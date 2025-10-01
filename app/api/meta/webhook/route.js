//app/api/meta/webhook/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

async function getMetaObjectName(objectId, accessToken) {
    if (!objectId || !accessToken) return null;
    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) return data.name || null;
        console.error(`LOG: AVISO - Falha ao buscar nome para o ID ${objectId}:`, data.error?.message);
        return null;
    } catch (error) {
        console.error(`LOG: ERRO - Erro de rede ao buscar nome para o ID ${objectId}:`, error);
        return null;
    }
}

async function getOrganizationIdByPageId(supabase, pageId, accessToken) {
    if (!accessToken) throw new Error("[DETETIVE] Token de Acesso à Página não fornecido.");

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${accessToken}`;
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();
    if (!metaResponse.ok) throw new Error(`[DETETIVE] Falha ao buscar dados da página na Meta: ${metaData.error?.message || 'Erro desconhecido'}`);
    
    const metaBusinessId = metaData.business?.id;
    if (!metaBusinessId) throw new Error(`[DETETIVE] A página com ID ${pageId} não está associada a um Gerenciador de Negócios.`);

    const { data: empresa, error } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_business_id', metaBusinessId).single();
    if (error || !empresa) throw new Error(`[DETETIVE] Nenhuma empresa no sistema foi encontrada com o Meta Business ID: ${metaBusinessId}.`);
    
    return empresa.organizacao_id;
}

async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    let { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();

    if (!funil) {
        const { data: newFunil, error: funilCreateError } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
        if (funilCreateError) throw new Error(`Erro ao criar funil: ${funilCreateError.message}`);
        funil = newFunil;
    }

    let { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();

    if (!primeiraColuna) {
        const { data: newColuna, error: colunaCreateError } = await supabase.from('colunas_funil').insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId }).select('id').single();
        if (colunaCreateError) throw new Error(`Erro ao criar coluna: ${colunaCreateError.message}`);
        primeiraColuna = newColuna;
    }

    return primeiraColuna.id;
}

export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    } else {
        return new NextResponse(null, { status: 403 });
    }
}

export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook da Meta.");
    
    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração do servidor incompleta.' }), { status: 500 });
    }
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') {
            return new NextResponse(JSON.stringify({ status: 'not_a_leadgen_event' }), { status: 200 });
        }
        
        const { leadgen_id: leadId, page_id: pageId, campaign_id: campaignId, ad_id: adId } = change.value;

        if (!leadId || !pageId || !campaignId || !adId) {
             throw new Error("Dados essenciais do lead (leadId, pageId, campaignId, adId) estão faltando no payload.");
        }

        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) {
            return new NextResponse(JSON.stringify({ status: 'lead_already_exists' }), { status: 200 });
        }
        
        // =================================================================================
        // OTIMIZAÇÃO DE PERFORMANCE: Executando buscas em paralelo
        // O PORQUÊ: As três buscas abaixo são independentes. Executá-las ao mesmo
        // tempo com Promise.all é muito mais rápido do que uma após a outra,
        // o que ajuda a evitar o timeout do servidor.
        // =================================================================================
        console.log("LOG: Iniciando buscas paralelas por organização, nome da campanha e nome do anúncio...");
        const [organizacaoId, campaignName, adName] = await Promise.all([
            getOrganizationIdByPageId(supabase, pageId, PAGE_ACCESS_TOKEN),
            getMetaObjectName(campaignId, PAGE_ACCESS_TOKEN),
            getMetaObjectName(adId, PAGE_ACCESS_TOKEN)
        ]);
        console.log(`LOG: Buscas paralelas concluídas. OrgID: ${organizacaoId}, Campanha: '${campaignName}', Anúncio: '${adName}'`);


        await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }, { onConflict: 'id' }).throwOnError();
        await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, organizacao_id: organizacaoId }, { onConflict: 'id' }).throwOnError();

        let leadDetails;
        if (leadId.startsWith('TEST_')) {
            leadDetails = {
                field_data: [{ name: "full_name", values: ["João da Silva (Teste)"] }, { name: "email", values: [`teste_${Date.now()}@studio57.com.br`] }, { name: "phone_number", values: ["+5533999998888"] }]
            };
        } else {
            const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${PAGE_ACCESS_TOKEN}`);
            const apiResult = await leadDetailsResponse.json();
            if (!leadDetailsResponse.ok) throw new Error(apiResult.error?.message || "Falha ao buscar dados do lead no Meta.");
            leadDetails = apiResult;
        }

        const allLeadData = {};
        leadDetails.field_data.forEach(field => { allLeadData[field.name] = field.values[0]; });
        
        const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
            nome: allLeadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`,
            origem: 'Meta Lead Ad',
            tipo_contato: 'Lead',
            personalidade_juridica: 'Pessoa Física',
            organizacao_id: organizacaoId,
            meta_lead_id: leadId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_adgroup_id: change.value.adgroup_id,
            meta_page_id: pageId,
            meta_form_id: change.value.form_id,
            meta_created_time: new Date(change.value.created_time * 1000).toISOString(),
            meta_form_data: allLeadData,
            meta_ad_name: adName,
            meta_campaign_name: campaignName
        }).select('id').single();

        if (contactError) throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
            
        const contatoId = newContact.id;
        contatoIdParaLimpeza = contatoId;
        console.log(`LOG: Novo contato criado com ID: ${contatoId}`);

        if (allLeadData.email) await supabase.from('emails').insert({ contato_id: contatoId, email: allLeadData.email, tipo: 'Principal', organizacao_id: organizacaoId });
        if (allLeadData.phone_number) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: allLeadData.phone_number.replace(/\D/g, ''), tipo: 'Celular', organizacao_id: organizacaoId });
        
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        
        await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColunaId, organizacao_id: organizacaoId }).throwOnError();
        
        console.log('LOG: SUCESSO! Contato adicionado ao funil!');
        
        fetch(`${request.nextUrl.origin}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: '🎉 Novo Lead Recebido!',
                message: `Um novo lead (${allLeadData.full_name}) chegou da Meta.`,
                url: '/crm',
                organizacao_id: organizacaoId
            })
        }).catch(err => console.error("Falha ao disparar notificação de novo lead:", err));

        return new NextResponse(JSON.stringify({ status: 'success' }), { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e.message);
        
        if (contatoIdParaLimpeza) {
            console.log(`LOG: [LIMPEZA] Tentando remover o contato órfão com ID: ${contatoIdParaLimpeza}`);
            await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        }
        
        // IMPORTANTE: Responder 500 para que o erro seja visível na ferramenta da Meta
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 500 });
    }
}
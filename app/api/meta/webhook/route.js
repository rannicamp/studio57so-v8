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

// =================================================================================
// LÓGICA RESTAURADA (DO CÓDIGO ANTIGO E FUNCIONAL)
// O PORQUÊ: Esta função agora busca o token diretamente do 'process.env',
// tornando-a autossuficiente e eliminando o ponto de falha de passar o
// token como parâmetro.
// =================================================================================
async function getMetaObjectName(objectId) {
    if (!objectId) return null;
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_ACCESS_TOKEN) {
        console.error("LOG: ERRO em getMetaObjectName - META_PAGE_ACCESS_TOKEN não encontrado.");
        return null;
    }

    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`;
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) {
            console.log(`LOG: Nome encontrado para ID ${objectId}: ${data.name}`);
            return data.name || null;
        }
        console.error(`LOG: AVISO - Falha ao buscar nome para o ID ${objectId}:`, data.error?.message);
        return null;
    } catch (error) {
        console.error(`LOG: ERRO - Erro de rede ao buscar nome para o ID ${objectId}:`, error);
        return null;
    }
}

async function getOrganizationIdByPageId(supabase, pageId) {
    console.log(`LOG: [DETETIVE] Iniciando investigação para a página ID: ${pageId}`);
    
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_ACCESS_TOKEN) {
        throw new Error("[DETETIVE] Token de Acesso à Página (META_PAGE_ACCESS_TOKEN) não configurado no servidor.");
    }

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${PAGE_ACCESS_TOKEN}`;
    console.log(`LOG: [DETETIVE] Consultando a Meta para descobrir o 'dono' da página...`);

    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
        throw new Error(`[DETETIVE] Falha ao buscar dados da página na Meta: ${metaData.error?.message || 'Erro desconhecido'}`);
    }

    const metaBusinessId = metaData.business?.id;
    if (!metaBusinessId) {
        throw new Error(`[DETETIVE] A página com ID ${pageId} não está associada a um Gerenciador de Negócios. Verifique a configuração na Meta.`);
    }
    console.log(`LOG: [DETETIVE] Dono encontrado! Meta Business ID: ${metaBusinessId}`);

    const { data: empresa, error } = await supabase
        .from('cadastro_empresa')
        .select('organizacao_id')
        .eq('meta_business_id', metaBusinessId)
        .single();

    if (error || !empresa) {
        console.error(`[DETETIVE] ERRO ao buscar empresa com Meta Business ID ${metaBusinessId}.`, error);
        throw new Error(`[DETETIVE] Nenhuma empresa no seu sistema foi encontrada com o Meta Business ID: ${metaBusinessId}. Verifique se o ID está cadastrado corretamente na tela de "Minha Empresa".`);
    }

    console.log(`LOG: [DETETIVE] Caso resolvido! Organização ID: ${empresa.organizacao_id}`);
    return empresa.organizacao_id;
}


async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    console.log(`LOG: Verificando funil e coluna para a organização ID: ${organizacaoId}`);

    let { data: funil, error: funilFindError } = await supabase
        .from('funis')
        .select('id')
        .eq('nome', 'Funil de Vendas')
        .eq('organizacao_id', organizacaoId)
        .single();

    if (funilFindError && funilFindError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar funil: ${funilFindError.message}`);
    }

    if (!funil) {
        console.log(`LOG: Funil de Vendas não encontrado para org ${organizacaoId}. Criando um novo...`);
        const { data: newFunil, error: funilCreateError } = await supabase
            .from('funis')
            .insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (funilCreateError) throw new Error(`Erro ao criar funil: ${funilCreateError.message}`);
        funil = newFunil;
        console.log(`LOG: Funil criado com ID: ${funil.id} para org ${organizacaoId}`);
    }

    let { data: primeiraColuna, error: colunaFindError } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('funil_id', funil.id)
        .order('ordem', { ascending: true })
        .limit(1)
        .single();

    if (colunaFindError && colunaFindError.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar coluna: ${colunaFindError.message}`);
    }

    if (!primeiraColuna) {
        console.log("LOG: Primeira coluna do funil não encontrada. Criando 'Novos Leads'...");
        const { data: newColuna, error: colunaCreateError } = await supabase
            .from('colunas_funil')
            .insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId })
            .select('id')
            .single();
        if (colunaCreateError) throw new Error(`Erro ao criar coluna: ${colunaCreateError.message}`);
        primeiraColuna = newColuna;
        console.log(`LOG: Coluna criada com ID: ${primeiraColuna.id}`);
    }

    return primeiraColuna.id;
}

export async function GET(request) {
    console.log("LOG: Recebida requisição GET para verificação do webhook.");
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("LOG: Verificação do webhook BEM-SUCEDIDA.");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("LOG: FALHA na verificação do webhook. Token recebido:", token, "Token esperado:", META_VERIFY_TOKEN);
        return new NextResponse(null, { status: 403 });
    }
}

export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook da Meta.");
    
    const supabase = getSupabaseAdmin();
    const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (!supabase || !PAGE_ACCESS_TOKEN) {
        return NextResponse.json({ status: 'error', message: 'Configuração do servidor (Supabase ou Meta Token) está incompleta.' }, { status: 500 });
    }
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        console.log('LOG: Corpo da requisição completo:', JSON.stringify(body, null, 2));

        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') {
            console.log(`LOG: Ignorando evento, não é 'leadgen'. Campo recebido: ${change?.field}`);
            return NextResponse.json({ status: 'not_a_leadgen_event' }, { status: 200 });
        }
        
        const leadValue = change.value;
        const leadId = leadValue.leadgen_id;
        const pageId = leadValue.page_id;
        const campaignId = leadValue.campaign_id;
        const adId = leadValue.ad_id;

        if (!leadId || !pageId || !campaignId || !adId) {
             console.error("LOG: ERRO CRÍTICO - O evento de Lead não continha 'leadgen_id', 'page_id', 'campaign_id' ou 'ad_id'.");
             return NextResponse.json({ status: 'error', message: "Dados do lead incompletos no payload da Meta." }, { status: 400 });
        }

        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) {
            console.log(`LOG: Lead com ID ${leadId} já existe. Ignorando.`);
            return NextResponse.json({ status: 'lead_already_exists' }, { status: 200 });
        }
        
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        
        const adName = await getMetaObjectName(adId);
        const campaignName = await getMetaObjectName(campaignId);
        console.log(`LOG: Nomes encontrados -> Anúncio: '${adName}', Campanha: '${campaignName}'`);

        const { error: campaignUpsertError } = await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }, { onConflict: 'id' });
        if (campaignUpsertError) throw new Error(`Falha ao registrar campanha: ${campaignUpsertError.message}`);

        const { error: adUpsertError } = await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, organizacao_id: organizacaoId }, { onConflict: 'id' });
        if (adUpsertError) throw new Error(`Falha ao registrar anúncio: ${adUpsertError.message}`);

        let leadDetails;
        if (leadId.startsWith('TEST_')) {
            leadDetails = {
                field_data: [
                    { name: "full_name", values: ["João da Silva (Teste)"] },
                    { name: "email", values: [`teste_${Date.now()}@studio57.com.br`] },
                    { name: "phone_number", values: ["+5533999998888"] },
                ]
            };
        } else {
            const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${PAGE_ACCESS_TOKEN}`);
            const apiResult = await leadDetailsResponse.json();
            if (!leadDetailsResponse.ok) throw new Error(apiResult.error?.message || "Falha ao buscar dados do lead no Meta.");
            leadDetails = apiResult;
        }

        const allLeadData = {};
        leadDetails.field_data.forEach(field => { allLeadData[field.name] = field.values[0]; });
        
        const nomeCompleto = allLeadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const email = allLeadData.email;
        const telefoneLimpo = allLeadData.phone_number?.replace(/\D/g, '');
        
        const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
            nome: nomeCompleto,
            origem: 'Meta Lead Ad',
            tipo_contato: 'Lead',
            personalidade_juridica: 'Pessoa Física',
            organizacao_id: organizacaoId,
            meta_lead_id: leadId,
            meta_ad_id: adId,
            meta_campaign_id: campaignId,
            meta_adgroup_id: leadValue.adgroup_id,
            meta_page_id: pageId,
            meta_form_id: leadValue.form_id,
            meta_created_time: new Date(leadValue.created_time * 1000).toISOString(),
            meta_form_data: allLeadData,
            meta_ad_name: adName,
            meta_campaign_name: campaignName
        }).select('id').single();

        if (contactError) throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
            
        const contatoId = newContact.id;
        contatoIdParaLimpeza = contatoId;
        console.log(`LOG: Novo contato criado com ID: ${contatoId}`);

        if (email) await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal', organizacao_id: organizacaoId });
        if (telefoneLimpo) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular', organizacao_id: organizacaoId });
        
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        
        const { error: funilError } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColunaId, organizacao_id: organizacaoId });
            
        if (funilError) throw new Error(`Falha ao adicionar o contato ao funil: ${funilError.message}`);
        
        console.log('LOG: SUCESSO! Contato adicionado ao funil!');
        
        fetch(`${request.nextUrl.origin}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: '🎉 Novo Lead Recebido!',
                message: `Um novo lead (${nomeCompleto}) chegou da Meta.`,
                url: '/crm',
                organizacao_id: organizacaoId
            })
        }).catch(err => console.error("Falha ao disparar notificação de novo lead:", err));

        console.log("LOG: [FIM] Processamento do webhook concluído com sucesso.");
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e.message);
        
        if (contatoIdParaLimpeza) {
            console.log(`LOG: [LIMPEZA] Tentando remover o contato órfão com ID: ${contatoIdParaLimpeza}`);
            await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        }

        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 }); 
    }
}
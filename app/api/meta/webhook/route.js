//app/api/meta/webhook/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para obter o cliente Supabase Admin
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !supabaseKey) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }
    return createClient(supabaseUrl, supabaseKey);
};

// Função autossuficiente para buscar nomes de objetos na Meta
async function getMetaObjectName(objectId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!objectId || !accessToken) {
        console.warn(`LOG: Aviso em getMetaObjectName - objectId ou accessToken faltando.`);
        return null;
    }
    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) return data.name || null;
        console.error(`LOG: Falha ao buscar nome para ID ${objectId}:`, data.error?.message);
        return null;
    } catch (error) {
        console.error(`LOG: Erro de rede ao buscar nome para ID ${objectId}:`, error);
        return null;
    }
}

// Função autossuficiente para encontrar a organização
async function getOrganizationIdByPageId(supabase, pageId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) throw new Error("[DETETIVE] Token de Acesso à Página não configurado.");

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${accessToken}`;
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();
    if (!metaResponse.ok) throw new Error(`[DETETIVE] Falha ao consultar API da Meta: ${metaData.error?.message}`);
    
    const metaBusinessId = metaData.business?.id;
    if (!metaBusinessId) throw new Error(`[DETETIVE] A página ${pageId} não pertence a um Gerenciador de Negócios.`);

    const { data: empresa, error } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_business_id', metaBusinessId).single();
    if (error || !empresa) throw new Error(`[DETETIVE] Nenhuma empresa no sistema encontrada com o Meta Business ID: ${metaBusinessId}. Verifique o cadastro.`);
    
    return empresa.organizacao_id;
}

// Função para garantir que o funil e a primeira coluna existam
async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    let { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (!funil) {
        const { data: newFunil, error } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
        if (error) throw new Error(`Erro ao criar funil: ${error.message}`);
        funil = newFunil;
    }
    let { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
    if (!primeiraColuna) {
        const { data: newColuna, error } = await supabase.from('colunas_funil').insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId }).select('id').single();
        if (error) throw new Error(`Erro ao criar coluna: ${error.message}`);
        primeiraColuna = newColuna;
    }
    return primeiraColuna.id;
}

// Rota GET para verificação do Webhook
export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const [mode, token, challenge] = [searchParams.get('hub.mode'), searchParams.get('hub.verify_token'), searchParams.get('hub.challenge')];
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("LOG: Verificação do webhook BEM-SUCEDIDA.");
        return new NextResponse(challenge, { status: 200 });
    }
    console.error("LOG: FALHA na verificação do webhook.");
    return new NextResponse(null, { status: 403 });
}

// Rota POST para receber os leads
export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook.");
    
    const supabase = getSupabaseAdmin();
    if (!supabase || !process.env.META_PAGE_ACCESS_TOKEN) {
        console.error("LOG: ERRO CRÍTICO - Configuração do servidor (Supabase/Meta Token) incompleta.");
        return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração do servidor incompleta.' }), { status: 200 });
    }
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') {
            console.log("LOG: Ignorando evento não-leadgen.");
            return new NextResponse(JSON.stringify({ status: 'not_a_leadgen_event' }), { status: 200 });
        }
        
        const { leadgen_id: leadId, page_id: pageId, campaign_id: campaignId, ad_id: adId } = change.value;
        if (!leadId || !pageId || !campaignId || !adId) throw new Error("Payload do lead incompleto (faltando IDs essenciais).");

        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) {
            console.log(`LOG: Lead ${leadId} já existe. Ignorando.`);
            return new NextResponse(JSON.stringify({ status: 'lead_already_exists' }), { status: 200 });
        }
        
        // --- EXECUÇÃO SEQUENCIAL E SEGURA ---
        console.log(`LOG: Passo 1 - Identificando organização para a página ${pageId}...`);
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        console.log(`LOG: Organização encontrada: ${organizacaoId}`);

        console.log(`LOG: Passo 2 - Buscando nome da campanha ${campaignId}...`);
        const campaignName = await getMetaObjectName(campaignId);

        console.log(`LOG: Passo 3 - Buscando nome do anúncio ${adId}...`);
        const adName = await getMetaObjectName(adId);
        console.log(`LOG: Nomes encontrados -> Campanha: '${campaignName}', Anúncio: '${adName}'`);

        // --- Fim da execução sequencial ---

        await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }).throwOnError();
        await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, organizacao_id: organizacaoId }).throwOnError();

        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();
        if (!leadDetailsResponse.ok) throw new Error(leadDetails.error?.message || "Falha ao buscar detalhes do lead.");

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

        if (contactError) throw new Error(`Erro ao criar contato: ${contactError.message}`);
        
        contatoIdParaLimpeza = newContact.id;
        console.log(`LOG: Contato criado com ID: ${contatoIdParaLimpeza}`);

        if (allLeadData.email) await supabase.from('emails').insert({ contato_id: contatoIdParaLimpeza, email: allLeadData.email, tipo: 'Principal', organizacao_id: organizacaoId });
        if (allLeadData.phone_number) await supabase.from('telefones').insert({ contato_id: contatoIdParaLimpeza, telefone: allLeadData.phone_number.replace(/\D/g, ''), tipo: 'Celular', organizacao_id: organizacaoId });
        
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        await supabase.from('contatos_no_funil').insert({ contato_id: contatoIdParaLimpeza, coluna_id: primeiraColunaId, organizacao_id: organizacaoId }).throwOnError();
        
        console.log('LOG: SUCESSO! Contato adicionado ao funil!');
        
        // Dispara notificação sem esperar (não bloqueia a resposta para a Meta)
        fetch(`${request.nextUrl.origin}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: '🎉 Novo Lead Recebido!', message: `Lead (${allLeadData.full_name}) da Meta.`, url: '/crm', organizacao_id: organizacaoId })
        }).catch(err => console.error("Falha ao disparar notificação:", err));

        return new NextResponse(JSON.stringify({ status: 'success' }), { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL NO WEBHOOK] Processo interrompido:', e.message);
        if (contatoIdParaLimpeza) {
            console.log(`LOG: [LIMPEZA] Removendo contato órfão ID: ${contatoIdParaLimpeza}`);
            await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        }
        // Respondemos 200 para a Meta não tentar de novo, pois o erro foi logado.
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 200 }); 
    }
}
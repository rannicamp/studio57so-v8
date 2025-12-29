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

// --- FUNÇÕES AUXILIARES ---

// Helper de Padronização de Telefone
function sanitizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Lógica do Porteiro (Gatekeeper):
    // Se tiver 10 ou 11 dígitos, assumimos que é Brasil sem DDI -> Adiciona 55
    if (clean.length === 10 || clean.length === 11) {
        // Proteção simples contra números EUA que começam com 1
        // Se começar com 1 e tiver 11 digitos, verificamos o terceiro digito (SP/RJ tem 9)
        // Se for 1 + DDD + numero (EUA), o terceiro digito raramente é 9.
        if (clean.startsWith('1') && clean.length === 11 && clean[2] !== '9') {
             // Provavel EUA, mantém (Ex: 1 508 ... )
        } else {
             clean = '55' + clean;
        }
    }
    return clean;
}

async function getMetaObjectName(objectId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!objectId || !accessToken) return null;
    try {
        const url = `https://graph.facebook.com/v20.0/${objectId}?fields=name&access_token=${accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) return data.name || null;
        return null;
    } catch (error) {
        return null;
    }
}

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
    if (error || !empresa) throw new Error(`[DETETIVE] Nenhuma empresa no sistema encontrada com o Meta Business ID: ${metaBusinessId}.`);
    
    return empresa.organizacao_id;
}

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

async function getEquipeComercial(supabase, organizacaoId) {
    const { data: funcoes } = await supabase.from('funcoes').select('id').in('nome_funcao', ['Proprietário', 'Proprietario', 'Comercial']).eq('organizacao_id', organizacaoId); 
    if (!funcoes?.length) return [];
    const funcoesIds = funcoes.map(f => f.id);
    const { data: users } = await supabase.from('usuarios').select('id').in('funcao_id', funcoesIds).eq('organizacao_id', organizacaoId);
    return users || [];
}

// --- FIM AUXILIARES ---

export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const [mode, token, challenge] = [searchParams.get('hub.mode'), searchParams.get('hub.verify_token'), searchParams.get('hub.challenge')];
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook.");
    
    const supabase = getSupabaseAdmin();
    if (!supabase || !process.env.META_PAGE_ACCESS_TOKEN) return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração incompleta.' }), { status: 200 });
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') return new NextResponse(JSON.stringify({ status: 'not_a_leadgen_event' }), { status: 200 });
        
        const { leadgen_id: leadId, page_id: pageId, campaign_id: campaignId, ad_id: adId, adgroup_id: adsetId } = change.value;

        if (!leadId || !pageId) throw new Error("Payload do lead incompleto.");
        
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) return new NextResponse(JSON.stringify({ status: 'lead_already_exists' }), { status: 200 });
        
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        
        let campaignName = null, adsetName = null, adName = null;

        if (campaignId) {
            campaignName = await getMetaObjectName(campaignId);
            await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId }).throwOnError();
        }
        if (adsetId) {
            adsetName = await getMetaObjectName(adsetId);
            if (campaignId) await supabase.from('meta_adsets').upsert({ id: adsetId, name: adsetName, campaign_id: campaignId, organizacao_id: organizacaoId }).throwOnError();
        }
        if (adId) {
            adName = await getMetaObjectName(adId);
            if (campaignId && adsetId) await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, adset_id: adsetId, organizacao_id: organizacaoId }).throwOnError();
        }

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
            meta_adgroup_id: adsetId,
            meta_page_id: pageId,
            meta_form_id: change.value.form_id,
            meta_created_time: new Date(change.value.created_time * 1000).toISOString(),
            meta_form_data: allLeadData,
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            meta_adset_name: adsetName
        }).select('id').single();

        if (contactError) throw new Error(`Erro ao criar contato: ${contactError.message}`);
        
        contatoIdParaLimpeza = newContact.id;

        if (allLeadData.email) await supabase.from('emails').insert({ contato_id: contatoIdParaLimpeza, email: allLeadData.email, tipo: 'Principal', organizacao_id: organizacaoId });
        
        // --- AQUI A CORREÇÃO: Usamos sanitizePhone ---
        if (allLeadData.phone_number) {
            const finalPhone = sanitizePhone(allLeadData.phone_number);
            if (finalPhone) {
                await supabase.from('telefones').insert({ contato_id: contatoIdParaLimpeza, telefone: finalPhone, tipo: 'Celular', organizacao_id: organizacaoId });
            }
        }
        
        const primeiraColunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        await supabase.from('contatos_no_funil').insert({ contato_id: contatoIdParaLimpeza, coluna_id: primeiraColunaId, organizacao_id: organizacaoId }).throwOnError();
        
        try {
            const equipeComercial = await getEquipeComercial(supabase, organizacaoId);
            if (equipeComercial.length > 0) {
                const notificacoes = equipeComercial.map(usuario => ({
                    user_id: usuario.id,
                    titulo: '🚀 Novo Lead Chegou!',
                    mensagem: `Oportunidade: ${allLeadData.full_name} veio pelo anúncio "${adName || 'Desconhecido'}". Corre lá!`,
                    link: `/crm`,
                    tipo: 'sucesso',
                    organizacao_id: organizacaoId,
                    lida: false,
                    created_at: new Date().toISOString()
                }));
                await supabase.from('notificacoes').insert(notificacoes);
            }
        } catch (notifErr) { console.error('Erro notificação:', notifErr); }

        return new NextResponse(JSON.stringify({ status: 'success' }), { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO WEBHOOK]', e.message);
        if (contatoIdParaLimpeza) await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 200 }); 
    }
}
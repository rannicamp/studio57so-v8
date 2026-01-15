import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Admin para operações de background
const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY; 
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
    });
};

// --- FUNÇÕES AUXILIARES ---

function sanitizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, ''); 
    if (clean.length === 10 || clean.length === 11) {
        if (clean.startsWith('1') && clean.length === 11 && clean[2] !== '9') {
             // Provavel EUA, mantém
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
        return response.ok ? data.name : null;
    } catch (error) {
        return null;
    }
}

async function getOrganizationIdByPageId(supabase, pageId) {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Token Meta não configurado.");

    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=business&access_token=${accessToken}`;
    const metaResponse = await fetch(url);
    const metaData = await metaResponse.json();
    
    if (!metaData.business?.id) throw new Error(`Página ${pageId} sem Business Manager vinculado.`);

    const { data: empresa } = await supabase.from('cadastro_empresa').select('organizacao_id').eq('meta_business_id', metaData.business.id).single();
    if (!empresa) throw new Error(`Business ID ${metaData.business.id} não encontrado no sistema.`);
    
    return empresa.organizacao_id;
}

async function ensureFunilAndFirstColumn(supabase, organizacaoId) {
    let { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').eq('organizacao_id', organizacaoId).single();
    if (!funil) {
        const { data: newFunil } = await supabase.from('funis').insert({ nome: 'Funil de Vendas', organizacao_id: organizacaoId }).select('id').single();
        funil = newFunil;
    }
    let { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
    if (!primeiraColuna) {
        const { data: newColuna } = await supabase.from('colunas_funil').insert({ funil_id: funil.id, nome: 'Novos Leads', ordem: 0, organizacao_id: organizacaoId }).select('id').single();
        primeiraColuna = newColuna;
    }
    return primeiraColuna.id;
}

// --- ROTAS ---

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('hub.mode') === 'subscribe' && searchParams.get('hub.verify_token') === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

export async function POST(request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) return new NextResponse(JSON.stringify({ status: 'error', message: 'Configuração incompleta.' }), { status: 500 });
    
    let contatoIdParaLimpeza = null;

    try {
        const body = await request.json();
        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') return new NextResponse(JSON.stringify({ status: 'ignored' }), { status: 200 });
        
        const { leadgen_id: leadId, page_id: pageId, campaign_id: campaignId, ad_id: adId, adgroup_id: adsetId } = change.value;
        
        // Verifica duplicidade
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();
        if (existingLead) return new NextResponse(JSON.stringify({ status: 'lead_exists' }), { status: 200 });
        
        const organizacaoId = await getOrganizationIdByPageId(supabase, pageId);
        
        // Sincroniza metadados (Campanha, Adset, Ad)
        let campaignName = null, adsetName = null, adName = null;
        if (campaignId) {
            campaignName = await getMetaObjectName(campaignId);
            await supabase.from('meta_campaigns').upsert({ id: campaignId, name: campaignName, organizacao_id: organizacaoId });
        }
        if (adsetId) {
            adsetName = await getMetaObjectName(adsetId);
            await supabase.from('meta_adsets').upsert({ id: adsetId, name: adsetName, campaign_id: campaignId, organizacao_id: organizacaoId });
        }
        if (adId) {
            adName = await getMetaObjectName(adId);
            await supabase.from('meta_ads').upsert({ id: adId, name: adName, campaign_id: campaignId, adset_id: adsetId, organizacao_id: organizacaoId });
        }

        // Busca dados do Lead na API Graph
        const leadRes = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${process.env.META_PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadRes.json();
        if (!leadRes.ok) throw new Error(leadDetails.error?.message || "Erro ao buscar lead");

        const formMap = {};
        leadDetails.field_data.forEach(f => { formMap[f.name] = f.values[0]; });
        
        const nomeLead = formMap.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;

        // Cria o Contato
        const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
            nome: nomeLead,
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
            meta_form_data: formMap,
            meta_ad_name: adName,
            meta_campaign_name: campaignName,
            meta_adset_name: adsetName
        }).select('id').single();

        if (contactError) throw new Error(contactError.message);
        contatoIdParaLimpeza = newContact.id;

        // Salva Email e Telefone
        if (formMap.email) await supabase.from('emails').insert({ contato_id: newContact.id, email: formMap.email, tipo: 'Principal', organizacao_id: organizacaoId });
        
        if (formMap.phone_number) {
            const finalPhone = sanitizePhone(formMap.phone_number);
            if (finalPhone) {
                // Trigger do banco vai vincular conversas automaticamente
                await supabase.from('telefones').insert({ contato_id: newContact.id, telefone: finalPhone, tipo: 'Celular', organizacao_id: organizacaoId });
            }
        }
        
        // Coloca no Funil
        // A Trigger do banco vai detectar este INSERT e enviar a notificação automaticamente!
        const colunaId = await ensureFunilAndFirstColumn(supabase, organizacaoId);
        await supabase.from('contatos_no_funil').insert({ contato_id: newContact.id, coluna_id: colunaId, organizacao_id: organizacaoId });
        
        console.log(`LOG: Novo Lead processado via Webhook. ID: ${newContact.id}`);

        return new NextResponse(JSON.stringify({ status: 'success' }), { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO WEBHOOK]', e.message);
        if (contatoIdParaLimpeza) await supabase.from('contatos').delete().eq('id', contatoIdParaLimpeza);
        return new NextResponse(JSON.stringify({ status: 'error', message: e.message }), { status: 200 }); 
    }
}
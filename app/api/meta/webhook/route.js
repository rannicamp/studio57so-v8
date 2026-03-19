import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Admin (Service Role) — Necessário para operações server-side
const getSupabaseAdmin = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return null;
    return createClient(url, key, { auth: { persistSession: false } });
};

// --- FUNÇÕES AUXILIARES ---

function sanitizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10 || clean.length === 11) {
        if (!(clean.startsWith('1') && clean.length === 11 && clean[2] !== '9')) {
            clean = '55' + clean;
        }
    }
    return clean || null;
}

/**
 * Busca a coluna ENTRADA do Funil de Entrada da organizacao.
 * Estrategia em cascata:
 * 1. Funil com is_sistema=true  (banco atualizado)
 * 2. Fallback: qualquer coluna tipo_coluna='entrada' da org (banco legado)
 */
async function getOrgEntryColumnId(supabase, orgId) {
    // TENTATIVA 1: Funil com is_sistema=true
    const { data: funilSistema } = await supabase
        .from('funis')
        .select('id')
        .eq('organizacao_id', orgId)
        .eq('is_sistema', true)
        .maybeSingle();

    if (funilSistema) {
        const { data: coluna } = await supabase
            .from('colunas_funil')
            .select('id')
            .eq('funil_id', funilSistema.id)
            .eq('tipo_coluna', 'entrada')
            .maybeSingle();
        if (coluna) {
            console.log(`[Org ${orgId}] ENTRADA via Funil de Entrada (is_sistema=true), coluna id=${coluna.id}`);
            return coluna.id;
        }
    }

    // FALLBACK: qualquer coluna tipo_coluna='entrada' desta org
    const { data: fallback } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('organizacao_id', orgId)
        .eq('tipo_coluna', 'entrada')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (fallback) {
        console.warn(`[Org ${orgId}] Fallback: usando coluna ENTRADA por tipo_coluna, id=${fallback.id}.`);
        return fallback.id;
    }

    console.error(`[Org ${orgId}] ERRO: Nenhuma coluna ENTRADA encontrada.`);
    return null;
}

// --- VERIFICACAO DO WEBHOOK (Meta valida a URL) ---
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    if (
        searchParams.get('hub.mode') === 'subscribe' &&
        searchParams.get('hub.verify_token') === process.env.META_VERIFY_TOKEN
    ) {
        return new NextResponse(searchParams.get('hub.challenge'), { status: 200 });
    }
    return new NextResponse(null, { status: 403 });
}

// --- RECEBIMENTO DE LEADS ---
export async function POST(request) {
    // Le o body ANTES de disparar o processamento async.
    // No Next.js App Router, request.body so pode ser lido UMA vez.
    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    // Responde 200 imediatamente para o Meta nao marcar como "rejected"
    processWebhook(body).catch(err =>
        console.error('[WEBHOOK] Erro no processamento assincrono:', err.message)
    );
    return NextResponse.json({ status: 'received' }, { status: 200 });
}

async function processWebhook(body) {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error('Supabase Admin nao configurado.');

    const change = body.entry?.[0]?.changes?.[0];

    if (change?.field !== 'leadgen') {
        console.log('[WEBHOOK] Evento ignorado (nao e leadgen):', change?.field);
        return;
    }

    const { leadgen_id: leadId, page_id: pageId } = change.value;
    console.log(`[WEBHOOK] Lead recebido: leadId=${leadId}, pageId=${pageId}`);

    // PASSO 1: Descobrir quais organizacoes tem esta pagina integrada
    const { data: integracoes, error: intError } = await supabase
        .from('integracoes_meta')
        .select('organizacao_id, access_token')
        .eq('page_id', pageId);

    if (intError || !integracoes || integracoes.length === 0) {
        console.error(`[WEBHOOK] Pagina ${pageId} sem integracao no sistema. Lead descartado.`);
        return;
    }

    // PASSO 2: Buscar dados completos do lead na API do Meta
    const pageAccessToken = integracoes[0].access_token;
    const leadFields = 'id,field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,is_organic,platform';
    const apiUrl = `https://graph.facebook.com/v20.0/${leadId}?fields=${leadFields}&access_token=${pageAccessToken}`;

    const leadRes = await fetch(apiUrl);
    const leadDetails = await leadRes.json();

    if (leadDetails.error) {
        throw new Error(`[Meta API] ${leadDetails.error.message} (code: ${leadDetails.error.code})`);
    }

    // Monta mapa de campos do formulario
    const formMap = {};
    (leadDetails.field_data || []).forEach(f => { formMap[f.name] = f.values?.[0]; });

    const nomeLead = formMap.full_name || formMap.nome || 'Lead Meta';
    const emailLead = formMap.email || formMap.email_address;
    const phoneLead = formMap.phone_number || formMap.telefone;

    // PASSO 3: Salvar o lead para cada organizacao conectada
    for (const integracao of integracoes) {
        const orgId = integracao.organizacao_id;
        console.log(`[WEBHOOK] Processando para Org ${orgId}...`);

        // 3a. Encontra a coluna ENTRADA do Funil de Entrada desta org
        const colunaEntradaId = await getOrgEntryColumnId(supabase, orgId);
        if (!colunaEntradaId) {
            console.error(`[Org ${orgId}] Sem coluna ENTRADA. Lead ignorado.`);
            continue;
        }

        // 3b. Anti-duplicata: ID unico por org
        const uniqueLeadId = `${leadId}_${orgId}`;
        const { data: existingLead } = await supabase
            .from('contatos')
            .select('id')
            .eq('meta_lead_id', uniqueLeadId)
            .maybeSingle();

        if (existingLead) {
            console.log(`[Org ${orgId}] Lead ${uniqueLeadId} ja existia. Ignorado.`);
            continue;
        }

        // 3b-2. UPSERT Meta Ativos (O Cofre de Anúncios)
        if (leadDetails.campaign_id) {
            await supabase.from('meta_ativos').upsert({ id: leadDetails.campaign_id, organizacao_id: orgId, tipo: 'CAMPAIGN', nome: leadDetails.campaign_name || 'Desconhecido' }, { onConflict: 'id' });
        }
        if (leadDetails.adset_id) {
            await supabase.from('meta_ativos').upsert({ id: leadDetails.adset_id, organizacao_id: orgId, tipo: 'ADSET', nome: leadDetails.adset_name || 'Desconhecido' }, { onConflict: 'id' });
        }
        if (leadDetails.ad_id) {
            await supabase.from('meta_ativos').upsert({ id: leadDetails.ad_id, organizacao_id: orgId, tipo: 'AD', nome: leadDetails.ad_name || 'Desconhecido' }, { onConflict: 'id' });
        }

        // 3c. Cria o contato
        const { data: newContact, error: contactError } = await supabase
            .from('contatos')
            .insert({
                nome: nomeLead,
                origem: leadDetails.is_organic ? 'Meta Lead Organico' : 'Meta Lead Ad',
                tipo_contato: 'Lead',
                personalidade_juridica: 'Pessoa Fisica',
                organizacao_id: orgId,
                meta_lead_id: uniqueLeadId,
                meta_page_id: pageId,
                meta_campaign_id: leadDetails.campaign_id || null,
                meta_campaign_name: leadDetails.campaign_name || null,
                meta_adset_id: leadDetails.adset_id || null,
                meta_adset_name: leadDetails.adset_name || null,
                meta_ad_id: leadDetails.ad_id || null,
                meta_ad_name: leadDetails.ad_name || null,
                meta_form_data: formMap,
            })
            .select('id')
            .single();

        if (contactError) {
            console.error(`[Org ${orgId}] Erro ao criar contato:`, contactError.message);
            continue;
        }

        // 3d. Salva e-mail e telefone
        if (emailLead) {
            await supabase.from('emails').insert({ contato_id: newContact.id, email: emailLead, organizacao_id: orgId });
        }
        if (phoneLead) {
            const finalPhone = sanitizePhone(phoneLead);
            if (finalPhone) {
                await supabase.from('telefones').insert({ contato_id: newContact.id, telefone: finalPhone, organizacao_id: orgId });
            }
        }

        // 3e. Vincula ao Funil de Entrada -> coluna ENTRADA
        const { data: funilEntry, error: funilError } = await supabase
            .from('contatos_no_funil')
            .insert({ contato_id: newContact.id, coluna_id: colunaEntradaId, organizacao_id: orgId })
            .select('id')
            .single();

        if (funilError) {
            console.error(`[Org ${orgId}] Erro ao vincular ao funil:`, funilError.message);
            continue;
        }

        console.log(`[Org ${orgId}] OK: "${nomeLead}" entregue na coluna ENTRADA (id=${colunaEntradaId}).`);

        // 3f. AUTOMACAO DE ROTEAMENTO: verifica regras para mover para outro funil
        const { data: roteamentoResult, error: roteamentoError } = await supabase
            .rpc('fn_rotear_lead', { p_contato_no_funil_id: funilEntry.id });

        if (roteamentoError) {
            console.error(`[Org ${orgId}] Erro no roteamento automatico:`, roteamentoError.message);
        } else if (roteamentoResult === 'SEM_REGRA') {
            console.log(`[Org ${orgId}] Nenhuma regra aplicavel. Lead permanece no Funil de Entrada.`);
        } else {
            console.log(`[Org ${orgId}] ROTEADO! Resultado: ${roteamentoResult}`);
        }
    }
}
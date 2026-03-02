import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Admin (Service Role) - Necessário para rodar em background
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
            // Provavel EUA
        } else {
            clean = '55' + clean;
        }
    }
    return clean;
}

// Busca a coluna "ENTRADA" do SISTEMA (Org 1)
async function getSystemEntryColumn(supabase) {
    const SYSTEM_ORG_ID = 1;
    const { data: coluna } = await supabase
        .from('colunas_funil')
        .select('id')
        .eq('nome', 'ENTRADA')
        .eq('organizacao_id', SYSTEM_ORG_ID) // <--- ID DA ORGANIZAÇÃO DO SISTEMA
        .limit(1)
        .maybeSingle();

    if (!coluna) {
        console.error("ERRO CRÍTICO: Coluna 'ENTRADA' do sistema não encontrada.");
        return null;
    }
    return coluna.id;
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
    if (!supabase) return new NextResponse(JSON.stringify({ status: 'error' }), { status: 500 });

    try {
        const body = await request.json();
        const change = body.entry?.[0]?.changes?.[0];

        if (change?.field !== 'leadgen') return new NextResponse(JSON.stringify({ status: 'ignored' }), { status: 200 });

        const { leadgen_id: leadId, page_id: pageId } = change.value;

        // 🕵️‍♂️ INTELIGÊNCIA DO SISTEMA: Descobre TODAS as organizações conectadas a esta página
        const { data: integracoes, error: intError } = await supabase
            .from('integracoes_meta')
            .select('organizacao_id, access_token')
            .eq('page_id', pageId);

        if (intError || !integracoes || integracoes.length === 0) {
            console.error(`ERRO: Página ${pageId} desconhecida ou sem integração ativa.`);
            return NextResponse.json({ status: 'ignored_unknown_page' });
        }

        // Busca dados na Meta apenas UMA vez (economiza chamadas de API)
        // Usamos o token da primeira organização encontrada, pois ele tem acesso à página
        const urlParams = new URLSearchParams({
            fields: 'id,field_data,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,is_organic,platform',
            access_token: pageAccessToken
        });
        const leadRes = await fetch(`https://graph.facebook.com/v20.0/${leadId}?${urlParams.toString()}`);
        const leadDetails = await leadRes.json();

        if (leadDetails.error) throw new Error(leadDetails.error.message);

        // Mapeia os campos da resposta do Facebook
        const formMap = {};
        if (leadDetails.field_data) {
            leadDetails.field_data.forEach(f => { formMap[f.name] = f.values[0]; });
        }

        const nomeLead = formMap.full_name || formMap.nome || 'Lead Meta';
        const emailLead = formMap.email || formMap.email_address;
        const phoneLead = formMap.phone_number || formMap.telefone;

        // Pega o ID da nossa coluna mestre "ENTRADA"
        const systemColumnId = await getSystemEntryColumn(supabase);
        if (!systemColumnId) throw new Error("Coluna mestre 'ENTRADA' não encontrada no banco.");

        // 💾 O LAÇO DE MULTIPLICAÇÃO: Salva o contato para CADA organização da lista
        for (const integracao of integracoes) {
            const clienteOrgId = integracao.organizacao_id;

            // O "PULO DO GATO": Carimbamos a org no ID do lead para não quebrar a regra UNIQUE do banco
            const uniqueLeadId = `${leadId}_${clienteOrgId}`;

            // Verifica se este lead já foi salvo para ESTA organização especificamente
            const { data: existingLead } = await supabase
                .from('contatos')
                .select('id')
                .eq('meta_lead_id', uniqueLeadId)
                .maybeSingle();

            if (existingLead) {
                console.log(`Aviso: Lead já existe para a org ${clienteOrgId}, pulando...`);
                continue; // Vai para a próxima organização da lista
            }

            // Insere o contato
            const { data: newContact, error: contactError } = await supabase.from('contatos').insert({
                nome: nomeLead,
                origem: leadDetails.is_organic ? 'Meta Lead Orgânico' : 'Meta Lead Ad',
                tipo_contato: 'Lead',
                personalidade_juridica: 'Pessoa Física',
                organizacao_id: clienteOrgId, // <--- ID DO CLIENTE DO LOOP
                meta_lead_id: uniqueLeadId,   // <--- ID EXCLUSIVO PARA ESTE CLIENTE
                meta_page_id: pageId,
                meta_campaign_id: leadDetails.campaign_id || null,
                meta_campaign_name: leadDetails.campaign_name || null,
                meta_ad_id: leadDetails.ad_id || null,
                meta_ad_name: leadDetails.ad_name || null,
                meta_form_data: formMap
            }).select('id').single();

            if (contactError) {
                console.error(`Falha ao salvar lead para a Org ${clienteOrgId}:`, contactError.message);
                continue; // Se falhou pra um, não quebra o sistema, apenas tenta o próximo
            }

            // Salva Email e Telefone
            if (emailLead) await supabase.from('emails').insert({ contato_id: newContact.id, email: emailLead, organizacao_id: clienteOrgId });
            if (phoneLead) {
                const finalPhone = sanitizePhone(phoneLead);
                if (finalPhone) await supabase.from('telefones').insert({ contato_id: newContact.id, telefone: finalPhone, organizacao_id: clienteOrgId });
            }

            // 🎯 VINCULA AO FUNIL (Coluna do Sistema, Visível para o Cliente)
            await supabase.from('contatos_no_funil').insert({
                contato_id: newContact.id,
                coluna_id: systemColumnId,
                organizacao_id: clienteOrgId // <--- A permissão de visualização do cliente!
            });

            console.log(`SUCESSO: Lead ${newContact.id} criado para a Organização ${clienteOrgId} na Coluna Mestre.`);
        }

        return NextResponse.json({ status: 'success' });

    } catch (e) {
        console.error('ERRO GERAL WEBHOOK:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
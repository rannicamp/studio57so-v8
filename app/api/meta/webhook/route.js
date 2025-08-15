// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para criar um cliente Supabase
const getSupabaseAdmin = () => {
    // --- CORREÇÃO APLICADA AQUI ---
    // Padronizando para usar a SERVICE_ROLE_KEY, que é mais segura e apropriada para o servidor.
    console.log("LOG: Tentando criar cliente Supabase. URL existe:", !!process.env.NEXT_PUBLIC_SUPABASE_URL, "Service Key existe:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
};

// Rota GET para verificação (sem alterações)
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

// Rota POST para receber os leads (lógica interna sem alterações)
export async function POST(request) {
    console.log("LOG: [INÍCIO] Requisição POST recebida no webhook da Meta.");
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ status: 'error', message: 'Configuração do Supabase no servidor está incompleta.' }, { status: 500 });
    }
    
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

        if (!leadId) {
             console.error("LOG: ERRO CRÍTICO - O evento de Lead não continha um 'leadgen_id'.");
             throw new Error("O evento de Lead recebido não continha a identificação do lead (leadgen_id).");
        }

        console.log(`LOG: Buscando no DB por contato com meta_lead_id: ${leadId}`);
        const { data: existingLead } = await supabase.from('contatos').select('id').eq('meta_lead_id', leadId).single();

        if (existingLead) {
            console.log(`LOG: Lead com ID ${leadId} já existe no DB. Nenhuma ação necessária.`);
            return NextResponse.json({ status: 'lead_already_exists' }, { status: 200 });
        }
        
        console.log(`LOG: Lead ID ${leadId} é novo. Buscando detalhes na API da Meta...`);
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

        if (!PAGE_ACCESS_TOKEN) {
            console.error("LOG: ERRO CRÍTICO - Variável de ambiente META_PAGE_ACCESS_TOKEN não encontrada.");
            throw new Error("Token de Acesso à Página não configurado no servidor.");
        }

        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();

        if (!leadDetailsResponse.ok) {
            console.error("LOG: ERRO na API da Meta:", leadDetails);
            throw new Error(leadDetails.error?.message || "Falha ao buscar dados do lead no Meta.");
        }

        console.log("LOG: Detalhes do lead recebidos com sucesso.");
        const leadData = {};
        leadDetails.field_data.forEach(field => {
            leadData[field.name] = field.values[0];
        });
        
        const nomeCompleto = leadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const email = leadData.email;
        const telefoneLimpo = leadData.phone_number?.replace(/\D/g, '');

        console.log("LOG: Criando novo contato no DB com todos os metadados...");
        const { data: newContact, error: contactError } = await supabase
            .from('contatos')
            .insert({
                nome: nomeCompleto,
                origem: 'Meta Lead Ad',
                tipo_contato: 'Lead',
                personalidade_juridica: 'Pessoa Física',
                meta_lead_id: leadId,
                meta_ad_id: leadValue.ad_id,
                meta_adgroup_id: leadValue.adgroup_id,
                meta_form_id: leadValue.form_id,
                meta_page_id: leadValue.page_id,
                meta_created_time: new Date(leadValue.created_time * 1000).toISOString()
            })
            .select('id')
            .single();

        if (contactError) {
             console.error("LOG: ERRO ao criar novo contato no DB:", contactError);
             throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
        }
            
        const contatoId = newContact.id;
        console.log(`LOG: Novo contato criado com ID: ${contatoId} para o Lead ID: ${leadId}`);

        if (email) await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' });
        if (telefoneLimpo) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular' });
        console.log("LOG: Email e telefone associados ao novo contato.");
        
        console.log(`LOG: Adicionando contato ${contatoId} ao funil.`);
        const { data: funil } = await supabase.from('funis').select('id').order('created_at').limit(1).single();
        if (funil) {
            const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
            if (primeiraColuna) {
                const { error: funilError } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColuna.id });
                if (funilError) console.error('LOG: ERRO ao adicionar contato ao funil:', funilError);
                else console.log('LOG: SUCESSO! Contato adicionado ao funil!');
            } else console.error("LOG: ERRO - Nenhuma coluna encontrada para o funil ID:", funil.id);
        } else console.error("LOG: ERRO - Nenhum funil encontrado no sistema.");

        console.log("LOG: [FIM] Processamento do webhook concluído com sucesso.");
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 }); 
    }
}
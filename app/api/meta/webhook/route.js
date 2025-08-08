// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para criar um cliente Supabase com permissões de administrador (service_role)
const getSupabaseAdmin = () => {
    // LOG DE VERIFICAÇÃO DAS CHAVES DO SUPABASE
    console.log("LOG: Tentando criar cliente Supabase. URL existe:", !!process.env.NEXT_PUBLIC_SUPABASE_URL, "Service Key existe:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("LOG: ERRO CRÍTICO - Variáveis de ambiente do Supabase não encontradas!");
        return null;
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
};

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
    if (!supabase) {
        // Se o Supabase não pôde ser inicializado, retorna um erro.
        return NextResponse.json({ status: 'error', message: 'Configuração do Supabase no servidor está incompleta.' }, { status: 500 });
    }
    
    try {
        const body = await request.json();
        console.log('LOG: Corpo da requisição:', JSON.stringify(body, null, 2));

        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        if (change?.field !== 'leadgen') {
            console.log("LOG: Ignorando evento, não é 'leadgen'. Campo recebido:", change?.field);
            return NextResponse.json({ status: 'not_a_leadgen_event' }, { status: 200 });
        }
        
        console.log("LOG: Evento de leadgen detectado. Processando...");
        const leadgenId = change.value.leadgen_id;
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

        if (!PAGE_ACCESS_TOKEN) {
            console.error("LOG: ERRO CRÍTICO - Variável de ambiente META_PAGE_ACCESS_TOKEN não encontrada.");
            throw new Error("Token de Acesso à Página não configurado no servidor.");
        }

        console.log(`LOG: Buscando detalhes do lead ID: ${leadgenId} na API da Meta.`);
        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();

        if (!leadDetailsResponse.ok) {
            console.error("LOG: ERRO na API da Meta:", leadDetails);
            throw new Error(leadDetails.error?.message || "Falha ao buscar dados do lead no Meta.");
        }

        console.log("LOG: Detalhes do lead recebidos com sucesso:", JSON.stringify(leadDetails, null, 2));
        const leadData = {};
        leadDetails.field_data.forEach(field => {
            leadData[field.name] = field.values[0];
        });
        
        console.log("LOG: Dados do lead formatados:", leadData);

        const nomeCompleto = leadData.full_name || `Lead Meta (${new Date().toLocaleDateString()})`;
        const email = leadData.email;
        const telefoneLimpo = leadData.phone_number?.replace(/\D/g, '');

        console.log(`LOG: Buscando contato no DB com telefone: ${telefoneLimpo}`);
        const { data: existingPhone } = await supabase.from('telefones').select('contato_id').eq('telefone', telefoneLimpo).limit(1).single();

        let contatoId;
        if (existingPhone) {
            contatoId = existingPhone.contato_id;
            console.log(`LOG: Contato existente encontrado. ID: ${contatoId}`);
        } else {
            console.log("LOG: Contato não encontrado. Criando um novo...");
            const { data: newContact, error: contactError } = await supabase
                .from('contatos')
                .insert({ nome: nomeCompleto, origem: 'Meta Lead Ad', tipo_contato: 'Lead', personalidade_juridica: 'Pessoa Física' })
                .select('id')
                .single();

            if (contactError) throw new Error(`Erro ao criar novo contato no DB: ${contactError.message}`);
            
            contatoId = newContact.id;
            console.log(`LOG: Novo contato criado com ID: ${contatoId}`);

            if (email) await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' });
            if (telefoneLimpo) await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular' });
            console.log("LOG: Email e telefone associados ao novo contato.");
        }

        console.log(`LOG: Verificando se o contato ${contatoId} já está no funil.`);
        const { data: existingFunnelEntry } = await supabase.from('contatos_no_funil').select('id').eq('contato_id', contatoId).limit(1).single();

        if (!existingFunnelEntry) {
            console.log(`LOG: Contato ${contatoId} não está no funil. Adicionando...`);
            const { data: funil } = await supabase.from('funis').select('id').order('created_at').limit(1).single();
            if (funil) {
                const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
                if (primeiraColuna) {
                    const { error: funilError } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColuna.id });
                    if (funilError) console.error('LOG: ERRO ao adicionar contato ao funil:', funilError);
                    else console.log('LOG: SUCESSO! Contato adicionado ao funil!');
                } else console.error("LOG: ERRO - Nenhuma coluna encontrada para o funil ID:", funil.id);
            } else console.error("LOG: ERRO - Nenhum funil encontrado no sistema.");
        } else {
            console.log(`LOG: Contato ${contatoId} já estava no funil.`);
        }

        console.log("LOG: [FIM] Processamento do webhook concluído com sucesso.");
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('LOG: [ERRO GERAL] Ocorreu um erro no processamento do webhook:', e);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 }); // Responde 200 para a Meta não desativar.
    }
}

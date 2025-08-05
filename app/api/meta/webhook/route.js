// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função GET: Usada pelo Meta para verificar se a nossa URL é válida
export async function GET(request) {
    // Pega a senha diretamente do ambiente do servidor
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    // Compara o token que o Meta enviou com o que está salvo no nosso servidor
    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("SUCESSO: Webhook verificado com sucesso!");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("FALHA NA VALIDAÇÃO: Os tokens não conferem.");
        console.error(`Token esperado: ${META_VERIFY_TOKEN}`);
        console.error(`Token recebido: ${token}`);
        return new NextResponse(null, { status: 403 });
    }
}

// Função POST: Usada pelo Meta para nos enviar os dados de um novo lead
export async function POST(request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const body = await request.json();

    console.log('Recebido webhook do Meta:', JSON.stringify(body, null, 2));

    try {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        if (change?.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id;
            const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

            if (!PAGE_ACCESS_TOKEN) {
                throw new Error("META_PAGE_ACCESS_TOKEN não está configurado no servidor.");
            }

            const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
            const leadDetails = await leadDetailsResponse.json();

            if (!leadDetailsResponse.ok) {
                console.error("Erro ao buscar detalhes do lead:", leadDetails);
                throw new Error(leadDetails.error.message);
            }

            const leadData = {};
            leadDetails.field_data.forEach(field => {
                const fieldName = field.name;
                const fieldValue = field.values[0];
                if (fieldName === 'full_name') leadData.nome = fieldValue;
                if (fieldName === 'email') leadData.email = fieldValue;
                if (fieldName === 'phone_number') leadData.telefone = fieldValue;
            });
            
            console.log("Dados do lead extraídos:", leadData);

            // Prepara os dados para salvar no CRM
            const contatoParaSalvar = {
                nome: leadData.nome || 'Lead sem nome',
                email: leadData.email,
                origem: 'Meta Lead Ad',
                tipo_contato: 'Lead'
            };

            const { data: newContact, error: contactError } = await supabase
                .from('contatos')
                .insert(contatoParaSalvar)
                .select('id')
                .single();

            if (contactError) {
                console.error('Erro ao salvar lead no banco de dados:', contactError);
                return NextResponse.json({ status: 'error', message: 'Falha ao salvar no DB.' }, { status: 200 });
            }
            
            // Se tiver telefone, salva na tabela de telefones
            if (leadData.telefone) {
                await supabase.from('telefones').insert({
                    contato_id: newContact.id,
                    telefone: leadData.telefone.replace(/\D/g, ''), // Salva só os números
                    tipo: 'Celular'
                });
            }

            console.log('Novo lead salvo com sucesso no CRM! ID:', newContact.id);
        }

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (e) {
        console.error('Erro geral no processamento do webhook:', e.message);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
    }
}
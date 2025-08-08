// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Função GET: Usada pelo Meta para verificar se a nossa URL é válida
export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

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
    const supabase = getSupabaseAdmin();
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

            // 1. Salva o lead na tabela principal de contatos
            const { data: newContact, error: contactError } = await supabase
                .from('contatos')
                .insert({
                    nome: leadData.nome || 'Lead sem nome',
                    origem: 'Meta Lead Ad',
                    tipo_contato: 'Lead'
                })
                .select('id')
                .single();

            if (contactError) {
                console.error('Erro ao salvar lead na tabela de contatos:', contactError);
                return NextResponse.json({ status: 'error', message: 'Falha ao salvar o contato.' }, { status: 200 });
            }
            
            const newContactId = newContact.id;
            console.log('Novo contato salvo com sucesso! ID:', newContactId);

            // 2. Salva o email e o telefone nas tabelas relacionadas
            if (leadData.email) {
                await supabase.from('emails').insert({ contato_id: newContactId, email: leadData.email, tipo: 'Principal' });
            }
            if (leadData.telefone) {
                await supabase.from('telefones').insert({
                    contato_id: newContactId,
                    telefone: leadData.telefone.replace(/\D/g, ''),
                    tipo: 'Celular'
                });
            }

            // 3. Adiciona o contato ao funil do CRM (PASSO QUE FALTAVA)
            const { data: funil } = await supabase.from('funis').select('id').eq('nome', 'Funil de Vendas').single();
            if (funil) {
                const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
                if (primeiraColuna) {
                    const { error: funilError } = await supabase.from('contatos_no_funil').insert({
                        contato_id: newContactId,
                        coluna_id: primeiraColuna.id
                    });
                    if (funilError) {
                        console.error('Erro ao adicionar o contato ao funil do CRM:', funilError);
                    } else {
                        console.log('Contato adicionado com sucesso à primeira coluna do funil!');
                    }
                }
            }
        }

        return NextResponse.json({ status: 'success' }, { status: 200 });
    } catch (e) {
        console.error('Erro geral no processamento do webhook:', e.message);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
    }
}

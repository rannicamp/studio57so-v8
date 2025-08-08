// app/api/meta/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rota GET para verificação do webhook (sem alterações)
export async function GET(request) {
    const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
        console.log("WEBHOOK_VERIFIED");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("WEBHOOK_VERIFICATION_FAILED");
        return new NextResponse(null, { status: 403 });
    }
}

// Rota POST para receber os leads (COM A LÓGICA CORRIGIDA)
export async function POST(request) {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    console.log('Webhook do Meta recebido:', JSON.stringify(body, null, 2));

    try {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];

        if (change?.field !== 'leadgen') {
            console.log("Recebido webhook que não é de leadgen. Ignorando.");
            return NextResponse.json({ status: 'not_a_leadgen_event' }, { status: 200 });
        }
        
        const leadgenId = change.value.leadgen_id;
        const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

        if (!PAGE_ACCESS_TOKEN) {
            console.error("ERRO CRÍTICO: META_PAGE_ACCESS_TOKEN não está configurado.");
            throw new Error("Token de Acesso à Página não configurado no servidor.");
        }

        console.log(`Buscando detalhes do lead ID: ${leadgenId}`);
        const leadDetailsResponse = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`);
        const leadDetails = await leadDetailsResponse.json();

        if (!leadDetailsResponse.ok) {
            console.error("Erro ao buscar detalhes do lead na API do Meta:", leadDetails);
            throw new Error(leadDetails.error?.message || "Falha ao buscar dados do lead no Meta.");
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

        let contatoId = null;
        const telefoneLimpo = leadData.telefone?.replace(/\D/g, '');

        // ETAPA 1: Tenta encontrar um contato existente pelo telefone
        if (telefoneLimpo) {
            const { data: existingPhone } = await supabase.from('telefones').select('contato_id').eq('telefone', telefoneLimpo).single();
            if (existingPhone) {
                contatoId = existingPhone.contato_id;
                console.log(`Contato encontrado pelo telefone. ID: ${contatoId}`);
            }
        }
        
        // ETAPA 2: Se não encontrou, cria um novo contato
        if (!contatoId) {
            console.log("Nenhum contato encontrado. Criando um novo...");
            const { data: newContact, error: contactError } = await supabase
                .from('contatos')
                .insert({
                    nome: leadData.nome || `Lead de ${new Date().toLocaleDateString()}`,
                    origem: 'Meta Lead Ad',
                    tipo_contato: 'Lead',
                    personalidade_juridica: 'Pessoa Física'
                })
                .select('id')
                .single();

            if (contactError) throw new Error(`Erro ao salvar novo contato: ${contactError.message}`);
            
            contatoId = newContact.id;
            console.log(`Novo contato criado com ID: ${contatoId}`);

            // Associa email e telefone ao novo contato
            if (leadData.email) {
                await supabase.from('emails').insert({ contato_id: contatoId, email: leadData.email, tipo: 'Principal' });
            }
            if (telefoneLimpo) {
                await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefoneLimpo, tipo: 'Celular' });
            }
        }

        // --- LÓGICA CORRIGIDA E MOVIDA PARA FORA DO BLOCO DE CRIAÇÃO ---
        // ETAPA 3: Agora que temos um ID de contato (seja novo ou existente), verificamos se ele já está no funil.
        
        if (contatoId) {
            const { data: existingFunnelEntry } = await supabase.from('contatos_no_funil').select('id').eq('contato_id', contatoId).single();

            if (!existingFunnelEntry) {
                console.log(`Contato ID ${contatoId} não está no funil. Adicionando...`);
                // Busca o funil e a primeira coluna para adicionar o card
                const { data: funil } = await supabase.from('funis').select('id').order('created_at').limit(1).single();
                if (funil) {
                    const { data: primeiraColuna } = await supabase.from('colunas_funil').select('id').eq('funil_id', funil.id).order('ordem', { ascending: true }).limit(1).single();
                    if (primeiraColuna) {
                        const { error: funilError } = await supabase.from('contatos_no_funil').insert({ contato_id: contatoId, coluna_id: primeiraColuna.id });
                        if (funilError) {
                            console.error('Erro ao adicionar contato ao funil do CRM:', funilError);
                        } else {
                            console.log('SUCESSO: Contato adicionado à primeira coluna do funil!');
                        }
                    } else {
                         console.error("Nenhuma coluna encontrada para o funil ID:", funil.id);
                    }
                } else {
                    console.error("Nenhum funil encontrado no sistema para adicionar o lead.");
                }
            } else {
                console.log(`Contato ID ${contatoId} já está no funil. Nenhuma ação necessária.`);
            }
        }
        // --- FIM DA CORREÇÃO ---

        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (e) {
        console.error('Erro geral no processamento do webhook:', e);
        // Retornamos 200 para o Meta não ficar reenviando, mas logamos o erro para nossa análise.
        return NextResponse.json({ status: 'error', message: e.message }, { status: 200 });
    }
}
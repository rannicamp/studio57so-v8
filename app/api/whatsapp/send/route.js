import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para normalizar e gerar variações de números de telefone para busca (COPIADA DO WEBHOOK)
function normalizeAndGeneratePhoneNumbers(rawPhone) {
    const digitsOnly = rawPhone.replace(/\D/g, '');

    let numbersToSearch = new Set();
    numbersToSearch.add(digitsOnly);

    const brazilDDI = '55';
    const minBrazilLength = 10;
    const maxBrazilLength = 11;

    if (!digitsOnly.startsWith(brazilDDI)) {
        if (digitsOnly.length === minBrazilLength || digitsOnly.length === maxBrazilLength) {
            numbersToSearch.add(brazilDDI + digitsOnly);
        }
    }

    if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 13) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        if (remainingDigits.startsWith('9') && remainingDigits.length === 9) {
            numbersToSearch.add(ddiDdd + remainingDigits.substring(1));
        }
    } else if (digitsOnly.startsWith(brazilDDI) && digitsOnly.length === 12) {
        const ddiDdd = digitsOnly.substring(0, 4);
        const remainingDigits = digitsOnly.substring(4);
        numbersToSearch.add(ddiDdd + '9' + remainingDigits);
    }

    return Array.from(numbersToSearch);
}


export async function POST(request) {
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não foram encontradas.");
        return NextResponse.json({ error: "Configuração do servidor incompleta." }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log("INFO: Cliente Supabase Admin inicializado.");

    try {
        const body = await request.json();
        const { to, type, templateName, languageCode, components, text, link, filename } = body;

        if (!to || !type) {
            return NextResponse.json({ error: 'O número de destino (to) e o tipo (type) são obrigatórios.' }, { status: 400 });
        }

        const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_phone_number_id')
            .limit(1)
            .single();

        if (configError || !config) {
            console.error("ERRO: Não foi possível ler as configurações do WhatsApp.", configError);
            return NextResponse.json({ error: 'Credenciais do WhatsApp não encontradas.' }, { status: 500 });
        }

        const { whatsapp_permanent_token: WHATSAPP_TOKEN, whatsapp_phone_number_id: WHATSAPP_PHONE_NUMBER_ID } = config;
        const url = `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        let payload = {};
        let messageContentForDb = '';

        if (type === 'template') {
            payload = { messaging_product: 'whatsapp', to: to, type: 'template', template: { name: templateName, language: { code: languageCode || 'pt_BR' }, components: components || [] } };
            messageContentForDb = `Template: ${templateName}`;
        } else if (type === 'text') {
            payload = { messaging_product: 'whatsapp', to: to, type: 'text', text: { preview_url: true, body: text } };
            messageContentForDb = text;
        } else if (type === 'document') {
             payload = { messaging_product: 'whatsapp', to: to, type: 'document', document: { link: link, filename: filename } };
             messageContentForDb = filename || 'Documento enviado';
        } else {
            return NextResponse.json({ error: 'Tipo de mensagem inválido.' }, { status: 400 });
        }

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseData = await apiResponse.json();

        if (!apiResponse.ok) {
            console.error("ERRO da API da Meta:", responseData);
            return NextResponse.json({ error: `Erro da API do WhatsApp: ${responseData.error?.message}` }, { status: apiResponse.status });
        }

        const newMessageId = responseData.messages?.[0]?.id;
        if (!newMessageId) {
            console.error("ERRO: ID da mensagem não encontrado na resposta da Meta:", responseData);
            return NextResponse.json({ message: 'Mensagem enviada, mas não pôde ser salva (ID ausente).', data: responseData }, { status: 200 });
        }

        console.log(`INFO: Mensagem enviada via WhatsApp (ID: ${newMessageId}). Salvando no banco...`);

        // --- Lógica de busca de Contato (sem alteração) ---
        let contactId = null;
        let enterpriseId = null;
        let contactPhoneNumber = to;
        
        if (contactPhoneNumber) {
            const possiblePhones = normalizeAndGeneratePhoneNumbers(contactPhoneNumber);
            const { data: matchingPhones } = await supabaseAdmin.from('telefones').select('contato_id').in('telefone', possiblePhones).limit(1);
            if (matchingPhones && matchingPhones.length > 0) {
                contactId = matchingPhones[0].contato_id;
                if (contactId) {
                    const { data: contactData } = await supabaseAdmin.from('contatos').select('empresa_id').eq('id', contactId).single();
                    if (contactData) enterpriseId = contactData.empresa_id;
                }
            }
        }
        
        // ***** INÍCIO DA CORREÇÃO *****
        // Em vez de 'insert', agora usamos 'rpc' para chamar nossa nova função
        const { error: dbError } = await supabaseAdmin.rpc('salvar_mensagem_whatsapp', {
            p_contato_id: contactId,
            p_enterprise_id: enterpriseId,
            p_message_id: newMessageId,
            p_sender_id: WHATSAPP_PHONE_NUMBER_ID,
            p_receiver_id: to,
            p_content: messageContentForDb,
            p_sent_at: new Date().toISOString(),
            p_direction: 'outbound',
            p_status: 'sent',
            p_raw_payload: payload // Salva o que foi enviado para a API da Meta
        });
        // ***** FIM DA CORREÇÃO *****

        if (dbError) {
            console.error('ERRO ao chamar RPC para salvar no banco:', dbError);
            return NextResponse.json({ message: 'Mensagem ENVIADA, mas falhou ao salvar no banco.', error: dbError.message }, { status: 206 });
        }

        console.log("SUCESSO: Mensagem salva no banco via RPC!");
        return NextResponse.json({ message: 'Mensagem enviada e salva com sucesso!', data: responseData }, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO NA API:", error);
        return NextResponse.json({ error: 'Falha crítica ao processar a requisição.', details: error.message }, { status: 500 });
    }
}
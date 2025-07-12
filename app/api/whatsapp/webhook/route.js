import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para extrair o conteúdo de texto da complexa resposta do WhatsApp
function getTextContent(message) {
    if (message.type === 'text') {
        return message.text?.body || null;
    }
    if (message.type === 'interactive') {
        if (message.interactive?.button_reply) {
            return message.interactive.button_reply.title;
        }
        if (message.interactive?.list_reply) {
            return message.interactive.list_reply.title;
        }
    }
    return `Mensagem do tipo '${message.type}' recebida.`;
}

export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("INFO: Webhook verificado com sucesso!");
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("ERRO: Falha na verificação do webhook. Tokens não correspondem.");
        return new NextResponse(null, { status: 403 });
    }
}

export async function POST(request) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const body = await request.json();
        console.log("INFO: Payload recebido do webhook:", JSON.stringify(body, null, 2));

        // Estrutura padrão de uma notificação do WhatsApp
        if (body.object === 'whatsapp_business_account') {
            const messageEntry = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

            if (messageEntry) {
                const senderPhone = messageEntry.from;
                const messageContent = getTextContent(messageEntry);
                const messageId = messageEntry.id;
                const timestamp = new Date(parseInt(messageEntry.timestamp, 10) * 1000).toISOString();

                // Busca o contato pelo número de telefone
                const { data: contact } = await supabaseAdmin
                    .from('contatos')
                    .select('id, empresa_id')
                    .eq('whatsapp', senderPhone)
                    .single();
                
                // Objeto para salvar no banco, com os nomes de colunas corretos
                const messageToSave = {
                    contato_id: contact?.id || null,
                    enterprise_id: contact?.empresa_id || null,
                    message_id: messageId,
                    sender_id: senderPhone, // Quem enviou a mensagem
                    receiver_id: process.env.WHATSAPP_PHONE_NUMBER_ID, // O seu número que recebeu
                    content: messageContent,
                    sent_at: timestamp,
                    direction: 'inbound', // 'inbound' significa "de entrada"
                    status: 'delivered',
                    raw_payload: messageEntry,
                };
                
                const { error: dbError } = await supabaseAdmin.from('whatsapp_messages').insert(messageToSave);

                if (dbError) {
                    console.error("ERRO ao salvar mensagem recebida no banco:", dbError);
                } else {
                    console.log("SUCESSO: Mensagem do cliente salva no banco de dados.");
                }
            }
        }
        
        // Responde à Meta com status 200 OK para confirmar o recebimento
        return new NextResponse(null, { status: 200 });

    } catch (error) {
        console.error("ERRO INESPERADO no webhook:", error);
        return new NextResponse(null, { status: 500 });
    }
}
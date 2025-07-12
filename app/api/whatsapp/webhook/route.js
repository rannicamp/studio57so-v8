import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

// Função para a verificação inicial do Webhook (já funcionando)
export async function GET(request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const token = searchParams.get('hub.verify_token');

    const { data: config } = await supabase
        .from('configuracoes_whatsapp')
        .select('verify_token')
        .limit(1)
        .single();

    if (mode === 'subscribe' && token === config?.verify_token) {
        return new NextResponse(challenge, { status: 200 });
    } else {
        return new NextResponse("Erro: Falha na verificação do Webhook.", { status: 403 });
    }
}

// Função para receber e salvar as mensagens (COM A CORREÇÃO)
export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();

    try {
        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages' && change.value.messages) {
                        for (const message of change.value.messages) {
                            
                            // Apenas processa mensagens de texto recebidas
                            if (message.type !== 'text') {
                                continue;
                            }

                            // Tenta encontrar o contato no seu banco de dados
                            const { data: contato } = await supabase
                                .from('telefones')
                                .select('contato_id')
                                .eq('telefone', message.from)
                                .single();
                            
                            // Objeto de dados CORRIGIDO para bater com a sua tabela
                            const messageData = {
                                whatsapp_message_id: message.id,
                                sender_phone: message.from,
                                message_content: message.text.body,
                                message_type: message.type,
                                message_timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                                direction: 'inbound',
                                raw_payload: message,
                                contato_id: contato ? contato.contato_id : null
                            };

                            // Salva a mensagem na sua tabela
                            await supabase.from('whatsapp_messages').insert(messageData);
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Log de erro para podermos ver na Netlify se algo der errado
        console.error("Erro geral no processamento do webhook POST:", e);
    }

    // Responde ao WhatsApp que a mensagem foi recebida com sucesso.
    return NextResponse.json({ status: 'ok' }, { status: 200 });
}
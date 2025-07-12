import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

// Função para a verificação inicial do Webhook (não precisa de alteração)
export async function GET(request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const token = searchParams.get('hub.verify_token');

    const { data: config, error } = await supabase
        .from('configuracoes_whatsapp')
        .select('verify_token')
        .limit(1)
        .single();

    if (error || !config || !config.verify_token) {
        return new NextResponse("Erro: Token de verificação não encontrado no sistema.", { status: 403 });
    }

    const myToken = config.verify_token;

    if (mode === 'subscribe' && token === myToken) {
        return new NextResponse(challenge, { status: 200 });
    } else {
        return new NextResponse("Erro: Falha na verificação do Webhook.", { status: 403 });
    }
}


// Função para receber e salvar as mensagens (COM A CORREÇÃO)
export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();

    // Log para depuração. Você poderá ver isso nos logs da Netlify se precisar.
    console.log('Webhook POST recebido:', JSON.stringify(body, null, 2));

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

                            // Tenta encontrar o contato no seu banco de dados pelo número de telefone
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
                                direction: 'inbound', // inbound = mensagem recebida
                                raw_payload: message,
                                contato_id: contato ? contato.contato_id : null
                            };

                            // Salva a mensagem na sua tabela
                            const { error: insertError } = await supabase.from('whatsapp_messages').insert(messageData);

                            if (insertError) {
                                console.error('Erro ao salvar mensagem no Supabase:', insertError);
                            } else {
                                console.log(`Mensagem de ${message.from} salva com sucesso!`);
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Erro geral no processamento do webhook POST:", e);
    }

    // Responde ao WhatsApp que a mensagem foi recebida com sucesso.
    return NextResponse.json({ status: 'ok' }, { status: 200 });
}
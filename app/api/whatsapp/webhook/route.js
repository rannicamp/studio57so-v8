import { NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';

// Esta função lida com a VERIFICAÇÃO INICIAL do Webhook pela Meta
export async function GET(request) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('hub.mode');
    const challenge = searchParams.get('hub.challenge');
    const token = searchParams.get('hub.verify_token');

    // Busca o token de verificação que VOCÊ salvou no seu banco de dados
    const { data: config, error } = await supabase
        .from('configuracoes_whatsapp')
        .select('verify_token')
        .limit(1)
        .single();

    if (error || !config || !config.verify_token) {
        console.error("Webhook GET Error: Não foi possível encontrar o 'verify_token' no banco de dados.", error);
        return new NextResponse("Erro: Token de verificação não encontrado no sistema.", { status: 403 });
    }

    const myToken = config.verify_token;

    // Compara o token do seu banco com o token que a Meta enviou
    if (mode === 'subscribe' && token === myToken) {
        console.log("Webhook GET: Verificação bem-sucedida!");
        // Se ambos forem iguais, responde com o "desafio" da Meta
        return new NextResponse(challenge, { status: 200 });
    } else {
        console.error("Webhook GET Error: Falha na verificação. Os tokens não batem ou o modo é inválido.");
        // Se forem diferentes, recusa a conexão
        return new NextResponse("Erro: Falha na verificação do Webhook.", { status: 403 });
    }
}


// Esta função lida com o RECEBIMENTO DE MENSAGENS após a verificação
export async function POST(request) {
    const supabase = createClient();
    const body = await request.json();

    console.log('Webhook POST recebido:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
            for (const change of entry.changes) {
                if (change.field === 'messages' && change.value.messages) {
                    for (const message of change.value.messages) {
                        
                        // Ignora notificações de status (enviada, entregue, lida) e foca só nas mensagens de texto
                        if (message.type !== 'text') {
                            continue;
                        }

                        // Tenta encontrar o contato no seu banco de dados pelo número de telefone
                        const { data: contato } = await supabase
                            .from('telefones')
                            .select('contato_id')
                            .eq('telefone', message.from)
                            .single();
                        
                        const messageData = {
                            whatsapp_message_id: message.id,
                            sender_phone: message.from,
                            message_content: message.text.body,
                            message_timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                            direction: 'inbound', // 'inbound' significa que é uma mensagem recebida
                            contato_id: contato ? contato.contato_id : null,
                        };

                        // Salva a mensagem na sua tabela
                        const { error: insertError } = await supabase.from('whatsapp_messages').insert(messageData);
                        if (insertError) {
                            console.error('Erro ao salvar mensagem do webhook:', insertError);
                        } else {
                             console.log('Mensagem do webhook salva com sucesso:', messageData);
                        }
                    }
                }
            }
        }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
}
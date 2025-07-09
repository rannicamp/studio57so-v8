import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; // Usamos o client do servidor aqui

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Esta parte continua igual, para a verificação inicial da Meta.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado com sucesso!');
    return new NextResponse(challenge, { status: 200 });
  } else {
    console.error('Falha na verificação do Webhook. Tokens não correspondem.');
    return new NextResponse(null, { status: 403 });
  }
}

// *** ESTA É A PARTE NOVA E MAIS IMPORTANTE ***
// Ela processa e salva as mensagens recebidas.
export async function POST(request) {
  const supabase = createClient();
  const body = await request.json();

  // Log para depuração. Você poderá ver isso nos logs do seu servidor Netlify.
  console.log('MENSAGEM BRUTA RECEBIDA:', JSON.stringify(body, null, 2));

  // O WhatsApp envia vários tipos de eventos. Só nos importamos com as mensagens.
  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        // Verifica se é uma notificação de mensagem
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            
            // Ignora mensagens que a sua própria empresa enviou
            if (message.from === process.env.WHATSAPP_PHONE_NUMBER_ID) {
                continue;
            }

            const messageData = {
              whatsapp_message_id: message.id,
              sender_phone: message.from,
              recipient_phone: change.value.metadata.display_phone_number,
              message_content: message.text?.body || 'Mensagem sem texto (imagem, áudio, etc.)',
              message_type: message.type,
              message_timestamp: new Date(parseInt(message.timestamp) * 1000),
              direction: 'inbound', // 'inbound' significa "entrada"
              raw_payload: message, // Salva a mensagem completa para referência
            };

            // Tenta encontrar o contato no seu banco de dados pelo número de telefone
            const { data: contato } = await supabase
              .from('telefones')
              .select('contato_id')
              .eq('telefone', message.from)
              .single();

            if (contato) {
              messageData.contato_id = contato.contato_id;
            }

            // Salva a mensagem na nova tabela que criamos
            const { error } = await supabase.from('whatsapp_messages').insert(messageData);

            if (error) {
              console.error('Erro ao salvar mensagem no Supabase:', error);
            } else {
              console.log(`Mensagem de ${message.from} salva com sucesso!`);
            }
          }
        }
      }
    }
  }

  // Responde ao WhatsApp para confirmar que a mensagem foi recebida.
  return NextResponse.json({ status: 'success' }, { status: 200 });
}
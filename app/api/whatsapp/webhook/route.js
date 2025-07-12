// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// A função GET para verificação do webhook permanece a mesma.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return new NextResponse(challenge, { status: 200 });
    } else {
      console.error('Webhook verification failed. Tokens do not match.');
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  return new NextResponse('Bad Request', { status: 400 });
}

// Função POST aprimorada para receber as mensagens
export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não configuradas no servidor.");
    return new NextResponse('Internal Server Error: Server configuration missing', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await request.json();
    console.log('Received WhatsApp Webhook:', JSON.stringify(body, null, 2));

    const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
        console.log("Webhook recebido, mas não é uma mensagem de usuário. Ignorando.");
        return new NextResponse('OK: Not a user message', { status: 200 });
    }

    if (message.type === 'text') {
        const from = message.from;
        const timestamp = message.timestamp;
        const textBody = message.text.body;

        console.log(`Mensagem de texto recebida de ${from}: "${textBody}"`);

        // Busca o contato na tabela "contatos" (plural)
        const { data: contact, error: contactError } = await supabase
          .from('contatos') // Nome da tabela correto
          .select('id, enterprise_id')
          .eq('whatsapp', from)
          .single();

        if (contactError && contactError.code !== 'PGRST116') {
          console.error('Erro ao buscar contato no Supabase:', contactError.message);
          return new NextResponse('OK: Error fetching contact', { status: 200 });
        }
        
        const contact_id = contact?.id || null;
        const enterprise_id = contact?.enterprise_id || null;

        if (!contact) {
          console.log(`Contato para o número ${from} não encontrado. A mensagem será salva sem associação.`);
        }

        // Insere na tabela "whatsapp_messages" usando o nome de coluna correto
        const { error: messageError } = await supabase
          .from('whatsapp_messages')
          .insert([{
              contact_id: contact_id, // <--- Nome da coluna correto
              enterprise_id: enterprise_id,
              message_id: message.id,
              conversation_id: from,
              sender_id: from,
              receiver_id: 'SYSTEM', 
              content: textBody,
              sent_at: new Date(parseInt(timestamp, 10) * 1000),
              direction: 'IN',
              status: 'DELIVERED',
          }]);

        if (messageError) {
          console.error('Erro ao inserir mensagem no Supabase:', messageError.message);
          return new NextResponse('OK: Error inserting message', { status: 200 });
        }

        console.log(`Mensagem de ${from} salva com sucesso no banco de dados!`);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('Erro geral no processamento do webhook:', error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
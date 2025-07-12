// app/api/whatsapp/webhook/route.js

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Use a Service Role Key para ter permissão de escrita no servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para lidar com a verificação do Webhook (GET request)
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
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
  return new NextResponse('Bad Request', { status: 400 });
}

// Função para lidar com o recebimento de mensagens (POST request)
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('Received WhatsApp Webhook:', JSON.stringify(body, null, 2));

    if (body.object) {
      const entry = body.entry && body.entry[0];
      const change = entry && entry.changes && entry.changes[0];
      const message = change && change.value.messages && change.value.messages[0];

      // Processa apenas mensagens de texto recebidas
      if (message && message.type === 'text') {
        const from = message.from; // Número do remetente
        const timestamp = message.timestamp;
        const textBody = message.text.body;

        // *** INÍCIO DA CORREÇÃO ***
        // 1. Buscar o contato no banco de dados pelo número de telefone
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('id, enterprise_id')
          .eq('whatsapp', from) // Procura pelo número exato
          .single();

        if (contactError && contactError.code !== 'PGRST116') { // Ignora erro de "nenhuma linha encontrada"
          console.error('Error fetching contact:', contactError.message);
        }

        const contact_id = contact ? contact.id : null;
        const enterprise_id = contact ? contact.enterprise_id : null;

        if (!contact) {
          console.log(`Contact not found for number: ${from}. Message will be saved without association.`);
        }

        // 2. Inserir a mensagem no banco de dados com o ID do contato encontrado
        const { error: messageError } = await supabase
          .from('whatsapp_messages')
          .insert([
            {
              contact_id: contact_id,       // <-- CAMPO CORRIGIDO
              enterprise_id: enterprise_id, // <-- CAMPO ADICIONADO
              message_id: message.id,
              conversation_id: from,
              sender_id: from,
              receiver_id: 'SYSTEM', 
              content: textBody,
              sent_at: new Date(parseInt(timestamp) * 1000),
              direction: 'IN',
              status: 'DELIVERED',
            },
          ]);
        // *** FIM DA CORREÇÃO ***

        if (messageError) {
          console.error('Error inserting message into Supabase:', messageError.message);
        } else {
          console.log(`Message from ${from} successfully saved to Supabase.`);
        }
      }

      // Responde ao WhatsApp que a mensagem foi recebida com sucesso
      return new NextResponse('OK', { status: 200 });
    } else {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
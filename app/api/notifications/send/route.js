// Caminho: app/api/notifications/send/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import webPush from 'web-push';

// Inicializa o Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configura o web-push com as chaves VAPID
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { organizacao_id, title, body: message } = body;

    if (!organizacao_id || !title || !message) {
      return NextResponse.json({ error: 'organizacao_id, title e message são obrigatórios' }, { status: 400 });
    }

    // Busca as inscrições (subscriptions) da organização correta na tabela correta
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('push_subscriptions') // Lendo da tabela correta: push_subscriptions
      .select('id, subscription_data')
      .eq('organizacao_id', organizacao_id);

    if (fetchError) {
      console.error('[API Send] Erro ao buscar assinaturas:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[API Send] Nenhuma assinatura encontrada para a organização.');
      return NextResponse.json({ success: true, message: 'Nenhum dispositivo inscrito para receber notificações.' });
    }

    // Prepara o conteúdo da notificação no formato que o sw.js espera
    const notificationPayload = JSON.stringify({
      title: title, // Ex: "Nova mensagem de Ranniere"
      body: message // Ex: "Olá, tudo bem?"
    });

    // Envia a notificação para cada dispositivo inscrito
    const sendPromises = subscriptions.map(sub =>
      webPush.sendNotification(
        sub.subscription_data,
        notificationPayload
      ).catch(async (err) => {
        // Se a assinatura for inválida/expirada, removemos do banco
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[API Send] Assinatura expirada ${sub.id}, removendo.`);
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error(`[API Send] Erro ao enviar notificação para ${sub.id}:`, err.statusCode);
        }
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, sent_to: subscriptions.length });

  } catch (error) {
    console.error('Erro na API /api/notifications/send:', error);
    return NextResponse.json({ error: 'Falha ao enviar notificações', details: error.message }, { status: 500 });
  }
}
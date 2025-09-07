// app/api/notifications/send-test/route.js

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Configura o web-push com as chaves VAPID do nosso "cofre" (.env.local)
webpush.setVapidDetails(
  'mailto:seu-email@exemplo.com', // Coloque um email seu aqui
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Para este teste, vamos enviar para o usuário que está fazendo a chamada
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const userId = session.user.id;

    // 1. Busca no banco de dados o "endereço de entrega" do usuário
    const { data: subscriptionData, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription_data')
      .eq('user_id', userId)
      .single(); // Pegamos apenas um, assumindo que o usuário tem um dispositivo

    if (subError || !subscriptionData) {
      console.error("Erro ou inscrição não encontrada:", subError);
      return NextResponse.json({ error: 'Inscrição de notificação não encontrada para este usuário.' }, { status: 404 });
    }

    const subscription = subscriptionData.subscription_data;

    // 2. Prepara a notificação (o conteúdo da "carta")
    const payload = JSON.stringify({
      title: 'Notificação de Teste! 🚀',
      body: 'Olá, meu lindo! Se você está vendo isso, tudo funcionou!',
      icon: '/icons/icon-512x512.png',
      url: '/painel' // Página que vai abrir ao clicar na notificação
    });

    // 3. Usa a biblioteca web-push para enviar a mensagem
    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ message: 'Notificação de teste enviada com sucesso!' });

  } catch (error) {
    console.error('Erro ao enviar notificação:', error);
    // Se a inscrição for inválida (ex: usuário desinstalou o PWA), podemos deletá-la
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('Inscrição expirada ou inválida. Deletando do banco de dados.');
      // Aqui você adicionaria a lógica para deletar a inscrição inválida do Supabase
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
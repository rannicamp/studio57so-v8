// Caminho: app/api/notifications/send/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// 1. Configura a biblioteca de envio com as chaves VAPID (remetente da notificação)
// É crucial que as variáveis VAPID_PRIVATE_KEY e NEXT_PUBLIC_VAPID_PUBLIC_KEY estejam no seu .env.local
webpush.setVapidDetails(
  'mailto:rannierecampos@studio57.arq.br', // Seu e-mail de contato
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { title, message, url } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 });
    }

    // 2. Busca TODAS as assinaturas salvas na nossa tabela correta
    const { data: subscriptions, error: fetchError } = await supabase
      .from('notification_subscriptions') // Lendo da tabela correta
      .select('subscription'); // Lendo a coluna correta

    if (fetchError) {
      console.error('Erro ao buscar assinaturas:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum dispositivo inscrito para receber notificações.' });
    }

    // 3. Prepara o conteúdo da notificação
    const notificationPayload = JSON.stringify({
      title,
      body: message,
      icon: '/favicon.ico', // Ícone que aparecerá na notificação
      data: {
        url: url || '/', // URL para abrir ao clicar
      },
    });

    // 4. Envia a notificação para cada dispositivo inscrito
    const sendPromises = subscriptions.map(sub =>
      webpush.sendNotification(
        sub.subscription, // A assinatura de cada dispositivo
        notificationPayload
      ).catch(err => {
        // Se uma assinatura for inválida (ex: usuário limpou o cache), a removemos do banco
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log('Assinatura expirada, removendo:', sub.subscription.endpoint);
          return supabase.from('notification_subscriptions').delete().eq('subscription', sub.subscription);
        } else {
          console.error('Erro ao enviar notificação para um dispositivo:', err.statusCode);
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
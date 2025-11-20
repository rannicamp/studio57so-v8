import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configure suas chaves VAPID aqui ou no .env (recomendado)
// Se não tiver no .env, vai dar erro.
webpush.setVapidDetails(
  process.env.NEXT_PUBLIC_VAPID_MAILTO || 'mailto:suporte@studio57.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { userId, title, message, url, organizacaoId } = await req.json();

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1. Buscar inscrições na tabela EXISTENTE 'notification_subscriptions'
    const { data: subscriptions, error } = await supabaseAdmin
      .from('notification_subscriptions') 
      .select('subscription_data, endpoint')
      .eq('user_id', userId);

    if (error) console.error("Erro ao buscar subscriptions:", error);

    // 2. Salvar no histórico (tabela nova 'notificacoes')
    await supabaseAdmin.from('notificacoes').insert({
      user_id: userId,
      titulo: title,
      mensagem: message,
      link: url,
      lida: false,
      organizacao_id: organizacaoId || null
    });

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'Notificação salva, mas usuário sem dispositivos push.' });
    }

    // 3. Enviar Push
    const payload = JSON.stringify({ title, body: message, url });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        // A coluna no seu banco é 'subscription_data' (jsonb)
        await webpush.sendNotification(sub.subscription_data, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Remove inscrição inválida baseada no endpoint (que é único na sua tabela)
          await supabaseAdmin
            .from('notification_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro Notification API:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
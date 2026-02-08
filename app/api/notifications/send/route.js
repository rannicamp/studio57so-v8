import { createClient } from '@/utils/supabase/server';
import webPush from 'web-push';
import { NextResponse } from 'next/server';

if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("❌ CHAVES VAPID NÃO ENCONTRADAS NO SERVIDOR");
}

webPush.setVapidDetails(
  'mailto:suporte@studio57.arq.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { title, message, url, userId, organizacaoId } = await request.json();

    console.log(`🔔 API: Enviando Push para UserID: ${userId}`);

    // 1. Busca dispositivos inscritos
    let query = supabase.from('notification_subscriptions').select('*');
    if (userId) query = query.eq('user_id', userId);
    else if (organizacaoId) query = query.eq('organizacao_id', organizacaoId);

    const { data: subscriptions, error } = await query;

    if (error) throw error;
    if (!subscriptions?.length) {
      return NextResponse.json({ message: 'Nenhum dispositivo inscrito encontrado.' });
    }

    // 2. Salva no histórico (Sininho)
    if (userId) {
        await supabase.from('notificacoes').insert({
            user_id: userId,
            titulo: title,
            mensagem: message,
            link: url,
            organizacao_id: organizacaoId,
            lida: false
        });
    }

    // 3. Dispara o Push real
    const payload = JSON.stringify({
      title: title || 'Studio 57',
      message: message,
      url: url || '/',
      icon: '/icons/icon-192x192.png'
    });

    const promises = subscriptions.map(sub => 
      webPush.sendNotification(sub.subscription_data, payload)
        .catch(async err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log(`🗑️ Removendo inscrição morta: ${sub.id}`);
            await supabase.from('notification_subscriptions').delete().eq('id', sub.id);
          }
        })
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true, count: subscriptions.length });

  } catch (error) {
    console.error('Erro API Notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
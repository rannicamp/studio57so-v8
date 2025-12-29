import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configura o Web Push com as chaves do ambiente
webpush.setVapidDetails(
  'mailto:suporte@studio57.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    
    console.log("🔔 [PUSH API] Recebido:", JSON.stringify(body, null, 2));

    // O "PULO DO GATO": Tratamento Inteligente do Payload
    // Se vier do Supabase Webhook, os dados reais estão dentro de 'record'.
    // Se vier de um teste manual, pode estar na raiz.
    const notificationData = body.record || body;

    const { user_id, titulo, mensagem, link, enviar_push } = notificationData;

    // Se o flag enviar_push for falso, ignoramos
    if (enviar_push === false) {
      console.log("🔕 [PUSH API] Push ignorado (flag false).");
      return NextResponse.json({ message: 'Push disabled for this notification' });
    }

    if (!user_id || !titulo) {
      console.error("❌ [PUSH API] Dados incompletos (faltando user_id ou titulo):", notificationData);
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 2. BUSCAR AS ASSINATURAS DO USUÁRIO NO BANCO
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: subscriptions, error } = await supabase
      .from('notification_subscriptions')
      .select('subscription_data')
      .eq('user_id', user_id);

    if (error || !subscriptions || subscriptions.length === 0) {
      console.log(`⚠️ [PUSH API] Nenhuma assinatura encontrada para o User ${user_id}`);
      return NextResponse.json({ message: 'No subscriptions found' });
    }

    console.log(`🚀 [PUSH API] Enviando para ${subscriptions.length} dispositivos...`);

    // 3. ENVIAR PARA TODOS OS DISPOSITIVOS
    const payload = JSON.stringify({
      title: titulo,
      body: mensagem,
      url: link || '/',
      icon: '/icons/icon-192x192.png',
      tag: `notif-${Date.now()}` // Tag única para forçar vibração
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription_data, payload);
        return { success: true };
      } catch (err) {
        console.error("❌ Erro ao enviar para um dispositivo:", err.statusCode);
        return { success: false, error: err };
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, sent_count: sendPromises.length });

  } catch (error) {
    console.error("💀 [PUSH API] Erro Fatal:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
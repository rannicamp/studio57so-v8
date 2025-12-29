import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Configura Web Push
webpush.setVapidDetails(
  'mailto:suporte@studio57.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  // Configura Cliente Supabase com PODER TOTAL (Service Role) para ignorar RLS
  // Se não tiver a Service Key na Vercel, use a Anon Key, mas pode dar erro de permissão.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let body = {};

  try {
    body = await request.json();
    
    // 1. LOG INICIAL: A API FOI CHAMADA?
    await supabase.from('app_logs').insert({
      origem: 'API PUSH',
      mensagem: 'Recebi uma chamada!',
      payload: body
    });

    const notificationData = body.record || body;
    const { user_id, titulo, mensagem, link, enviar_push } = notificationData;

    if (enviar_push === false) {
      await supabase.from('app_logs').insert({ origem: 'API PUSH', mensagem: 'Abortado: Flag false' });
      return NextResponse.json({ message: 'Push disabled' });
    }

    if (!user_id) {
       await supabase.from('app_logs').insert({ origem: 'API PUSH', mensagem: 'Erro: Sem User ID' });
       return NextResponse.json({ error: 'Sem User ID' }, { status: 400 });
    }

    // 2. BUSCAR ASSINATURAS
    const { data: subscriptions, error: subError } = await supabase
      .from('notification_subscriptions')
      .select('subscription_data')
      .eq('user_id', user_id);

    if (subError) {
       await supabase.from('app_logs').insert({ origem: 'API PUSH', mensagem: 'Erro ao buscar subs', payload: subError });
       throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      // AQUI É ONDE GERALMENTE FALHA
      await supabase.from('app_logs').insert({ origem: 'API PUSH', mensagem: `Nenhuma assinatura encontrada para User ${user_id}` });
      return NextResponse.json({ message: 'No subscriptions found' });
    }

    // 3. ENVIAR
    const payload = JSON.stringify({
      title: titulo,
      body: mensagem,
      url: link || '/',
      icon: '/icons/icon-192x192.png',
      tag: `notif-${Date.now()}`
    });

    const sendPromises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription_data, payload)
        .then(() => ({ success: true }))
        .catch(err => ({ success: false, error: err.statusCode }))
    );

    const results = await Promise.all(sendPromises);

    // 4. LOG FINAL: SUCESSO?
    await supabase.from('app_logs').insert({ 
      origem: 'API PUSH', 
      mensagem: 'Envio finalizado', 
      payload: { total: subscriptions.length, resultados: results } 
    });

    return NextResponse.json({ success: true, results });

  } catch (error) {
    // LOG DE ERRO FATAL
    console.error(error);
    await supabase.from('app_logs').insert({ 
      origem: 'API PUSH CRASH', 
      mensagem: error.message,
      payload: { body } 
    });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
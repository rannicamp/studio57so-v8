import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Garante que a Netlify não faça cache da rota
export const dynamic = 'force-dynamic';

// Configura Web Push
webpush.setVapidDetails(
  'mailto:suporte@studio57.com.br',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Função auxiliar para gravar no banco (Nosso espião)
async function logToDb(supabase, origem, mensagem, payload = null) {
  try {
    await supabase.from('app_logs').insert({ origem, mensagem, payload });
  } catch (e) {
    console.error("Erro ao logar:", e);
  }
}

// Lógica unificada (funciona para GET e POST)
async function handleRequest(request, method) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let body = {};
  
  try {
    // Se for POST, tenta ler o corpo. Se for GET, cria um corpo falso de teste.
    if (method === 'POST') {
      try {
        body = await request.json();
      } catch (e) {
        await logToDb(supabase, 'API ERROR', 'Recebi POST mas falhei ao ler JSON');
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    } else {
      // GET (Teste de navegador)
      body = { record: { titulo: "Teste Navegador", mensagem: "Se vibrar, é o Supabase!", enviar_push: true } };
      const { searchParams } = new URL(request.url);
      const userIdParam = searchParams.get('user_id');
      if (userIdParam) body.record.user_id = userIdParam;
    }

    // O payload do Supabase vem dentro de 'record'
    const notificationData = body.record || body;
    const { user_id, titulo, mensagem, link, enviar_push } = notificationData;

    // --- 🚨 A CORREÇÃO MÁGICA ESTÁ AQUI 🚨 ---
    // O sistema verifica se o banco disse "NÃO ENVIAR" (false)
    if (enviar_push === false) {
        await logToDb(supabase, 'API INFO', 'Push cancelado: Usuário desativou ou regra bloqueou.', { user_id });
        return NextResponse.json({ skipped: true, message: 'Push desabilitado na origem.' });
    }
    // -----------------------------------------

    if (!user_id && method === 'POST') {
      return NextResponse.json({ message: 'Sem User ID' });
    }

    if (!user_id && method === 'GET') {
       return NextResponse.json({ message: 'API Viva! Para testar push, adicione ?user_id=SEU_UUID na URL.' });
    }

    // Busca assinaturas
    const { data: subscriptions } = await supabase
      .from('notification_subscriptions')
      .select('subscription_data')
      .eq('user_id', user_id);

    if (!subscriptions || subscriptions.length === 0) {
      await logToDb(supabase, 'API AVISO', `Nenhuma assinatura para User ${user_id}`);
      return NextResponse.json({ message: 'Sem assinaturas no banco (O navegador não pediu permissão?)' });
    }

    // Prepara envio
    const payload = JSON.stringify({
      title: titulo,
      body: mensagem,
      url: link || '/',
      icon: '/icons/icon-192x192.png',
      tag: `notif-${Date.now()}`
    });

    // Dispara
    const promises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription_data, payload)
        .then(() => ({ success: true }))
        .catch(e => {
            // Se der erro 410 (Gone), significa que a inscrição é velha e pode ser removida
            if (e.statusCode === 410 || e.statusCode === 404) {
                console.log("Removendo inscrição inválida/antiga...");
            }
            return { success: false, error: e.statusCode };
        })
    );

    await Promise.all(promises);
    await logToDb(supabase, 'API SUCESSO', `Enviado para ${subscriptions.length} dispositivos`);

    return NextResponse.json({ success: true });

  } catch (error) {
    await logToDb(supabase, 'API CRASH', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) { return handleRequest(req, 'POST'); }
export async function GET(req) { return handleRequest(req, 'GET'); }
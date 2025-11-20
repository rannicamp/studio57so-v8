import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

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
    const rawBody = await req.json();
    
    const title = rawBody.title || 'Nova Notificação';
    const message = rawBody.message || rawBody.body; 
    const url = rawBody.url || rawBody.link || '/crm';
    const orgId = rawBody.organizacaoId || rawBody.organizacao_id;
    
    if (!message) {
        return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
    }

    let targetUserIds = [];

    // 1. Se veio userId direto
    if (rawBody.userId) {
        targetUserIds.push(rawBody.userId);
    } 
    // 2. Se veio organizacaoId (Broadcast para a equipe)
    else if (orgId) {
        const { data: users } = await supabaseAdmin
            .from('usuarios')
            .select('id')
            .eq('organizacao_id', orgId)
            .eq('is_active', true);
        
        if (users && users.length > 0) {
            targetUserIds = users.map(u => u.id);
        }
    }

    if (targetUserIds.length === 0) {
         return NextResponse.json({ message: 'Nenhum destinatário encontrado.' }, { status: 200 });
    }

    const results = await Promise.all(targetUserIds.map(async (uid) => {
        // A. Salva no histórico visual
        await supabaseAdmin.from('notificacoes').insert({
            user_id: uid,
            titulo: title,
            mensagem: message,
            link: url,
            lida: false,
            organizacao_id: orgId
        });

        // B. Busca dispositivos push
        const { data: subscriptions } = await supabaseAdmin
            .from('notification_subscriptions')
            .select('subscription_data, endpoint')
            .eq('user_id', uid);

        if (!subscriptions || subscriptions.length === 0) return { uid, status: 'no_device' };

        // C. Dispara push
        const payload = JSON.stringify({ title, body: message, url });
        
        const pushPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub.subscription_data, payload);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabaseAdmin.from('notification_subscriptions').delete().eq('endpoint', sub.endpoint);
                }
            }
        });
        
        await Promise.all(pushPromises);
        return { uid, status: 'sent' };
    }));

    return NextResponse.json({ success: true, details: results });

  } catch (error) {
    console.error('[Notification API] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
// app/api/notifications/push/route.js
import { createClient } from '@supabase/supabase-js';
import webPush from 'web-push';
import { NextResponse } from 'next/server';

// Configura as chaves do Web Push
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        'mailto:suporte@studio57.arq.br',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { type, table, record } = body;

        // Validação básica
        if (type !== 'INSERT' || table !== 'notificacoes' || !record.enviar_push) {
            return NextResponse.json({ message: 'Ignorado: Não requer push' });
        }

        console.log(`[Push API] Processando envio para User ID: ${record.user_id}`);

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: subs, error } = await supabase
            .from('notification_subscriptions')
            .select('*')
            .eq('user_id', record.user_id);

        if (error || !subs || subs.length === 0) {
            return NextResponse.json({ message: 'Sem dispositivos' });
        }

        // 1. Payload Otimizado
        const payload = JSON.stringify({
            title: record.titulo,
            body: record.mensagem,
            url: record.link,
            icon: '/icons/icon-192x192.png',
            // 2. TAG ÚNICA: Usa o ID para garantir que o Android vibre em cada nova mensagem
            tag: `${record.tipo}-${record.id}`, 
            timestamp: Date.now()
        });

        // 3. Opções de Entrega (CRUCIAL PARA ANDROID)
        const pushOptions = {
            TTL: 60 * 60 * 24, // Tenta entregar por 24 horas se o celular estiver desligado
            headers: {
                'Urgency': 'high' // Prioridade Alta: Acorda o dispositivo
            }
        };

        const promises = subs.map(sub => 
            webPush.sendNotification(sub.subscription_data, payload, pushOptions)
                .then(() => ({ success: true, id: sub.id }))
                .catch(err => {
                    console.error(`[Push API] Falha (ID ${sub.id}):`, err.statusCode);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        return supabase.from('notification_subscriptions').delete().eq('id', sub.id);
                    }
                    return ({ success: false });
                })
        );

        await Promise.allSettled(promises);
        return NextResponse.json({ success: true, devices: subs.length });

    } catch (error) {
        console.error('[Push API] Erro Crítico:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
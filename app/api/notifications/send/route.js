// app/api/notifications/send/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:seu-email-de-contato@exemplo.com', // Pode ser um email seu
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
    const supabase = createClient();

    try {
        const notificationPayload = await request.json();
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('subscription_object');

        if (error) throw error;

        const sendPromises = subscriptions.map(s =>
            webpush.sendNotification(s.subscription_object, JSON.stringify(notificationPayload))
        );

        await Promise.all(sendPromises);

        return NextResponse.json({ success: true, sentTo: subscriptions.length });

    } catch (error) {
        console.error('[API SEND NOTIFICATION ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
// app/api/notifications/send/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import webpush from 'web-push';

// Verifique se as variáveis de ambiente estão carregadas
if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error('VAPID keys are not defined in environment variables.');
  // Em um ambiente de produção, você pode querer lançar um erro ou lidar com isso de outra forma
}

webpush.setVapidDetails(
  'mailto:rannierecampos@studio57.arq.br', // E-mail de contato real
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

        // Filtra assinaturas inválidas ou nulas antes de tentar enviar
        const validSubscriptions = subscriptions.filter(s => s && s.subscription_object);

        if (validSubscriptions.length === 0) {
            console.log('No valid push subscriptions found.');
            return NextResponse.json({ success: true, sentTo: 0, message: "No valid subscriptions found." });
        }

        const sendPromises = validSubscriptions.map(s =>
            webpush.sendNotification(s.subscription_object, JSON.stringify(notificationPayload))
        );

        await Promise.all(sendPromises);

        return NextResponse.json({ success: true, sentTo: validSubscriptions.length });

    } catch (error) {
        console.error('[API SEND NOTIFICATION ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
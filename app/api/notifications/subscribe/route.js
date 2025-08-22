// app/api/notifications/subscribe/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const supabase = createClient();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
        }

        const subscription = await request.json();
        if (!subscription || !subscription.endpoint) {
             return NextResponse.json({ error: 'Objeto de inscrição inválido.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                user_id: user.id,
                subscription_object: subscription
            }, {
                onConflict: 'user_id, subscription_object' // Evita duplicatas
            });

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[API SUBSCRIBE ERROR]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
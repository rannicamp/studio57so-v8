// Local: app/api/notifications/subscribe/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const subscription = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tenta inserir ou atualizar a inscrição
    // Usamos o 'endpoint' como chave única para evitar duplicatas do mesmo dispositivo
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription_data: subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar inscrição Push:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
// app/api/notifications/subscribe/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !userId) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1. Busca a organização do usuário para manter a consistência
    const { data: userConfig } = await supabase
      .from('usuarios')
      .select('organizacao_id')
      .eq('id', userId)
      .single();

    // 2. Salva a inscrição (Upsert pelo endpoint que é único)
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        subscription_data: subscription, // O JSON completo (keys, auth, etc)
        organizacao_id: userConfig?.organizacao_id,
        updated_at: new Date().toISOString() // Força atualização da data
      }, { onConflict: 'endpoint' });

    if (error) {
      console.error('[Subscribe API] Erro de Banco:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Subscribe API] Erro Fatal:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
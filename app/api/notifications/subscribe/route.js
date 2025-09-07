// Caminho: app/api/notifications/subscribe/route.js
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = createClient();

  // 1. Pega o usuário que está fazendo a solicitação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 });
  }

  try {
    // 2. Pega a "assinatura" (o endereço de notificação) que o navegador enviou
    const subscription = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Assinatura de notificação inválida' }, { status: 400 });
    }

    // 3. Salva na tabela 'notification_subscriptions'
    // O comando 'upsert' insere um novo registro, mas se já existir um igual, ele o ignora, evitando duplicatas.
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: user.id,
        subscription: subscription // A coluna se chama 'subscription'
      }, {
        onConflict: 'user_id, subscription' // A chave para evitar duplicatas
      });

    if (error) {
      console.error('Erro ao salvar assinatura no Supabase:', error);
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Inscrição salva com sucesso' });

  } catch (error) {
    console.error('Erro na API /api/notifications/subscribe:', error);
    return NextResponse.json({ error: 'Falha ao salvar a inscrição', details: error.message }, { status: 500 });
  }
}
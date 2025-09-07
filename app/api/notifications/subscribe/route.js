// app/api/notifications/subscribe/route.js

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // 1. Pega os dados da sessão para saber qual usuário está logado
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = session.user;

    // 2. Pega o "endereço de entrega" (subscription) que o frontend enviou
    const subscription = await request.json();

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription não fornecida' }, { status: 400 });
    }

    // 3. Salva o endereço no banco de dados, associado ao usuário logado
    // Usamos "upsert" para que se o usuário já tiver uma inscrição, ela seja atualizada.
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ 
        user_id: user.id, 
        subscription_data: subscription 
      }, { onConflict: 'user_id' }); // Se já existir para esse user_id, atualiza

    if (error) {
      console.error('Erro ao salvar subscription no Supabase:', error);
      throw error;
    }

    console.log('Inscrição salva com sucesso para o usuário:', user.id);
    return NextResponse.json({ message: 'Inscrição salva com sucesso!' }, { status: 201 });

  } catch (error) {
    console.error('Erro na API /api/notifications/subscribe:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
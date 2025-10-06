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
    // 2. (NOVO) Busca o perfil do usuário para encontrar a qual organização ele pertence
    // Assumindo que você tem uma tabela 'perfis' que liga o user_id à organizacao_id
    const { data: profile, error: profileError } = await supabase
      .from('perfis')
      .select('organizacao_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.organizacao_id) {
      console.error('Erro ao buscar perfil/organização do usuário:', profileError);
      return NextResponse.json({ error: 'Perfil do usuário ou organização não encontrado' }, { status: 404 });
    }

    // 3. Pega a "assinatura" (o endereço de notificação) que o navegador enviou
    const subscription = await request.json();
    const endpoint = subscription.endpoint;

    if (!subscription || !endpoint) {
      return NextResponse.json({ error: 'Assinatura de notificação inválida' }, { status: 400 });
    }

    // 4. (MODIFICADO) Salva na tabela correta, incluindo a organização e o endpoint
    // O comando 'upsert' agora usa o 'endpoint' como chave única para evitar duplicatas.
    const { error: upsertError } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: user.id,
        organizacao_id: profile.organizacao_id, // Adicionamos a organização
        endpoint: endpoint,                      // Usamos o endpoint como identificador
        subscription_data: subscription          // Salvamos o objeto completo aqui
      }, {
        onConflict: 'endpoint' // Evita duplicatas com base no endpoint
      });

    if (upsertError) {
      console.error('Erro ao salvar assinatura no Supabase:', upsertError);
      throw upsertError;
    }

    return NextResponse.json({ success: true, message: 'Inscrição salva com sucesso' });

  } catch (error) {
    console.error('Erro na API /api/notifications/subscribe:', error);
    return NextResponse.json({ error: 'Falha ao salvar a inscrição', details: error.message }, { status: 500 });
  }
}
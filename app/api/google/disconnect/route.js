import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request) {
  try {
    const supabase = await createClient();

    // 1. Verifica se o usuário está logado
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Deleta a integração do banco de dados
    const { error: deleteError } = await supabase
      .from('integracoes_google')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Erro ao deletar integração no banco:', deleteError);
      return NextResponse.json({ error: 'Erro ao desconectar no banco' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro crítico no endpoint de desconexão do Google:', error);
    return NextResponse.json({ error: 'Erro interno ao desconectar' }, { status: 500 });
  }
}

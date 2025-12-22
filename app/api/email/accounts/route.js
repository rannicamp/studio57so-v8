import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  // ADICIONADO: await aqui para esperar a conexão
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Busca todas as contas do usuário
    const { data: accounts, error } = await supabase
      .from('email_configuracoes')
      .select('id, conta_apelido, email, nome_remetente')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ accounts: accounts || [] });

  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    return NextResponse.json({ error: 'Erro ao buscar contas' }, { status: 500 });
  }
}
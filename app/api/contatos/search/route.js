import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  // Só busca se tiver pelo menos 2 letras
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // Busca na tabela de contatos (Nome, Razão Social ou Email)
    // Importante: Filtramos apenas contatos que têm e-mail cadastrado
    const { data, error } = await supabase
      .from('contatos')
      .select('id, nome, email, razao_social, nome_fantasia')
      .eq('organizacao_id', user.user_metadata.organizacao_id) // Segurança: só da sua empresa
      .or(`nome.ilike.%${query}%,email.ilike.%${query}%,razao_social.ilike.%${query}%`)
      .neq('email', null) // Garante que tem email
      .limit(5); // Traz só 5 para não poluir

    if (error) throw error;

    return NextResponse.json(data || []);

  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return NextResponse.json([], { status: 500 });
  }
}
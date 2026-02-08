// Local do Arquivo: app/api/admin/check-users/route.js
import { createClient } from '@/utils/supabase/server';
import { buscarIdsPorPermissao } from '@/utils/permissions';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { permissao, organizacaoId } = await request.json();
    const supabase = await createClient();

    // 1. Pega os IDs usando a lógica centralizada
    const ids = await buscarIdsPorPermissao(permissao, organizacaoId);

    if (!ids.length) {
      return NextResponse.json({ users: [] });
    }

    // 2. Busca os nomes e emails desses IDs para mostrar na tela
    const { data: users } = await supabase
      .from('usuarios')
      .select('id, nome, email, funcao_id, funcoes(nome_funcao)')
      .in('id', ids);

    return NextResponse.json({ users: users || [] });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
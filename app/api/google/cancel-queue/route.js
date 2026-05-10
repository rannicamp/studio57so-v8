import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { organizacao_id } = body;

    if (!organizacao_id) {
      return NextResponse.json({ error: 'organizacao_id é obrigatório' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Remove todos os itens pendentes da fila para esta organização
    const { data, error, count } = await supabase
      .from('sync_queue')
      .delete({ count: 'exact' })
      .eq('organizacao_id', organizacao_id)
      .eq('status', 'pendente');

    if (error) {
      console.error('Erro ao cancelar fila:', error);
      return NextResponse.json({ error: 'Falha ao cancelar fila' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: count || 0 });

  } catch (error) {
    console.error('Erro na Rota cancel-queue:', error);
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 });
  }
}

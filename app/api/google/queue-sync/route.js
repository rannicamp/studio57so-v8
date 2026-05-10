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
    const { contatosIds, organizacao_id, user_id } = body;

    if (!contatosIds || !Array.isArray(contatosIds) || contatosIds.length === 0) {
      return NextResponse.json({ error: 'contatosIds é obrigatório e deve ser um array com itens' }, { status: 400 });
    }

    if (!organizacao_id || !user_id) {
      return NextResponse.json({ error: 'organizacao_id e user_id são obrigatórios' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Mapear os contatos para o formato da fila
    const payload = contatosIds.map(contatoId => ({
      contato_id: contatoId,
      organizacao_id,
      user_id,
      status: 'pendente'
    }));

    // Inserir todos na tabela sync_queue
    const { error } = await supabase
      .from('sync_queue')
      .insert(payload);

    if (error) {
      console.error('Erro ao inserir na fila de sync:', error);
      return NextResponse.json({ error: 'Falha ao colocar na fila' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: payload.length });

  } catch (error) {
    console.error('Erro na Rota queue-sync:', error);
    return NextResponse.json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 });
  }
}

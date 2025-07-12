// app/api/test-insert/route.js

import { NextResponse } from 'next/server';
// CORREÇÃO: O caminho foi ajustado de 4 para 3 níveis de diretório.
import { createClient } from '../../../utils/supabase/server';

export async function POST(request) {
  // Cria um cliente Supabase para o servidor
  const supabase = createClient();

  // Define os dados de teste que vamos tentar salvar
  const testMessage = {
    message_id: `test_${Date.now()}`, // ID de mensagem único para o teste
    sender_id: 'SYSTEM_TEST',
    receiver_id: 'SYSTEM_TEST',
    content: 'Esta é uma mensagem de teste direto da API.',
    direction: 'OUT',
    status: 'SENT',
    sent_at: new Date().toISOString()
  };

  try {
    // Tenta inserir a mensagem de teste na tabela
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .insert(testMessage)
      .select()
      .single();

    if (error) {
      // Se houver um erro do Supabase, retorna o erro detalhado
      console.error('Erro no teste de inserção:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Se funcionar, retorna uma mensagem de sucesso com os dados inseridos
    return NextResponse.json({ success: true, message: 'Dados de teste inseridos com sucesso!', data });

  } catch (e) {
    // Captura qualquer outro erro inesperado
    console.error('Erro inesperado na API de teste:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
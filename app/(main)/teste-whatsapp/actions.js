// app/(main)/teste-whatsapp/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'

export async function getRawMessages() {
  const supabase = createClient()
  
  // --- NOSSO TRUQUE ESTÁ AQUI ---
  // Vamos forçar a busca para a organização 2, ignorando o usuário logado.
  const organizacaoId = 2;
  console.log(`--- TESTE FORÇADO --- Buscando mensagens para a organização ID: ${organizacaoId}`);

  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('organizacao_id', organizacaoId) // Usando o ID forçado
    .order('sent_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Erro grave ao buscar mensagens brutas (com ID forçado):', error)
    throw new Error('Falha ao buscar dados no Supabase: ' + error.message)
  }

  if (data.length === 0) {
      console.warn("A busca com o ID forçado não retornou resultados. Verifique se as políticas de RLS (Row Level Security) estão permitindo a leitura para esta tabela.");
  } else {
      console.log(`--- SUCESSO --- Encontradas ${data.length} mensagens com o ID forçado.`);
  }

  return data
}
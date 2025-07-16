// Caminho do arquivo: app/(landingpages)/residencialalfa/actions.js

'use server'; // <-- Isso diz que este código SÓ roda no servidor.

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

// Esta é a nossa ação para salvar o lead.
export async function salvarLead(formData) {
  // Pega os dados digitados no formulário
  const nome = formData.get('nome');
  const email = formData.get('email');
  const telefone = formData.get('telefone');

  // Cria a conexão com o banco de dados Supabase
  const supabase = createClient();

  // Tenta inserir o novo contato na sua tabela 'contatos'
  const { error } = await supabase.from('contatos').insert({
    nome: nome,
    email: email,
    telefone: telefone,
    origem: 'Landing Page - Residencial Alfa'
  });

  if (error) {
    // Se der um erro, ele será mostrado no console do sistema
    console.error('Erro ao salvar o lead:', error);
  } else {
    // Se der tudo certo, o usuário será redirecionado para a página de "obrigado"
    redirect('/residencialalfa/obrigado');
  }
}
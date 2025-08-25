// Caminho do arquivo: app/(landingpages)/residencialalfa/actions.js

'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export async function salvarLead(formData) {
  const nome = formData.get('nome');
  const email = formData.get('email');
  const telefone = formData.get('telefone');
  const origem = formData.get('origem'); // <-- Lendo a origem do formulário
  const supabase = createClient();

  // Busca o ID do contato recém-criado
  const { data: novoContato, error } = await supabase.from('contatos').insert({
    nome: nome,
    origem: origem, // <-- Usando a variável 'origem'
    tipo_contato: 'Lead',
    personalidade_juridica: 'Pessoa Física'
  }).select('id').single();
  

  if (error) {
    console.error('Erro ao salvar o lead:', error);
    // Adicionar um tratamento de erro para o usuário aqui seria uma boa prática
  } else {
    // Se o contato foi criado, agora salvamos o email e telefone nas tabelas corretas
    const contatoId = novoContato.id;
    if (email) {
        await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' });
    }
    if (telefone) {
        await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefone.replace(/\D/g, ''), tipo: 'Celular' });
    }
    redirect('/residencialalfa/obrigado');
  }
}
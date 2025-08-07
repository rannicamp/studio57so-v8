// Caminho do arquivo: app/(landingpages)/residencialalfa/actions.js

'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export async function salvarLead(formData) {
  const nome = formData.get('nome');
  const email = formData.get('email');
  const telefone = formData.get('telefone');
  const supabase = createClient();

  // *** ALTERAÇÃO AQUI ***
  // Adiciona o campo 'origem' ao salvar o lead
  const { error } = await supabase.from('contatos').insert({
    nome: nome,
    // email: email, // Removido para salvar na tabela de emails
    // telefone: telefone, // Removido para salvar na tabela de telefones
    origem: 'Landing Page - Residencial Alfa', // Define a origem do lead
    tipo_contato: 'Lead',
    personalidade_juridica: 'Pessoa Física'
  }).select('id').single();
  // *** FIM DA ALTERAÇÃO ***

  if (error) {
    console.error('Erro ao salvar o lead:', error);
  } else {
    // Se o contato foi criado, agora salvamos o email e telefone nas tabelas corretas
    const contatoId = (await supabase.from('contatos').select('id').eq('nome', nome)).data[0].id;
    if (email) {
        await supabase.from('emails').insert({ contato_id: contatoId, email: email, tipo: 'Principal' });
    }
    if (telefone) {
        await supabase.from('telefones').insert({ contato_id: contatoId, telefone: telefone.replace(/\D/g, ''), tipo: 'Celular' });
    }
    redirect('/residencialalfa/obrigado');
  }
}
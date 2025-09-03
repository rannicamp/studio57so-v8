// app/(public)/cadastro-cliente/actions.js
'use server';

import { createServerClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function createContact(prevState, formData) {
  const supabase = createServerClient();

  const tipoPessoa = formData.get('tipoPessoa');
  const rawData = Object.fromEntries(formData.entries());

  const contactData = {
    // Campos Comuns
    origem: 'Cadastro Público via Link',
    cep: rawData.cep,
    address_street: rawData.address_street,
    address_number: rawData.address_number,
    address_complement: rawData.address_complement,
    neighborhood: rawData.neighborhood,
    city: rawData.city,
    state: rawData.state,
    observations: rawData.observations,

    // Campos Dinâmicos (PF ou PJ)
    ...(tipoPessoa === 'pf' ? {
      nome: rawData.nome,
      cpf: rawData.cpf,
      rg: rawData.rg,
      birth_date: rawData.birth_date,
      nacionalidade: rawData.nacionalidade,
      estado_civil: rawData.estado_civil,
      regime_bens: rawData.regime_bens,
      dados_conjuge: rawData.estado_civil === 'Casado(a)' || rawData.estado_civil === 'União Estável' ? {
        nome: rawData.conjuge_nome,
        cpf: rawData.conjuge_cpf,
        rg: rawData.conjuge_rg
      } : null,
    } : {
      razao_social: rawData.razao_social,
      nome_fantasia: rawData.nome_fantasia,
      cnpj: rawData.cnpj,
      inscricao_estadual: rawData.inscricao_estadual,
      responsavel_legal: rawData.responsavel_legal,
      pessoa_contato: rawData.pessoa_contato
    })
  };

  // 1. Insere o contato principal
  const { data: newContact, error } = await supabase
    .from('contatos')
    .insert(contactData)
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao inserir contato:', error);
    return { message: `Erro ao criar contato: ${error.message}` };
  }

  const newContactId = newContact.id;

  // 2. Insere telefones e emails associados
  const telefones = [
    { contato_id: newContactId, telefone: rawData.telefone_principal, tipo: 'Principal' },
    rawData.telefone_secundario && { contato_id: newContactId, telefone: rawData.telefone_secundario, tipo: 'Secundário' }
  ].filter(Boolean);

  const emails = [
    { contato_id: newContactId, email: rawData.email_principal, tipo: 'Principal' },
    rawData.email_secundario && { contato_id: newContactId, email: rawData.email_secundario, tipo: 'Secundário' }
  ].filter(Boolean);

  const { error: telError } = await supabase.from('telefones').insert(telefones);
  if (telError) {
    console.error('Erro ao inserir telefones:', telError);
    // Poderíamos deletar o contato aqui para consistência, mas por enquanto só logamos o erro.
    return { message: `Erro ao salvar telefones: ${telError.message}` };
  }

  const { error: emailError } = await supabase.from('emails').insert(emails);
  if (emailError) {
    console.error('Erro ao inserir emails:', emailError);
    return { message: `Erro ao salvar e-mails: ${emailError.message}` };
  }

  // 3. Redireciona para a página de sucesso
  redirect('/cadastro-cliente/obrigado');
}
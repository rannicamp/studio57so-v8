// app/(public)/cadastrocliente/[slug]/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createContact(prevState, formData) {
  const supabase = await createClient();
  const rawData = Object.fromEntries(formData.entries());
  const organizacaoId = rawData.organizacao_id;

  if (!organizacaoId) {
    return { message: 'Erro: ID da Organização não encontrado. O formulário não pode ser enviado.' };
  }

  const tipoPessoa = rawData.tipoPessoa;

  const contactData = {
    organizacao_id: organizacaoId,
    tipo_contato: 'Cliente',
    origem: 'Cadastro Público via Link',
    cep: rawData.cep,
    address_street: rawData.address_street,
    address_number: rawData.address_number,
    address_complement: rawData.address_complement,
    neighborhood: rawData.neighborhood,
    city: rawData.city,
    state: rawData.state,
    observations: rawData.observations,
    cargo: rawData.cargo,
  };

  if (tipoPessoa === 'pf') {
    Object.assign(contactData, {
      nome: rawData.nome,
      cpf: rawData.cpf,
      rg: rawData.rg,
      birth_date: rawData.birth_date || null,
      nacionalidade: rawData.nacionalidade,
      estado_civil: rawData.estado_civil,
      regime_bens: rawData.regime_bens,
      personalidade_juridica: 'Pessoa Física',
    });
  } else {
    Object.assign(contactData, {
      razao_social: rawData.razao_social,
      nome_fantasia: rawData.nome_fantasia,
      cnpj: rawData.cnpj,
      inscricao_estadual: rawData.inscricao_estadual,
      responsavel_legal: rawData.responsavel_legal,
      pessoa_contato: rawData.pessoa_contato,
      personalidade_juridica: 'Pessoa Jurídica',
    });
  }

  try {
    const { data: mainContact, error: mainError } = await supabase
      .from('contatos')
      .insert(contactData)
      .select('id')
      .single();

    if (mainError) {
      console.error('Erro ao inserir contato principal:', mainError);
      return { message: `Erro ao criar contato: ${mainError.message}` };
    }

    const mainContactId = mainContact.id;
    const hasConjuge = rawData.conjuge_nome && (rawData.estado_civil === 'Casado(a)' || rawData.estado_civil === 'União Estável');
    
    if (hasConjuge) {
      const { data: conjugeContact, error: conjugeError } = await supabase
        .from('contatos')
        .insert({
          organizacao_id: organizacaoId,
          tipo_contato: 'Outros',
          nome: rawData.conjuge_nome,
          cpf: rawData.conjuge_cpf,
          rg: rawData.conjuge_rg,
          conjuge_id: mainContactId,
          personalidade_juridica: 'Pessoa Física',
        })
        .select('id')
        .single();

      if (!conjugeError) {
        await supabase
          .from('contatos')
          .update({ conjuge_id: conjugeContact.id })
          .eq('id', mainContactId);
      }
    }

    const telefones = [
      { contato_id: mainContactId, telefone: rawData.telefone_principal, tipo: 'Principal' },
      rawData.telefone_secundario && { contato_id: mainContactId, telefone: rawData.telefone_secundario, tipo: 'Secundário' }
    ].filter(Boolean);

    const emails = [
      { contato_id: mainContactId, email: rawData.email_principal, tipo: 'Principal' },
      rawData.email_secundario && { contato_id: mainContactId, email: rawData.email_secundario, tipo: 'Secundário' }
    ].filter(Boolean);

    if (telefones.length > 0) {
        await supabase.from('telefones').insert(telefones);
    }
    if (emails.length > 0) {
        await supabase.from('emails').insert(emails);
    }
    
    // ===== MUDANÇA AQUI =====
    // Redireciona para a página de obrigado DENTRO de /cadastrocliente
    redirect('/cadastrocliente/obrigado');

  } catch (error) {
    console.error('Erro inesperado:', error);
    return { message: 'Ocorreu um erro inesperado.' };
  }
}
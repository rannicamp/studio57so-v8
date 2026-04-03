// app/cadastro/actions.js

'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function signUpAction(formData) {
 try {
  const cookieStore = cookies();
  const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
  cookies: {
  get(name) {
  return cookieStore.get(name)?.value;
  },
  },
  // Precisamos contornar o RLS do service role para conseguir criar e amarrar
  // os registros (Organização -> Empresa) sem estar logado no banco.
  // O signup natural do auth.users não bate no banco público com os mesmos poderes.
  }
  );

  // Instância de Admin para criar dados no banco que o usuário anônimo não tem RLS pra inserir
  const supabaseAdmin = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // A chave que pula RLS
  {
  cookies: { get(name) { return null; } },
  }
  );

  const tipoPessoa = formData.get('tipoPessoa');

  // Dados do Admin
  const admin_nome = formData.get('admin_nome');
  const admin_email = formData.get('admin_email');
  const admin_senha = formData.get('admin_senha');
  const admin_telefone = formData.get('admin_telefone');

  // Dados da Empresa/PF
  const cnpj = formData.get('cnpj');
  const razao_social = formData.get('razao_social');
  const nome_fantasia = formData.get('nome_fantasia');
  const cpf = formData.get('cpf');

  // Endereço
  const cep = formData.get('cep');
  const address_street = formData.get('address_street');
  const address_number = formData.get('address_number');
  const address_complement = formData.get('address_complement');
  const neighborhood = formData.get('neighborhood');
  const city = formData.get('city');
  const state = formData.get('state');

  // 1. Criar a Organização
  const nomeOrganizacao = tipoPessoa === 'PJ' ? razao_social : admin_nome;

  const { data: orgData, error: orgError } = await supabaseAdmin
  .from('organizacoes')
  .insert([{ nome: nomeOrganizacao }])
  .select('id')
  .single();

  if (orgError) {
  console.error("Erro ao criar Org:", orgError);
  return { error: { message: 'Não foi possível iniciar sua organização. Tente novamente.' } };
  }

  const organizacaoId = orgData.id;

  // 2. Criar o Registro Base em `cadastro_empresa`
  // PFs também entram aqui para satisfazer a arquitetura do núcleo do sistema.
  // CNPJ precisa ser null explícito quando vazio se não banco barra a constraint original
  const payloadEmpresa = {
  organizacao_id: organizacaoId,
  natureza_juridica: tipoPessoa,
  razao_social: tipoPessoa === 'PJ' ? razao_social : admin_nome,
  nome_fantasia: tipoPessoa === 'PJ' ? nome_fantasia : admin_nome,
  cnpj: (tipoPessoa === 'PJ' && cnpj) ? cnpj : null,
  cep: cep || null,
  address_street: address_street || null,
  address_number: address_number || null,
  address_complement: address_complement || null,
  neighborhood: neighborhood || null,
  city: city || null,
  state: state || null,
  telefone: admin_telefone,
  email: admin_email,
  responsavel_legal: admin_nome,
  };

  const { data: empresaData, error: empresaError } = await supabaseAdmin
  .from('cadastro_empresa')
  .insert([payloadEmpresa])
  .select('id')
  .single();

  if (empresaError) {
  console.error("Erro ao criar cadastro base da empresa:", empresaError);
  await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId); // Rollback
  return { error: { message: 'Incompatibilidade na Tabela Empresa: ' + empresaError.message } };
  }

  // 3. Vincular Entidade à Organização
  const { error: vincularError } = await supabaseAdmin
  .from('organizacoes')
  .update({ entidade_principal_id: empresaData.id })
  .eq('id', organizacaoId);

  // 4. Criar o usuário Supabase (Auth)
  // Nota: Isso envia um e-mail de confirmação.
  const { data, error } = await supabase.auth.signUp({
  email: admin_email,
  password: admin_senha,
  options: {
  data: {
  full_name: admin_nome,
  organizacao_id: organizacaoId,
  },
  },
  });

  if (error) {
  console.error("Erro ao criar Auth User:", error);
  // Rollback brutal
  await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaData.id);
  await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
  return { error: { message: error.message } };
  }

  return { data };
 } catch(err) {
  console.error('Edge crash prevent', err)
  return { error: { message: 'Falha grave no Edge DB Connect.' } }
 }
}
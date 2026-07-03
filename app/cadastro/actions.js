// app/cadastro/actions.js

'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { obterOuCriarCliente, criarAssinatura, obterLinkPagamentoAssinatura } from '@/lib/asaas';

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

  // Parâmetros de Plano e Cupom
  const planoCodigo = formData.get('plano_codigo') || 'essencial';
  const cupom = formData.get('cupom') || '';

  // 1. Consultar os dados do plano no banco
  const { data: planoRecord, error: planoQueryError } = await supabaseAdmin
    .from('planos')
    .select('*')
    .eq('codigo', planoCodigo)
    .single();

  if (planoQueryError || !planoRecord) {
    console.error("Erro ao consultar plano no cadastro:", planoQueryError);
    return { error: { message: 'Plano inválido ou não encontrado. Selecione um plano válido.' } };
  }

  // 2. Consultar os dados do cupom no banco
  let trialDays = 15;
  let descontoPercentual = 0.00;
  let cupomAplicado = null;

  if (cupom) {
    const { data: promocaoRecord } = await supabaseAdmin
      .from('promocoes')
      .select('*')
      .eq('codigo', cupom.toUpperCase())
      .eq('ativo', true)
      .maybeSingle();

    if (promocaoRecord) {
      trialDays = promocaoRecord.trial_days || 15;
      descontoPercentual = Number(promocaoRecord.desconto_percentual) || 0.00;
      cupomAplicado = promocaoRecord.codigo;
    }
  }

  // 3. Criar a Organização
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

  // 4. Criar o Registro Base em `cadastro_empresa`
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

  // 5. Vincular Entidade à Organização
  const { error: vincularError } = await supabaseAdmin
  .from('organizacoes')
  .update({ entidade_principal_id: empresaData.id })
  .eq('id', organizacaoId);

  if (vincularError) {
  console.error("Erro ao vincular empresa principal:", vincularError);
  await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaData.id);
  await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
  return { error: { message: 'Erro ao associar entidade principal.' } };
  }

  // 6. Integração e Sincronização com o Asaas
  let customerId = null;
  let subscriptionId = null;
  let paymentUrl = null;

  // Calculo de carência (trial) e descontos
  const valorTotal = planoRecord.valor_mensal;
  const valorLiquido = Number((valorTotal * (1 - descontoPercentual / 100)).toFixed(2));

  const dataVenc = new Date();
  dataVenc.setDate(dataVenc.getDate() + trialDays);
  const dataVencimentoStr = dataVenc.toISOString().split('T')[0];

  try {
    const dadosClienteAsaas = {
      nome: nomeOrganizacao,
      email: admin_email,
      cpfCnpj: (tipoPessoa === 'PJ' ? cnpj : cpf)?.replace(/\D/g, '') || null,
      phone: admin_telefone?.replace(/\D/g, '') || null,
      postalCode: cep?.replace(/\D/g, '') || null,
      addressNumber: address_number || 'S/N'
    };

    if (!dadosClienteAsaas.cpfCnpj) {
      throw new Error('CPF ou CNPJ é obrigatório para o faturamento da assinatura.');
    }

    // Criar/atualizar ficha de cliente no Asaas
    const customer = await obterOuCriarCliente(dadosClienteAsaas);
    customerId = customer.id;

    // Criar assinatura recorrente
    const assinatura = await criarAssinatura({
      clienteId: customerId,
      valor: valorLiquido,
      ciclo: 'MONTHLY',
      descricao: `Assinatura Elo 57 - Plano ${planoRecord.nome}`,
      dataVencimento: dataVencimentoStr,
      formaPagamento: 'UNDEFINED'
    });
    subscriptionId = assinatura.id;

    // Gerar URL do checkout do Asaas
    paymentUrl = await obterLinkPagamentoAssinatura(subscriptionId);
  } catch (asaasError) {
    console.error("Erro no processamento Asaas durante cadastro:", asaasError.message);
    // Rollback do banco
    await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaData.id);
    await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
    return { error: { message: `Falha no faturamento Asaas: ${asaasError.message}` } };
  }

  // 7. Atualizar a Organização com os dados do Asaas e vencimento do Trial
  const { error: updateBillingError } = await supabaseAdmin
    .from('organizacoes')
    .update({
      plano_codigo: planoCodigo,
      seats_contracted: 1,
      cupom_aplicado: cupomAplicado,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      subscription_status: 'pending', // Bloqueado até registrar cartão no checkout
      trial_ends_at: dataVenc.toISOString(),
      subscription_expires_at: dataVenc.toISOString()
    })
    .eq('id', organizacaoId);

  if (updateBillingError) {
    console.error("Erro ao salvar faturamento na organização:", updateBillingError.message);
    // Rollback
    await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaData.id);
    await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
    return { error: { message: 'Erro ao registrar informações de faturamento.' } };
  }

  // 8. Criar o usuário Supabase (Auth)
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
  // Rollback total
  await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaData.id);
  await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
  return { error: { message: error.message } };
  }

  return { data, paymentUrl };
 } catch(err) {
  console.error('Edge crash prevent', err)
  return { error: { message: 'Falha grave no Edge DB Connect.' } }
 }
}
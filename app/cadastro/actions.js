// app/cadastro/actions.js

'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { obterOuCriarCliente, criarAssinatura, obterLinkPagamentoAssinatura, criarPagamento, cancelarAssinatura, obterPixQrCode, obterPrimeiraCobrancaIdAssinatura } from '@/lib/asaas';

// Função auxiliar segura para buscar o usuário no Supabase Auth por email
async function buscarUsuarioAuthPorEmail(supabaseAdmin, email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  
  // 1. Tentar na tabela public.usuarios primeiro
  try {
    const { data: dbUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, organizacao_id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (dbUser) {
      console.log(`[Cadastro Actions] Usuário encontrado na public.usuarios:`, dbUser.id);
      return {
        id: dbUser.id,
        email: dbUser.email,
        user_metadata: {
          organizacao_id: dbUser.organizacao_id
        }
      };
    }
  } catch (dbErr) {
    console.error("Erro ao buscar na public.usuarios:", dbErr);
  }

  // 2. Chave Mestra: Tentar obter o ID do Auth via generateLink (bypass seguro do listUsers que dá erro de banco)
  try {
    console.log(`[Cadastro Actions] Buscando ID no Auth via generateLink para ${cleanEmail}...`);
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail
    });
    
    if (data?.user) {
      console.log(`[Cadastro Actions] Usuário encontrado no Auth via link de recuperação:`, data.user.id);
      return data.user;
    }
  } catch (linkErr) {
    console.error("Erro no fallback de generateLink:", linkErr);
  }

  // 3. Fallback final: listUsers padrão (primeiros 50)
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (!error && data?.users) {
      const matched = data.users.find(u => u.email?.toLowerCase() === cleanEmail);
      if (matched) return matched;
    }
  } catch (err) {
    console.error("Erro no fallback final de listUsers:", err);
  }

  return null;
}

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
  let valorCobradoFinal = 0;

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
    const cupomCodigo = cupom.toUpperCase().trim();
    if (cupomCodigo === 'ELOTESTE1REAL') {
      trialDays = 0;
      descontoPercentual = 99.99;
      cupomAplicado = 'ELOTESTE1REAL';
    } else {
      const { data: promocaoRecord } = await supabaseAdmin
        .from('promocoes')
        .select('*')
        .eq('codigo', cupomCodigo)
        .eq('ativo', true)
        .maybeSingle();

      if (promocaoRecord) {
        trialDays = promocaoRecord.trial_days || 15;
        descontoPercentual = Number(promocaoRecord.desconto_percentual) || 0.00;
        cupomAplicado = promocaoRecord.codigo;
      }
    }
  }

  // 2.5. Verificar se já existe um cadastro com este CNPJ ou CPF (ambos salvos no campo cnpj)
  const cleanCnpj = (tipoPessoa === 'PJ' && cnpj) ? cnpj.replace(/\D/g, '') : null;
  const cleanCpf = (tipoPessoa === 'PF' && cpf) ? cpf.replace(/\D/g, '') : null;
  const docValue = cleanCnpj || cleanCpf;

  let organizacaoId = null;
  let empresaId = null;
  let asaasCustomerId = null;
  let asaasSubscriptionIdAntigo = null;
  let isReutilizacao = false;

  if (docValue) {
    const { data: existingEmpresa } = await supabaseAdmin
      .from('cadastro_empresa')
      .select('*')
      .eq('cnpj', docValue)
      .maybeSingle();

    if (existingEmpresa) {
      // Buscar status da assinatura da organização existente
      const { data: existingOrg } = await supabaseAdmin
        .from('organizacoes')
        .select('subscription_status, asaas_customer_id, asaas_subscription_id')
        .eq('id', existingEmpresa.organizacao_id)
        .maybeSingle();

      const status = existingOrg?.subscription_status || 'pending';

      if (status === 'pending') {
        // CNPJ existe mas a conta está pendente: vamos atualizar/reutilizar os IDs existentes!
        console.log(`[Cadastro Actions] CNPJ/CPF ${docValue} já existe com assinatura pendente. Reutilizando IDs da Org ${existingEmpresa.organizacao_id}`);
        organizacaoId = existingEmpresa.organizacao_id;
        empresaId = existingEmpresa.id;
        asaasCustomerId = existingOrg?.asaas_customer_id;
        asaasSubscriptionIdAntigo = existingOrg?.asaas_subscription_id;
        isReutilizacao = true;
      } else {
        // Conta ativa ou em trial legítimo: barrar duplicidade
        return { 
          error: { 
            message: `Este ${cleanCnpj ? 'CNPJ' : 'CPF'} já está cadastrado em uma conta ativa. Caso já possua acesso, realize o login.` 
          } 
        };
      }
    }
  }

  // 2.7. Verificar se o e-mail digitado já existe em conta ativa
  let existingAuthUser = null;
  try {
    const { data: dbUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, organizacao_id, email')
      .eq('email', admin_email.toLowerCase().trim())
      .maybeSingle();

    if (dbUser) {
      existingAuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        user_metadata: {
          organizacao_id: dbUser.organizacao_id
        }
      };
    } else {
      existingAuthUser = await buscarUsuarioAuthPorEmail(supabaseAdmin, admin_email);
    }
  } catch (emailErr) {
    console.error("Erro ao verificar e-mail existente no Auth:", emailErr);
  }

  if (existingAuthUser) {
    const orgId = existingAuthUser.user_metadata?.organizacao_id;
    let isOrgActive = false;

    if (orgId) {
      const { data: orgCheck } = await supabaseAdmin
        .from('organizacoes')
        .select('subscription_status')
        .eq('id', orgId)
        .maybeSingle();
        
      if (orgCheck && orgCheck.subscription_status !== 'pending') {
        isOrgActive = true;
      }
    }

    if (isOrgActive) {
      return { error: { message: 'Este e-mail já está cadastrado em uma conta ativa. Caso já possua acesso, realize o login.' } };
    } else {
      console.log(`[Cadastro Actions] E-mail ${admin_email} pertence a conta pendente/órfã. Reutilizaremos as credenciais.`);
    }
  }

  // 3. Criar ou Atualizar a Organização
  const nomeOrganizacao = tipoPessoa === 'PJ' ? razao_social : admin_nome;

  if (isReutilizacao) {
    console.log(`[Cadastro Actions] Atualizando organização existente ID: ${organizacaoId}`);
    const { error: orgError } = await supabaseAdmin
      .from('organizacoes')
      .update({ nome: nomeOrganizacao })
      .eq('id', organizacaoId);

    if (orgError) {
      console.error("Erro ao atualizar Org na reutilização:", orgError);
      return { error: { message: 'Não foi possível atualizar a organização do cadastro.' } };
    }
  } else {
    console.log(`[Cadastro Actions] Criando nova organização...`);
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizacoes')
      .insert([{ nome: nomeOrganizacao }])
      .select('id')
      .single();

    if (orgError) {
      console.error("Erro ao criar Org:", orgError);
      return { error: { message: 'Não foi possível iniciar sua organização. Tente novamente.' } };
    }
    organizacaoId = orgData.id;
  }

  // 4. Criar ou Atualizar o Registro em `cadastro_empresa`
  const payloadEmpresa = {
    organizacao_id: organizacaoId,
    natureza_juridica: tipoPessoa,
    razao_social: tipoPessoa === 'PJ' ? razao_social : admin_nome,
    nome_fantasia: tipoPessoa === 'PJ' ? nome_fantasia : admin_nome,
    cnpj: docValue,
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

  if (isReutilizacao) {
    console.log(`[Cadastro Actions] Atualizando cadastro da empresa ID: ${empresaId}`);
    const { error: empresaError } = await supabaseAdmin
      .from('cadastro_empresa')
      .update(payloadEmpresa)
      .eq('id', empresaId);

    if (empresaError) {
      console.error("Erro ao atualizar empresa na reutilização:", empresaError);
      return { error: { message: 'Erro ao atualizar dados cadastrais da empresa.' } };
    }
  } else {
    console.log(`[Cadastro Actions] Inserindo novo cadastro de empresa...`);
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from('cadastro_empresa')
      .insert([payloadEmpresa])
      .select('id')
      .single();

    if (empresaError) {
      console.error("Erro ao criar cadastro base da empresa:", empresaError);
      await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId); // Rollback
      return { error: { message: 'Erro ao salvar dados fiscais da empresa: ' + empresaError.message } };
    }
    empresaId = empresaData.id;

    // Vincular Entidade à Organização
    const { error: vincularError } = await supabaseAdmin
      .from('organizacoes')
      .update({ entidade_principal_id: empresaId })
      .eq('id', organizacaoId);

    if (vincularError) {
      console.error("Erro ao vincular empresa principal:", vincularError);
      await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaId);
      await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
      return { error: { message: 'Erro ao associar entidade principal.' } };
    }
  }

  const periodicidade = formData.get('periodicidade') || 'anual';

  // Dados de Pagamento do Checkout Transparente
  const formaPagamento = formData.get('forma_pagamento') || 'cartao'; // 'cartao' ou 'pix'
  const cartao_numero = formData.get('cartao_numero');
  const cartao_nome = formData.get('cartao_nome');
  const cartao_validade = formData.get('cartao_validade');
  const cartao_cvv = formData.get('cartao_cvv');

  // Capturar o IP do cliente (obrigatório para cartao transparente no Asaas)
  const headersList = await headers();
  const remoteIp = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || '127.0.0.1';

  // 6. Integração e Sincronização com o Asaas
  let subscriptionId = null;
  let paymentUrl = null;
  let pixQrCode = null;
  let pixCopiaCola = null;

  const dataVenc = new Date();
  dataVenc.setDate(dataVenc.getDate() + trialDays);
  const dataVencimentoStr = dataVenc.toISOString().split('T')[0];

  const meses = periodicidade === 'semestral' ? 6 : 12;
  const dataExpira = new Date(dataVenc);
  dataExpira.setMonth(dataExpira.getMonth() + meses);

  try {
    const dadosClienteAsaas = {
      nome: nomeOrganizacao,
      email: admin_email,
      cpfCnpj: docValue,
      phone: admin_telefone?.replace(/\D/g, '') || null,
      postalCode: cep?.replace(/\D/g, '') || null,
      addressNumber: address_number || 'S/N',
      address: address_street || null,
      province: neighborhood || null,
      state: state || null
    };

    const customer = await obterOuCriarCliente(dadosClienteAsaas);
    const customerId = customer.id;

    // Se já havia uma cobrança pendente associada, cancelamos no Asaas para evitar duplicidade
    if (isReutilizacao && asaasSubscriptionIdAntigo) {
      try {
        console.log(`[Cadastro Actions] Cancelando assinatura anterior pendente no Asaas: ${asaasSubscriptionIdAntigo}`);
        await cancelarAssinatura(asaasSubscriptionIdAntigo);
      } catch (cancelErr) {
        console.warn(`[Cadastro Actions] Falha não impeditiva ao cancelar cobrança antiga no Asaas:`, cancelErr.message);
      }
    }

    // Configura os dados do cartão se a forma de pagamento for cartão de crédito
    let creditCard = null;
    let creditCardHolderInfo = null;
    let billingType = formaPagamento === 'cartao' ? 'CREDIT_CARD' : 'PIX';

    if (formaPagamento === 'cartao' && cartao_numero) {
      let expiryMonth = '';
      let expiryYear = '';
      
      if (cartao_validade) {
        const cleanVal = cartao_validade.replace(/\D/g, '');
        if (cleanVal.length >= 4) {
          expiryMonth = cleanVal.substring(0, 2);
          const yearPart = cleanVal.substring(2, 4);
          expiryYear = yearPart.length === 2 ? '20' + yearPart : yearPart;
        }
      }

      creditCard = {
        holderName: cartao_nome,
        number: cartao_numero.replace(/\D/g, ''),
        expiryMonth,
        expiryYear,
        ccv: cartao_cvv.replace(/\D/g, '')
      };

      creditCardHolderInfo = {
        name: cartao_nome,
        email: admin_email,
        cpfCnpj: docValue,
        postalCode: cep?.replace(/\D/g, '') || '',
        addressNumber: address_number || 'S/N',
        phone: admin_telefone?.replace(/\D/g, '') || '',
        mobilePhone: admin_telefone?.replace(/\D/g, '') || ''
      };
    }

    if (cupomAplicado) {
      let valorPlano = planoRecord.valor_mensal;
      let valorLiquido = cupomAplicado === 'ELOTESTE1REAL' ? 6.00 : Number((valorPlano * (1 - descontoPercentual / 100)).toFixed(2));
      let descPlano = `Garantia Elo 57 - Plano ${planoRecord.nome} (${nomeOrganizacao})`;

      console.log(`[Cadastro Actions] Criando assinatura transparente de garantia no Asaas de R$ ${valorLiquido} com tipo ${billingType}...`);
      const assinatura = await criarAssinatura({
        clienteId: customerId,
        valor: valorLiquido,
        ciclo: 'MONTHLY',
        descricao: descPlano,
        dataVencimento: dataVencimentoStr,
        formaPagamento: billingType,
        creditCard,
        creditCardHolderInfo,
        remoteIp
      });
      subscriptionId = assinatura.id;
      valorCobradoFinal = valorLiquido;

      if (billingType === 'PIX') {
        try {
          const cobrancaId = await obterPrimeiraCobrancaIdAssinatura(subscriptionId);
          const pixRes = await obterPixQrCode(cobrancaId);
          pixQrCode = pixRes.encodedImage;
          pixCopiaCola = pixRes.payload;
        } catch (pixErr) {
          console.error("[Cadastro Actions] Erro ao gerar Pix para assinatura:", pixErr.message);
        }
      } else {
        paymentUrl = await obterLinkPagamentoAssinatura(subscriptionId);
      }
    } else {
      const parcelasInput = Number(formData.get('parcelas'));
      const parcelasMax = periodicidade === 'semestral' ? 3 : 6;
      const parcelasFinal = (parcelasInput >= 1 && parcelasInput <= parcelasMax) ? parcelasInput : parcelasMax;
      const valorMensal = Number(planoRecord.valor_mensal);
      const valorTotal = valorMensal * meses;
      const valorTotalComDesconto = cupomAplicado === 'ELOTESTE1REAL' ? 6.00 : Number((valorTotal * (1 - descontoPercentual / 100)).toFixed(2));
      const descPlano = `Plano Elo 57 - ${planoRecord.nome} ${periodicidade === 'semestral' ? 'Semestral' : 'Anual'} (${nomeOrganizacao})`;

      console.log(`[Cadastro Actions] Criando cobrança transparente de R$ ${valorTotalComDesconto} com tipo ${billingType}...`);
      
      const pagamento = await criarPagamento({
        clienteId: customerId,
        valor: valorTotalComDesconto,
        formaPagamento: billingType,
        dataVencimento: dataVencimentoStr,
        descricao: descPlano,
        parcelas: billingType === 'PIX' ? 1 : parcelasFinal, // PIX é sempre à vista (1x)
        externalReference: organizacaoId,
        creditCard,
        creditCardHolderInfo,
        remoteIp
      });
      subscriptionId = pagamento.id;
      valorCobradoFinal = valorTotalComDesconto;

      if (billingType === 'PIX') {
        try {
          const pixRes = await obterPixQrCode(subscriptionId);
          pixQrCode = pixRes.encodedImage;
          pixCopiaCola = pixRes.payload;
        } catch (pixErr) {
          console.error("[Cadastro Actions] Erro ao gerar Pix para pagamento unico:", pixErr.message);
        }
      } else {
        paymentUrl = pagamento.invoiceUrl;
      }
    }

    // Salvar informações de faturamento na organização
    await supabaseAdmin
      .from('organizacoes')
      .update({
        plano_codigo: planoCodigo,
        seats_contracted: 1,
        cupom_aplicado: cupomAplicado,
        asaas_customer_id: customerId,
        asaas_subscription_id: subscriptionId,
        subscription_status: 'pending',
        trial_ends_at: dataVenc.toISOString(),
        subscription_expires_at: cupomAplicado ? dataVenc.toISOString() : dataExpira.toISOString()
      })
      .eq('id', organizacaoId);

  } catch (asaasError) {
    console.error("Erro no processamento Asaas durante cadastro:", asaasError.message);
    if (!isReutilizacao) {
      // Rollback apenas se for cadastro novo do zero
      await supabaseAdmin.from('organizacoes').update({ entidade_principal_id: null }).eq('id', organizacaoId);
      await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaId);
      await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
    }
    return { error: { message: `Erro de faturamento Asaas: ${asaasError.message}` } };
  }

  // 8. Criar ou Reconfigurar o Usuário do Auth
  if (existingAuthUser) {
    console.log(`[Cadastro Actions] Reutilizando usuário Auth ${existingAuthUser.id} e vinculando à org ${organizacaoId}`);
    
    // Atualiza a senha e o vinculo de organização do usuário no Auth
    const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password: admin_senha,
        user_metadata: {
          full_name: admin_nome,
          organizacao_id: organizacaoId
        }
      }
    );

    if (updateAuthErr) {
      console.error("Erro ao atualizar credenciais do usuário existente no Auth:", updateAuthErr.message);
      return { error: { message: 'Erro ao configurar as credenciais do usuário existente.' } };
    }

    // Vincula na tabela pública public.usuarios
    const { data: dbUserCheck } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('id', existingAuthUser.id)
      .maybeSingle();

    if (dbUserCheck) {
      await supabaseAdmin
        .from('usuarios')
        .update({
          nome: admin_nome,
          organizacao_id: organizacaoId,
          is_active: true,
          aceitou_termos: true
        })
        .eq('id', existingAuthUser.id);
    } else {
      await supabaseAdmin
        .from('usuarios')
        .insert([{
          id: existingAuthUser.id,
          email: admin_email.toLowerCase().trim(),
          nome: admin_nome,
          organizacao_id: organizacaoId,
          is_active: true,
          aceitou_termos: true
        }]);
    }

    // Se o usuário pertencia a outra organizacao antiga pendente, nós a deletamos para manter o banco limpo
    const orgIdAntiga = existingAuthUser.user_metadata?.organizacao_id;
    if (orgIdAntiga && orgIdAntiga !== organizacaoId) {
      console.log(`[Cadastro Actions] Limpando organização anterior pendente ${orgIdAntiga}`);
      try {
        await supabaseAdmin.from('organizacoes').update({ entidade_principal_id: null }).eq('id', orgIdAntiga);
        await supabaseAdmin.from('cadastro_empresa').delete().eq('organizacao_id', orgIdAntiga);
        await supabaseAdmin.from('usuarios').delete().eq('organizacao_id', orgIdAntiga);
        await supabaseAdmin.from('organizacoes').delete().eq('id', orgIdAntiga);
      } catch (limpErr) {
        console.warn("[Cadastro Actions] Limpeza de org antiga falhou silenciosamente:", limpErr.message);
      }
    }
  } else {
    // Criar novo usuário do zero no Auth
    console.log(`[Cadastro Actions] Criando novo usuário Auth para ${admin_email}`);
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
      if (!isReutilizacao) {
        await supabaseAdmin.from('cadastro_empresa').delete().eq('id', empresaId);
        await supabaseAdmin.from('organizacoes').delete().eq('id', organizacaoId);
      }
      return { error: { message: error.message } };
    }

    // Se o usuário foi criado, atualiza na public.usuarios para aceitou_termos: true
    if (data?.user?.id) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay para a trigger rodar
      await supabaseAdmin
        .from('usuarios')
        .update({ aceitou_termos: true })
        .eq('id', data.user.id);
    }
  }

  // Disparar e-mail de boas-vindas e recibo de faturamento em background
  enviarEmailBoasVindas({
    to: admin_email.toLowerCase().trim(),
    nome: admin_nome,
    planoNome: planoRecord.nome,
    vigencia: periodicidade === 'semestral' ? 'Semestral' : 'Anual',
    formaPagamento: formaPagamento,
    valorTotal: valorCobradoFinal,
    paymentUrl: paymentUrl || ''
  }).catch(mailErr => console.error("[Cadastro Actions] Erro ao enviar e-mail de boas-vindas:", mailErr));

  return {
    success: true,
    paymentUrl,
    pixQrCode,
    pixCopiaCola,
    formaPagamento
  };
 } catch(err) {
  console.error('Edge crash prevent', err)
  return { error: { message: 'Falha grave no Edge DB Connect.' } }
 }
}

export async function validarCupomAction(cupomCodigo) {
  try {
    const codigoLimpo = cupomCodigo?.toUpperCase().trim();
    if (codigoLimpo === 'ELOTESTE1REAL') {
      return {
        success: true,
        codigo: 'ELOTESTE1REAL',
        trial_days: 0,
        desconto_percentual: 99.99
      };
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { get(name) { return null; } } }
    );

    const { data, error } = await supabaseAdmin
      .from('promocoes')
      .select('*')
      .eq('codigo', codigoLimpo)
      .eq('ativo', true)
      .maybeSingle();

    if (error) {
      console.error('Erro ao validar cupom:', error.message);
      return { error: 'Falha ao consultar cupom.' };
    }

    if (!data) {
      return { error: 'Cupom inválido ou expirado.' };
    }

    return {
      success: true,
      codigo: data.codigo,
      trial_days: data.trial_days || 15,
      desconto_percentual: Number(data.desconto_percentual) || 0
    };
  } catch (err) {
    console.error('Crash ao validar cupom:', err);
    return { error: 'Erro de conexão com o banco.' };
  }
}

export async function verificarDocumentoStatusAction(documento) {
  try {
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { get(name) { return null; } } }
    );
    
    const cleanDoc = documento.replace(/\D/g, '');
    
    const { data: empresa, error: empresaErr } = await supabaseAdmin
      .from('cadastro_empresa')
      .select('*')
      .eq('cnpj', cleanDoc)
      .maybeSingle();
      
    if (empresaErr) {
      console.error("Erro ao verificar documento existente:", empresaErr);
      return { error: 'Erro ao verificar documento cadastrado.' };
    }
    
    if (empresa) {
      const { data: org, error: orgErr } = await supabaseAdmin
        .from('organizacoes')
        .select('subscription_status, asaas_subscription_id')
        .eq('id', empresa.organizacao_id)
        .maybeSingle();
        
      if (orgErr) {
        console.error("Erro ao buscar organização existente:", orgErr);
        return { error: 'Erro ao verificar status da organização.' };
      }
      
      const status = org?.subscription_status || 'pending';
      
      if (status === 'pending') {
        let checkoutUrl = '';
        if (org.asaas_subscription_id) {
          const id = org.asaas_subscription_id;
          try {
            const asaasKey = process.env.ASAAS_API_KEY;
            const asaasUrl = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
            if (id.startsWith('pay_')) {
              const res = await fetch(`${asaasUrl}/payments/${id}`, {
                headers: { 'access_token': asaasKey }
              });
              if (res.ok) {
                const data = await res.json();
                checkoutUrl = data.invoiceUrl;
              }
            } else if (id.startsWith('sub_')) {
              const res = await fetch(`${asaasUrl}/subscriptions/${id}/payments`, {
                headers: { 'access_token': asaasKey }
              });
              if (res.ok) {
                const data = await res.json();
                const pendingPayment = data.data?.find(p => p.status === 'PENDING');
                checkoutUrl = pendingPayment?.invoiceUrl || '';
              }
            }
          } catch (err) {
            console.error("Erro ao obter checkout do Asaas para documento existente:", err);
          }
        }
        
        return {
          exists: true,
          status: 'pending',
          razao_social: empresa.razao_social,
          email: empresa.email,
          checkoutUrl,
          empresaDetails: {
            razao_social: empresa.razao_social,
            nome_fantasia: empresa.nome_fantasia || '',
            cep: empresa.cep || '',
            address_street: empresa.address_street || '',
            address_number: empresa.address_number || '',
            address_complement: empresa.address_complement || '',
            neighborhood: empresa.neighborhood || '',
            city: empresa.city || '',
            state: empresa.state || '',
            telefone: empresa.telefone || '',
            responsavel_legal: empresa.responsavel_legal || ''
          }
        };
      } else {
        return {
          exists: true,
          status: 'active',
          razao_social: empresa.razao_social
        };
      }
    }
    
    return { exists: false };
  } catch (err) {
    console.error("Erro no verificarDocumentoStatusAction:", err);
    return { error: 'Erro de conexão com o banco.' };
  }
}

export async function deletarCadastroPendenteAction(documento) {
  // Mantemos a action para compatibilidade de rotas, mas o fluxo principal agora atualiza tudo silenciosamente.
  return { success: true };
}

export async function verificarCnpjStatusAction(cnpj) {
  return verificarDocumentoStatusAction(cnpj);
}

// Helpers locais de Criptografia Stateless para OTP
const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'senha-secreta-padrao-elo57-2026';

function encryptOTP(text) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(SECRET_KEY, 'salt-otp-elo57', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptOTP(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const key = crypto.scryptSync(SECRET_KEY, 'salt-otp-elo57', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Server Action para disparar o codigo de seguranca por e-mail
export async function solicitarCodigoVerificacaoAction(email) {
  try {
    const emailLimpo = email?.toLowerCase().trim();
    if (!emailLimpo) return { error: 'E-mail inválido.' };

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { get(name) { return null; } } }
    );

    // Busca credenciais globais do remetente
    const { data: config } = await supabaseAdmin
      .from('email_configuracoes')
      .select('*')
      .eq('email', 'elo57@studio57.arq.br')
      .limit(1)
      .maybeSingle();

    if (!config) {
      console.error("[Cadastro Actions] Credenciais do elo57@studio57.arq.br nao encontradas no banco.");
      return { error: 'O servidor de envio de e-mails não está configurado.' };
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 465,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_user || config.email,
        pass: config.senha_app
      },
      tls: { rejectUnauthorized: false }
    });

    const mailOptions = {
      from: `"${config.nome_remetente || 'Elo 57'}" <${config.email}>`,
      to: emailLimpo,
      subject: `Código de Verificação: ${codigo} - Elo 57`,
      html: `
        <div style="font-family: sans-serif; padding: 25px; color: #1e293b; background-color: #f8fafc; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://studio57.arq.br/marca/logo-elo57-horizontal.svg" alt="Elo 57" style="height: 32px; width: auto; border: none; display: inline-block; outline: none;" />
            <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; font-weight: 500;">Confirmação de e-mail de acesso</p>
          </div>
          <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 14px; color: #475569; margin: 0 0 15px 0;">Olá! Use o código abaixo para confirmar o seu e-mail e prosseguir com a conclusão do seu cadastro:</p>
            <div style="font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 5px; padding: 10px 20px; background-color: #f1f5f9; border-radius: 8px; display: inline-block; margin-bottom: 15px;">
              ${codigo}
            </div>
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">Este código expira em 15 minutos. Se você não solicitou este código, por favor ignore este e-mail.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8;">
            © 2026 Elo 57. Todos os direitos reservados.
          </div>
        </div>
      `
    };

    console.log(`[Cadastro Actions] Enviando codigo ${codigo} para ${emailLimpo}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[Cadastro Actions] Codigo enviado com sucesso.`);

    // Gera token criptografado
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min
    const payload = JSON.stringify({ email: emailLimpo, codigo, expiresAt });
    const token = encryptOTP(payload);

    return { success: true, token };
  } catch (err) {
    console.error("[Cadastro Actions] Erro no solicitarCodigoVerificacaoAction:", err);
    return { error: 'Falha ao enviar o código por e-mail. Revise o endereço e tente novamente.' };
  }
}

// Server Action para validar o codigo digitado
export async function validarCodigoVerificacaoAction(email, codigoDigitado, token) {
  try {
    if (!email || !codigoDigitado || !token) {
      return { error: 'Parâmetros incompletos.' };
    }

    const decrypted = decryptOTP(token);
    const { email: origEmail, codigo: origCodigo, expiresAt } = JSON.parse(decrypted);

    if (origEmail.toLowerCase().trim() !== email.toLowerCase().trim()) {
      return { error: 'O e-mail digitado não corresponde ao código enviado.' };
    }
    if (Date.now() > expiresAt) {
      return { error: 'O código de verificação expirou. Solicite um novo código.' };
    }
    if (origCodigo.trim() !== codigoDigitado.trim()) {
      return { error: 'Código de segurança incorreto. Verifique no seu e-mail.' };
    }

    return { success: true };
  } catch (err) {
    console.error("[Cadastro Actions] Erro ao validar OTP:", err);
    return { error: 'Código inválido ou expirado. Por favor, tente re-enviar.' };
  }
}

// Função auxiliar interna para enviar email de boas-vindas com recibo de faturamento
export async function enviarEmailBoasVindas({ to, nome, planoNome, vigencia, formaPagamento, valorTotal, paymentUrl }) {
  try {
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { cookies: { get(name) { return null; } } }
    );

    const { data: config } = await supabaseAdmin
      .from('email_configuracoes')
      .select('*')
      .eq('email', 'elo57@studio57.arq.br')
      .limit(1)
      .maybeSingle();

    if (!config) {
      console.warn("[Cadastro Actions] Configuração de e-mail elo57@studio57.arq.br não encontrada para boas-vindas.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port || 465,
      secure: config.smtp_port === 465,
      auth: {
        user: config.smtp_user || config.email,
        pass: config.senha_app
      },
      tls: { rejectUnauthorized: false }
    });

    const isCartao = formaPagamento === 'cartao';
    const loginUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}login` : 'http://localhost:3000/login';

    const mailOptions = {
      from: `"${config.nome_remetente || 'Elo 57'}" <${config.email}>`,
      to,
      subject: `Seja bem-vindo ao Elo 57! 🚀 - Confirmação de Assinatura`,
      html: `
        <div style="font-family: sans-serif; padding: 25px; color: #1e293b; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://studio57.arq.br/marca/logo-elo57-horizontal.svg" alt="Elo 57" style="height: 36px; width: auto; border: none; display: inline-block; outline: none;" />
            <p style="color: #64748b; font-size: 13px; margin: 8px 0 0 0; font-weight: 500;">Seu ERP de Gestão Inteligente para Construção Civil</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <h2 style="color: #000000; margin-top: 0; font-size: 20px;">Olá, ${nome}!</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.5;">Parabéns! Sua assinatura foi criada com sucesso na nossa plataforma. Estamos muito felizes em fazer parte da jornada de crescimento da sua empresa.</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            
            <h3 style="color: #000000; font-size: 16px; margin-bottom: 10px;">Resumo da Assinatura</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #475569;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; width: 40%;">Plano contratado:</td>
                <td style="padding: 6px 0;">Plano ${planoNome}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold;">Periodicidade:</td>
                <td style="padding: 6px 0; text-transform: capitalize;">${vigencia}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold;">Forma de pagamento:</td>
                <td style="padding: 6px 0;">${isCartao ? 'Cartão de Crédito' : 'PIX'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold;">Valor faturado:</td>
                <td style="padding: 6px 0; color: #059669; font-weight: bold;">R$ ${valorTotal.toFixed(2).replace('.', ',')}</td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            
            <h3 style="color: #000000; font-size: 16px; margin-bottom: 10px;">Dados de Acesso</h3>
            <p style="font-size: 14px; color: #475569; margin: 0 0 10px 0;">
              Você já pode acessar o Elo 57 com as suas credenciais:
            </p>
            <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 15px;">
              <strong>E-mail de Login:</strong> <span style="color: #2563eb;">${to}</span><br/>
              <strong>Senha:</strong> A senha que você cadastrou no wizard
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${loginUrl}" style="background-color: #000000; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                Acessar Minha Conta no Elo 57
              </a>
            </div>
            
            ${!isCartao && paymentUrl ? `
            <div style="margin-top: 25px; padding: 15px; background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; text-align: center;">
              <p style="font-size: 13px; color: #92400e; margin: 0 0 10px 0; font-weight: bold;">Aguardando pagamento do PIX</p>
              <p style="font-size: 12px; color: #78350f; margin: 0 0 10px 0;">Sua conta será liberada automaticamente assim que o pagamento do PIX for compensado.</p>
              <a href="${paymentUrl}" style="color: #b45309; font-weight: bold; font-size: 13px; text-decoration: underline;">
                Visualizar Link de Pagamento / QR Code
              </a>
            </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0 0 5px 0;">* A Nota Fiscal de Serviços (NFS-e) oficial será emitida e enviada automaticamente após a liquidação do faturamento junto ao banco.</p>
            <p style="margin: 0;">© 2026 Elo 57. Todos os direitos reservados.</p>
          </div>
        </div>
      `
    };

    console.log(`[Cadastro Actions] Disparando email de boas-vindas para ${to}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[Cadastro Actions] Email de boas-vindas enviado com sucesso.`);
  } catch (err) {
    console.error("[Cadastro Actions] Erro ao enviar e-mail de boas-vindas:", err);
  }
}
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateContentWithTelemetry } from '../../../../utils/gemini';


// Função auxiliar para obter ou criar o registro da Stella na tabela funcionarios
async function obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, contatoId) {
  const emailStella = `stella.org${organizacaoId}@elo57.com.br`;

  // 1. Verificar se já existe funcionário com o email da Stella
  const { data: funcExistente } = await supabaseAdmin
    .from('funcionarios')
    .select('id')
    .eq('email', emailStella)
    .eq('organizacao_id', organizacaoId)
    .maybeSingle();

  if (funcExistente) {
    return funcExistente.id;
  }

  // 2. Buscar a primeira empresa da organização
  const { data: empresa } = await supabaseAdmin
    .from('cadastro_empresa')
    .select('id')
    .eq('organizacao_id', organizacaoId)
    .limit(1)
    .maybeSingle();

  if (!empresa) {
    console.warn(`[Stella AI Warning] Nenhuma empresa encontrada em cadastro_empresa para a org ${organizacaoId}. Não é possível criar o funcionário da Stella.`);
    return null;
  }

  // 3. Cadastrar a Stella como Funcionário (CPF fictício baseado na organização)
  const cpfStella = `000.000.000-${organizacaoId.toString().padStart(2, '0')}`;
  const { data: newFunc, error: insertError } = await supabaseAdmin
    .from('funcionarios')
    .insert({
      empresa_id: empresa.id,
      full_name: 'Stella IA',
      cpf: cpfStella,
      email: emailStella,
      admission_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      status: 'Ativo',
      contato_id: contatoId,
      organizacao_id: organizacaoId
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[Stella AI Error] Falha ao criar funcionário Stella:', insertError.message);
    return null;
  }

  console.log(`[Stella AI] Funcionário Stella criado com sucesso: ID ${newFunc.id}`);
  return newFunc.id;
}

// Função auxiliar para obter ou criar o usuário e contato da Stella por organização
async function obterOuCriarUsuarioStella(supabaseAdmin, organizacaoId) {
  const emailStella = `stella.org${organizacaoId}@elo57.com.br`;
  
  // 1. Verificar se o usuário já existe na public.usuarios
  const { data: usuarioExistente, error: checkError } = await supabaseAdmin
    .from('usuarios')
    .select('id, contato_id, funcionario_id')
    .eq('email', emailStella)
    .eq('organizacao_id', organizacaoId)
    .maybeSingle();
    
  if (usuarioExistente) {
    // Se o usuário já existe mas não possui funcionario_id, vamos tentar associá-lo
    if (!usuarioExistente.funcionario_id) {
      console.log(`[Stella AI] Usuário existente sem funcionario_id. Buscando ou criando funcionário...`);
      try {
        const funcId = await obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, usuarioExistente.contato_id);
        if (funcId) {
          await supabaseAdmin
            .from('usuarios')
            .update({ funcionario_id: funcId })
            .eq('id', usuarioExistente.id);
          usuarioExistente.funcionario_id = funcId;
        }
      } catch (e) {
        console.error('[Stella AI Error] Erro ao sincronizar funcionário para usuário existente:', e.message);
      }
    }

    return {
      userId: usuarioExistente.id,
      contatoId: usuarioExistente.contato_id,
      funcionarioId: usuarioExistente.funcionario_id
    };
  }
  
  console.log(`[Stella AI] Provisionando usuário Stella para a organização ${organizacaoId}...`);
  
  // 2. Tentar criar o usuário no Auth
  const tempPassword = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  let authUserId = null;
  
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: emailStella,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { nome: 'Stella', sobrenome: 'IA' }
  });
  
  if (authError) {
    if (authError.message.toLowerCase().includes('already exists') || authError.status === 422) {
      console.log(`[Stella AI] Usuário auth já existe com o e-mail ${emailStella}. Buscando ID...`);
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && usersData?.users) {
        const found = usersData.users.find(u => u.email === emailStella);
        if (found) {
          authUserId = found.id;
        }
      }
    }
    if (!authUserId) {
      throw new Error(`Falha ao criar usuário Stella no Auth: ${authError.message}`);
    }
  } else {
    authUserId = authUser.user.id;
  }
  
  // 3. Cadastrar a Stella como Contato do tipo 'Corretor'
  const { data: newContact, error: contactError } = await supabaseAdmin
    .from('contatos')
    .insert({
      nome: 'Stella IA',
      tipo_contato: 'Corretor',
      foto_url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/avatar/stella_avatar.png',
      organizacao_id: organizacaoId,
      status: 'Ativo'
    })
    .select('id')
    .single();
    
  if (contactError) {
    throw new Error(`Falha ao cadastrar contato Stella IA: ${contactError.message}`);
  }

  // 3.5 Cadastrar a Stella como Funcionário
  let newFuncId = null;
  try {
    newFuncId = await obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, newContact.id);
  } catch (funcErr) {
    console.error('[Stella AI Error] Falha ao criar funcionário durante fluxo de criação inicial:', funcErr.message);
  }
  
  // 4. Cadastrar o registro na public.usuarios
  const { error: profileError } = await supabaseAdmin
    .from('usuarios')
    .insert({
      id: authUserId,
      email: emailStella,
      nome: 'Stella',
      sobrenome: 'IA',
      is_active: true,
      organizacao_id: organizacaoId,
      contato_id: newContact.id,
      funcionario_id: newFuncId
    });
    
  if (profileError) {
    await supabaseAdmin.from('contatos').delete().eq('id', newContact.id);
    if (newFuncId) {
      await supabaseAdmin.from('funcionarios').delete().eq('id', newFuncId);
    }
    throw new Error(`Falha ao cadastrar perfil Stella IA na public.usuarios: ${profileError.message}`);
  }
  
  console.log(`[Stella AI] Usuário Stella provisionado com sucesso: UserID ${authUserId}, ContatoID ${newContact.id}, FuncionarioID ${newFuncId}`);
  
  return {
    userId: authUserId,
    contatoId: newContact.id,
    funcionarioId: newFuncId
  };
}

// Função utilitária para calcular data 3 dias úteis a partir de uma data inicial (ignora finais de semana)
function calcularDataTresDiasUteis(dataInicial = new Date()) {
  let data = new Date(dataInicial);
  let diasUteisAdicionados = 0;
  
  while (diasUteisAdicionados < 3) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Ignora sábado e domingo
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteisAdicionados++;
    }
  }
  
  return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// Função utilitária para calcular data 2 dias úteis a partir de uma data inicial (ignora finais de semana)
function calcularDataDoisDiasUteis(dataInicial = new Date()) {
  let data = new Date(dataInicial);
  let diasUteisAdicionados = 0;
  
  while (diasUteisAdicionados < 2) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay(); // 0 = Domingo, 6 = Sábado
    
    // Ignora sábado e domingo
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasUteisAdicionados++;
    }
  }
  
  return data.toISOString().split('T')[0]; // Formato YYYY-MM-DD
}

// Função para processar a criação de contratos em modo Rascunho
async function processarConfeccaoContrato(supabaseAdmin, contatoId, organizacaoId, gerarContratoData, usuarioStellaId) {
  const {
    tipo_documento,
    empreendimento_id,
    produto_id,
    garagem_produto_id,
    valor_final_venda,
    plano_pagamento,
    dados_conjuge
  } = gerarContratoData;

  if (!produto_id || !empreendimento_id) {
    console.error("[Stella Contrato Error] produto_id ou empreendimento_id ausentes.");
    return null;
  }

  // 1. Verificar duplicidade de contrato ativo para o comprador e o lote
  const { data: contratoExistente } = await supabaseAdmin
    .from('contratos')
    .select('id')
    .eq('contato_id', contatoId)
    .eq('produto_id', produto_id)
    .eq('organizacao_id', organizacaoId)
    .eq('lixeira', false)
    .not('status_contrato', 'eq', 'Cancelado')
    .limit(1)
    .maybeSingle();

  if (contratoExistente) {
    console.log(`[Stella Contrato] Contrato ativo já existente para Contato ${contatoId} e Produto ${produto_id}: ID ${contratoExistente.id}`);
    return contratoExistente.id;
  }

  // 2. Processar Cônjuge se aplicável
  let conjugeId = null;
  if (dados_conjuge && dados_conjuge.nome && dados_conjuge.nome.trim().length > 0) {
    const nomeConjuge = dados_conjuge.nome.trim();
    const cpfConjuge = (dados_conjuge.cpf || '').replace(/\D/g, '');

    // Buscar cônjuge existente na organização pelo CPF se fornecido, senão por nome
    let queryConj = supabaseAdmin.from('contatos').select('id').eq('organizacao_id', organizacaoId);
    if (cpfConjuge) {
      queryConj = queryConj.eq('cpf', cpfConjuge);
    } else {
      queryConj = queryConj.eq('nome', nomeConjuge);
    }
    const { data: conjExistente } = await queryConj.limit(1).maybeSingle();

    if (conjExistente) {
      conjugeId = conjExistente.id;
      // Atualizar dados cadastrais adicionais se fornecidos
      const updateConj = {};
      if (dados_conjuge.rg) updateConj.rg = dados_conjuge.rg.replace(/\D/g, '');
      if (dados_conjuge.cargo) updateConj.cargo = dados_conjuge.cargo;
      if (dados_conjuge.nacionalidade) updateConj.nacionalidade = dados_conjuge.nacionalidade;
      if (Object.keys(updateConj).length > 0) {
        await supabaseAdmin.from('contatos').update(updateConj).eq('id', conjugeId);
      }
    } else {
      // Criar contato para o cônjuge
      const { data: newConj, error: conjError } = await supabaseAdmin
        .from('contatos')
        .insert({
          nome: nomeConjuge,
          cpf: cpfConjuge || null,
          rg: dados_conjuge.rg ? dados_conjuge.rg.replace(/\D/g, '') : null,
          cargo: dados_conjuge.cargo || null,
          nacionalidade: dados_conjuge.nacionalidade || null,
          tipo_contato: 'Cliente',
          organizacao_id: organizacaoId,
          status: 'Ativo'
        })
        .select('id')
        .single();

      if (!conjError && newConj) {
        conjugeId = newConj.id;
        console.log(`[Stella Contrato] Cônjuge cadastrado com sucesso: ID ${conjugeId}`);
        
        // Criar telefones e emails do cônjuge se fornecidos
        if (dados_conjuge.email) {
          await supabaseAdmin.from('emails').insert({ contato_id: conjugeId, email: dados_conjuge.email, organizacao_id: organizacaoId });
        }
        if (dados_conjuge.telefone) {
          await supabaseAdmin.from('telefones').insert({ contato_id: conjugeId, telefone: dados_conjuge.telefone, organizacao_id: organizacaoId });
        }
      } else {
        console.error('[Stella Contrato Error] Falha ao cadastrar cônjuge:', conjError?.message);
      }
    }

    if (conjugeId) {
      // Sincronizar cônjuge no contato do comprador
      await supabaseAdmin
        .from('contatos')
        .update({ conjuge_id: conjugeId })
        .eq('id', contatoId);
    }
  }

  // 3. Buscar dados adicionais do lead para o contrato
  const { data: compradorData } = await supabaseAdmin
    .from('contatos')
    .select('regime_bens, conjuge_id')
    .eq('id', contatoId)
    .single();

  const regimeBensFinal = compradorData?.regime_bens || null;
  const conjugeIdFinal = conjugeId || compradorData?.conjuge_id || null;

  // 4. Buscar se existe corretor associado no funil
  const { data: funilInfo } = await supabaseAdmin
    .from('contatos_no_funil')
    .select('id, corretor_id')
    .eq('contato_id', contatoId)
    .maybeSingle();

  let corretorIdFinal = funilInfo?.corretor_id || null;
  if (!corretorIdFinal) {
    const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacaoId);
    if (stellaRecord?.contatoId) {
      corretorIdFinal = stellaRecord.contatoId;
    }
  }

  // 5. Determinar tipo_documento e index de reajuste com base nas regras do Empreendimento
  let tipoDocFinal = tipo_documento;
  let indiceReajusteFinal = null;
  if (empreendimento_id === 5) {
    tipoDocFinal = 'TERMO_DE_INTERESSE';
  } else if (empreendimento_id === 1 || empreendimento_id === 6) {
    tipoDocFinal = 'CONTRATO';
    if (empreendimento_id === 6) {
      indiceReajusteFinal = 'INCC + 11% a.a.';
    } else {
      indiceReajusteFinal = 'INCC';
    }
  }

  const comissaoPercentual = 5.0;

  // 6. Inserir na tabela public.contratos
  const { data: newContract, error: contractError } = await supabaseAdmin
    .from('contratos')
    .insert({
      contato_id: contatoId,
      produto_id: produto_id,
      empreendimento_id: empreendimento_id,
      data_venda: new Date().toISOString().split('T')[0],
      valor_final_venda: valor_final_venda || 0,
      status_contrato: 'Rascunho',
      tipo_documento: tipoDocFinal || 'CONTRATO',
      organizacao_id: organizacaoId,
      corretor_id: corretorIdFinal,
      conjuge_id: conjugeIdFinal,
      regime_bens: regimeBensFinal,
      indice_reajuste: indiceReajusteFinal,
      percentual_comissao_corretagem: comissaoPercentual,
      criado_por_usuario_id: usuarioStellaId || null
    })
    .select('id')
    .single();

  if (contractError) {
    console.error('[Stella Contrato Error] Falha ao criar contrato:', contractError.message);
    return null;
  }

  const contractId = newContract.id;
  console.log(`[Stella Contrato] Contrato criado com sucesso: ID ${contractId}`);

  // 7. Inserir vínculo na tabela public.contrato_produtos
  const { error: linkError } = await supabaseAdmin
    .from('contrato_produtos')
    .insert({
      contrato_id: contractId,
      produto_id: produto_id,
      organizacao_id: organizacaoId
    });

  if (linkError) {
    console.error('[Stella Contrato Error] Falha ao criar contrato_produtos:', linkError.message);
    await supabaseAdmin.from('contratos').delete().eq('id', contractId);
    return null;
  }

  // Se houver garagem vinculada, criar o vínculo correspondente
  if (garagem_produto_id) {
    const { error: linkGarageError } = await supabaseAdmin
      .from('contrato_produtos')
      .insert({
        contrato_id: contractId,
        produto_id: garagem_produto_id,
        organizacao_id: organizacaoId
      });

    if (linkGarageError) {
      console.error('[Stella Contrato Error] Falha ao criar contrato_produtos para garagem:', linkGarageError.message);
    }
  }

  // 8. Bloquear estoque: mudar status do produto para 'Reservado'
  await supabaseAdmin
    .from('produtos_empreendimento')
    .update({ status: 'Reservado' })
    .eq('id', produto_id);

  if (garagem_produto_id) {
    await supabaseAdmin
      .from('produtos_empreendimento')
      .update({ status: 'Reservado' })
      .eq('id', garagem_produto_id);
  }

  // 9. Chamar garantir_simulacao_para_contrato
  const { data: simulacaoRes, error: simError } = await supabaseAdmin
    .rpc('garantir_simulacao_para_contrato', {
      p_contrato_id: contractId,
      p_organizacao_id: organizacaoId
    });

  if (simError) {
    console.error('[Stella Contrato Error] Falha na RPC garantir_simulacao_para_contrato:', simError.message);
  } else if (simulacaoRes && plano_pagamento) {
    const simId = typeof simulacaoRes === 'object' ? simulacaoRes.id : JSON.parse(simulacaoRes).id;

    // Calcular data da primeira parcela de entrada (3 dias úteis se vazia)
    let dataPrimeiraEntrada = plano_pagamento.data_primeira_parcela_entrada;
    if (!dataPrimeiraEntrada) {
      dataPrimeiraEntrada = calcularDataTresDiasUteis(new Date());
    }

    // Calcular data da primeira parcela da obra (1 mês depois da entrada se vazia)
    let dataPrimeiraObra = plano_pagamento.data_primeira_parcela_obra;
    if (!dataPrimeiraObra && dataPrimeiraEntrada) {
      const dataEntradaObj = new Date(dataPrimeiraEntrada + 'T12:00:00');
      dataEntradaObj.setMonth(dataEntradaObj.getMonth() + 1);
      dataPrimeiraObra = dataEntradaObj.toISOString().split('T')[0];
    }

    const updateSimData = {
      valor_venda: valor_final_venda || 0,
      desconto_valor: plano_pagamento.desconto_valor || 0,
      entrada_valor: plano_pagamento.entrada_valor || 0,
      num_parcelas_entrada: plano_pagamento.num_parcelas_entrada || 1,
      data_primeira_parcela_entrada: dataPrimeiraEntrada,
      parcelas_obra_valor: plano_pagamento.parcelas_obra_valor || 0,
      num_parcelas_obra: plano_pagamento.num_parcelas_obra || 1,
      data_primeira_parcela_obra: dataPrimeiraObra,
      saldo_remanescente_valor: plano_pagamento.saldo_remanescente_valor || 0,
      status: 'Aprovado',
      produto_id: produto_id
    };

    const { error: simUpdateError } = await supabaseAdmin
      .from('simulacoes')
      .update(updateSimData)
      .eq('id', simId);

    if (simUpdateError) {
      console.error('[Stella Contrato Error] Falha ao atualizar dados de simulação:', simUpdateError.message);
    } else {
      // 10. Chamar regerar_parcelas_contrato
      const { error: rpcParcelasError } = await supabaseAdmin
        .rpc('regerar_parcelas_contrato', {
          p_contrato_id: contractId,
          p_organizacao_id: organizacaoId
        });

      if (rpcParcelasError) {
        console.error('[Stella Contrato Error] Falha na RPC regerar_parcelas_contrato:', rpcParcelasError.message);
      } else {
        console.log(`[Stella Contrato] Cronograma financeiro de parcelas gerado com sucesso!`);
      }
    }
  }

  // 11. Registrar nota no CRM
  const { data: prodData } = await supabaseAdmin
    .from('produtos_empreendimento')
    .select('unidade, empreendimentos(nome)')
    .eq('id', produto_id)
    .single();

  const nomeUnidade = prodData?.unidade || `ID ${produto_id}`;
  const nomeEmpreendimento = prodData?.empreendimentos?.nome || `ID ${empreendimento_id}`;

  const { error: insertNoteError } = await supabaseAdmin
    .from('crm_notas')
    .insert({
      contato_id: contatoId,
      contato_no_funil_id: funilInfo?.id || null,
      conteudo: `Confecção de Contrato Autônoma: Stella IA gerou com sucesso o rascunho de ${tipoDocFinal === 'TERMO_DE_INTERESSE' ? 'termo de interesse' : 'contrato'} para a unidade "${nomeUnidade}" do empreendimento "${nomeEmpreendimento}" no valor de R$ ${valor_final_venda || 0}. O plano de pagamento foi salvo e as parcelas geradas no sistema. Pronto para revisão e emissão do PDF.`,
      usuario_id: usuarioStellaId || null,
      organizacao_id: organizacaoId
    });

  if (insertNoteError) {
    console.error('[Stella Contrato Error] Falha ao criar nota no CRM:', insertNoteError.message);
  }

  return contractId;
}

export async function processarAnaliseStella({
  contato_id,
  organizacao_id,
  force,
  quickResponse,
  human_input,
  canal = 'whatsapp',
  janelaFechada = false,
  templatesDisponiveis = []
}) {
  if (!contato_id || !organizacao_id) {
    return { error: 'Faltam parâmetros obrigatórios.', status: 400 };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Tentar adquirir a trava exclusiva contra concorrência via RPC do Postgres
  const { data: lockAdquirido, error: lockError } = await supabaseAdmin.rpc('adquirir_lock_stella', {
    p_contato_id: contato_id,
    p_segundos: 30
  });

  if (lockError) {
    console.error('[Stella AI Lock Error] Falha ao tentar adquirir lock no Supabase:', lockError.message);
  }

  // Se não obteve o lock, retorna o cache atual e aborta silenciosamente
  if (!lockAdquirido) {
    console.log(`[Stella AI Lock] Concorrência detectada para contato ID ${contato_id}. Abortando execução.`);
    const { data: contactCache } = await supabaseAdmin
      .from('contatos')
      .select('ai_analysis')
      .eq('id', contato_id)
      .single();

    return {
      ...(contactCache?.ai_analysis || {}),
      _concorrencia_abortada: true
    };
  }

  try {
    // Obter data e hora atual do servidor ajustados para o fuso de Brasília (UTC-3)
    const dataAtualObj = new Date();
    const optionsDate = { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' };
    const optionsTime = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const optionsWeekday = { timeZone: 'America/Sao_Paulo', weekday: 'long' };
    
    const dataAtualStr = dataAtualObj.toLocaleDateString('pt-BR', optionsDate);
    const horaAtualStr = dataAtualObj.toLocaleTimeString('pt-BR', optionsTime);
    const diaSemanaStr = dataAtualObj.toLocaleDateString('pt-BR', optionsWeekday);

    // 1. Tentar ler do Cache se não foi forçado a atualizar
    if (!force) {
      const { data: contactCache } = await supabaseAdmin
        .from('contatos')
        .select('ai_analysis')
        .eq('id', contato_id)
        .single();
        
      if (contactCache?.ai_analysis) {
        return contactCache.ai_analysis;
      }
    }

    if (!process.env.GEMINI_API_KEY) {
       throw new Error('Chave GEMINI_API_KEY não configurada no servidor.');
    }

    // Alterna dinamicamente as queries do histórico de chat dependendo do canal
    let queryUltimaMsg = null;
    let queryMessages = null;
    let queryAnexosEnviados = null;

    if (canal === 'instagram') {
      // 1. Buscar a conversa do Instagram vinculada ao contato
      const { data: conv } = await supabaseAdmin
        .from('instagram_conversations')
        .select('id')
        .eq('contato_id', contato_id)
        .maybeSingle();

      const conversationId = conv?.id || 0;

      queryUltimaMsg = supabaseAdmin
        .from('instagram_messages')
        .select('id, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      queryMessages = supabaseAdmin
        .from('instagram_messages')
        .select('content, direction, sent_at')
        .eq('conversation_id', conversationId)
        .eq('organizacao_id', organizacao_id)
        .order('sent_at', { ascending: false })
        .limit(25);

      queryAnexosEnviados = supabaseAdmin
        .from('instagram_messages')
        .select('content')
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .like('content', 'http%');
    } else {
      queryUltimaMsg = supabaseAdmin
        .from('whatsapp_messages')
        .select('id, media_url, content, raw_payload, created_at')
        .eq('contato_id', contato_id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      queryMessages = supabaseAdmin
        .from('whatsapp_messages')
        .select('content, direction, sent_at')
        .eq('contato_id', contato_id)
        .eq('organizacao_id', organizacao_id)
        .order('sent_at', { ascending: false })
        .limit(25);

      queryAnexosEnviados = supabaseAdmin
        .from('whatsapp_messages')
        .select('content, media_url')
        .eq('contato_id', contato_id)
        .eq('direction', 'outbound')
        .not('media_url', 'is', null);
    }

    // 1.5 Buscar os dados iniciais do contato e histórico em paralelo (Otimização de Latência)
    const [
      contatoResult,
      ultimaMsgResult,
      messagesResult,
      funilResult,
      anexosEnviadosResult
    ] = await Promise.all([
      // 1. Dados cadastrais do contato
      supabaseAdmin
        .from('contatos')
        .select(`
          nome, tipo_contato, cpf, cnpj, origem, objetivo, cargo, estado_civil, renda_familiar, fgts, mais_de_3_anos_clt,
          observations, meta_campaign_name, meta_adset_name, meta_ad_name, meta_form_data, birth_date, cep,
          address_street, address_number, address_complement, neighborhood, city, state, ai_analysis,
          meta_referral_data,
          anuncio:meta_ad_id(id, nome),
          adset:meta_adset_id(id, nome),
          campanha:meta_campaign_id(id, nome)
        `)
        .eq('id', contato_id)
        .eq('organizacao_id', organizacao_id)
        .single(),

      queryUltimaMsg,
      queryMessages,

      // 4. Dados do Funil Comercial
      supabaseAdmin
        .from('contatos_no_funil')
        .select(`
          id,
          corretor_id,
          coluna_id,
          colunas_funil(id, nome, funil_id),
          contatos_no_funil_produtos(
            produto:produto_id(nome:unidade, empreendimento_id, area_m2, valor_venda_calculado)
          )
        `)
        .eq('contato_id', contato_id)
        .maybeSingle(),

      queryAnexosEnviados
    ]);

    const { data: contatoInfo, error: contatoError } = contatoResult;
    const { data: ultimaMsgCliente } = ultimaMsgResult;
    const { data: messages } = messagesResult;
    const { data: funil, error: funilError } = funilResult;
    const { data: anexosEnviados } = anexosEnviadosResult;

    if (contatoError) {
      console.error('Erro ao buscar dados do contato para IA:', contatoError);
    }
    if (funilError) {
      console.error('Erro ao buscar dados do funil para IA:', funilError);
    }
    console.log('[Stella AI Debug] Dados do funil comercial carregados na API:', funil);

    // --- FLUXO DE INTERVENÇÃO HUMANA E APRENDIZADO ATIVO (Active Learning Loop) ---
    if (human_input && human_input.trim().length > 0) {
      console.log(`[Stella AI Active Learning] Processando input de aprendizado do corretor: "${human_input}"`);
      
      // 1. Identificar qual o empreendimento para atualizar o dossiê
      let empIdParaAtualizar = contatoInfo?.ai_analysis?.empreendimento_detectado_id 
        || funil?.empreendimento_id 
        || funil?.produtos_interesse?.[0]?.produto?.empreendimento_id;

      if (!empIdParaAtualizar) {
        const { data: firstEmp } = await supabaseAdmin
          .from('empreendimentos')
          .select('id')
          .eq('organizacao_id', organizacao_id)
          .limit(1)
          .maybeSingle();
        if (firstEmp) empIdParaAtualizar = firstEmp.id;
      }

      console.log(`[Stella AI Active Learning] Empreendimento associado para dossiê: ID ${empIdParaAtualizar}`);

      // 2. Buscar o dossiê atual do empreendimento
      let dossieAtual = "";
      let empreendimentoNome = "Empreendimento";
      if (empIdParaAtualizar) {
        const { data: empData } = await supabaseAdmin
          .from('empreendimentos')
          .select('nome, dossie_ia')
          .eq('id', empIdParaAtualizar)
          .single();
        if (empData) {
          dossieAtual = empData.dossie_ia || "";
          empreendimentoNome = empData.nome;
        }
      }

      // 3. Gerar a reescrita da resposta comercial (Modelo dinâmico)
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      
      const reversedMessages = [...(messages || [])].reverse();
      const chatLogForRewriting = reversedMessages.filter(m => m.content).map(m => {
        const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
        return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
      }).join('\n');

      const reescreverPrompt = `
Você é a Stella, a assistente inteligente e de elite do Studio 57. Use sempre a concordância masculina para se referir à incorporadora: "do Studio 57" ou "o Studio 57", nunca "da Studio 57".
A última resposta comercial sugerida por você continha alguma informação incompleta ou você não soube responder.
O corretor humano interveio e forneceu a informação correta sobre o empreendimento ${empreendimentoNome}:
"${human_input}"

Com base nesta informação e no histórico recente de mensagens do WhatsApp:
---
${chatLogForRewriting}
---

Escreva a resposta de WhatsApp perfeita e polida para o cliente. 
REGRAS CRÍTICAS DO WHATSAPP:
1. Seja EXTREMAMENTE SUCINTA e envie a resposta em PÍLULAS (mensagens curtas por parágrafo, no máximo 2 a 3 pílulas separadas por \n\n). Cada parágrafo/pílula de texto deve ter no máximo 1 a 2 lines de extensão! Evite textões longos.
2. Use tom caloroso, empático e humano (evite linguajar robótico).
3. Não use termos proibidos como "hiper-compacto" ou "compacto".
4. Termine com uma única pergunta bem simples e curta para guiar o fechamento ou avanço.

Retorne rigorosamente um objeto JSON nos seguintes moldes:
{
  "proxima_resposta_sugerida": "A resposta exata gerada para enviar no WhatsApp."
}
`;

      let respostaSugeridaReescrita = "";
      try {
        const rewriteResult = await generateContentWithTelemetry({
          modelName: geminiModel,
          promptContent: [{ text: reescreverPrompt }],
          origem: 'chat-analysis',
          context: 'Active Learning - Reescrita',
          contatoId: contato_id,
          organizacaoId: organizacao_id
        });
        
        const rewriteText = rewriteResult.response.text();
        const cleanRewrite = rewriteText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const parsedRewrite = JSON.parse(cleanRewrite);
        respostaSugeridaReescrita = parsedRewrite.proxima_resposta_sugerida || "";
      } catch (rewriteErr) {
        console.error('[Stella AI Active Learning] Erro ao reescrever resposta:', rewriteErr);
        respostaSugeridaReescrita = `Perfeito! Confirmei aqui e ${human_input}`;
      }

      // 4. Enriquecer o Dossiê no banco de dados (Active Learning)
      if (empIdParaAtualizar && dossieAtual) {
        const aprenderPrompt = `
Você é o motor de inteligência de dados do Studio 57.
Sua missão é enriquecer o Dossiê Técnico do Empreendimento adicionando uma nova informação fornecida pela equipe comercial de forma totalmente estruturada e organizada no documento Markdown existente.

Aqui está o Dossiê atual do empreendimento ${empreendimentoNome}:
---
${dossieAtual}
---

Aqui está a nova informação fornecida pela equipe:
"${human_input}"

Instruções:
1. Analise onde essa informação se encaixa melhor no dossiê (ex: em Áreas Comuns, Lazer, Valores, Financiamento, Vagas de Garagem, etc.).
2. Insira a informação de forma clara e limpa no documento Markdown atual, preservando todo o restante do conteúdo e formatação intactos.
3. Não crie cabeçalhos repetidos. Encaixe o fato de forma concisa e natural.
4. Retorne APENAS o Markdown consolidado final. NUNCA adicione blocos de código tipo "triple backtick markdown" ou explicações antes/depois. Retorne apenas o conteúdo do dossiê consolidado em formato Markdown.
`;

        try {
          const learnResult = await generateContentWithTelemetry({
            modelName: geminiModel,
            promptContent: [{ text: aprenderPrompt }],
            origem: 'chat-analysis',
            context: 'Active Learning - Enriquecimento Dossiê',
            contatoId: contato_id,
            organizacaoId: organizacao_id
          });
          
          const novoDossie = learnResult.response.text().trim();
          
          if (novoDossie && novoDossie.length > 50) {
            const { error: learnUpdateError } = await supabaseAdmin
              .from('empreendimentos')
              .update({ dossie_ia: novoDossie })
              .eq('id', empIdParaAtualizar); // Segurança: mantendo a integridade se for arquivado ou atualizado
              
            if (learnUpdateError) {
              console.error('[Stella AI Active Learning] Erro ao atualizar dossie no banco:', learnUpdateError.message);
            } else {
              console.log('[Stella AI Active Learning] Dossiê enriquecido e atualizado com sucesso no banco de dados!');
            }
          }
        } catch (learnErr) {
          console.error('[Stella AI Active Learning] Erro no fluxo de aprendizado do dossiê:', learnErr);
        }
      }

      // 5. Mesclar e atualizar o cache do contato com a nova resposta e temperatura
      const oldAnalysis = contatoInfo?.ai_analysis || {};
      const mergedAnalysis = {
        ...oldAnalysis,
        proxima_resposta_sugerida: respostaSugeridaReescrita,
        resumo_interacao: `${oldAnalysis.resumo_interacao || ''}\n[Intervenção Humana] Fato aprendido: ${human_input}`,
        last_updated: new Date().toISOString(),
        mover_para_coluna_id: null
      };

      await supabaseAdmin
        .from('contatos')
        .update({ ai_analysis: mergedAnalysis })
        .eq('id', contato_id);

      // Mover de volta para Em Atendimento (se estava na coluna de Intervenção Humana)
      if (funil && funil.coluna_id === '7de9b5b4-05fa-4813-82d8-7790406ee268') {
        const { error: moveBackError } = await supabaseAdmin
          .from('contatos_no_funil')
          .update({ coluna_id: '029c8d6a-4799-4f4b-a55e-b4d5426718c0', updated_at: new Date() })
          .eq('id', funil.id);
          
        if (moveBackError) {
          console.error('[Stella AI Active Learning] Erro ao mover de volta para Em Atendimento:', moveBackError);
        } else {
          console.log('[Stella AI Active Learning] Lead movido de volta para Em Atendimento.');
        }
      }

      return NextResponse.json(mergedAnalysis);
    }

    // 1.8 Carregar todas as colunas de todos os funis da organização para permitir trânsito entre funis
    let colunasDisponiveis = [];
    const { data: cols, error: colsError } = await supabaseAdmin
      .from('colunas_funil')
      .select(`
        id, 
        nome, 
        ordem, 
        descricao,
        funis!funil_id(nome)
      `)
      .eq('organizacao_id', organizacao_id);
      
    if (colsError) {
      console.error('Erro ao buscar colunas do funil:', colsError);
    } else if (cols) {
      colunasDisponiveis = cols.map(c => ({
        id: c.id,
        nome: c.nome,
        ordem: c.ordem,
        descricao: c.descricao,
        funil_nome: c.funis?.nome || 'Geral'
      }));
    }

    // Resolve os nomes com fallback: coluna _name → JOIN meta_ativos
    if (contatoInfo) {
      contatoInfo.meta_ad_name_original = contatoInfo.meta_ad_name;
      contatoInfo.meta_adset_name_original = contatoInfo.meta_adset_name;
      contatoInfo.meta_campaign_name_original = contatoInfo.meta_campaign_name;

      contatoInfo.meta_ad_name = contatoInfo.meta_ad_name || contatoInfo.anuncio?.nome || null;
      contatoInfo.meta_adset_name = contatoInfo.meta_adset_name || contatoInfo.adset?.nome || null;
      contatoInfo.meta_campaign_name = contatoInfo.meta_campaign_name || contatoInfo.campanha?.nome || null;
    }

    let docBase64Data = null;
    let docMimeType = null;

    // Apenas processamos a mídia se ela for de fato a última mensagem recebida do cliente e recente (enviada nos últimos 5 minutos)
    // E apenas no modo completo (se for quickResponse pulamos o download de arquivos pesados)
    if (!quickResponse && ultimaMsgCliente && ultimaMsgCliente.media_url) {
      const diferencaTempo = Date.now() - new Date(ultimaMsgCliente.created_at).getTime();
      const ehRecente = diferencaTempo < 5 * 60 * 1000; // 5 minutos

      if (ehRecente) {
        const urlLower = ultimaMsgCliente.media_url.toLowerCase();
        // Consideramos PDF ou imagens comuns de documentos
        const isPdf = urlLower.includes('.pdf') || (ultimaMsgCliente.raw_payload && ultimaMsgCliente.raw_payload.type === 'document');
        const isImg = urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.webp') || (ultimaMsgCliente.raw_payload && ultimaMsgCliente.raw_payload.type === 'image');

        if (isPdf || isImg) {
          console.log(`[Stella AI] Mídia recente detectada para análise online: ${ultimaMsgCliente.media_url}`);
          try {
            const fileResponse = await fetch(ultimaMsgCliente.media_url);
            if (fileResponse.ok) {
              const arrayBuffer = await fileResponse.arrayBuffer();
              docBase64Data = Buffer.from(arrayBuffer).toString('base64');
              docMimeType = isPdf ? 'application/pdf' : fileResponse.headers.get('content-type') || 'image/jpeg';
              console.log(`[Stella AI] Mídia carregada com sucesso na memória RAM (Tamanho: ${docBase64Data.length} caracteres Base64).`);
            }
          } catch (mediaErr) {
            console.error('[Stella AI Warning] Erro ao baixar mídia para memória RAM:', mediaErr.message);
          }
        }
      } else {
        console.log(`[Stella AI] Mídia mais recente (${ultimaMsgCliente.media_url}) foi enviada há mais de 5 minutos. Ignorando download para otimização de performance.`);
      }
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        resumo_interacao: "Não há mensagens suficientes no WhatsApp para análise.",
        temperatura: "Frio",
        fase_crm_atual: funil?.colunas_funil?.nome || "Nenhuma fase no funil",
        proxima_acao_sugerida: "Inicie o contato com o cliente via WhatsApp.",
        proxima_resposta_sugerida: "Olá! Notei seu interesse, como posso ajudar?"
      });
    }

    // Invertemos para ficar na ordem cronológica de leitura da IA (começo -> fim)
    const reversedMessages = [...messages].reverse();

    // Formata o histórico como string
    const chatLog = reversedMessages.filter(m => m.content).map(m => {
      const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
      return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
    }).join('\n');

    const crmStatus = funil?.colunas_funil?.nome || "Lead Sem Funil (Caixa de Entrada Vazia)";
    const produtosRaw = funil?.contatos_no_funil_produtos?.map(p => p.produto?.nome) || [];
    const produtos = produtosRaw.length > 0 ? produtosRaw.join(', ') : "Nenhum Produto Vinculado";

    // Extrair IDs de Empreendimentos para buscar anexos e contexto
    const empIdsSet = new Set();
    let detalhesUnidades = "";
    if (funil?.contatos_no_funil_produtos) {
      funil.contatos_no_funil_produtos.forEach(p => {
        if (p.produto?.empreendimento_id) empIdsSet.add(p.produto.empreendimento_id);
        if (p.produto?.nome) {
          detalhesUnidades += `- Produto: ${p.produto.nome} | Área: ${p.produto.area_m2 || 'N/A'}m² | Valor Calculado: R$ ${p.produto.valor_venda_calculado || 'N/A'}\n`;
        }
      });
    }

    // Tenta deduzir o empreendimento também pelo texto de campanhas de Ads
    const campaignText = (
      (contatoInfo?.meta_campaign_name || '') + ' ' + 
      (contatoInfo?.meta_adset_name || '') + ' ' + 
      (contatoInfo?.meta_ad_name || '')
    ).toLowerCase();

    if (campaignText.includes('alfa')) {
      empIdsSet.add(1); // Residencial Alfa
    }
    if (campaignText.includes('beta') || campaignText.includes('samara')) {
      empIdsSet.add(5); // Beta Suítes
    }
    if (campaignText.includes('braunas') || campaignText.includes('braúnas')) {
      empIdsSet.add(6); // Refúgio Braúnas
    }

    // Tenta deduzir os empreendimentos de interesse pelo histórico de mensagens também
    const chatText = (messages || []).map(m => m.content || '').join(' ').toLowerCase();
    
    if (chatText.includes('alfa')) {
      empIdsSet.add(1); // Residencial Alfa
    }
    if (chatText.includes('beta') || chatText.includes('samara')) {
      empIdsSet.add(5); // Beta Suítes
    }
    if (chatText.includes('braunas') || chatText.includes('braúnas')) {
      empIdsSet.add(6); // Refúgio Braúnas
    }

    const empreendimentoIds = Array.from(empIdsSet);

    // --- NOVA LÓGICA DE QUERIES PARALELAS FILTRADAS POR EMPREENDIMENTO ---
    const empIdsBusca = empreendimentoIds.length > 0 ? empreendimentoIds : [1, 5, 6];

    const [
      empreendimentosResult,
      anexosResult,
      produtosResult
    ] = await Promise.all([
      // 1. Dossiês apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('empreendimentos')
        .select('id, nome, dossie_ia')
        .in('id', empIdsBusca)
        .not('dossie_ia', 'is', null),

      // 2. Anexos apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('empreendimento_anexos')
        .select('id, nome_arquivo, caminho_arquivo, descricao, empreendimento_id')
        .eq('disponivel_corretor', true)
        .eq('organizacao_id', organizacao_id)
        .in('empreendimento_id', empIdsBusca),

      // 3. Produtos apenas dos empreendimentos de interesse
      supabaseAdmin
        .from('produtos_empreendimento')
        .select('id, unidade, area_m2, valor_venda_calculado, status, descricao, empreendimento_id')
        .in('empreendimento_id', empIdsBusca)
        .eq('status', 'Disponível')
        .eq('organizacao_id', organizacao_id)
    ]);

    const todosEmpreendimentos = empreendimentosResult.data;
    const anexos = anexosResult.data;
    const produtosDisponiveis = produtosResult.data;

    let empContext = "";
    if (todosEmpreendimentos && todosEmpreendimentos.length > 0) {
      empContext = "### BASE DE CONHECIMENTO DO EMPREENDIMENTO (Dossiê)\n" + todosEmpreendimentos.map(e => {
        return `\n--- INÍCIO DO DOSSIÊ: ${e.nome} ---\n${e.dossie_ia}\n--- FIM DO DOSSIÊ: ${e.nome} ---\n`;
      }).join('\n');
    }

    let anexosContext = "Nenhum anexo público encontrado para este empreendimento.";
    if (anexos && anexos.length > 0) {
       anexosContext = anexos.map(a => `- ID: ${a.id} | Nome: "${a.nome_arquivo}" | Caminho: "${a.caminho_arquivo}" | Descrição: "${a.descricao || 'Sem descrição'}" | Empreendimento ID: ${a.empreendimento_id}`).join('\n');
    }

    let anexosEnviadosContext = "Nenhum anexo foi enviado anteriormente para este cliente nesta conversa.";
    if (anexosEnviados && anexosEnviados.length > 0) {
      anexosEnviadosContext = anexosEnviados.map(ae => `- Nome: "${ae.content || 'Sem nome'}" | URL/Caminho: "${ae.media_url}"`).join('\n');
    }

    // Filtra apenas unidades residenciais reais, ignorando garagens e motos para o estoque de apartamentos
    const unidadesHabitacionais = (produtosDisponiveis || []).filter(p => {
      const u = (p.unidade || '').toUpperCase();
      return !u.includes('MOTO') && !u.includes('CARRO') && !u.includes('GARAGEM');
    });

    let produtosDisponiveisContext = "Nenhuma unidade habitacional disponível cadastrada em estoque no momento para este empreendimento.";
    if (unidadesHabitacionais.length > 0) {
      produtosDisponiveisContext = unidadesHabitacionais.map(p => 
        `- Empreendimento ID: ${p.empreendimento_id} | Unidade: ${p.unidade} | Área: ${p.area_m2}m² | Valor de Venda: R$ ${p.valor_venda_calculado} | Descrição: ${p.descricao || 'Sem descrição'}`
      ).join('\n');
    }

    // Filtra vagas de garagem disponíveis (tipo Vaga Carro ou nome contendo CARRO/GARAGEM/VAGA)
    const garagensDisponiveis = (produtosDisponiveis || []).filter(p => {
      const u = (p.unidade || '').toUpperCase();
      const t = (p.tipo || '').toUpperCase();
      return u.includes('CARRO') || u.includes('GARAGEM') || u.includes('VAGA') || t.includes('VAGA') || t.includes('GARAGEM');
    });

    let garagensDisponiveisContext = "Nenhuma vaga de garagem disponível cadastrada em estoque no momento.";
    if (garagensDisponiveis.length > 0) {
      garagensDisponiveisContext = garagensDisponiveis.map(p =>
        `- Empreendimento ID: ${p.empreendimento_id} | Vaga: "${p.unidade}" | ID do Produto (Vaga): ${p.id}`
      ).join('\n');
    }

    // Criação do objeto estruturado com todos os dados do lead em formato JSON para o contexto da Stella
    const dadosClienteJSON = {
      id: contato_id,
      nome_completo_crm: contatoInfo?.nome || null,
      tipo_contato: contatoInfo?.tipo_contato || 'Lead',
      origem_declarada: contatoInfo?.origem || null,
      objetivo_interesse: contatoInfo?.objetivo || null,
      observacoes_crm: contatoInfo?.observations || null,
      renda_familiar: contatoInfo?.renda_familiar || null,
      possui_fgts: contatoInfo?.fgts || null,
      mais_de_3_anos_clt: contatoInfo?.mais_de_3_anos_clt || null,
      estado_civil: contatoInfo?.estado_civil || null,
      profissao_cargo: contatoInfo?.cargo || null,
      data_nascimento: contatoInfo?.birth_date || null,
      endereco: {
        cep: contatoInfo?.cep || null,
        rua: contatoInfo?.address_street || null,
        numero: contatoInfo?.address_number || null,
        complemento: contatoInfo?.address_complement || null,
        bairro: contatoInfo?.neighborhood || null,
        cidade: contatoInfo?.city || null,
        state: contatoInfo?.state || null
      },
      marketing_ads: {
        campanha: contatoInfo?.meta_campaign_name || null,
        conjunto_anuncios: contatoInfo?.meta_adset_name || null,
        anuncio: contatoInfo?.meta_ad_name || null,
        respostas_formulario_lead: contatoInfo?.meta_form_data ? (
          typeof contatoInfo.meta_form_data === 'string' 
            ? JSON.parse(contatoInfo.meta_form_data) 
            : contatoInfo.meta_form_data
        ) : null,
        dados_referral_click_to_whatsapp: contatoInfo?.meta_referral_data ? (
          typeof contatoInfo.meta_referral_data === 'string'
            ? JSON.parse(contatoInfo.meta_referral_data)
            : contatoInfo.meta_referral_data
        ) : null
      },
      fase_crm_atual: crmStatus,
      produtos_interesse_vinculados: produtosRaw,
      tentativas_insistencia: contatoInfo?.ai_analysis?.tentativas_insistencia || 0
    };

    const fichaLead = `
### DADOS CADASTRAIS COMPLETOS DO CLIENTE NO CRM (JSON ESTRUTURADO)
Você DEVE analisar o JSON de contexto abaixo antes de dar qualquer resposta.
Se o campo "nome_completo_crm" contiver um nome válido (não nulo e que não seja um número de telefone ou contiver a palavra "Lead"), chame o cliente pelo seu primeiro nome de forma simpática (ex: Nelson) e **é estritamente proibido perguntar o nome do cliente de novo**.
Se houver informações sobre renda, FGTS, CLT, etc. no JSON, use-as para pular etapas redundantes de qualificação e vá direto para as informações que ainda faltam ser qualificadas no método BANT.
JSON de Contexto:
${JSON.stringify(dadosClienteJSON, null, 2)}
    `;

    // 4. Invocar a IA (Modelo configurável)
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // Formata a lista de templates disponíveis caso a janela esteja fechada
    let templatesContext = "";
    if (janelaFechada && Array.isArray(templatesDisponiveis) && templatesDisponiveis.length > 0) {
      templatesContext = templatesDisponiveis.map(t => {
        return `Nome do Template: "${t.name}"\nIdioma: "${t.language?.code || t.language || 'pt_BR'}"\nComponentes (Estrutura de variáveis):\n${JSON.stringify(t.components, null, 2)}`;
      }).join('\n\n');
    }

    const instrucoesJanelaFechada = janelaFechada ? `
# 🚨🚨🚨 ALERTA CRÍTICO: JANELA DE ATENDIMENTO DE 24h FECHADA 🚨🚨🚨
- A janela de conversação de 24 horas do WhatsApp está FECHADA para este contato.
- Você **NÃO PODE** enviar mensagens normais de texto livre. Qualquer tentativa de enviar mensagem normal causará falha de entrega.
- Você **DEVE OBRIGATORIAMENTE** selecionar o template de WhatsApp mais adequado da lista de templates aprovados abaixo para abrir a janela de conversação.
- **DIRETRIZ DE SELEÇÃO DE TEMPLATE (CRÍTICO)**:
  1. **Priorize templates 100% textuais, simples e amigáveis** para reatar a conversa e obter resposta. O ideal para o cliente é a simplicidade.
  2. Templates Recomendados (Em Português):
     - **"reativar_contato"** (Usa variável {{1}} para o primeiro nome do cliente. Ex: "Olá Nelson, tudo bem com você? Podemos continuar a nossa conversa?"). Escolha este como padrão se souber o nome do cliente.
     - **"oi_tudo_bem_"** (Sem variáveis. Ex: "Oi, aqui é do studio 57 arquitetura e incorporação, tudo bem com você?"). Escolha este se não souber o nome do cliente ou para contatos brasileiros gerais.
     - **"eua_retomar_conversa"** (Sem variáveis. Ex: "Estou passando para verificar se você conseguiu acessar as informações que enviamos anteriormente. Deu tudo certo?"). Muito bom para acompanhamento geral.
  3. Se o lead estiver inativo há mais tempo e você já possuir um relacionamento mínimo, você pode usar **"reativar_contato_em_andamento"** ou **"reativar_contato_perdido"** (ambos usam variável {{1}} para o primeiro nome do cliente).
  4. **Evite** escolher templates de marketing complexos com imagem no cabeçalho (como "beta_suites_1"), a menos que o cliente esteja altamente interessado ou discutindo especificamente aquele empreendimento. (Lembre-se de que se selecionar "beta_suites_1", o backend inserirá uma imagem padrão se você não fornecer a variável de cabeçalho).
- Para o template selecionado, você deve preencher os parâmetros correspondentes (como o primeiro nome do cliente se o template possuir variáveis do tipo {{1}} no componente BODY).
- ⚠️⚠️⚠️ **REGRA DE OURO DOS BOTÕES**: Se o template selecionado possuir botões do tipo QUICK_REPLY ou botões estáticos (com textos como "SIM" e "NÃO" rápidos), você **NUNCA** deve incluí-los no array "template_componentes". A Meta rejeita componentes de botão estáticos no payload de envio. O array "template_componentes" deve conter **apenas** o componente do tipo "body" (e "header" se houver variáveis dinâmicas de cabeçalho). É **TERMINANTEMENTE PROIBIDO** enviar objetos com type: "BUTTONS" ou type: "buttons" ou chaves de botões no array "template_componentes".
- No JSON de retorno:
  1. Preencha "template_selecionado" com o nome exato do template escolhido (ex: "reativar_contato").
  2. Preencha "template_componentes" com os componentes formatados contendo as variáveis reais (como o primeiro nome do lead) no formato de payload da Meta (veja o formato abaixo).
  3. No campo "proxima_resposta_sugerida", escreva apenas "Template: [nome_do_template]" para fins de log.

### MODELOS DE WHATSAPP APROVADOS DISPONÍVEIS:
${templatesContext}

### FORMATO JSON REQUERIDO PARA TEMPLATE:
Se você escolher um template, o seu JSON de retorno deve ter a seguinte estrutura (repare que NÃO enviamos o componente de botões, apenas o body):
{
  "template_selecionado": "NOME_DO_TEMPLATE_EXATO",
  "template_componentes": [
    {
      "type": "body",
      "parameters": [
        {
          "type": "text",
          "text": "Valor da variável 1 (ex: Nome do cliente)"
        }
      ]
    }
  ],
  "proxima_resposta_sugerida": "Template: NOME_DO_TEMPLATE_EXATO",
  "mover_para_coluna_id": null,
  "justificativa_movimentacao": null,
  "dados_cliente": null
}
` : "";

    // Construção condicional do Prompt
    let prompt = '';
    
    if (quickResponse) {
      prompt = `${instrucoesJanelaFechada}
Você é Stella, a super Assistente Comercial e SDR (Sales Development Representative) de Pré-Atendimento do Studio 57.
Sua missão nesta chamada rápida é responder ao lead no WhatsApp de forma imediata, qualificando-o e sugerindo o anexo ideal para envio se necessário.

# 1. Regras de Rapport, Tom de Voz e Apresentação (Transparência de IA)
1. **Disclaimer de IA na Primeira Mensagem e Uso de Dados do Anúncio/Formulário**:
   - Analise o histórico recente da conversa. Se você AINDA não enviou nenhuma mensagem nesta conversa (ou seja, se a conversa está no início ou sem mensagens enviadas por você), você deve obrigatoriamente se apresentar e incluir o disclaimer de transparência de forma simpática.
   - **Click-to-WhatsApp e Formulários de Anúncios**: Se houver dados em 'ORIGEM DO META ADS' ou 'Respostas do Formulário' demonstrando interesse em um empreendimento específico (como 'Residencial Alfa', 'Studios Beta', etc.) ou exibindo uma mensagem de clique (ex: 'Mande um oi para receber mais informações...'), cite isso de forma simpática (ex: 'Olá! Vi que você se interessou pelo nosso anúncio do Residencial Alfa!').
   - **Extração de Nome de Formulários**: Se o nome do contato estiver preenchido nas respostas do formulário da Meta ou nos dados cadastrais, chame-o diretamente pelo nome (ex: 'Olá, Nelson!' ou 'Olá, Leandro! Vi que você se interessou...') e **É TERMINANTEMENTE PROIBIDO perguntar o nome do contato novamente**.
   - Adicione o disclaimer padrão de transparência de forma fluida e simpática no final:
     "Sou a Stella, a inteligência artificial de pré-atendimento do Studio 57. 😊 Como sou uma inteligência artificial comercial, minhas respostas podem conter erros e todas as simulações e dados técnicos do nosso papo serão confirmados por um corretor humano antes do fechamento do negócio. Se a qualquer momento preferir falar com um corretor do time, é só me avisar! Como posso te ajudar hoje?"
   - Se já houver mensagens enviadas por você anteriormente no histórico, NUNCA repita a apresentação ou o disclaimer. Vá direto ao assunto e mantenha a fluidez natural da conversa!
2. **Mensagens Curtas e em Pílulas (WhatsApp - CRÍTICO)**:
   - As pessoas no WhatsApp não leem textos longos. A sua resposta inteira deve ter no máximo 40 a 50 palavras e ser dividida em 2 a 3 mensagens curtas e dinâmicas (pílulas) separadas por uma quebra de linha dupla (\n\n). Cada pílula de texto deve ter no máximo 1 a 2 lines de comprimento. Diga uma única informação de valor e faça uma pergunta interativa simples no final.
   - Use no máximo 1 emoji por mensagem inteira para manter o profissionalismo.
3. **Regra de Concordância**:
   - Refira-se sempre à incorporadora como "o Studio 57" (gênero masculino) e NUNCA como "a Studio 57" ou "da Studio 57". Exemplos corretos: "sou a assistente virtual do Studio 57", "os empreendimentos do Studio 57".

# 2. Qualificação Conversacional (Método BANT) e Descarte
1. **Aproveitamento de Dados Prévios do CRM / Meta Ads**:
   - Analise com extrema atenção a ficha cadastral do cliente no JSON de contexto ('### DADOS CADASTRAIS COMPLETOS DO CLIENTE NO CRM').
   - Se informações como nome, renda familiar, estado civil ou profissão já estiverem cadastradas no CRM ou preenchidas pelo formulário de anúncio, considere-as já coletadas e **é terminantemente proibido fazer qualquer pergunta redundante** sobre esses mesmos dados. Pule direto para os critérios BANT que ainda restam qualificar.
2. **Garantia de Jornada de Apresentação do Produto**:
   - Você deve garantir que o cliente conheça e veja o empreendimento de interesse antes de avançar para perguntas mais profundas sobre orçamento.
   - Analise a seção '### Anexos Já Enviados' para o contato atual.
   - Se o book/apresentação em PDF ou vídeo do empreendimento correspondente ao interesse do lead (conforme dossiês) ainda NÃO tiver sido enviado, a sua primeira ação obrigatória deve ser sugerir o envio do book apropriado (gerando o objeto 'anexo_sugerido' no JSON de retorno) e fazer uma pergunta simpática sobre o interesse dele no produto.
   - Se o book já tiver sido enviado, pergunte se ele conseguiu dar uma olhada no book, o que achou das imagens/projeto e se o empreendimento corresponde às expectativas dele. Valide o interesse real no produto antes de avançar na qualificação.
3. **Coleta de Informações (BANT)**:
   - Colete de forma sutil e amigável (uma única pergunta curta por vez) os dados BANT restantes:
     * **Need (Necessidade)**: O que busca (moradia, investimento ou lazer).
     * **Profile (Perfil)**: Identidade (nome se não souber), estado civil, profissão ou se possui FGTS/CLT.
     * **Timeline (Prazo)**: Quando pretende comprar (imediato, em 3 meses, etc.).
     * **Budget (Orçamento)**: Capacidade de entrada/parcela ou renda familiar (se não cadastrada no JSON).
4. **Regras Rígidas de Transbordo de Funil**:
   - **CLIENTE POTENCIAL (ID: "0553d8db-5259-41bc-ae9e-b8803014ed93")**: Você **só pode** sugerir mover o lead para esta coluna se:
     1. O cliente tiver recebido e visualizado o material/book do empreendimento.
     2. O cliente tiver demonstrado interesse claro e continuado no projeto.
     3. Você tiver identificado e coletado **pelo menos 3 dos 4 critérios BANT** (seja na conversa atual ou já preenchidos na ficha cadastral).
     - Se houver menos de 3 critérios BANT qualificados, o lead **deve continuar obrigatoriamente na coluna EM ATENDIMENTO** (ID: "029c8d6a-4799-4f4b-a55e-b4d5426718c0").
   - **INTERVENÇÃO HUMANA (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268")**: Mover imediatamente para esta coluna se:
     1. O cliente solicitar explicitamente falar com um corretor ou ser humano (ex: "quero falar com corretor", "me passa para uma pessoa", "atendimento humano", "ser humano", etc.).
     2. O cliente insistir repetidamente em tabelas completas de preços, parcelamento detalhado ou simulações financeiras após você explicar amigavelmente que o especialista de vendas entrará em contato para apresentar tais detalhes.
   - **PERDIDO (ID: "feaa8511-261d-451b-bf99-24c8a6d6e7e0")**: Mover para esta coluna se o cliente responder com evasivas consecutivas por 2 rodadas ("apenas olhando", "não sei", "não quero falar", "depois").

# 3. Regras de Preços, Escape e Postura Exclusiva de SDR
1. **Foco em Qualificar, Não em Vender**:
   - A sua única missão é qualificar o lead coletando os dados BANT. Você NUNCA tenta vender, negociar unidades ou fechar contratos.
2. **Como lidar com perguntas de Valores e Preços (Regra de Ouro)**:
   - Se o cliente perguntar de preços, orçamentos ou valores (ex: "quanto custa?", "qual o preço?", "quais os valores?"), você deve responder de forma extremamente sucinta apenas citando o preço inicial básico do empreendimento de forma genérica (ex: "temos opções a partir de R$ 250 mil" ou "o valor de partida está na faixa de R$ 250.000").
   - **Imediatamente na mesma resposta**, você deve fazer uma pergunta de qualificação do lead para entender a real intenção de compra dele (ex: "Você busca para moradia própria, lazer para a família ou investimento?").
   - **É PROIBIDO** detalhar planos de parcelamento, simular financiamentos ou ficar citando valores individuais de vários lotes/apartamentos da tabela de estoque.
   - Se o cliente insistir em detalhes de parcelas, formas de pagamento ou simulação financeira, use a frase de escape padrão:
     "Essa parte de valores exatos, tabelas de parcelamento e simulação detalhada eu vou deixar para o nosso especialista de vendas te apresentar em instantes. Mas antes de eu te passar para ele..."
     E faça a pergunta de qualificação pendente.
   - Assim que o cliente responder a essa qualificação ou se ele insistir mais de uma vez em valores, defina mover_para_coluna_id como a coluna INTERVENÇÃO HUMANA (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268") no JSON para que a equipe humana assuma o controle comercial e o piloto automático seja desligado.
3. **REGRA DE OURO - Transbordo Comercial no Fechamento (CRÍTICO)**:
   - Se o cliente aceitar a simulação, concordar com a proposta, disser que quer fechar ("Sim tá ótimo pra mim", "quero fechar", "pode fazer"), enviar documentos pessoais (como CNH/RG ou comprovante de residência), ou solicitar os próximos passos de contrato, você **NUNCA deve continuar a conversa tentando coletar dados de contrato (como estado civil, profissão, etc.) ou dizer que está preenchendo o contrato**!
   - Responda imediatamente com simpatia e entusiasmo dizendo que está passando o caso agora mesmo para o especialista de vendas do Studio 57 para formalização e envio do contrato em instantes.
   - Defina obrigatoriamente 'mover_para_coluna_id' como a coluna **INTERVENÇÃO HUMANA** (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268") no JSON de retorno para desviar o atendimento ao humano.

# 4. Dados Atuais do CRM e Funil (Mapeamento Rígido Org 2)
- Coluna Atual no CRM: "${crmStatus}" (ID Atual: ${funil?.coluna_id || 'null'})
- Colunas disponíveis para movimentação:
  * **ENTRADA**: "e8e88027-c7be-4e8c-9667-e17fa4e06ce5"
  * **EM ATENDIMENTO**: "029c8d6a-4799-4f4b-a55e-b4d5426718c0"
  * **INTERVENÇÃO HUMANA**: "7de9b5b4-05fa-4813-82d8-7790406ee268" (Para quando o cliente pede humano, faz perguntas complexas fora da base ou insiste em valores sem ser qualificado)
  * **CLIENTE POTENCIAL**: "0553d8db-5259-41bc-ae9e-b8803014ed93" (Lead Qualificado BANT)
  * **PERDIDO**: "feaa8511-261d-451b-bf99-24c8a6d6e7e0" (Lead descartado por evasiva de 2 rodadas ou desinteresse)

# 5. Base de Conhecimento e Estoque (Apenas para tirar dúvidas básicas)
### Dossiê dos Empreendimentos:
${empContext}

### Estoque Real Disponível:
${produtosDisponiveisContext}

### Arquivos e Anexos Disponíveis:
${anexosContext}

### Anexos Já Enviados:
${anexosEnviadosContext}

# 6. Histórico Recente de Conversa (WhatsApp)
${chatLog}

Escreva um JSON rigoroso nos seguintes moldes:
{
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente no WhatsApp. Siga rigorosamente a regra das pílulas curtas e do disclaimer inicial na primeira mensagem, se aplicável. Use no máximo 1 emoji.",
  "template_selecionado": "NOME_DO_TEMPLATE_EXATO ou null (Se janelaFechada for true, preencha com o nome do melhor template de WhatsApp aprovado dentre os disponíveis. Se for false, deixe obrigatoriamente null.)",
  "template_componentes": [
    {
      "type": "body",
      "parameters": [
        {
          "type": "text",
          "text": "Valor da variável 1 (ex: primeiro nome do cliente se o template possuir variáveis do tipo {{1}} no componente BODY)"
        }
      ]
    }
  ] ou null (Se template_selecionado for null, retorne null. Caso contrário, retorne o array contendo as variáveis preenchidas no formato acima)",
  "empreendimento_detectado_id": 1, 5, 6 ou null,
  "anexo_sugerido": {
    "id": ID_DO_ARQUIVO,
    "nome_arquivo": "NOME_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "caminho_arquivo": "CAMINHO_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "pergunta_pos_anexo": "Uma pergunta curta de engajamento para fazer ao cliente logo após o envio do arquivo (ex: 'O que achou do book do Residencial Alfa?' ou 'Conseguiu dar uma olhada no vídeo?'). Obrigatório se anexo_sugerido não for null."
  } ou null,
  "dados_cliente": {
    "nome": "Nome detectado do cliente se ele informou na conversa, caso contrário null"
  },
  "mover_para_coluna_id": "ID_DA_COLUNA_OU_NULL",
  "justificativa_movimentacao": "Motivo resumido da movimentação de etapa comercial (obrigatório se mover_para_coluna_id não for null, justificando a qualificação, perda por evasivas ou intervenção humana)."
}
`;
    } else {
      prompt = `${instrucoesJanelaFechada}
Você é Stella, a super Assistente Comercial e SDR (Sales Development Representative) de Pré-Atendimento do Studio 57.
Graduada em inteligência de leads, sua missão é classificar o lead, analisar a origem da campanha e o perfil do cliente, qualificar o lead utilizando o método BANT e gerar uma RESPOSTA SUGERIDA PRONTA para o corretor ou para envio automático no WhatsApp.

# 1. Regras de Rapport, Tom de Voz e Apresentação (Transparência de IA)
1. **Disclaimer de IA na Primeira Mensagem e Uso de Dados do Anúncio/Formulário**:
   - Analise o histórico recente da conversa. Se você AINDA não enviou nenhuma mensagem nesta conversa (ou seja, se a conversa está no início ou sem mensagens enviadas por você), você deve obrigatoriamente se apresentar e incluir o disclaimer de transparência de forma simpática.
   - **Click-to-WhatsApp e Formulários de Anúncios**: Se houver dados em 'ORIGEM DO META ADS' ou 'Respostas do Formulário' demonstrando interesse in um empreendimento específico (como 'Residencial Alfa', 'Studios Beta', etc.) ou exibindo uma mensagem de clique (ex: 'Mande um oi para receber mais informações...'), cite isso de forma simpática (ex: 'Olá! Vi que você se interessou pelo nosso anúncio do Residencial Alfa!').
   - **Extração de Nome de Formulários**: Se o nome do contato estiver preenchido nas respostas do formulário da Meta ou nos dados cadastrais, chame-o diretamente pelo nome (ex: 'Olá, Nelson!' ou 'Olá, Leandro! Vi que você se interessou...') e **É TERMINANTEMENTE PROIBIDO perguntar o nome do contato novamente**.
   - Adicione o disclaimer padrão de transparência de forma fluida e simpática no final:
     "Sou a Stella, a inteligência artificial de pré-atendimento do Studio 57. 😊 Como sou uma inteligência artificial comercial, minhas respostas podem conter erros e todas as simulações e dados técnicos do nosso papo serão confirmados por um corretor humano antes do fechamento do negócio. Se a qualquer momento preferir falar com um corretor do time, é só me avisar! Como posso te ajudar hoje?"
   - Se já houver mensagens enviadas por você anteriormente no histórico, NUNCA repita a apresentação ou o disclaimer. Vá direto ao assunto e mantenha a fluidez natural da conversa!
2. **Mensagens Curtas e em Pílulas (WhatsApp - CRÍTICO)**:
   - As pessoas no WhatsApp não leem textos longos. A sua resposta inteira deve ter no máximo 40 a 50 palavras e ser dividida em 2 a 3 mensagens curtas e dinâmicas (pílulas) separadas por uma quebra de linha dupla (\\n\\n). Cada pílula de texto deve ter no máximo 1 a 2 linhas de comprimento. Diga uma única informação de valor e faça uma pergunta interativa simples no final.
   - Use no máximo 1 emoji por mensagem inteira para manter o profissionalismo.
3. **Regra de Concordância**:
   - Refira-se sempre à incorporadora como "o Studio 57" (gênero masculino) e NUNCA como "a Studio 57" ou "da Studio 57". Exemplos corretos: "sou a assistente virtual do Studio 57", "os empreendimentos do Studio 57".

# 2. Qualificação Conversacional (Método BANT) e Descarte
1. **Aproveitamento de Dados Prévios do CRM / Meta Ads**:
   - Analise com extrema atenção a ficha cadastral do cliente no JSON de contexto ('### DADOS CADASTRAIS COMPLETOS DO CLIENTE NO CRM').
   - Se informações como nome, renda familiar, estado civil ou profissão já estiverem cadastradas no CRM ou preenchidas pelo formulário de anúncio, considere-as já coletadas e **é terminantemente proibido fazer qualquer pergunta redundante** sobre esses mesmos dados. Pule direto para os critérios BANT que ainda restam qualificar.
2. **Garantia de Jornada de Apresentação do Produto**:
   - Você deve garantir que o cliente conheça e veja o empreendimento de interesse antes de avançar para perguntas mais profundas sobre orçamento.
   - Analise a seção '### Anexos Já Enviados' para o contato atual.
   - Se o book/apresentação em PDF ou vídeo do empreendimento correspondente ao interesse do lead (conforme dossiês) ainda NÃO tiver sido enviado, a sua primeira ação obrigatória deve ser sugerir o envio do book apropriado (gerando o objeto 'anexo_sugerido' no JSON de retorno) e fazer uma pergunta simpática sobre o interesse dele no produto.
   - Se o book já tiver sido enviado, pergunte se ele conseguiu dar uma olhada no book, o que achou das imagens/projeto e se o empreendimento corresponde às expectativas dele. Valide o interesse real no produto antes de avançar na qualificação.
3. **Coleta de Informações (BANT)**:
   - Colete de forma sutil e amigável (uma única pergunta curta por vez) os dados BANT restantes:
     * **Need (Necessidade)**: O que busca (moradia, investimento ou lazer).
     * **Profile (Perfil)**: Identidade (nome se não souber), estado civil, profissão ou se possui FGTS/CLT.
     * **Timeline (Prazo)**: Quando pretende comprar (imediato, em 3 meses, etc.).
     * **Budget (Orçamento)**: Capacidade de entrada/parcela ou renda familiar (se não cadastrada no JSON).
4. **Regras Rígidas de Transbordo de Funil**:
   - **CLIENTE POTENCIAL (ID: "0553d8db-5259-41bc-ae9e-b8803014ed93")**: Você **só pode** sugerir mover o lead para esta coluna se:
     1. O cliente tiver recebido e visualizado o material/book do empreendimento.
     2. O cliente tiver demonstrado interesse claro e continuado no projeto.
     3. Você tiver identificado e coletado **pelo menos 3 dos 4 critérios BANT** (seja na conversa atual ou já preenchidos na ficha cadastral).
     - Se houver menos de 3 critérios BANT qualificados, o lead **deve continuar obrigatoriamente na coluna EM ATENDIMENTO** (ID: "029c8d6a-4799-4f4b-a55e-b4d5426718c0").
   - **INTERVENÇÃO HUMANA (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268")**: Mover imediatamente para esta coluna se:
     1. O cliente solicitar explicitamente falar com um corretor ou ser humano (ex: "quero falar com corretor", "me passa para uma pessoa", "atendimento humano", "ser humano", etc.).
     2. O cliente insistir repetidamente em tabelas completas de preços, parcelamento detalhado ou simulações financeiras após você explicar amigavelmente que o especialista de vendas entrará em contato para apresentar tais detalhes.
   - **PERDIDO (ID: "feaa8511-261d-451b-bf99-24c8a6d6e7e0")**: Mover para esta coluna se o cliente responder com evasivas consecutivas por 2 rodadas ("apenas olhando", "não sei", "não quero falar", "depois").

# 3. Regras de Preços, Escape e Postura Exclusiva de SDR
1. **Foco em Qualificar, Não em Vender**:
   - A sua única missão é qualificar o lead coletando os dados BANT. Você NUNCA tenta vender, negociar unidades ou fechar contratos.
2. **Como lidar com perguntas de Valores e Preços (Regra de Ouro)**:
   - Se o cliente perguntar de preços, orçamentos ou valores (ex: "quanto custa?", "qual o preço?", "quais os valores?"), você deve responder de forma extremamente sucinta apenas citando o preço inicial básico do empreendimento de forma genérica (ex: "temos opções a partir de R$ 250 mil" ou "o valor de partida está na faixa de R$ 250.000").
   - **Imediatamente na mesma resposta**, você deve fazer uma pergunta de qualificação do lead para entender a real intenção de compra dele (ex: "Você busca para moradia própria, lazer para a família ou investimento?").
   - **É PROIBIDO** detalhar planos de parcelamento, simular financiamentos ou ficar citando valores individuais de vários lotes/apartamentos da tabela de estoque.
   - Se o cliente insistir em detalhes de parcelas, formas de pagamento ou simulação financeira, use a frase de escape padrão:
     "Essa parte de valores exatos, tabelas de parcelamento e simulação detalhada eu vou deixar para o nosso especialista de vendas te apresentar em instantes. Mas antes de eu te passar para ele..."
     E faça a pergunta de qualificação pendente.
   - Assim que o cliente responder a essa qualificação ou se ele insistir mais de uma vez em valores, defina mover_para_coluna_id como a coluna INTERVENÇÃO HUMANA (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268") no JSON para que a equipe humana assuma o controle comercial e o piloto automático seja desligado.
3. **REGRA DE OURO - Transbordo Comercial no Fechamento (CRÍTICO)**:
   - Se o cliente aceitar a simulação, concordar com a proposta, disser que quer fechar ("Sim tá ótimo pra mim", "quero fechar", "pode fazer"), enviar documentos pessoais (como CNH/RG ou comprovante de residência), ou solicitar os próximos passos de contrato, você **NUNCA deve continuar a conversa tentando coletar dados de contrato (como estado civil, profissão, etc.) ou dizer que está preenchendo o contrato**!
   - Responda imediatamente com simpatia e entusiasmo dizendo que está passando o caso agora mesmo para o especialista de vendas do Studio 57 para formalização e envio do contrato em instantes.
   - Defina obrigatoriamente 'mover_para_coluna_id' como a coluna **INTERVENÇÃO HUMANA** (ID: "7de9b5b4-05fa-4813-82d8-7790406ee268") no JSON de retorno para desviar o atendimento ao humano.

# 4. Dados Atuais do CRM e Funil (Mapeamento Rígido Org 2)
- Coluna Atual no CRM: "${crmStatus}" (ID Atual: ${funil?.coluna_id || 'null'})
- Colunas disponíveis para movimentação:
  * **ENTRADA**: "e8e88027-c7be-4e8c-9667-e17fa4e06ce5"
  * **EM ATENDIMENTO**: "029c8d6a-4799-4f4b-a55e-b4d5426718c0"
  * **INTERVENÇÃO HUMANA**: "7de9b5b4-05fa-4813-82d8-7790406ee268" (Para quando o cliente pede humano, faz perguntas complexas fora da base ou insiste em valores sem ser qualificado)
  * **CLIENTE POTENCIAL**: "0553d8db-5259-41bc-ae9e-b8803014ed93" (Lead Qualificado BANT)
  * **PERDIDO**: "feaa8511-261d-451b-bf99-24c8a6d6e7e0" (Lead descartado por evasiva de 2 rodadas ou desinteresse)

# 5. Base de Conhecimento e Estoque (Apenas para tirar dúvidas básicas)
### Dossiê dos Empreendimentos:
${empContext}

### Estoque Real Disponível:
${produtosDisponiveisContext}

### Arquivos e Anexos Disponíveis:
${anexosContext}

### Anexos Já Enviados:
${anexosEnviadosContext}

# 6. Ficha Cadastral e Origem do Lead
${fichaLead}

# 7. Histórico Recente de Conversa (WhatsApp)
${chatLog}

# 8. Regras de Extração e Análise do Cliente (Chave "dados_cliente" e ID do Empreendimento)
Analise todos os dados disponíveis (Ficha do Lead, Origem do Meta Ads, Formulário Meta, Dossiês e Conversa no WhatsApp) para determinar o perfil do cliente:
1. "objetivo": Classifique rigorosamente como "MORADIA", "INVESTIMENTO" ou "LAZER".
   - O histórico de conversa no WhatsApp (chat log) é a verdade final absoluta e prevalece sobre as campanhas.
   - Caso seja inconclusivo e não haja nenhuma informação, retorne null.
2. Identifique qual é o ID do empreendimento associado ao interesse do lead no campo "empreendimento_detectado_id":
   - 1 para Residencial Alfa.
   - 5 para Beta Suítes.
   - 6 para Refúgio Braúnas.
   - Se for outro empreendimento ou totalmente inconclusivo, retorne null.
3. Outros campos cadastrais do lead: "nome", "cpf", "cnpj", "renda_familiar", "fgts", "mais_de_3_anos_clt", "cargo", "estado_civil", "birth_date" e endereço.

Com base SOMENTE neste histórico recente e contexto do projeto, escreva um JSON rigoroso nos seguintes moldes:
{
  "resumo_interacao": "Texto conciso de até 3 linhas resumindo a intenção real, de onde o lead veio (campanha) e o ponto de temperatura da conversa.",
  "temperatura": "Quente" ou "Morno" ou "Frio",
  "fase_crm_atual": "${crmStatus}",
  "proxima_acao_sugerida": "Dica direta e acionável para o corretor.",
  "proxima_resposta_sugerida": "A resposta exata e natural para enviar ao cliente no WhatsApp. Siga rigorosamente a regra das pílulas curtas e do disclaimer inicial na primeira mensagem, se aplicável. Use no máximo 1 emoji.",
  "template_selecionado": "NOME_DO_TEMPLATE_EXATO ou null (Se janelaFechada for true, preencha com o nome do melhor template de WhatsApp aprovado dentre os disponíveis. Se for false, deixe obrigatoriamente null.)",
  "template_componentes": [
    {
      "type": "body",
      "parameters": [
        {
          "type": "text",
          "text": "Valor da variável 1 (ex: primeiro nome do cliente se o template possuir variáveis do tipo {{1}} no componente BODY)"
        }
      ]
    }
  ] ou null (Se template_selecionado for null, retorne null. Caso contrário, retorne o array contendo as variáveis preenchidas no formato acima)",
  "empreendimento_detectado_id": 1, 5, 6 ou null,
  "anexo_sugerido": {
    "id": ID_DO_ARQUIVO,
    "nome_arquivo": "NOME_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "caminho_arquivo": "CAMINHO_DO_ARQUIVO_EXATO (idêntico ao da lista)",
    "pergunta_pos_anexo": "Uma pergunta curta de engajamento para fazer ao cliente logo após o envio do arquivo (ex: 'O que achou do book do Residencial Alfa?' ou 'Conseguiu dar uma olhada no vídeo?'). Obrigatório se anexo_sugerido não for null."
  } ou null,
  "dados_cliente": {
    "nome": "Nome completo ou null",
    "cpf": "Apenas dígitos do CPF ou null",
    "cnpj": "Apenas dígitos do CNPJ ou null",
    "rg": "Apenas dígitos do RG ou null",
    "nacionalidade": "Nacionalidade ou null",
    "renda_familiar": 12000.00 (ou null),
    "fgts": true/false (ou null),
    "mais_de_3_anos_clt": true/false (ou null),
    "objetivo": "MORADIA" / "INVESTIMENTO" / "LAZER" (ou null),
    "cargo": "Profissão ou null",
    "estado_civil": "Estado civil ou null",
    "birth_date": "YYYY-MM-DD ou null",
    "cep": "Apenas dígitos do CEP ou null",
    "address_street": "Logradouro ou null",
    "address_number": "Número ou null",
    "address_complement": "Complemento ou null",
    "neighborhood": "Bairro ou null",
    "city": "Cidade ou null",
    "state": "UF ou null"
  },
  "atividade_agendada": {
    "name": "Nome/Título da atividade ou null",
    "description": "Motivo detalhado do agendamento ou null",
    "data_inicio_prevista": "YYYY-MM-DD ou null",
    "hora_inicio": "HH:MM:SS ou null",
    "tipo_atividade": "Evento" ou null
  } ou null,
  "mover_para_coluna_id": "ID_DA_COLUNA_OU_NULL",
  "justificativa_movimentacao": "Motivo resumido da movimentação de etapa comercial (obrigatório se mover_para_coluna_id não for null, justificando a qualificação, perda por evasivas ou intervenção humana)."
}
`;
    }

    const promptContent = [];
    if (docBase64Data && docMimeType) {
      console.log(`[Stella AI] Injetando arquivo CNH/Documento de forma online no prompt do Gemini...`);
      promptContent.push({
        inlineData: {
          data: docBase64Data,
          mimeType: docMimeType
        }
      });
    }
    // Substitui dinamicamente referências ao canal para não confundir a inteligência artificial
    let promptFinal = prompt;
    if (canal === 'instagram') {
      promptFinal = prompt
        .replaceAll('WhatsApp', 'Instagram Direct')
        .replaceAll('no WhatsApp', 'no Instagram')
        .replaceAll('do WhatsApp', 'do Instagram')
        .replaceAll('via WhatsApp', 'via Instagram');
    }

    promptContent.push({ text: promptFinal });

    const maxRetries = 3;
    const retryDelayMs = 2000;
    let result;
    let textOutput = '';
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Stella AI] Tentando gerar resposta com ${geminiModel} (Tentativa ${attempt}/${maxRetries})...`);
        result = await generateContentWithTelemetry({
          modelName: geminiModel,
          promptContent: promptContent,
          generationConfig: {
            responseMimeType: "application/json",
          },
          origem: 'chat-analysis',
          context: 'Chat Autônomo',
          contatoId: contato_id,
          organizacaoId: organizacao_id
        });
        textOutput = result.response.text();
        console.log(`[Stella AI] Resposta gerada com sucesso na tentativa ${attempt}!`);
        break; // Sucesso, sai do loop
      } catch (err) {
        console.warn(`[Stella AI Warning] Falha na tentativa ${attempt}/${maxRetries} (Erro: ${err.message})`);
        if (attempt === maxRetries) {
          console.error(`[Stella AI Fatal Error] Todas as tentativas locais com ${geminiModel} falharam.`);
          throw new Error(`Serviço de IA Indisponível (${geminiModel}): ${err.message}`);
        }
        console.log(`[Stella AI] Aguardando ${retryDelayMs / 1000}s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    // --- CÁLCULO E LOG DE CUSTO DA CHAMADA ---
    let custoChamada = 0;
    let novoCustoAcumulado = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const usageMetadata = result?.response?.usageMetadata;
      if (usageMetadata) {
        inputTokens = usageMetadata.promptTokenCount || 0;
        outputTokens = usageMetadata.candidatesTokenCount || 0;
        
        // Custo estimado local
        const rates = {
          'gemini-1.5-flash': { input: 0.075, output: 0.30 },
          'gemini-2.5-flash': { input: 0.075, output: 0.30 },
          'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
          'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.50 },
          'gemini-1.5-pro': { input: 1.25, output: 5.00 },
          'gemini-2.5-pro': { input: 1.25, output: 5.00 },
          'gemini-3.1-pro': { input: 2.00, output: 12.00 },
          'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 }
        };
        const activeRate = rates[geminiModel] || rates['gemini-2.5-flash'];
        custoChamada = (inputTokens * (activeRate.input / 1000000)) + (outputTokens * (activeRate.output / 1000000));
        
        const oldAnalysis = contatoInfo?.ai_analysis || {};
        const custoAnterior = oldAnalysis.custo_gemini_acumulado || 0;
        novoCustoAcumulado = parseFloat((custoAnterior + custoChamada).toFixed(8));
      }
    } catch (costErr) {
      console.error('[Stella AI Cost Error] Erro ao processar custos da chamada:', costErr);
    }
    
    let parsedResult;
    try {
      // Limpeza de blocos de marcação, caso a API teimosamente os envie
      const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
      let rawJson = JSON.parse(cleanString);
      
      if (Array.isArray(rawJson)) {
        parsedResult = rawJson[0] || {};
      } else {
        parsedResult = rawJson;
      }
      
      // Adiciona o timestamp da análise
      parsedResult.last_updated = new Date().toISOString();

      // --- BLINDAGEM DE JANELA FECHADA E TEMPLATES DE RETOMADA ---
      if (janelaFechada) {
        const tSel = parsedResult.template_selecionado;
        if (!tSel || tSel === 'null' || tSel === null) {
          console.log(`[Stella AI Blindagem] Janela fechada, mas a IA retornou template_selecionado nulo. Forçando template de reengajamento...`);
          
          // Tenta obter o nome do contato do banco ou do próprio parsedResult
          const primeiroNome = (parsedResult.dados_cliente?.nome || contatoInfo?.nome || '')
            .split(' ')[0]
            .replace(/[^a-zA-ZáàâãéèêíïóôõöúçÑñÁÀÂÃÉÈÍÏÓÔÕÖÚÇ]/g, '')
            .trim();

          if (primeiroNome && primeiroNome.length > 1 && !primeiroNome.toLowerCase().includes('lead')) {
            parsedResult.template_selecionado = 'reativar_contato';
            parsedResult.template_componentes = [
              {
                type: 'body',
                parameters: [
                  {
                    type: 'text',
                    text: primeiroNome
                  }
                ]
              }
            ];
            console.log(`[Stella AI Blindagem] Forçado template reativar_contato para ${primeiroNome}`);
          } else {
            parsedResult.template_selecionado = 'oi_tudo_bem_';
            parsedResult.template_componentes = null;
            console.log(`[Stella AI Blindagem] Nome indisponível ou genérico. Forçado template oi_tudo_bem_`);
          }
          parsedResult.proxima_resposta_sugerida = `Template: ${parsedResult.template_selecionado}`;
        }
      }
    } catch (e) {
      console.error('[AI Parser Error]', textOutput, e);
      return NextResponse.json({ error: 'Falha ao processar o JSON retornado pela IA' }, { status: 500 });
    }

    // --- NOVA LÓGICA: ATUALIZAÇÃO CADASTRAL INTELIGENTE E INCREMENTAL ---
    // Rodamos o enriquecimento cadastral se houver dados_cliente (nome é atualizável em quickResponse também)
    if (parsedResult.dados_cliente && typeof parsedResult.dados_cliente === 'object') {
      const dc = parsedResult.dados_cliente;
      const currentContact = contatoInfo;
      
      if (currentContact) {
        const updateData = {};

        // Regra do Nome Completo: atualiza se for um nome genérico temporário ou se o nome detectado for mais completo
        if (dc.nome && typeof dc.nome === 'string' && dc.nome.trim().length > 0) {
          const nomeDetectado = dc.nome.trim();
          const nomeAtual = (currentContact.nome || '').trim();
          const palavrasNovas = nomeDetectado.split(/\s+/).length;
          const palavrasAtuais = nomeAtual.split(/\s+/).length;

          const isGenericName = nomeAtual === '' || nomeAtual.toLowerCase().includes('lead') || /^\+?\d+$/.test(nomeAtual.replace(/[\s()+-]/g, ''));
          if (isGenericName || (palavrasNovas > palavrasAtuais && nomeDetectado.toLowerCase().includes(nomeAtual.split(/\s+/)[0].toLowerCase()))) {
            updateData.nome = nomeDetectado;
          }
        }

        // Se as colunas textuais na tabela contatos estiverem nulas no banco e resolvidas pelo JOIN,
        // salvamos para persistir na ficha do contato permanentemente.
        if (!currentContact.meta_campaign_name_original && currentContact.meta_campaign_name) {
          updateData.meta_campaign_name = currentContact.meta_campaign_name;
        }
        if (!currentContact.meta_adset_name_original && currentContact.meta_adset_name) {
          updateData.meta_adset_name = currentContact.meta_adset_name;
        }
        if (!currentContact.meta_ad_name_original && currentContact.meta_ad_name) {
          updateData.meta_ad_name = currentContact.meta_ad_name;
        }

        // Função auxiliar para atualizar apenas se estiver vazio/nulo (campos críticos de identidade)
        const preencherSeVazio = (field, value) => {
          const currentValue = currentContact[field];
          if (value !== undefined && value !== null && (currentValue === null || currentValue === undefined || String(currentValue).trim() === '')) {
            updateData[field] = value;
          }
        };

        // Função auxiliar para atualizar se houver qualquer alteração/diferença (campos gerais de cadastro)
        const atualizarSeDiferente = (field, value) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            const currentValue = currentContact[field];
            if (currentValue === null || currentValue === undefined || String(currentValue).trim().toLowerCase() !== String(value).trim().toLowerCase()) {
              updateData[field] = value;
            }
          }
        };

        // Campos de identificação rígidos: só preenchemos se estiver em branco
        preencherSeVazio('cpf', dc.cpf);
        preencherSeVazio('cnpj', dc.cnpj);
        preencherSeVazio('renda_familiar', dc.renda_familiar);

        // Campos gerais e de endereço: atualizamos incrementalmente caso a IA detecte novidades ou alterações
        atualizarSeDiferente('estado_civil', dc.estado_civil);
        atualizarSeDiferente('cargo', dc.cargo);
        atualizarSeDiferente('rg', dc.rg);
        atualizarSeDiferente('nacionalidade', dc.nacionalidade);
        atualizarSeDiferente('fgts', dc.fgts);
        atualizarSeDiferente('mais_de_3_anos_clt', dc.mais_de_3_anos_clt);
        atualizarSeDiferente('cep', dc.cep);
        atualizarSeDiferente('address_street', dc.address_street);
        atualizarSeDiferente('address_number', dc.address_number);
        atualizarSeDiferente('address_complement', dc.address_complement);
        atualizarSeDiferente('neighborhood', dc.neighborhood);
        atualizarSeDiferente('city', dc.city);
        atualizarSeDiferente('state', dc.state);
        atualizarSeDiferente('birth_date', dc.birth_date);


        // Normalização e atualização inteligente do Objetivo
        const objetivoAtual = (currentContact.objetivo || '').trim().toLowerCase();
        if (dc.objetivo && typeof dc.objetivo === 'string') {
          const objetivoIA = dc.objetivo.trim().toUpperCase();
          if (['MORADIA', 'INVESTIMENTO', 'LAZER'].includes(objetivoIA)) {
            // Se estiver vazio, nulo, ou for uma variação antiga (minúscula, com underline, etc)
            if (
              !currentContact.objetivo || 
              objetivoAtual === '' || 
              objetivoAtual === 'não informado' ||
              (objetivoAtual !== objetivoIA.toLowerCase() && !objetivoAtual.startsWith(objetivoIA.toLowerCase().substring(0, 5)))
            ) {
              updateData.objetivo = objetivoIA;
            }
          }
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('contatos')
            .update(updateData)
            .eq('id', contato_id);
            
          if (updateError) {
            console.error('[AI Enrichment] Erro ao atualizar contato:', updateError);
          } else {
            console.log('[AI Enrichment] Contato enriquecido com sucesso:', updateData);
          }
        }
      }
    }

    // --- NOVA LÓGICA: CONFECÇÃO AUTÔNOMA DE CONTRATOS (STELLA IA) ---
    if (Number(organizacao_id) !== 2 && parsedResult.gerar_contrato && parsedResult.gerar_contrato.confirmar === true) {
      console.log(`[Stella Contrato] Detectado comando de confecção autônoma de contrato para o Contato ${contato_id}.`);
      try {
        const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
        const contractId = await processarConfeccaoContrato(
          supabaseAdmin,
          contato_id,
          organizacao_id,
          parsedResult.gerar_contrato,
          stellaRecord?.userId
        );

        if (contractId) {
          console.log(`[Stella Contrato] Contrato confeccionado com sucesso! Moveremos o lead no funil para a etapa CONTRATO.`);
          // Força a movimentação do lead no funil para a etapa "CONTRATO" (c69be155-8422-45a2-a59d-0d47458be1bc)
          parsedResult.mover_para_coluna_id = 'c69be155-8422-45a2-a59d-0d47458be1bc';
          parsedResult.justificativa_movimentacao = 'Rascunho de contrato gerado pela Stella IA após confirmação comercial do cliente.';
        }
      } catch (errContrato) {
        console.error('[Stella Contrato Error] Falha no fluxo de confecção autônoma:', errContrato.message);
      }
    }

    // --- NOVA LÓGICA: ATRIBUIÇÃO DA STELLA COMO RESPONSÁVEL NO FUNIL ---
    // Se o lead no funil comercial não tiver corretor associado (corretor_id nulo),
    // nós o associamos à Stella IA daquela organização para que ela conste como a corretora responsável.
    if (funil && funil.id && !funil.corretor_id) {
      console.log(`[Stella AI] Lead no funil está sem corretor responsável. Atribuindo à Stella IA...`);
      try {
        const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
        if (stellaRecord?.contatoId) {
          const { error: funnelUpdateError } = await supabaseAdmin
            .from('contatos_no_funil')
            .update({ corretor_id: stellaRecord.contatoId })
            .eq('id', funil.id);

          if (funnelUpdateError) {
            console.error('[Stella AI Error] Falha ao atribuir lead à Stella no funil:', funnelUpdateError.message);
          } else {
            console.log(`[Stella AI] Lead atribuído com sucesso à Stella no funil (Contato ID ${stellaRecord.contatoId})`);
            funil.corretor_id = stellaRecord.contatoId;
          }
        }
      } catch (stellaUserErr) {
        console.error('[Stella AI Error] Falha ao obter/criar usuário Stella para atribuição no funil:', stellaUserErr.message);
      }
    }

    // --- NOVA LÓGICA: AGENDAMENTO AUTÔNOMO DE ATIVIDADES ---
    if (parsedResult.atividade_agendada && typeof parsedResult.atividade_agendada === 'object') {
      const aa = parsedResult.atividade_agendada;
      const lastInboundMsgId = ultimaMsgCliente?.id;
      
      if (lastInboundMsgId) {
        // Verifica se essa mensagem já gerou agendamento de atividade (evita duplicidade)
        const cacheAiAnalysis = contatoInfo?.ai_analysis || {};
        const jaAgendado = cacheAiAnalysis.last_scheduled_message_id === lastInboundMsgId;
        
        if (!jaAgendado && aa.nome && aa.data_inicio_prevista) {
          console.log(`[Stella AI] Detectada solicitação de agendamento: "${aa.nome}" para a data ${aa.data_inicio_prevista}.`);
          try {
            // Obter ou criar o usuário e contato da Stella para esta organização
            const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
            
            if (stellaRecord?.userId) {
              // Garante que a atividade gerada pela Stella sempre seja um Evento com hora marcada
              const horaInicioFinal = aa.hora_inicio || '09:00:00';
              
              // 1. Verificar se já existe alguma atividade pendente da Stella para este contato
              const { data: existingAct, error: searchActErr } = await supabaseAdmin
                .from('activities')
                .select('id, data_inicio_prevista, hora_inicio')
                .eq('contato_id', contato_id)
                .eq('responsavel_texto', 'Stella IA')
                .eq('status', 'Não iniciado')
                .maybeSingle();

              if (searchActErr) {
                console.error('[Stella AI Error] Erro ao buscar atividade existente:', searchActErr.message);
              }

              if (existingAct) {
                console.log(`[Stella AI] Reagendando atividade existente ID: ${existingAct.id} de ${existingAct.data_inicio_prevista} para ${aa.data_inicio_prevista}.`);
                
                // 2. Atualiza (Reagenda) a atividade existente em vez de criar uma nova
                const { error: updateActErr } = await supabaseAdmin
                  .from('activities')
                  .update({
                    nome: aa.nome,
                    descricao: aa.descricao || '',
                    data_inicio_prevista: aa.data_inicio_prevista,
                    data_fim_prevista: aa.data_inicio_prevista, // Para Evento, data fim = data início
                    hora_inicio: horaInicioFinal,
                  })
                  .eq('id', existingAct.id);

                if (updateActErr) {
                  console.error('[Stella AI Error] Falha ao reagendar atividade:', updateActErr.message);
                } else {
                  console.log(`[Stella AI] Atividade ID ${existingAct.id} reagendada com sucesso.`);
                  cacheAiAnalysis.last_scheduled_message_id = lastInboundMsgId;
                  parsedResult.last_scheduled_message_id = lastInboundMsgId;
                }
              } else {
                // 3. Insere uma nova atividade se não houver pendente
                const newActivity = {
                  contato_id: contato_id,
                  organizacao_id: organizacao_id,
                  criado_por_usuario_id: stellaRecord.userId,
                  funcionario_id: stellaRecord.funcionarioId || null,
                  nome: aa.nome,
                  descricao: aa.descricao || '',
                  data_inicio_prevista: aa.data_inicio_prevista,
                  data_fim_prevista: aa.data_inicio_prevista, // Para Evento, data fim = data início
                  hora_inicio: horaInicioFinal,
                  tipo_atividade: 'Evento',
                  duracao_horas: 1.0,
                  duracao_dias: 0,
                  status: 'Não iniciado',
                  responsavel_texto: 'Stella IA'
                };

                const { data: actData, error: actError } = await supabaseAdmin
                  .from('activities')
                  .insert(newActivity)
                  .select('id')
                  .single();

                if (actError) {
                  console.error('[Stella AI Error] Falha ao salvar nova atividade:', actError.message);
                } else {
                  console.log(`[Stella AI] Nova atividade agendada com sucesso! ID: ${actData.id} sob responsabilidade do usuário Stella (${stellaRecord.userId}).`);
                  cacheAiAnalysis.last_scheduled_message_id = lastInboundMsgId;
                  parsedResult.last_scheduled_message_id = lastInboundMsgId;
                }
              }
            }
          } catch (stellaUserErr) {
            console.error('[Stella AI Error] Falha ao obter/criar usuário Stella:', stellaUserErr.message);
          }
        } else if (jaAgendado) {
          console.log(`[Stella AI] Agendamento ignorado: Atividade para a mensagem ${lastInboundMsgId} já foi cadastrada anteriormente.`);
        }
      }
    }

    // --- NOVA LÓGICA: MOVIMENTAÇÃO AUTÔNOMA DE LEADS NO FUNIL (PILOTO AUTOMÁTICO) ---
    if (parsedResult.mover_para_coluna_id && funil && funil.id) {
      const novaColunaId = parsedResult.mover_para_coluna_id;
      const colunaAtualId = funil.coluna_id;

      if (novaColunaId !== colunaAtualId) {
        console.log(`[Stella AI Funil] Movendo lead no funil ${funil.id} de ${colunaAtualId} para ${novaColunaId}...`);
        
        // Obter nome da nova coluna para a nota de CRM
        const novaColInfo = colunasDisponiveis.find(c => c.id === novaColunaId);
        const nomeNovaColuna = novaColInfo ? novaColInfo.nome : 'Nova Etapa';

        // 1. Atualizar contatos_no_funil
        const updateFunilData = { coluna_id: novaColunaId };

        const { error: updateFunnelError } = await supabaseAdmin
          .from('contatos_no_funil')
          .update(updateFunilData)
          .eq('id', funil.id);

        if (updateFunnelError) {
          console.error('[Stella AI Funil Error] Falha ao atualizar coluna no funil:', updateFunnelError.message);
        } else {
          console.log(`[Stella AI Funil] Lead movido com sucesso para a coluna ${nomeNovaColuna}!`);

          // --- SDR TRANSBORDO: DESATIVAR PILOTO AUTOMÁTICO SE MOVIDO PARA COLUNAS HUMANAS OU DE ARQUIVAMENTO ---
          const colunasDesativarIA = [
            '0553d8db-5259-41bc-ae9e-b8803014ed93', // CLIENTE POTENCIAL
            'feaa8511-261d-451b-bf99-24c8a6d6e7e0', // PERDIDO
            '7de9b5b4-05fa-4813-82d8-7790406ee268'  // INTERVENÇÃO HUMANA
          ];
          if (colunasDesativarIA.includes(novaColunaId)) {
            console.log(`[Stella AI SDR] Desativando piloto automático para o lead ${contato_id} por transbordo para a coluna ${nomeNovaColuna}.`);
            await supabaseAdmin
              .from('contatos')
              .update({ ia_atendimento_ativo: false })
              .eq('id', contato_id);
          } else {
            console.log(`[Stella AI SDR] Reativando piloto automático para o lead ${contato_id} na coluna ${nomeNovaColuna}.`);
            await supabaseAdmin
              .from('contatos')
              .update({ ia_atendimento_ativo: true })
              .eq('id', contato_id);
          }

          // 3. Registrar nota em crm_notas relatando a movimentação
          try {
            const stellaUserRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
            const { error: insertNoteError } = await supabaseAdmin
              .from('crm_notas')
              .insert({
                contato_id: contato_id,
                contato_no_funil_id: funil.id,
                conteudo: `Piloto Automático Stella: Lead movido para a etapa "${nomeNovaColuna}".${parsedResult.justificativa_movimentacao ? ` Motivo: ${parsedResult.justificativa_movimentacao}` : ''}`,
                usuario_id: stellaUserRecord?.userId || null,
                organizacao_id: organizacao_id
              });

            if (insertNoteError) {
              console.error('[Stella AI Funil Note Error] Falha ao criar nota no CRM:', insertNoteError.message);
            } else {
              console.log('[Stella AI Funil] Nota de CRM criada relatando a movimentação.');
            }
          } catch (noteErr) {
            console.error('[Stella AI Funil Note Error] Falha ao processar nota no CRM:', noteErr.message);
          }
        }
      }
    }

    // 5. Salvar localmente o cache mesclado
    let finalAnalysis = parsedResult;
    if (quickResponse) {
      // Mesclamos os campos rápidos com a análise anterior existente no banco para não perder os dados cadastrais ricos
      const oldAnalysis = contatoInfo?.ai_analysis || {};
      finalAnalysis = {
        ...oldAnalysis,
        proxima_resposta_sugerida: parsedResult.proxima_resposta_sugerida,
        empreendimento_detectado_id: parsedResult.empreendimento_detectado_id,
        anexo_sugerido: parsedResult.anexo_sugerido,
        template_selecionado: parsedResult.template_selecionado || null,
        template_componentes: parsedResult.template_componentes || null,
        last_updated: new Date().toISOString()
      };
    }

    // Mesclar a nova análise com o cache existente para não sobrescrever o last_scheduled_message_id no banco
    const oldAnalysis = contatoInfo?.ai_analysis || {};
    const mergedAnalysis = {
      ...oldAnalysis,
      ...finalAnalysis,
      // Custos e contagem de tokens do Gemini
      custo_gemini_chamada_atual: custoChamada,
      custo_gemini_acumulado: novoCustoAcumulado > 0 ? novoCustoAcumulado : (oldAnalysis.custo_gemini_acumulado || 0),
      tokens_chamada_atual: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens
      },
      tokens_acumulado: {
        input: (oldAnalysis.tokens_acumulado?.input || 0) + inputTokens,
        output: (oldAnalysis.tokens_acumulado?.output || 0) + outputTokens,
        total: (oldAnalysis.tokens_acumulado?.total || 0) + inputTokens + outputTokens
      },
      // Se last_scheduled_message_id foi definido nesta rodada ou existia na rodada antiga
      last_scheduled_message_id: finalAnalysis.last_scheduled_message_id || oldAnalysis.last_scheduled_message_id || null
    };

    await supabaseAdmin
      .from('contatos')
      .update({ ai_analysis: mergedAnalysis })
      .eq('id', contato_id);

    // --- REGRA DE OURO (GOLDEN RULE): AGENDAMENTO DA 1ª ATIVIDADE DE INSISTÊNCIA ---
    const finalColunaId = parsedResult.mover_para_coluna_id || funil?.coluna_id;
    const colunaMensagemEnviadaId = '660662df-a1e1-411f-9c2c-0907fce46126'; // MENSAGEM ENVIADA
    const tentativas = mergedAnalysis.tentativas_insistencia || 0;

    if (finalColunaId === colunaMensagemEnviadaId && tentativas === 0) {
      try {
        // Verificar se já existe atividade pendente para este contato da Stella
        const { data: existingAct } = await supabaseAdmin
          .from('activities')
          .select('id')
          .eq('contato_id', contato_id)
          .eq('responsavel_texto', 'Stella IA')
          .eq('status', 'Não iniciado')
          .limit(1)
          .maybeSingle();

        if (!existingAct) {
          console.log(`[Stella AI Golden Rule] Lead na coluna MENSAGEM ENVIADA com 0 tentativas. Agendando a 1ª insistência.`);
          const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
          if (stellaRecord?.userId) {
            const dataPrimeiraInsistencia = calcularDataDoisDiasUteis(new Date());
            const novaAtividade = {
              contato_id: contato_id,
              organizacao_id: organizacao_id,
              criado_por_usuario_id: stellaRecord.userId,
              funcionario_id: stellaRecord.funcionarioId || null,
              nome: `Stella IA - Insistência Comercial (Tentativa 1)`,
              descricao: `Mensagem de insistência comercial automática (Template Meta) para tentar reengajar o lead silencioso.`,
              data_inicio_prevista: dataPrimeiraInsistencia,
              data_fim_prevista: dataPrimeiraInsistencia,
              hora_inicio: '09:00:00',
              tipo_atividade: 'Evento',
              duracao_horas: 1.0,
              duracao_dias: 0,
              status: 'Não iniciado',
              responsavel_texto: 'Stella IA'
            };

            await supabaseAdmin
              .from('activities')
              .insert(novaAtividade);
            console.log(`[Stella AI Golden Rule] Atividade de 1ª insistência criada com sucesso para contato ${contato_id}.`);
          }
        }
      } catch (actErr) {
        console.error('[Stella AI Golden Rule Error] Falha ao agendar 1ª atividade de insistência:', actErr.message);
      }
    }

    return mergedAnalysis;

  } catch (error) {
    console.error('[processarAnaliseStella Error]', error);
    return { error: error.message, status: 500 };
  } finally {
    // 2. Liberar a trava de concorrência no banco de dados
    try {
      await supabaseAdmin.rpc('liberar_lock_stella', { p_contato_id: contato_id });
      console.log(`[Stella AI Lock] Trava de concorrência liberada para o contato ${contato_id}`);
    } catch (liberarErr) {
      console.error('[Stella AI Lock Error] Erro ao liberar lock da Stella:', liberarErr.message || liberarErr);
    }
  }
}

export async function POST(request) {
  try {
    const params = await request.json();
    const result = await processarAnaliseStella(params);
    
    if (result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[AI API POST Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

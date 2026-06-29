// app/api/ai/stella/processor.js
import { createClient } from '@supabase/supabase-js';
import { generateContentWithTelemetry } from '../../../../utils/gemini';
import { SYSTEM_PROMPT } from './prompt';
import { GEMINI_TOOLS, executarToolStella } from './tools';

// Função auxiliar para remover chaves vazias ou nulas do JSON antes do prompt
function removerCamposNulos(obj) {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj.length > 0 ? obj : undefined;
  }
  if (typeof obj === 'object') {
    const cleanObj = {};
    let hasKeys = false;
    for (const key in obj) {
      if (obj[key] !== null && obj[key] !== undefined) {
        if (typeof obj[key] === 'object') {
          const nested = removerCamposNulos(obj[key]);
          if (nested !== undefined) {
            cleanObj[key] = nested;
            hasKeys = true;
          }
        } else {
          cleanObj[key] = obj[key];
          hasKeys = true;
        }
      }
    }
    return hasKeys ? cleanObj : undefined;
  }
  return obj;
}

// Obter ou criar o funcionário da Stella na base
async function obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, contatoId) {
  const emailStella = `stella.org${organizacaoId}@elo57.com.br`;
  const { data: funcExistente } = await supabaseAdmin
    .from('funcionarios')
    .select('id')
    .eq('email', emailStella)
    .eq('organizacao_id', organizacaoId)
    .maybeSingle();

  if (funcExistente) return funcExistente.id;

  const { data: empresa } = await supabaseAdmin
    .from('cadastro_empresa')
    .select('id')
    .eq('organizacao_id', organizacaoId)
    .limit(1)
    .maybeSingle();

  if (!empresa) return null;

  const cpfStella = `000.000.000-${organizacaoId.toString().padStart(2, '0')}`;
  const { data: newFunc, error: insertError } = await supabaseAdmin
    .from('funcionarios')
    .insert({
      empresa_id: empresa.id,
      full_name: 'Stella IA',
      cpf: cpfStella,
      email: emailStella,
      admission_date: new Date().toISOString().split('T')[0],
      status: 'Ativo',
      contato_id: contatoId,
      organizacao_id: organizacaoId
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[Stella Processor Error] Falha ao criar funcionário Stella:', insertError.message);
    return null;
  }
  return newFunc.id;
}

// Obter ou criar o usuário e contato da Stella por organização
async function obterOuCriarUsuarioStella(supabaseAdmin, organizacaoId) {
  const emailStella = `stella.org${organizacaoId}@elo57.com.br`;
  
  const { data: usuarioExistente } = await supabaseAdmin
    .from('usuarios')
    .select('id, contato_id, funcionario_id')
    .eq('email', emailStella)
    .eq('organizacao_id', organizacaoId)
    .maybeSingle();
    
  if (usuarioExistente) {
    if (!usuarioExistente.funcionario_id) {
      const funcId = await obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, usuarioExistente.contato_id);
      if (funcId) {
        await supabaseAdmin
          .from('usuarios')
          .update({ funcionario_id: funcId })
          .eq('id', usuarioExistente.id);
        usuarioExistente.funcionario_id = funcId;
      }
    }
    return {
      userId: usuarioExistente.id,
      contatoId: usuarioExistente.contato_id,
      funcionarioId: usuarioExistente.funcionario_id
    };
  }
  
  console.log(`[Stella Processor] Provisionando usuário Stella para a organização ${organizacaoId}...`);
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
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && usersData?.users) {
        const found = usersData.users.find(u => u.email === emailStella);
        if (found) authUserId = found.id;
      }
    }
    if (!authUserId) throw new Error(`Falha ao criar usuário Stella no Auth: ${authError.message}`);
  } else {
    authUserId = authUser.user.id;
  }
  
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
    
  if (contactError) throw new Error(`Falha ao cadastrar contato Stella IA: ${contactError.message}`);

  let newFuncId = null;
  try {
    newFuncId = await obterOuCriarFuncionarioStella(supabaseAdmin, organizacaoId, newContact.id);
  } catch (funcErr) {
    console.error('[Stella Processor Error] Falha ao criar funcionário durante fluxo inicial:', funcErr.message);
  }
  
  await supabaseAdmin
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
   
  return {
    userId: authUserId,
    contatoId: newContact.id,
    funcionarioId: newFuncId
  };
}

/**
 * Função principal de orquestração cognitiva da Stella IA SDR 2.0.
 * Conecta o Gemini ao banco via Function Calling (Tools) e realiza a qualificação e CRM.
 */
export async function processarAnaliseStella({
  contato_id,
  organizacao_id,
  force,
  quickResponse,
  human_input,
  canal = 'whatsapp',
  janelaFechada = false,
  templatesDisponiveis = [],
  pular_atualizacao_crm = false
}) {
  if (!contato_id || !organizacao_id) {
    return { error: 'Faltam parâmetros obrigatórios.', status: 400 };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Tentar adquirir a trava de concorrência
  const { data: lockAdquirido, error: lockError } = await supabaseAdmin.rpc('adquirir_lock_stella', {
    p_contato_id: contato_id,
    p_segundos: 30
  });

  if (lockError) {
    console.error('[Stella Processor Lock Error] Erro ao tentar adquirir lock no Supabase:', lockError.message);
  }

  // Se a concorrência estiver ativa, aborta
  if (!lockAdquirido) {
    console.log(`[Stella Processor Lock] Concorrência ativa para contato ID ${contato_id}. Abortando.`);
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
    const dataAtualObj = new Date();
    const optionsDate = { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' };
    const optionsTime = { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const optionsWeekday = { timeZone: 'America/Sao_Paulo', weekday: 'long' };
    
    const dataAtualStr = dataAtualObj.toLocaleDateString('pt-BR', optionsDate);
    const horaAtualStr = dataAtualObj.toLocaleTimeString('pt-BR', optionsTime);
    const diaSemanaStr = dataAtualObj.toLocaleDateString('pt-BR', optionsWeekday);

    // 2. Resgate de cache se não foi forçado
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

    // Queries assíncronas do histórico
    let queryUltimaMsg = null;
    let queryMessages = null;
    let queryAnexosEnviados = null;

    if (canal === 'instagram') {
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

    const [
      contatoResult,
      ultimaMsgResult,
      messagesResult,
      funilResult,
      anexosEnviadosResult,
      colunasResult
    ] = await Promise.all([
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

      queryAnexosEnviados,

      supabaseAdmin
        .from('colunas_funil')
        .select('id, nome')
        .eq('organizacao_id', organizacao_id)
    ]);

    const { data: contatoInfo, error: contatoError } = contatoResult;
    const { data: ultimaMsgCliente } = ultimaMsgResult;
    const { data: messages } = messagesResult;
    const { data: funil, error: funilError } = funilResult;
    const { data: anexosEnviados } = anexosEnviadosResult;
    const colunasDisponiveis = colunasResult.data || [];

    if (contatoError) console.error('Erro ao buscar dados do contato:', contatoError);
    if (funilError) console.error('Erro ao buscar dados do funil:', funilError);

    // Formatar histórico em ordem cronológica para a IA
    const reversedMessages = [...(messages || [])].reverse();
    const chatLog = reversedMessages.filter(m => m.content).map(m => {
      const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
      return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
    }).join('\n');

    const crmStatus = funil?.colunas_funil?.nome || "Lead Sem Funil (Caixa de Entrada Vazia)";
    const produtosRaw = funil?.contatos_no_funil_produtos?.map(p => p.produto?.nome) || [];

    let anexosEnviadosContext = "Nenhum anexo foi enviado anteriormente.";
    if (anexosEnviados && anexosEnviados.length > 0) {
      anexosEnviadosContext = anexosEnviados.map(ae => `- Nome: "${ae.content || 'Sem nome'}" | URL: "${ae.media_url}"`).join('\n');
    }

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
          typeof contatoInfo.meta_form_data === 'string' ? JSON.parse(contatoInfo.meta_form_data) : contatoInfo.meta_form_data
        ) : null,
        dados_referral_click_to_whatsapp: contatoInfo?.meta_referral_data ? (
          typeof contatoInfo.meta_referral_data === 'string' ? JSON.parse(contatoInfo.meta_referral_data) : contatoInfo.meta_referral_data
        ) : null
      },
      fase_crm_atual: crmStatus,
      produtos_interesse_vinculados: produtosRaw,
      tentativas_insistencia: contatoInfo?.ai_analysis?.tentativas_insistencia || 0
    };

    const fichaLead = `
### DADOS CADASTRAIS COMPLETOS DO CLIENTE NO CRM (JSON ESTRUTURADO)
Você DEVE analisar o JSON de contexto abaixo antes de dar qualquer resposta.
Se o campo "nome_completo_crm" contiver um nome válido (não nulo, que não seja um número de telefone ou contiver a palavra "Lead"), chame o cliente pelo seu primeiro nome de forma simpática e **é estritamente proibido perguntar o nome do cliente de novo**.
Se houver informações sobre renda, FGTS, CLT, etc. no JSON, use-as para pular etapas redundantes de qualificação.
JSON de Contexto:
${JSON.stringify(removerCamposNulos(dadosClienteJSON) || {}, null, 2)}
    `;

    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

    let templatesContext = "";
    if (janelaFechada && Array.isArray(templatesDisponiveis) && templatesDisponiveis.length > 0) {
      templatesContext = templatesDisponiveis.map(t => {
        return `Nome do Template: "${t.name}"\nIdioma: "${t.language?.code || t.language || 'pt_BR'}"\nComponentes:\n${JSON.stringify(t.components, null, 2)}`;
      }).join('\n\n');
    }

    const instrucoesJanelaFechada = janelaFechada ? `
# 🚨🚨🚨 ALERTA CRÍTICO: JANELA DE ATENDIMENTO DE 24h FECHADA 🚨🚨🚨
- A janela de conversação de 24 horas do WhatsApp está FECHADA para este contato.
- Você **NÃO PODE** enviar mensagens normais de texto livre. Qualquer tentativa causará falha de entrega.
- Você **DEVE OBRIGATORIAMENTE** selecionar o template de WhatsApp mais adequado da lista de templates aprovados abaixo:
  - **"reativar_contato"** (Variável {{1}} = primeiro nome do cliente)
  - **"oi_tudo_bem_"** (Sem variáveis)
  - **"eua_retomar_conversa"** (Sem variáveis)
- No JSON de retorno:
  1. Preencha "template_selecionado" com o nome exato (ex: "reativar_contato").
  2. Preencha "template_componentes" com as variáveis reais.
  3. No campo "proxima_resposta_sugerida", escreva apenas "Template: [nome_do_template]".
  
### MODELOS DE WHATSAPP APROVADOS DISPONÍVEIS:
${templatesContext}
` : "";

    // Monta o prompt combinando regras do prompt.js com dados do contato
    let promptFinal = `${SYSTEM_PROMPT}

${instrucoesJanelaFechada}

# DADOS DE CONVERSA E HISTÓRICO
${fichaLead}

### Anexos Já Enviados:
${anexosEnviadosContext}

### Histórico Recente de Conversa:
${chatLog}

# DATA E HORA ATUAL DO SERVIDOR (BRASÍLIA)
- Hoje é ${diaSemanaStr}, dia ${dataAtualStr}.
- Horário corrente: ${horaAtualStr}.
`;

    if (canal === 'instagram') {
      promptFinal = promptFinal
        .replaceAll('WhatsApp', 'Instagram Direct')
        .replaceAll('no WhatsApp', 'no Instagram')
        .replaceAll('do WhatsApp', 'do Instagram')
        .replaceAll('via WhatsApp', 'via Instagram');
    }

    const promptContent = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptFinal }]
        }
      ]
    };

    let result = null;
    let turnosAdicionais = [];
    let loopCount = 0;
    const maxLoops = 5;

    // 4. CHAMADAS AO GEMINI COM SUPORTE A MÚLTIPLOS TURNOS DE FUNCTION CALLING IN LOOP
    while (loopCount < maxLoops) {
      console.log(`[Stella Processor] Fazendo chamada ao Gemini (Iteração ${loopCount + 1})...`);
      
      const apiParam = {
        contents: [
          ...promptContent.contents,
          ...turnosAdicionais
        ]
      };

      result = await generateContentWithTelemetry({
        modelName: geminiModel,
        promptContent: apiParam,
        origem: 'chat-analysis-v2',
        context: loopCount === 0 ? 'Orquestrador com Tools' : `Orquestrador com Tools - Iteração ${loopCount + 1}`,
        contatoId: contato_id,
        organizacaoId: organizacao_id,
        tools: GEMINI_TOOLS
      });

      const candidateParts = result.response.candidates?.[0]?.content?.parts || [];
      const functionCalls = candidateParts.filter(p => p.functionCall).map(p => p.functionCall);

      if (functionCalls && functionCalls.length > 0) {
        console.log(`[Stella Processor] O modelo solicitou ${functionCalls.length} Function Calls na iteração ${loopCount + 1}:`, JSON.stringify(functionCalls, null, 2));
        const parts = [];

        for (const call of functionCalls) {
          const { name, args } = call;
          const toolResult = await executarToolStella({
            supabaseAdmin,
            organizacaoId: organizacao_id,
            functionName: name,
            functionArgs: args
          });

          parts.push({
            functionResponse: {
              name: name,
              response: { result: toolResult }
            }
          });
        }

        // Adiciona a resposta com as chamadas de função e a resposta da tool nos turnos adicionais
        turnosAdicionais.push({
          role: result.response.candidates[0].content.role || 'model',
          parts: result.response.candidates[0].content.parts
        });

        turnosAdicionais.push({
          role: 'function',
          parts: parts
        });

        loopCount++;
      } else {
        console.log(`[Stella Processor] O modelo não solicitou mais chamadas de função na iteração ${loopCount + 1}.`);
        break;
      }
    }

    console.log(`[Stella Processor Raw Response]`, JSON.stringify(result.response, null, 2));
    const textOutput = result.response.text();
    console.log(`[Stella Processor Text Output]`, textOutput);
    console.log(`[Stella Processor] Resposta final gerada pela IA!`);

    // --- CÁLCULO E LOG DE CUSTO ---
    let custoChamada = 0;
    let novoCustoAcumulado = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const usageMetadata = result?.response?.usageMetadata;
      if (usageMetadata) {
        inputTokens = usageMetadata.promptTokenCount || 0;
        outputTokens = usageMetadata.candidatesTokenCount || 0;
        
        const rates = {
          'gemini-1.5-flash': { input: 0.075, output: 0.30 },
          'gemini-2.5-flash': { input: 0.075, output: 0.30 },
          'gemini-1.5-pro': { input: 1.25, output: 5.00 },
          'gemini-2.5-pro': { input: 1.25, output: 5.00 }
        };
        const activeRate = rates[geminiModel] || rates['gemini-2.5-pro'];
        custoChamada = (inputTokens * (activeRate.input / 1000000)) + (outputTokens * (activeRate.output / 1000000));
        
        const oldAnalysis = contatoInfo?.ai_analysis || {};
        const custoAnterior = oldAnalysis.custo_gemini_acumulado || 0;
        novoCustoAcumulado = parseFloat((custoAnterior + custoChamada).toFixed(8));
      }
    } catch (costErr) {
      console.error('[Stella Processor Cost Error] Erro ao processar custos:', costErr);
    }

    let parsedResult;
    try {
      const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
      parsedResult = JSON.parse(cleanString);
      if (Array.isArray(parsedResult)) parsedResult = parsedResult[0] || {};
      
      parsedResult.last_updated = new Date().toISOString();

      // Blindagem de janela fechada
      if (janelaFechada) {
        const tSel = parsedResult.template_selecionado;
        if (!tSel || tSel === 'null' || tSel === null) {
          const primeiroNome = (parsedResult.dados_cliente?.nome || contatoInfo?.nome || '').split(' ')[0].trim();
          if (primeiroNome && primeiroNome.length > 1 && !primeiroNome.toLowerCase().includes('lead')) {
            parsedResult.template_selecionado = 'reativar_contato';
            parsedResult.template_componentes = [{ type: 'body', parameters: [{ type: 'text', text: primeiroNome }] }];
          } else {
            parsedResult.template_selecionado = 'oi_tudo_bem_';
            parsedResult.template_componentes = null;
          }
          parsedResult.proxima_resposta_sugerida = `Template: ${parsedResult.template_selecionado}`;
        }
      }
    } catch (e) {
      console.error('[Stella Processor Parser Error] Falha ao processar o JSON retornado pela IA:', textOutput, e);
      return { error: 'Falha ao processar o JSON retornado pela IA.', status: 500 };
    }

    // --- ENRIQUECIMENTO CADASTRAL INCREMENTAL ---
    if (parsedResult.dados_cliente && typeof parsedResult.dados_cliente === 'object') {
      const dc = parsedResult.dados_cliente;
      const currentContact = contatoInfo;
      
      if (currentContact) {
        const updateData = {};

        // Regra de Nome Completo
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

        const converterParaBooleano = (val) => {
          if (val === undefined || val === null) return null;
          if (typeof val === 'boolean') return val;
          const s = String(val).trim().toLowerCase();
          if (s === 'sim' || s === 'true' || s === 's' || s === '1') return true;
          if (s === 'não' || s === 'nao' || s === 'false' || s === 'n' || s === '0') return false;
          return null;
        };

        const converterParaNumerico = (val) => {
          if (val === undefined || val === null) return null;
          if (typeof val === 'number') return val;
          
          let cleanVal = String(val)
            .replace(/R\$/g, '')
            .replace(/\s/g, '')
            .trim();
            
          if (cleanVal === '') return null;
          
          // Tratamento de formato brasileiro: 7.000,00 -> remove pontos, troca vírgula por ponto
          if (cleanVal.includes(',') && cleanVal.includes('.')) {
            cleanVal = cleanVal.replace(/\./g, '').replace(/,/g, '.');
          } 
          // Se contiver apenas vírgula como decimal: 7000,00 -> troca por ponto
          else if (cleanVal.includes(',') && !cleanVal.includes('.')) {
            cleanVal = cleanVal.replace(/,/g, '.');
          }
          
          const num = parseFloat(cleanVal);
          return isNaN(num) ? null : num;
        };

        const atualizarSeDiferente = (field, value) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            const currentValue = currentContact[field];
            if (currentValue === null || currentValue === undefined || String(currentValue).trim().toLowerCase() !== String(value).trim().toLowerCase()) {
              updateData[field] = value;
            }
          }
        };

        atualizarSeDiferente('cargo', dc.profissao);
        atualizarSeDiferente('estado_civil', dc.composicao_familiar);
        atualizarSeDiferente('renda_familiar', converterParaNumerico(dc.renda_familiar));
        atualizarSeDiferente('fgts', converterParaBooleano(dc.possui_fgts));
        atualizarSeDiferente('mais_de_3_anos_clt', converterParaBooleano(dc.mais_de_3_anos_clt));
        atualizarSeDiferente('city', dc.cidade_atual);

        if (dc.objetivo && ['MORADIA', 'INVESTIMENTO', 'LAZER'].includes(dc.objetivo.trim().toUpperCase())) {
          updateData.objetivo = dc.objetivo.trim().toUpperCase();
        }

        if (Object.keys(updateData).length > 0) {
          await supabaseAdmin.from('contatos').update(updateData).eq('id', contato_id);
          console.log('[Stella Processor Enrichment] Ficha enriquecida com sucesso:', updateData);
        }
      }
    }

    // --- ATRIBUIR STELLA COMO RESPONSÁVEL NO FUNIL COMERCIAL SE ESTIVER VAZIO ---
    if (funil && funil.id && !funil.corretor_id) {
      try {
        const stellaRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
        if (stellaRecord?.contatoId) {
          await supabaseAdmin.from('contatos_no_funil').update({ corretor_id: stellaRecord.contatoId }).eq('id', funil.id);
          funil.corretor_id = stellaRecord.contatoId;
        }
      } catch (stellaUserErr) {
        console.error('[Stella Processor Error] Falha ao atribuir lead à Stella no funil:', stellaUserErr.message);
      }
    }

    // --- MOVIMENTAÇÃO DE LEADS NO FUNIL ---
    if (!pular_atualizacao_crm && parsedResult.mover_para_coluna_id && funil && funil.id) {
      let novaColunaId = parsedResult.mover_para_coluna_id;
      
      // Resolução dinâmica de colunas de Recrutamento/RH para multitenancy
      if (novaColunaId === 'RECRUTAMENTO' || novaColunaId === 'RH') {
        console.log(`[Stella Processor CRM] Resolvendo coluna de RH de forma dinâmica...`);
        const { data: funilRh } = await supabaseAdmin
          .from('funis')
          .select('id')
          .eq('organizacao_id', organizacao_id)
          .eq('nome', 'Recrutamento & Talentos')
          .limit(1)
          .maybeSingle();

        if (funilRh) {
          const { data: colRh } = await supabaseAdmin
            .from('colunas_funil')
            .select('id, nome')
            .eq('funil_id', funilRh.id)
            .eq('tipo_coluna', 'entrada')
            .limit(1)
            .maybeSingle();

          if (colRh) {
            novaColunaId = colRh.id;
            console.log(`[Stella Processor CRM] Coluna de RH resolvida para: ${novaColunaId} (${colRh.nome})`);
            // Adiciona a coluna recém-descoberta no array em memória caso não esteja lá
            if (!colunasDisponiveis.some(c => c.id === novaColunaId)) {
              colunasDisponiveis.push({ id: colRh.id, nome: colRh.nome });
            }
          }
        }
      }

      const colunaAtualId = funil.coluna_id;

      if (novaColunaId !== colunaAtualId) {
        console.log(`[Stella Processor CRM] Movendo lead no funil de ${colunaAtualId} para ${novaColunaId}...`);
        
        const novaColInfo = colunasDisponiveis.find(c => c.id === novaColunaId);
        const nomeNovaColuna = novaColInfo ? novaColInfo.nome : 'Nova Etapa';

        const { error: updateFunnelError } = await supabaseAdmin
          .from('contatos_no_funil')
          .update({ coluna_id: novaColunaId })
          .eq('id', funil.id);

        if (updateFunnelError) {
          console.error('[Stella Processor CRM Error] Falha ao atualizar coluna no funil:', updateFunnelError.message);
        } else {
          console.log(`[Stella Processor CRM] Lead movido com sucesso para a coluna ${nomeNovaColuna}!`);

          // Se for movido para uma coluna humana ou RH, o piloto automático é desligado
          const colunasDesativarIA = [
            '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4', // QUALIFICAÇÃO STELLA (Transbordo)
            '0553d8db-5259-41bc-ae9e-b8803014ed93', // CLIENTE POTENCIAL
            'feaa8511-261d-451b-bf99-24c8a6d6e7e0', // PERDIDO
            '7de9b5b4-05fa-4813-82d8-7790406ee268'  // INTERVENÇÃO HUMANA (Transbordo)
          ];
          
          if (colunasDesativarIA.includes(novaColunaId) || parsedResult.mover_para_coluna_id === 'RECRUTAMENTO' || parsedResult.mover_para_coluna_id === 'RH') {
            console.log(`[Stella Processor CRM] Desativando piloto automático do lead ${contato_id} por transbordo.`);
            await supabaseAdmin.from('contatos').update({ ia_atendimento_ativo: false }).eq('id', contato_id);
          }

          // Gravar nota no CRM relatando a movimentação
          try {
            const stellaUserRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
            await supabaseAdmin.from('crm_notas').insert({
              contato_id: contato_id,
              contato_no_funil_id: funil.id,
              conteudo: parsedResult.justificativa_movimentacao || `Piloto Automático Stella: Lead movido para a etapa "${nomeNovaColuna}".`,
              usuario_id: stellaUserRecord?.userId || null,
              organizacao_id: organizacao_id
            });
          } catch (noteErr) {
            console.error('[Stella Processor CRM Note Error] Falha ao gravar nota:', noteErr.message);
          }
        }
      }
    }

    // 6. Salvar localmente o cache mesclado
    let finalAnalysis = parsedResult;
    const oldAnalysis = contatoInfo?.ai_analysis || {};

    if (quickResponse) {
      finalAnalysis = {
        ...oldAnalysis,
        proxima_resposta_sugerida: parsedResult.proxima_resposta_sugerida,
        empreendimento_detectado_id: parsedResult.empreendimento_detectado_id,
        anexo_sugerido: parsedResult.anexo_sugerido,
        template_selecionado: parsedResult.template_selecionado || null,
        template_componentes: parsedResult.template_componentes || null,
        mover_para_coluna_id: parsedResult.mover_para_coluna_id || null,
        justificativa_movimentacao: parsedResult.justificativa_movimentacao || null,
        last_updated: new Date().toISOString()
      };
    }

    const mergedAnalysis = {
      ...oldAnalysis,
      ...finalAnalysis,
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
      }
    };

    await supabaseAdmin
      .from('contatos')
      .update({ ai_analysis: mergedAnalysis })
      .eq('id', contato_id);

    return mergedAnalysis;

  } catch (error) {
    console.error('[Stella Processor Fatal Error]', error);
    return { error: error.message, status: 500 };
  } finally {
    // Liberar lock no banco
    try {
      await supabaseAdmin.rpc('liberar_lock_stella', { p_contato_id: contato_id });
      console.log(`[Stella Processor Lock] Lock liberado para contato ${contato_id}`);
    } catch (liberarErr) {
      console.error('[Stella Processor Lock Error] Erro ao liberar lock:', liberarErr.message);
    }
  }
}

/**
 * Executa a movimentação do lead no CRM (funil e piloto automático) e grava nota explicativa.
 * Chamada de forma síncrona/backgroundizada pelo route.js somente após o envio bem-sucedido das mensagens.
 */
export async function executarMovimentacaoCRMStella(supabaseAdmin, contato_id, organizacao_id, parsedResult) {
  if (!parsedResult || !parsedResult.mover_para_coluna_id) {
    return;
  }

  try {
    console.log(`[Stella CRM Handoff] Iniciando atualização de CRM pós-mensagens para contato ${contato_id}...`);

    // 1. Obter o card no funil
    const { data: funil } = await supabaseAdmin
      .from('contatos_no_funil')
      .select('id, coluna_id')
      .eq('contato_id', contato_id)
      .eq('organizacao_id', organizacao_id)
      .limit(1)
      .maybeSingle();

    if (!funil) {
      console.warn(`[Stella CRM Handoff Warning] Card no funil não encontrado para o contato ${contato_id} na org ${organizacao_id}.`);
      return;
    }

    let novaColunaId = parsedResult.mover_para_coluna_id;
    
    // Resolução dinâmica de colunas de Recrutamento/RH para multitenancy
    if (novaColunaId === 'RECRUTAMENTO' || novaColunaId === 'RH') {
      console.log(`[Stella CRM Handoff] Resolvendo coluna de RH de forma dinâmica...`);
      const { data: funilRh } = await supabaseAdmin
        .from('funis')
        .select('id')
        .eq('organizacao_id', organizacao_id)
        .eq('nome', 'Recrutamento & Talentos')
        .limit(1)
        .maybeSingle();

      if (funilRh) {
        const { data: colRh } = await supabaseAdmin
          .from('colunas_funil')
          .select('id, nome')
          .eq('funil_id', funilRh.id)
          .eq('tipo_coluna', 'entrada')
          .limit(1)
          .maybeSingle();

        if (colRh) {
          novaColunaId = colRh.id;
          console.log(`[Stella CRM Handoff] Coluna de RH resolvida para: ${novaColunaId} (${colRh.nome})`);
        }
      }
    }

    const colunaAtualId = funil.coluna_id;

    if (novaColunaId !== colunaAtualId) {
      console.log(`[Stella CRM Handoff] Movendo lead de ${colunaAtualId} para ${novaColunaId}...`);

      // Buscar colunas da organização
      const { data: colunas } = await supabaseAdmin
        .from('colunas_funil')
        .select('id, nome')
        .eq('organizacao_id', organizacao_id);

      const colunasDisponiveis = colunas || [];
      const novaColInfo = colunasDisponiveis.find(c => c.id === novaColunaId);
      const nomeNovaColuna = novaColInfo ? novaColInfo.nome : 'Nova Etapa';

      const { error: updateFunnelError } = await supabaseAdmin
        .from('contatos_no_funil')
        .update({ coluna_id: novaColunaId })
        .eq('id', funil.id);

      if (updateFunnelError) {
        console.error('[Stella CRM Handoff Error] Falha ao atualizar coluna no funil:', updateFunnelError.message);
        return;
      }

      console.log(`[Stella CRM Handoff] Lead movido com sucesso para a coluna ${nomeNovaColuna}!`);

      // Se for movido para uma coluna humana ou RH, desliga o piloto automático no contato
      const colunasDesativarIA = [
        '4b9b7e6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4', // QUALIFICAÇÃO STELLA (Transbordo)
        '0553d8db-5259-41bc-ae9e-b8803014ed93', // CLIENTE POTENCIAL
        'feaa8511-261d-451b-bf99-24c8a6d6e7e0', // PERDIDO
        '7de9b5b4-05fa-4813-82d8-7790406ee268'  // INTERVENÇÃO HUMANA (Transbordo)
      ];
      
      if (colunasDesativarIA.includes(novaColunaId) || parsedResult.mover_para_coluna_id === 'RECRUTAMENTO' || parsedResult.mover_para_coluna_id === 'RH') {
        console.log(`[Stella CRM Handoff] Desativando piloto automático do lead ${contato_id} por transbordo.`);
        await supabaseAdmin
          .from('contatos')
          .update({ ia_atendimento_ativo: false })
          .eq('id', contato_id);
      }

      // Gravar nota no CRM relatando a movimentação
      try {
        const stellaUserRecord = await obterOuCriarUsuarioStella(supabaseAdmin, organizacao_id);
        await supabaseAdmin.from('crm_notas').insert({
          contato_id: contato_id,
          contato_no_funil_id: funil.id,
          conteudo: parsedResult.justificativa_movimentacao || `Piloto Automático Stella: Lead movido para a etapa "${nomeNovaColuna}".`,
          usuario_id: stellaUserRecord?.userId || null,
          organizacao_id: organizacao_id
        });
        console.log(`[Stella CRM Handoff] Nota do CRM cadastrada com sucesso.`);
      } catch (noteErr) {
        console.error('[Stella CRM Handoff Note Error] Falha ao gravar nota:', noteErr.message);
      }
    } else {
      console.log(`[Stella CRM Handoff] O lead já estava na coluna ${novaColunaId}. Nenhuma ação necessária.`);
    }
  } catch (error) {
    console.error('[Stella CRM Handoff Critical Error] Falha na execução da movimentação do CRM:', error.message);
  }
}

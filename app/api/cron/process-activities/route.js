import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Força carregamento dinâmico
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

export async function GET(request) {
  try {
    // 1. Validação de Segurança (Apenas quem tem a chave pode rodar o Cron em prod)
    const authHeader = request.headers.get('authorization');
    const envSecret = process.env.CRON_SECRET;
    
    if (process.env.NODE_ENV === 'production' && envSecret) {
      if (authHeader !== `Bearer ${envSecret}`) {
        return NextResponse.json({ error: 'Não autorizado. CRON_SECRET inválido ou ausente.' }, { status: 401 });
      }
    }

    console.log('--- [CRON Stella] Iniciando Processamento de Atividades Pendentes ---');

    // 2. Conexão Admin com Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Credenciais do Supabase não configuradas no servidor.");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Buscar todas as atividades da Stella que estão "Não iniciado"
    const { data: pendentes, error: queryError } = await supabaseAdmin
      .from('activities')
      .select('*')
      .eq('status', 'Não iniciado')
      .eq('tipo_atividade', 'Evento')
      .eq('responsavel_texto', 'Stella IA');

    if (queryError) {
      console.error('[CRON Stella Error] Erro ao buscar atividades no banco:', queryError.message);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!pendentes || pendentes.length === 0) {
      console.log('[CRON Stella] Nenhuma atividade da Stella pendente.');
      return NextResponse.json({ message: 'Sem atividades pendentes.' }, { status: 200 });
    }

    // 4. Filtrar Atividades Vencidas no Fuso de Brasília (UTC-3)
    const agora = new Date();
    const dataHojeStr = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // Retorna YYYY-MM-DD
    const horaAgoraStr = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); // Retorna HH:MM:SS
    const dataRefAgora = `${dataHojeStr} ${horaAgoraStr}`;

    console.log(`[CRON Stella] Data/Hora Atual Brasília: ${dataRefAgora}`);

    const vencidas = pendentes.filter(act => {
      if (!act.data_inicio_prevista) return false;
      const horaStr = act.hora_inicio || '09:00:00';
      const dataRefAgendada = `${act.data_inicio_prevista} ${horaStr}`;
      return dataRefAgendada <= dataRefAgora;
    });

    console.log(`[CRON Stella] Encontradas ${vencidas.length} atividades vencidas/no horário.`);

    if (vencidas.length === 0) {
      return NextResponse.json({ message: 'Nenhuma atividade no horário de disparo.' }, { status: 200 });
    }

    // 5. Processar Lote
    const LIMIT_RUN = 5;
    const loteParaProcessar = vencidas.slice(0, LIMIT_RUN);
    const resultados = [];

    for (const act of loteParaProcessar) {
      try {
        console.log(`[CRON Stella] Processando Atividade ID ${act.id} para Contato ID ${act.contato_id}...`);

        // Trava de concorrência atômica: atualiza o status para 'Processando'
        // para que outras execuções concorrentes do cron não processem o mesmo item.
        const { data: lockResult, error: lockError } = await supabaseAdmin
          .from('activities')
          .update({ status: 'Processando', updated_at: new Date().toISOString() })
          .eq('id', act.id)
          .eq('status', 'Não iniciado')
          .select('id');

        if (lockError || !lockResult || lockResult.length === 0) {
          console.log(`[CRON Stella] ⏭️ Atividade ID ${act.id} já foi travada ou processada por outra execução concorrente. Ignorando.`);
          continue;
        }

        // 0. Verificar se piloto automático está ativo para o contato e se o lead está atribuído à Stella
        // Mudamos funilRes para usar limit(1) e evitar erro de múltiplas linhas
        const [contatoInfoRes, stellaUserRes, funilRes] = await Promise.all([
          supabaseAdmin
            .from('contatos')
            .select('ia_atendimento_ativo, ai_analysis')
            .eq('id', act.contato_id)
            .single(),
          supabaseAdmin
            .from('usuarios')
            .select('id, contato_id')
            .eq('email', `stella.org${act.organizacao_id}@elo57.com.br`)
            .maybeSingle(),
          supabaseAdmin
            .from('contatos_no_funil')
            .select('corretor_id')
            .eq('contato_id', act.contato_id)
            .limit(1)
        ]);

        const contatoInfo = contatoInfoRes.data;
        const contatoInfoErr = contatoInfoRes.error;
        const stellaUserId = stellaUserRes.data?.id;
        const stellaContatoId = stellaUserRes.data?.contato_id;
        const leadCorretorId = funilRes.data?.[0]?.corretor_id;

        // Se o lead no funil está atribuído a um corretor humano, desativa o piloto automático por segurança
        let autopilotActive = contatoInfo?.ia_atendimento_ativo;
        let isHumanReassigned = false;
        
        if (autopilotActive && stellaContatoId && leadCorretorId && stellaContatoId !== leadCorretorId) {
          console.warn(`[CRON Stella] Contato ID ${act.contato_id} atribuído ao corretor humano ID ${leadCorretorId}. Desativando autopilot.`);
          autopilotActive = false;
          isHumanReassigned = true;
          await supabaseAdmin
            .from('contatos')
            .update({ ia_atendimento_ativo: false })
            .eq('id', act.contato_id);
        }

        if (contatoInfoErr || !contatoInfo || !autopilotActive) {
          const motivoCancelamento = isHumanReassigned 
            ? 'Lead sob responsabilidade de corretor humano' 
            : 'Piloto automático inativo para este contato';
          
          console.warn(`[CRON Stella Warning] Contato ID ${act.contato_id} com piloto automático inativo. Cancelando atividade.`);
          await supabaseAdmin
            .from('activities')
            .update({ 
              status: 'Cancelado', 
              descricao: `${act.descricao || ''}\n[Cancelado automaticamente: ${motivoCancelamento}]` 
            })
            .eq('id', act.id);
          resultados.push({ id: act.id, status: 'cancelada_ia_inativo' });
          continue;
        }

        // A. Buscar telefone do contato
        const { data: telefones, error: telError } = await supabaseAdmin
          .from('telefones')
          .select('telefone')
          .eq('contato_id', act.contato_id)
          .limit(1);

        if (telError) throw telError;

        const telefoneDestino = telefones?.[0]?.telefone;
        if (!telefoneDestino) {
          console.warn(`[CRON Stella Warning] Contato ID ${act.contato_id} sem telefone cadastrado. Cancelando atividade.`);
          await supabaseAdmin
            .from('activities')
            .update({ 
              status: 'Cancelado', 
              descricao: `${act.descricao || ''}\n[Cancelado automaticamente: Contato sem telefone cadastrado]` 
            })
            .eq('id', act.id);
          resultados.push({ id: act.id, status: 'cancelada_sem_telefone' });
          continue;
        }

        // B. Buscar histórico de mensagens da conversa (últimas 20 msgs)
        const { data: messages } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('content, direction, sent_at')
          .eq('contato_id', act.contato_id)
          .eq('organizacao_id', act.organizacao_id)
          .order('sent_at', { ascending: false })
          .limit(20);

        const reversedMessages = [...(messages || [])].reverse();
        const chatLog = reversedMessages.filter(m => m.content).map(m => {
          const actor = m.direction === 'inbound' ? 'Cliente' : 'Corretor';
          return `[${new Date(m.sent_at).toLocaleString('pt-BR')}] ${actor}: ${m.content}`;
        }).join('\n');

        // B.2 Verificar se a janela de 24 horas está aberta
        const { data: lastInbound } = await supabaseAdmin
          .from('whatsapp_messages')
          .select('sent_at')
          .eq('contato_id', act.contato_id)
          .eq('direction', 'inbound')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const agoraData = new Date();
        const ultimaMsgData = lastInbound ? new Date(lastInbound.sent_at) : null;
        const janelaAberta = ultimaMsgData && (agoraData - ultimaMsgData < 24 * 60 * 60 * 1000);

        console.log(`[CRON Stella] Contato ID ${act.contato_id}: Janela de 24h está ${janelaAberta ? 'ABERTA' : 'FECHADA'}. Último inbound: ${ultimaMsgData ? ultimaMsgData.toLocaleString('pt-BR') : 'nunca'}`);

        let sendPayload = {};
        let finalLogMessage = '';

        if (janelaAberta) {
          // --- FLUXO JANELA ABERTA ---
          console.log(`[CRON Stella] Processando fluxo de texto livre...`);
          const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-pro-preview',
            generationConfig: {
              responseMimeType: "application/json",
            }
          });

          const prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Você está realizando um retorno de contato automático que foi agendado anteriormente.

# Detalhes da Tarefa de Acompanhamento Agendada:
- Título da tarefa: ${act.nome}
- Motivo/Descrição da tarefa: ${act.descricao}
- Data agendada: ${act.data_inicio_prevista} ${act.hora_inicio}

# Histórico Recente de Conversa (WhatsApp):
${chatLog}

# Sua Missão:
Escreva a mensagem exata de acompanhamento/retorno para enviar ao cliente no WhatsApp agora.

# Regras Críticas para a Mensagem:
1. **Seja Extremamente Natural e Humana**: A mensagem deve parecer escrita por uma pessoa real, de forma amigável, acolhedora e empática.
2. **Contexto Exato**: Use o motivo da tarefa e o histórico da conversa. Por exemplo:
   - Se o cliente disse que estava viajando e voltava na segunda, pergunte como foi a viagem ou diga que está chamando como prometido.
   - Se o cliente disse que só podia falar após as 18h, mencione que está entrando em contato agora no horário sugerido por ele.
   - Se o cliente pediu para ser lembrado em 5 minutos, traga o lembrete de volta de forma simpática.
3. **WhatsApp Style**: Escreva uma mensagem muito sucinta (máximo 2 a 3 linhas por parágrafo, no máximo 1 ou 2 parágrafos). Use emojis de forma amigável e natural.
4. **Termine com uma Pergunta Curta**: Conclua com uma única pergunta simples para engajar o cliente e incentivar a resposta.
5. **Sem placeholders ou tags**: Escreva apenas o texto final pronto para envio. Nenhuma marcação, nenhuma tag, nenhum "Olá [Nome]" se você não sabe o nome do cliente. Se souber o nome do cliente (veja no histórico ou na tarefa), use-o de forma natural.

Retorne um JSON no formato:
{
  "mensagem": "Texto final da mensagem a ser enviada no WhatsApp"
}
          `;

          const result = await model.generateContent([{ text: prompt }]);
          const textOutput = result.response.text();

          let generatedMessage = '';
          try {
            const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
            const parsed = JSON.parse(cleanString);
            generatedMessage = parsed.mensagem || parsed.response || '';
          } catch (jsonErr) {
            console.error('[CRON Stella Error] Falha ao parsear JSON do Gemini, usando texto bruto:', textOutput, jsonErr.message);
            generatedMessage = textOutput.trim();
          }

          if (!generatedMessage || generatedMessage.length === 0) {
            throw new Error('A mensagem gerada pela inteligência artificial está vazia.');
          }

          sendPayload = {
            to: telefoneDestino,
            type: 'text',
            text: generatedMessage,
            contact_id: act.contato_id,
            organizacao_id: act.organizacao_id,
            usuario_id: stellaUserId
          };
          finalLogMessage = generatedMessage;

        } else {
          // --- FLUXO JANELA FECHADA ---
          console.log(`[CRON Stella] Processando fluxo de template Meta...`);

          const { data: config, error: configError } = await supabaseAdmin
            .from('configuracoes_whatsapp')
            .select('whatsapp_permanent_token, whatsapp_business_account_id')
            .eq('organizacao_id', act.organizacao_id)
            .single();

          if (configError || !config) {
            throw new Error(`Configuração do WhatsApp não encontrada para a organização ${act.organizacao_id}.`);
          }

          const WHATSAPP_TOKEN = config.whatsapp_permanent_token || process.env.WHATSAPP_SYSTEM_USER_TOKEN;
          const WHATSAPP_BUSINESS_ACCOUNT_ID = config.whatsapp_business_account_id;

          if (!WHATSAPP_BUSINESS_ACCOUNT_ID || !WHATSAPP_TOKEN) {
            throw new Error('Credenciais de API do WhatsApp (WABA ID ou Token) incompletas no banco.');
          }

          const templatesUrl = `https://graph.facebook.com/v20.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=name,status,category,language,components&limit=100`;
          const templatesRes = await fetch(templatesUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
          });

          const templatesData = await templatesRes.json();

          if (!templatesRes.ok) {
            throw new Error(`Erro ao buscar templates na Meta: ${templatesData.error?.message || 'Erro desconhecido'}`);
          }

          const rawTemplates = Array.isArray(templatesData?.data) ? templatesData.data : [];
          const approvedTemplates = rawTemplates.filter(t => t.status === 'APPROVED');

          if (approvedTemplates.length === 0) {
            throw new Error('Nenhum template aprovado na Meta encontrado para reabrir a janela de conversação.');
          }

          const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-pro-preview',
            generationConfig: {
              responseMimeType: "application/json",
            }
          });

          const prompt = `
Você é Stella, a super Analista Comercial de Elite e Assistente Copiloto da Studio 57.
Você precisa enviar um retorno de contato automático que foi agendado anteriormente, porém a janela de 24 horas do cliente no WhatsApp está FECHADA.
Por causa disso, você só pode enviar mensagens utilizando um dos templates pré-aprovados pela Meta na conta de negócios da incorporadora.

# Detalhes da Tarefa de Acompanhamento Agendada:
- Título da tarefa: ${act.nome}
- Motivo/Descrição da tarefa: ${act.descricao}
- Data agendada: ${act.data_inicio_prevista} ${act.hora_inicio}

# Histórico Recente de Conversa (WhatsApp):
${chatLog}

# Lista de Templates Aprovados Disponíveis no WhatsApp da Empresa:
${JSON.stringify(approvedTemplates, null, 2)}

# Sua Missão:
1. **Escolha o Melhor Template**: Analise os templates aprovados acima e selecione aquele que melhor se adequa ao motivo da tarefa e ao histórico da conversa.
2. **Preencha as Variáveis do Template**: Se o template contiver variáveis (como {{1}}, {{2}} no componente BODY), gere os valores mais adequados e humanizados para cada variável com base no contexto do cliente.
   - Os valores das variáveis devem ser curtos, diretos e parecer escritos de forma natural por uma pessoa.
   - NUNCA use placeholders genéricos. Se você souber o nome do cliente, use-o. Se for sobre um agendamento ou retorno, use valores reais que se encaixem perfeitamente.
3. **Mapeie no Formato Meta**: Monte o objeto de componentes de parâmetros de variáveis que será enviado no payload.
4. **Gere o Conteúdo Final**: Forneça o texto completo final do template com as variáveis substituídas no campo "custom_content" (isso será salvo na nossa linha do tempo para sabermos o que foi enviado).

# Regras Importantes:
- Priorize templates que façam sentido comercial de reengajamento ou acompanhamento.
- Se nenhum template for 100% específico, use um template de saudação mais genérico (ex: "hello_world" ou ssimilar) e, se aplicável, preencha as variáveis de forma a trazer o assunto de volta de maneira sutil.
- O formato do JSON retornado deve ser estritamente o especificado abaixo.

# Formato do JSON de Resposta:
{
  "templateName": "nome_do_template_escolhido",
  "languageCode": "codigo_de_idioma_do_template_por_exemplo_pt_BR_ou_en_US",
  "components": [
    {
      "type": "body",
      "parameters": [
        {
          "type": "text",
          "text": "Valor que substituirá {{1}}"
        },
        {
          "type": "text",
          "text": "Valor que substituirá {{2}}"
        }
      ]
    }
  ],
  "custom_content": "O texto completo do template com as variáveis devidamente substituídas para podermos ver no chat"
}

Observação: Se o template escolhido não possuir variáveis no corpo, retorne "components": [] e o texto estático do template no "custom_content".
`;

          const result = await model.generateContent([{ text: prompt }]);
          const textOutput = result.response.text();

          let aiResponse = {};
          try {
            const cleanString = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
            aiResponse = JSON.parse(cleanString);
          } catch (jsonErr) {
            throw new Error(`Falha ao parsear JSON de template gerado pela IA: ${jsonErr.message}. Retorno bruto: ${textOutput}`);
          }

          if (!aiResponse.templateName) {
            throw new Error('A IA não retornou o nome do template a ser enviado.');
          }

          sendPayload = {
            to: telefoneDestino,
            type: 'template',
            templateName: aiResponse.templateName,
            languageCode: aiResponse.languageCode || 'pt_BR',
            components: aiResponse.components || [],
            custom_content: aiResponse.custom_content || `Template: ${aiResponse.templateName}`,
            contact_id: act.contato_id,
            organizacao_id: act.organizacao_id,
            usuario_id: stellaUserId
          };
          finalLogMessage = sendPayload.custom_content;
          console.log(`[CRON Stella] Escolhido template: ${aiResponse.templateName}. Custom Content: "${finalLogMessage}"`);
        }

        // D. Enviar no WhatsApp chamando a API local
        const sendUrl = `${request.nextUrl.origin}/api/whatsapp/send`;
        console.log(`[CRON Stella] Disparando lembrete via: ${sendUrl} (Tipo: ${sendPayload.type})`);

        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(sendPayload)
        });

        const sendResult = await sendResponse.json();
        
        if (!sendResponse.ok) {
          throw new Error(`Erro retornado pela API local: ${sendResult.error || 'Erro desconhecido no envio'}`);
        }

        if (sendPayload.type === 'template') {
          try {
            const currentCache = contatoInfo.ai_analysis || {};
            const tentativas = (currentCache.tentativas_insistencia || 0) + 1;
            currentCache.tentativas_insistencia = tentativas;

            console.log(`[CRON Stella Insistência] Contato ${act.contato_id} - Tentativa de insistência número ${tentativas} enviada com sucesso.`);

            if (tentativas < 3) {
              await supabaseAdmin
                .from('contatos')
                .update({ ai_analysis: currentCache })
                .eq('id', act.contato_id);

              const dataMinimaSeguinte = calcularDataDoisDiasUteis(new Date());
              const novaAtividade = {
                contato_id: act.contato_id,
                organizacao_id: act.organizacao_id,
                criado_por_usuario_id: act.criado_por_usuario_id,
                funcionario_id: act.funcionario_id || null,
                nome: `Stella IA - Insistência Comercial (Tentativa ${tentativas + 1})`,
                descricao: `Mensagem de insistência comercial automática (Template Meta) para tentar reengajar o lead silencioso.`,
                data_inicio_prevista: dataMinimaSeguinte,
                data_fim_prevista: dataMinimaSeguinte,
                hora_inicio: act.hora_inicio || '09:00:00',
                tipo_atividade: 'Evento',
                duracao_horas: 1.0,
                duracao_dias: 0,
                status: 'Não iniciado',
                responsavel_texto: 'Stella IA'
              };

              const { data: newAct, error: newActErr } = await supabaseAdmin
                .from('activities')
                .insert(novaAtividade)
                .select('id')
                .single();

              if (newActErr) {
                console.error('[CRON Stella Error] Erro ao agendar a próxima atividade de insistência:', newActErr.message);
              } else {
                console.log(`[CRON Stella] Próxima atividade de insistência (Tentativa ${tentativas + 1}) agendada: ID ${newAct.id}`);
              }
            } else {
              console.log(`[CRON Stella] Contato ${act.contato_id} atingiu o limite de ${tentativas} tentativas. Movendo lead para a coluna PERDIDO.`);
              
              currentCache.tentativas_insistencia = 0;
              await supabaseAdmin
                .from('contatos')
                .update({ ai_analysis: currentCache })
                .eq('id', act.contato_id);

              const { data: funil } = await supabaseAdmin
                .from('contatos_no_funil')
                .select('id')
                .eq('contato_id', act.contato_id)
                .limit(1);

              const funilRecord = funil?.[0];
              const colunaPerdidoId = 'feaa8511-261d-451b-bf99-24c8a6d6e7e0'; // Coluna PERDIDO

              if (funilRecord) {
                await supabaseAdmin
                  .from('contatos_no_funil')
                  .update({ 
                    coluna_id: colunaPerdidoId, 
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', funilRecord.id);

                await supabaseAdmin
                  .from('crm_notas')
                  .insert({
                    contato_id: act.contato_id,
                    contato_no_funil_id: funilRecord.id,
                    conteudo: `🤖 [Piloto Automático Stella] Lead movido automaticamente para a coluna PERDIDO. Motivo: Ausência de resposta após 3 tentativas de insistência via templates Meta. Piloto automático mantido ativo caso o cliente retorne contato no futuro.`,
                    organizacao_id: act.organizacao_id
                  });
                
                console.log(`[CRON Stella] Lead ${act.contato_id} arquivado com sucesso no CRM.`);
              }
            }
          } catch (insistenciaErr) {
            console.error('[CRON Stella Error] Erro ao tratar insistência comercial:', insistenciaErr.message);
          }
        }

        await supabaseAdmin
          .from('activities')
          .update({
            status: 'Concluído',
            data_fim_real: dataHojeStr,
            descricao: `${act.descricao || ''}\n[Enviado automaticamente pela Stella IA (${sendPayload.type === 'template' ? 'Template Meta: ' + sendPayload.templateName : 'Texto Livre'}) em ${dataHojeStr} às ${horaAgoraStr}]`
          })
          .eq('id', act.id);

        try {
          const { data: funil } = await supabaseAdmin
            .from('contatos_no_funil')
            .select('id')
            .eq('contato_id', act.contato_id)
            .limit(1);

          const funilRecord = funil?.[0];
          if (funilRecord?.id) {
            await supabaseAdmin
              .from('crm_notas')
              .insert({
                contato_no_funil_id: funilRecord.id,
                contato_id: act.contato_id,
                conteudo: `🤖 [Piloto Automático Stella] Retorno de contato realizado via WhatsApp (${sendPayload.type === 'template' ? 'Template Meta' : 'Texto Livre'}): "${finalLogMessage}"`,
                organizacao_id: act.organizacao_id
              });
          }
        } catch (noteErr) {
          console.warn('[CRON Stella Warning] Fail to register notes on CRM for contact:', noteErr.message);
        }

        console.log(`[CRON Stella] Atividade ID ${act.id} concluída com sucesso.`);
        resultados.push({ id: act.id, status: 'sucesso', mensagem: finalLogMessage, tipo: sendPayload.type });

      } catch (err) {
        console.error(`[CRON Stella Error] Falha ao processar atividade ID ${act.id}:`, err.message);
        resultados.push({ id: act.id, status: 'erro', erro: err.message });
        
        try {
          await supabaseAdmin
            .from('activities')
            .update({ 
              status: 'Não iniciado', 
              updated_at: new Date().toISOString() 
            })
            .eq('id', act.id);
          console.log(`[CRON Stella] Status da atividade ID ${act.id} revertido para 'Não iniciado' após falha.`);
        } catch (revertErr) {
          console.error(`[CRON Stella Error] Falha ao reverter status da atividade ID ${act.id}:`, revertErr.message);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      message: 'Processamento de atividades concluído',
      lote_tamanho: loteParaProcessar.length,
      resultados
    }, { status: 200 });

  } catch (fatalError) {
    console.error('[CRON Stella Fatal Error]', fatalError);
    return NextResponse.json({ error: 'Erro interno no servidor cron.', detalhe: fatalError.message }, { status: 500 });
  }
}

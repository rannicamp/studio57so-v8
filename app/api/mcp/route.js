import { authenticateMcpKey } from '@/utils/supabase/mcp';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// Mapa de conexões ativas na memória do processo (útil em dev local e servidores com estado)
if (!global.mcpConnections) {
  global.mcpConnections = new Map();
}
const connections = global.mcpConnections;

/**
 * GET /api/mcp
 * Estabelece a conexão Server-Sent Events (SSE) com o agente de IA.
 */
export async function GET(request) {
  // 1. Extrair a chave de API do usuário
  const authHeader = request.headers.get('authorization');
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const url = new URL(request.url);
    token = url.searchParams.get('token') || '';
  }

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Chave de API (Bearer Token) ausente.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Autenticar a chave de API e obter o cliente Supabase com JWT do usuário
  const mcpContext = await authenticateMcpKey(token);
  if (!mcpContext) {
    return new Response(
      JSON.stringify({ error: 'Chave de API inválida, inativa ou expirada.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const connectionId = uuidv4();
  const encoder = new TextEncoder();

  console.log(`[MCP] Nova conexão SSE estabelecida. ID: ${connectionId} (Usuário: ${mcpContext.user.id}, Org: ${mcpContext.user.organizacao_id})`);

  // 3. Retornar o Stream SSE
  const stream = new ReadableStream({
    start(controller) {
      // Salva a conexão ativa
      connections.set(connectionId, {
        controller,
        supabase: mcpContext.supabase,
        user: mcpContext.user
      });

      // Envia o cabeçalho 'endpoint' inicial (exigência do protocolo MCP SSE)
      const endpointUrl = `/api/mcp?connectionId=${connectionId}`;
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointUrl}\n\n`));

      // Mantém a conexão viva enviando pings a cada 15 segundos
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (e) {
          clearInterval(pingInterval);
          connections.delete(connectionId);
        }
      }, 15000);

      // Limpa no encerramento
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        connections.delete(connectionId);
        console.log(`[MCP] Conexão SSE abortada pelo cliente. ID: ${connectionId}`);
      });
    },
    cancel() {
      connections.delete(connectionId);
      console.log(`[MCP] Conexão SSE cancelada. ID: ${connectionId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * POST /api/mcp
 * Recebe comandos JSON-RPC do cliente e processa as ferramentas.
 */
export async function POST(request) {
  const url = new URL(request.url);
  const connectionId = url.searchParams.get('connectionId');

  if (!connectionId) {
    return new Response(
      JSON.stringify({ error: 'connectionId ausente na query string.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const connection = connections.get(connectionId);
  if (!connection) {
    return new Response(
      JSON.stringify({ error: 'Conexão MCP inativa ou não encontrada. Abra a conexão via GET primeiro.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rpcRequest = await request.json();
    console.log(`[MCP] Requisição recebida para conexão ${connectionId}:`, rpcRequest.method);

    // Processa a requisição JSON-RPC
    const rpcResponse = await handleMcpRequest(rpcRequest, connection.supabase, connection.user);

    // Envia no canal SSE como evento 'message' (padrão oficial MCP SSE)
    const encoder = new TextEncoder();
    try {
      connection.controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`));
    } catch (sseErr) {
      console.warn(`[MCP] Erro ao enviar resposta via SSE para ${connectionId}:`, sseErr.message);
    }

    // Retorna também a resposta diretamente no POST para compatibilidade máxima com SDKs simplificados
    return new Response(JSON.stringify(rpcResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err) {
    console.error(`[MCP] Erro ao processar POST para ${connectionId}:`, err);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Erro interno ao processar requisição.' },
        id: null
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PROCESSADOR DE REQUISIÇÕES JSON-RPC DO MCP
 */
async function handleMcpRequest(rpcRequest, supabase, user) {
  const { method, params, id } = rpcRequest;
  const jsonrpc = '2.0';

  switch (method) {
    case 'initialize':
      return {
        jsonrpc,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'elo57-mcp-server',
            version: '1.1.0'
          }
        },
        id
      };

    case 'tools/list':
      return {
        jsonrpc,
        result: {
          tools: [
            {
              name: 'listar_empreendimentos',
              description: 'Lista todos os empreendimentos imobiliários/obras ativos da organização.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_contas_financeiras',
              description: 'Lista as contas bancárias e cartões de crédito cadastrados na organização. Use para obter o ID correto da conta antes de fazer lançamentos.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_categorias_financeiras',
              description: 'Lista as categorias e subcategorias financeiras do sistema. Use para obter o ID correto da categoria antes de fazer lançamentos.',
              inputSchema: {
                type: 'object',
                properties: {
                  tipo: {
                    type: 'string',
                    description: 'Filtrar pelo tipo da categoria',
                    enum: ['Despesa', 'Receita']
                  }
                }
              }
            },
            {
              name: 'buscar_lancamentos_financeiros',
              description: 'Consulta o extrato de lançamentos financeiros (despesas/receitas) com filtros avançados. Útil para verificar status de pagamentos, conciliar e gerar relatórios.',
              inputSchema: {
                type: 'object',
                properties: {
                  busca: {
                    type: 'string',
                    description: 'Termo para pesquisar na descrição ou observações'
                  },
                  data_inicio: {
                    type: 'string',
                    description: 'Data de início para filtro do período (YYYY-MM-DD)'
                  },
                  data_fim: {
                    type: 'string',
                    description: 'Data final para filtro do período (YYYY-MM-DD)'
                  },
                  tipo: {
                    type: 'string',
                    description: 'Filtrar tipo de lançamento',
                    enum: ['Despesa', 'Receita']
                  },
                  status: {
                    type: 'string',
                    description: 'Filtrar pelo status do lançamento',
                    enum: ['Pago', 'Pendente']
                  },
                  conta_id: {
                    type: 'integer',
                    description: 'ID da conta financeira específica'
                  },
                  categoria_id: {
                    type: 'integer',
                    description: 'ID da categoria financeira específica'
                  },
                  limite: {
                    type: 'integer',
                    description: 'Quantidade máxima de lançamentos (padrão 50, máx 200)',
                    default: 50
                  }
                }
              }
            },
            {
              name: 'listar_clientes_crm',
              description: 'Busca contatos/leads cadastrados no CRM da organização.',
              inputSchema: {
                type: 'object',
                properties: {
                  busca: {
                    type: 'string',
                    description: 'Termo para pesquisar por nome, email ou celular'
                  },
                  limite: {
                    type: 'integer',
                    description: 'Limite máximo de contatos a retornar (padrão 20)',
                    default: 20
                  }
                }
              }
            },
            {
              name: 'criar_atividade_crm',
              description: 'Agenda uma nova atividade comercial ou de tarefas vinculada a um cliente/contato no CRM.',
              inputSchema: {
                type: 'object',
                properties: {
                  contato_id: {
                    type: 'integer',
                    description: 'ID numérico do contato associado. Se não souber, busque com listar_clientes_crm.'
                  },
                  titulo: {
                    type: 'string',
                    description: 'Nome ou título da atividade. Se não fornecido, pergunte.'
                  },
                  descricao: {
                    type: 'string',
                    description: 'Detalhamento ou notas da atividade'
                  },
                  tipo: {
                    type: 'string',
                    description: 'Tipo de atividade',
                    enum: ['Ligação', 'Reunião', 'Mensagem', 'Visita', 'Tarefa']
                  },
                  data_inicio: {
                    type: 'string',
                    description: 'Data e hora de início (ISO 8601, ex: YYYY-MM-DDTHH:mm:ssZ). Se não fornecida, pergunte ao usuário.'
                  },
                  duracao_minutos: {
                    type: 'integer',
                    description: 'Duração da atividade em minutos (padrão 30)'
                  }
                },
                required: ['contato_id', 'titulo', 'tipo', 'data_inicio']
              }
            },
            {
              name: 'lancar_despesa',
              description: 'Cria uma nova despesa no financeiro da organização. REGRAS DE DIÁLOGO: Se o usuário não informar a Conta, Categoria ou Obra/Empreendimento, você DEVE listar as opções e perguntar a ele antes de executar o lançamento!',
              inputSchema: {
                type: 'object',
                properties: {
                  descricao: {
                    type: 'string',
                    description: 'Descrição ou nome detalhado da despesa. O usuário deve informar. Se ausente, pergunte.'
                  },
                  valor: {
                    type: 'number',
                    description: 'Valor positivo da despesa (ex: 150.00). Não envie sinal negativo, a API ou o banco cuidará disso.'
                  },
                  data_vencimento: {
                    type: 'string',
                    description: 'Data de vencimento (Formato YYYY-MM-DD). Se não fornecida, pergunte ao usuário.'
                  },
                  conta_financeira_id: {
                    type: 'integer',
                    description: 'ID da conta financeira de origem. ATENÇÃO: Se não souber ou o usuário não informou, use a ferramenta listar_contas_financeiras e pergunte qual conta usar.'
                  },
                  categoria_id: {
                    type: 'integer',
                    description: 'ID da categoria financeira. ATENÇÃO: Se não souber ou o usuário não informou, use a ferramenta listar_categorias_financeiras (filtrando por Despesa) e pergunte.'
                  },
                  empreendimento_id: {
                    type: 'integer',
                    description: 'ID da obra/empreendimento associada (opcional). Se o usuário disser que é de uma obra, use listar_empreendimentos para obter o ID. Se ele não mencionar, pergunte se pertence a alguma obra ou se é custo administrativo.'
                  },
                  data_pagamento: {
                    type: 'string',
                    description: 'Data em que foi paga (Formato YYYY-MM-DD). Passe apenas se a despesa já estiver liquidada/paga.'
                  },
                  status: {
                    type: 'string',
                    description: 'Status do lançamento',
                    enum: ['Pago', 'Pendente'],
                    default: 'Pendente'
                  },
                  observacao: {
                    type: 'string',
                    description: 'Notas ou observações adicionais para o lançamento'
                  }
                },
                required: ['descricao', 'valor', 'data_vencimento', 'conta_financeira_id', 'categoria_id']
              }
            },
            {
              name: 'lancar_receita',
              description: 'Cria uma nova receita no financeiro da organização. REGRAS DE DIÁLOGO: Se o usuário não informar a Conta, Categoria ou Obra/Empreendimento, você DEVE listar as opções e perguntar a ele antes de executar o lançamento!',
              inputSchema: {
                type: 'object',
                properties: {
                  descricao: {
                    type: 'string',
                    description: 'Descrição ou nome detalhado da receita. O usuário deve informar. Se ausente, pergunte.'
                  },
                  valor: {
                    type: 'number',
                    description: 'Valor positivo da receita (ex: 5000.00).'
                  },
                  data_vencimento: {
                    type: 'string',
                    description: 'Data de vencimento (Formato YYYY-MM-DD). Se não fornecida, pergunte ao usuário.'
                  },
                  conta_financeira_id: {
                    type: 'integer',
                    description: 'ID da conta financeira de destino. ATENÇÃO: Se não souber ou o usuário não informou, use a ferramenta listar_contas_financeiras e pergunte qual conta usar.'
                  },
                  categoria_id: {
                    type: 'integer',
                    description: 'ID da categoria financeira. ATENÇÃO: Se não souber ou o usuário não informou, use a ferramenta listar_categorias_financeiras (filtrando por Receita) e pergunte.'
                  },
                  empreendimento_id: {
                    type: 'integer',
                    description: 'ID da obra/empreendimento associada (opcional). Se o usuário disser que é de uma obra, use listar_empreendimentos para obter o ID. Se ele não mencionar, pergunte se pertence a alguma obra.'
                  },
                  data_pagamento: {
                    type: 'string',
                    description: 'Data do recebimento (Formato YYYY-MM-DD). Passe apenas se a receita já tiver sido recebida/paga.'
                  },
                  status: {
                    type: 'string',
                    description: 'Status do lançamento',
                    enum: ['Pago', 'Pendente'],
                    default: 'Pendente'
                  },
                  observacao: {
                    type: 'string',
                    description: 'Notas ou observações adicionais para o lançamento'
                  }
                },
                required: ['descricao', 'valor', 'data_vencimento', 'conta_financeira_id', 'categoria_id']
              }
            }
          ]
        },
        id
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const toolResult = await executeTool(name, args, supabase, user);
        return {
          jsonrpc,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(toolResult)
              }
            ]
          },
          id
        };
      } catch (err) {
        return {
          jsonrpc,
          error: {
            code: -32603,
            message: `Erro ao executar ferramenta ${name}: ${err.message}`
          },
          id
        };
      }
    }

    default:
      return {
        jsonrpc,
        error: {
          code: -32601,
          message: `Método não encontrado: ${method}`
        },
        id
      };
  }
}

/**
 * EXECUTOR DAS FERRAMENTAS DO MCP
 */
async function executeTool(name, args, supabase, user) {
  switch (name) {
    case 'listar_empreendimentos': {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, codigo, status, created_at')
        .order('nome');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_contas_financeiras': {
      const { data, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo, instituicao, agencia, numero_conta')
        .order('nome');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_categorias_financeiras': {
      const { tipo } = args;
      let query = supabase
        .from('categorias_financeiras')
        .select('id, nome, tipo, parent_id')
        .order('nome');

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'buscar_lancamentos_financeiros': {
      const { busca, data_inicio, data_fim, tipo, status, conta_id, categoria_id, limite = 50 } = args;
      
      let query = supabase
        .from('lancamentos')
        .select(`
          id, 
          descricao, 
          valor, 
          tipo, 
          status, 
          data_vencimento, 
          data_pagamento, 
          created_at,
          conta:contas_financeiras(id, nome),
          categoria:categorias_financeiras(id, nome),
          empreendimento:empreendimentos(id, nome)
        `)
        .order('data_vencimento', { ascending: false })
        .limit(Math.min(limite, 200));

      if (busca) {
        query = query.or(`descricao.ilike.%${busca}%,observacao.ilike.%${busca}%`);
      }
      if (data_inicio) {
        query = query.gte('data_vencimento', data_inicio);
      }
      if (data_fim) {
        query = query.lte('data_vencimento', data_fim);
      }
      if (tipo) {
        query = query.eq('tipo', tipo);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (conta_id) {
        query = query.eq('conta_id', conta_id);
      }
      if (categoria_id) {
        query = query.eq('categoria_id', categoria_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_clientes_crm': {
      const { busca, limite } = args;
      let query = supabase
        .from('contatos')
        .select('id, nome, email, celular, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limite || 20);

      if (busca) {
        query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%,celular.ilike.%${busca}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_atividade_crm': {
      const { contato_id, titulo, descricao, tipo, data_inicio, duracao_minutos } = args;

      const startDateTime = new Date(data_inicio);
      if (isNaN(startDateTime.getTime())) {
        throw new Error('Formato de data_inicio inválido. Use ISO 8601.');
      }

      const duracao = duracao_minutos || 30;
      const dataInicioPrevista = data_inicio.split('T')[0];
      const horaInicio = startDateTime.toTimeString().split(' ')[0]; // HH:MM:SS
      const duracaoHoras = Number((duracao / 60).toFixed(2));

      // Calcular data de fim prevista
      const endDateTime = new Date(startDateTime.getTime() + duracao * 60 * 1000);
      const dataFimPrevista = endDateTime.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('activities')
        .insert({
          nome: titulo,
          descricao: descricao || '',
          tipo_atividade: tipo,
          contato_id: contato_id,
          data_inicio_prevista: dataInicioPrevista,
          hora_inicio: horaInicio,
          duracao_horas: duracaoHoras,
          data_fim_prevista: dataFimPrevista,
          status: 'Não iniciado',
          criado_por_usuario_id: user.id,
          organizacao_id: user.organizacao_id
        })
        .select('id, nome, status, data_inicio_prevista')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Atividade criada com sucesso!', atividade: data };
    }

    case 'lancar_despesa': {
      const { descricao, valor, data_vencimento, conta_financeira_id, categoria_id, empreendimento_id, data_pagamento, status = 'Pendente', observacao } = args;

      // Garantir sinal negativo no valor de despesa (regra de sinal financeiro automático)
      const valorFormatado = -Math.abs(Number(valor));

      const { data, error } = await supabase
        .from('lancamentos')
        .insert({
          descricao,
          valor: valorFormatado,
          tipo: 'Despesa',
          status: status,
          conta_id: conta_financeira_id,
          categoria_id,
          empreendimento_id: empreendimento_id || null,
          data_vencimento,
          data_transacao: data_pagamento || data_vencimento,
          data_pagamento: data_pagamento || null,
          criado_por_usuario_id: user.id,
          organizacao_id: user.organizacao_id,
          origem_criacao: 'MCP API',
          observacao: observacao || null
        })
        .select('id, descricao, valor, status, data_vencimento')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Despesa lançada com sucesso!', lancamento: data };
    }

    case 'lancar_receita': {
      const { descricao, valor, data_vencimento, conta_financeira_id, categoria_id, empreendimento_id, data_pagamento, status = 'Pendente', observacao } = args;

      // Garantir sinal positivo no valor de receita
      const valorFormatado = Math.abs(Number(valor));

      const { data, error } = await supabase
        .from('lancamentos')
        .insert({
          descricao,
          valor: valorFormatado,
          tipo: 'Receita',
          status: status,
          conta_id: conta_financeira_id,
          categoria_id,
          empreendimento_id: empreendimento_id || null,
          data_vencimento,
          data_transacao: data_pagamento || data_vencimento,
          data_pagamento: data_pagamento || null,
          criado_por_usuario_id: user.id,
          organizacao_id: user.organizacao_id,
          origem_criacao: 'MCP API',
          observacao: observacao || null
        })
        .select('id, descricao, valor, status, data_vencimento')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Receita lançada com sucesso!', lancamento: data };
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

// Suporte para OPTIONS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

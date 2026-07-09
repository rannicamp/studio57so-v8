import { authenticateMcpKey } from '@/utils/supabase/mcp';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp
 * Retorna apenas informações de status do servidor MCP e direciona para o uso do Stdio Bridge.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'online',
      message: 'Servidor MCP Elo 57 ativo. Para conectar seu agente de IA, utilize o script bridge de stdio local (scripts/mcp-bridge.js) apontando para este endpoint via POST.'
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * POST /api/mcp
 * Recebe comandos JSON-RPC do script bridge local e os processa síncronamente em nome do usuário.
 */
export async function POST(request) {
  // 1. Extrair a chave de API do usuário do header Authorization
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
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Não autorizado: Chave de API (Bearer Token) ausente.' },
        id: null
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. Autenticar a chave de API e obter o cliente Supabase com JWT do usuário (RLS ativo)
  const mcpContext = await authenticateMcpKey(token);
  if (!mcpContext) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Não autorizado: Chave de API inválida, inativa ou expirada.' },
        id: null
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { supabase, user } = mcpContext;

  try {
    const rpcRequest = await request.json();
    console.log(`[MCP] Requisição síncrona recebida para o método: ${rpcRequest.method} (User: ${user.id}, Org: ${user.organizacao_id})`);

    // 3. Processar a requisição JSON-RPC de forma síncrona/stateless
    const rpcResponse = await handleMcpRequest(rpcRequest, supabase, user);

    // 4. Retornar a resposta JSON-RPC diretamente no corpo do POST
    return new Response(JSON.stringify(rpcResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err) {
    console.error('[MCP] Erro síncrono ao processar requisição:', err);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: `Erro interno no servidor: ${err.message}` },
        id: null
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PROCESSADOR DE REQUISIÇÕES JSON-RPC DO MCP (Síncrono/Stateless)
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
            version: '2.0.0'
          }
        },
        id
      };

    case 'tools/list':
      return {
        jsonrpc,
        result: {
          tools: [
            // ==================== ALMOXARIFADO ====================
            {
              name: 'listar_estoque',
              description: 'Lista o inventário físico de materiais em estoque de uma obra/empreendimento.',
              inputSchema: {
                type: 'object',
                properties: {
                  empreendimento_id: {
                    type: 'integer',
                    description: 'Filtrar pelo ID do empreendimento imobiliário/obra.'
                  }
                }
              }
            },
            {
              name: 'registrar_movimentacao_estoque',
              description: 'Registra movimentações físicas (Entrada manual, Retirada por funcionário, Devolução de material) no almoxarifado de uma obra.',
              inputSchema: {
                type: 'object',
                properties: {
                  empreendimento_id: {
                    type: 'integer',
                    description: 'ID do empreendimento associado.'
                  },
                  material_id: {
                    type: 'integer',
                    description: 'ID do insumo/material.'
                  },
                  quantidade: {
                    type: 'number',
                    description: 'Quantidade movimentada.'
                  },
                  tipo: {
                    type: 'string',
                    description: 'Tipo de movimentação.',
                    enum: ['Entrada', 'Retirada', 'Devolucao']
                  },
                  funcionario_id: {
                    type: 'integer',
                    description: 'ID do funcionário que realizou a retirada (obrigatório se tipo for Retirada).'
                  },
                  observacao: {
                    type: 'string',
                    description: 'Notas ou justificativas da movimentação.'
                  }
                },
                required: ['empreendimento_id', 'material_id', 'quantidade', 'tipo']
              }
            },

            // ==================== ATIVIDADES ====================
            {
              name: 'listar_atividades',
              description: 'Lista o cronograma de atividades comerciais, tarefas ou reuniões do time.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'criar_atividade',
              description: 'Agenda uma nova atividade comercial ou tarefa associada a um contato/cliente ou funcionário.',
              inputSchema: {
                type: 'object',
                properties: {
                  contato_id: { type: 'integer', description: 'ID do contato/cliente vinculado.' },
                  funcionario_id: { type: 'integer', description: 'ID do funcionário executor (opcional).' },
                  titulo: { type: 'string', description: 'Nome/Título da atividade.' },
                  descricao: { type: 'string', description: 'Notas da atividade.' },
                  tipo: {
                    type: 'string',
                    enum: ['Ligação', 'Reunião', 'Mensagem', 'Visita', 'Tarefa']
                  },
                  data_inicio: { type: 'string', description: 'Data/Hora de início prevista (ISO 8601).' },
                  duracao_minutos: { type: 'integer', description: 'Duração da atividade em minutos (padrão 30).' }
                },
                required: ['contato_id', 'titulo', 'tipo', 'data_inicio']
              }
            },
            {
              name: 'atualizar_atividade',
              description: 'Atualiza dados de uma atividade ou tarefa cadastrada.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID da atividade.' },
                  titulo: { type: 'string' },
                  descricao: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['Não iniciado', 'Em andamento', 'Concluído', 'Cancelado']
                  },
                  data_inicio_prevista: { type: 'string', description: 'Data de início YYYY-MM-DD.' },
                  hora_inicio: { type: 'string', description: 'Hora de início HH:MM:SS.' }
                },
                required: ['id']
              }
            },
            {
              name: 'deletar_atividade',
              description: 'Exclui uma atividade do sistema.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID da atividade.' }
                },
                required: ['id']
              }
            },

            // ==================== CRM / CONTATOS ====================
            {
              name: 'listar_clientes_crm',
              description: 'Busca e lista contatos/leads cadastrados no CRM.',
              inputSchema: {
                type: 'object',
                properties: {
                  busca: { type: 'string', description: 'Termo de pesquisa (nome, email ou celular).' }
                }
              }
            },
            {
              name: 'criar_contato_crm',
              description: 'Cadastra um novo cliente/lead na base de dados.',
              inputSchema: {
                type: 'object',
                properties: {
                  nome: { type: 'string', description: 'Nome completo.' },
                  email: { type: 'string' },
                  celular: { type: 'string', description: 'Celular com DDD (ex: 5533991912291).' },
                  origem: { type: 'string', description: 'Origem do lead (ex: Meta Ads, Indicação).' },
                  status: { type: 'string', description: 'Fase inicial do contato.' }
                },
                required: ['nome']
              }
            },
            {
              name: 'atualizar_contato_crm',
              description: 'Edita a ficha de dados cadastrais de um contato/lead.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do contato.' },
                  nome: { type: 'string' },
                  email: { type: 'string' },
                  celular: { type: 'string' },
                  status: { type: 'string' }
                },
                required: ['id']
              }
            },
            {
              name: 'unir_contatos_crm',
              description: 'Funde contatos duplicados em um único, migrando todas as referências do banco de dados para o mais antigo (vencedor) e excluindo as duplicatas.',
              inputSchema: {
                type: 'object',
                properties: {
                  contato_ids: {
                    type: 'array',
                    items: { type: 'integer' },
                    description: 'Lista de IDs numéricos dos contatos duplicados.'
                  }
                },
                required: ['contato_ids']
              }
            },
            {
              name: 'listar_colunas_funil',
              description: 'Lista as colunas/etapas configuradas no Funil do CRM Kanban.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_leads_funil',
              description: 'Exibe a listagem de todos os contatos ativos que estão atualmente dentro de fases do funil comercial.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'mover_lead_funil',
              description: 'Move um lead/contato de uma fase para outra dentro do Kanban do CRM.',
              inputSchema: {
                type: 'object',
                properties: {
                  contato_id: { type: 'integer' },
                  coluna_id: { type: 'integer', description: 'ID da coluna destino no funil.' }
                },
                required: ['contato_id', 'coluna_id']
              }
            },

            // ==================== DIÁRIO DE OBRAS ====================
            {
              name: 'listar_diarios_obra',
              description: 'Consulta o histórico de relatórios diários de obras (RDO) lançados.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'criar_diario_obra',
              description: 'Gera um novo relatório diário de obra (RDO) registrando as condições e o responsável.',
              inputSchema: {
                type: 'object',
                properties: {
                  empreendimento_id: { type: 'integer' },
                  data_relatorio: { type: 'string', description: 'Data do diário (YYYY-MM-DD).' },
                  responsavel_rdo: { type: 'string', description: 'Nome do engenheiro/encarregado responsável.' },
                  condicoes_climaticas: { type: 'string', description: 'Condições do tempo (ex: Ensolarado, Chuvoso).' },
                  condicoes_trabalho: { type: 'string', description: 'Condições de trabalho (ex: Praticável, Parcial).' }
                },
                required: ['empreendimento_id', 'data_relatorio', 'responsavel_rdo']
              }
            },

            // ==================== FINANCEIRO ====================
            {
              name: 'listar_contas_financeiras',
              description: 'Lista as contas bancárias e cartões de crédito da organização.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'criar_conta_financeira',
              description: 'Cria uma nova conta bancária ou cartão de crédito na organização.',
              inputSchema: {
                type: 'object',
                properties: {
                  nome: { type: 'string', description: 'Nome de exibição da conta (ex: Sicoob Corrente, Inter Cartão).' },
                  tipo: { type: 'string', description: 'Tipo da conta.', enum: ['Conta Corrente', 'Cartão de Crédito', 'Poupança', 'Investimento', 'Conta de Passivo'] },
                  saldo_inicial: { type: 'number', description: 'Saldo inicial da conta.', default: 0 },
                  instituicao: { type: 'string', description: 'Nome do banco/instituição financeira.' },
                  agencia: { type: 'string', description: 'Agência bancária.' },
                  numero_conta: { type: 'string', description: 'Número da conta.' }
                },
                required: ['nome', 'tipo']
              }
            },
            {
              name: 'criar_categoria_financeira',
              description: 'Cria uma nova categoria financeira para receitas ou despesas.',
              inputSchema: {
                type: 'object',
                properties: {
                  nome: { type: 'string', description: 'Nome da categoria (ex: Moradia, Alimentação).' },
                  tipo: { type: 'string', description: 'Tipo da categoria.', enum: ['Despesa', 'Receita'] },
                  parent_id: { type: 'integer', description: 'ID da categoria pai (opcional).' }
                },
                required: ['nome', 'tipo']
              }
            },
            {
              name: 'listar_categorias_financeiras',
              description: 'Lista o plano de categorias financeiras.',
              inputSchema: {
                type: 'object',
                properties: {
                  tipo: {
                    type: 'string',
                    enum: ['Despesa', 'Receita']
                  }
                }
              }
            },
            {
              name: 'buscar_lancamentos_financeiros',
              description: 'Consulta lançamentos financeiros (despesas/receitas) com filtros.',
              inputSchema: {
                type: 'object',
                properties: {
                  busca: { type: 'string' },
                  data_inicio: { type: 'string', description: 'Filtro inicial (YYYY-MM-DD)' },
                  data_fim: { type: 'string', description: 'Filtro final (YYYY-MM-DD)' },
                  tipo: { type: 'string', enum: ['Despesa', 'Receita'] },
                  status: { type: 'string', enum: ['Pago', 'Pendente'] },
                  conta_id: { type: 'integer' },
                  categoria_id: { type: 'integer' }
                }
              }
            },
            {
              name: 'lancar_despesa',
              description: 'Cria uma nova despesa pendente ou paga (sinal negativo automático).',
              inputSchema: {
                type: 'object',
                properties: {
                  descricao: { type: 'string' },
                  valor: { type: 'number', description: 'Valor em formato decimal (positivo).' },
                  data_vencimento: { type: 'string', description: 'Data YYYY-MM-DD' },
                  conta_financeira_id: { type: 'integer' },
                  categoria_id: { type: 'integer' },
                  empreendimento_id: { type: 'integer' },
                  data_pagamento: { type: 'string', description: 'Se pago, passe a data de pagamento YYYY-MM-DD' },
                  status: { type: 'string', enum: ['Pago', 'Pendente'], default: 'Pendente' },
                  observacao: { type: 'string' }
                },
                required: ['descricao', 'valor', 'data_vencimento', 'conta_financeira_id', 'categoria_id']
              }
            },
            {
              name: 'lancar_receita',
              description: 'Cria uma nova receita pendente ou paga.',
              inputSchema: {
                type: 'object',
                properties: {
                  descricao: { type: 'string' },
                  valor: { type: 'number', description: 'Valor em formato decimal.' },
                  data_vencimento: { type: 'string', description: 'Data YYYY-MM-DD' },
                  conta_financeira_id: { type: 'integer' },
                  categoria_id: { type: 'integer' },
                  empreendimento_id: { type: 'integer' },
                  data_pagamento: { type: 'string', description: 'Se recebido, passe a data YYYY-MM-DD' },
                  status: { type: 'string', enum: ['Pago', 'Pendente'], default: 'Pendente' },
                  observacao: { type: 'string' }
                },
                required: ['descricao', 'valor', 'data_vencimento', 'conta_financeira_id', 'categoria_id']
              }
            },
            {
              name: 'atualizar_lancamento',
              description: 'Edita dados ou status de um lançamento financeiro.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do lançamento.' },
                  descricao: { type: 'string' },
                  valor: { type: 'number' },
                  status: { type: 'string', enum: ['Pago', 'Pendente', 'Conciliado'] },
                  data_vencimento: { type: 'string' },
                  data_pagamento: { type: 'string' }
                },
                required: ['id']
              }
            },
            {
              name: 'deletar_lancamento',
              description: 'Exclui definitivamente um lançamento financeiro.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do lançamento.' }
                },
                required: ['id']
              }
            },

            // ==================== ORÇAMENTOS ====================
            {
              name: 'listar_orcamentos',
              description: 'Lista orçamentos de obras cadastrados.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_itens_orcamento',
              description: 'Exibe os materiais e insumos planejados de um orçamento.',
              inputSchema: {
                type: 'object',
                properties: {
                  orcamento_id: { type: 'integer' }
                },
                required: ['orcamento_id']
              }
            },
            {
              name: 'adicionar_item_orcamento',
              description: 'Adiciona um insumo e quantidade no orçamento planejado.',
              inputSchema: {
                type: 'object',
                properties: {
                  orcamento_id: { type: 'integer' },
                  material_id: { type: 'integer' },
                  quantidade: { type: 'number' },
                  valor_unitario: { type: 'number' }
                },
                required: ['orcamento_id', 'material_id', 'quantidade', 'valor_unitario']
              }
            },

            // ==================== PEDIDOS / COMPRAS ====================
            {
              name: 'listar_pedidos_compra',
              description: 'Consulta os pedidos de compra de insumos do almoxarifado.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'criar_pedido_compra',
              description: 'Abre um novo pedido de compras em fase inicial.',
              inputSchema: {
                type: 'object',
                properties: {
                  empreendimento_id: { type: 'integer' },
                  fornecedor_id: { type: 'integer', description: 'ID do contato do fornecedor.' },
                  fase_id: { type: 'integer', description: 'ID da fase do funil de compras.' },
                  data_pedido: { type: 'string', description: 'Data YYYY-MM-DD.' },
                  condicao_pagamento: { type: 'string' }
                },
                required: ['empreendimento_id', 'fornecedor_id', 'fase_id', 'data_pedido']
              }
            },
            {
              name: 'listar_itens_pedido_compra',
              description: 'Exibe a listagem de itens de um pedido de compras.',
              inputSchema: {
                type: 'object',
                properties: {
                  pedido_compra_id: { type: 'integer' }
                },
                required: ['pedido_compra_id']
              }
            },
            {
              name: 'adicionar_item_pedido_compra',
              description: 'Adiciona material e valor cotado a um pedido de compra.',
              inputSchema: {
                type: 'object',
                properties: {
                  pedido_compra_id: { type: 'integer' },
                  material_id: { type: 'integer' },
                  quantidade: { type: 'number' },
                  valor_unitario: { type: 'number' }
                },
                required: ['pedido_compra_id', 'material_id', 'quantidade', 'valor_unitario']
              }
            },
            {
              name: 'deletar_item_pedido_compra',
              description: 'Exclui um item específico de um pedido de compra.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do item do pedido.' }
                },
                required: ['id']
              }
            },
            {
              name: 'marcar_pedido_entregue',
              description: 'Marca o pedido como entregue, atualizando o status e gerando entrada automática de insumos no estoque da obra.',
              inputSchema: {
                type: 'object',
                properties: {
                  pedido_compra_id: { type: 'integer' }
                },
                required: ['pedido_compra_id']
              }
            },

            // ==================== RECURSOS HUMANOS ====================
            {
              name: 'listar_funcionarios',
              description: 'Lista colaboradores da empresa, seus CPFs e salários.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'criar_funcionario',
              description: 'Insere a ficha de contratação de um novo colaborador no Departamento Pessoal.',
              inputSchema: {
                type: 'object',
                properties: {
                  full_name: { type: 'string', description: 'Nome completo.' },
                  cpf: { type: 'string', description: 'Formatado com máscara.' },
                  rg: { type: 'string' },
                  admission_date: { type: 'string', description: 'Data de admissão YYYY-MM-DD.' },
                  empresa_id: { type: 'integer', description: 'ID da empresa pagadora/prestadora.' },
                  empreendimento_atual_id: { type: 'integer', description: 'ID da obra em que vai atuar.' },
                  birth_date: { type: 'string', description: 'YYYY-MM-DD.' },
                  phone: { type: 'string' },
                  email: { type: 'string' },
                  base_salary: { type: 'string', description: 'Salário base (ex: 2500.00).' },
                  payment_method: { type: 'string', description: 'PIX, Depósito, etc.' },
                  pix_key: { type: 'string' }
                },
                required: ['full_name', 'cpf', 'admission_date', 'empresa_id']
              }
            },
            {
              name: 'atualizar_funcionario',
              description: 'Edita a ficha cadastral de um colaborador.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do funcionário.' },
                  full_name: { type: 'string' },
                  status: { type: 'string', enum: ['Ativo', 'Férias', 'Afastado', 'Demitido'] },
                  base_salary: { type: 'string' },
                  empreendimento_atual_id: { type: 'integer' }
                },
                required: ['id']
              }
            },
            {
              name: 'lancar_ponto_funcionario',
              description: 'Registra a batida de ponto físico (entrada/saída) de um colaborador.',
              inputSchema: {
                type: 'object',
                properties: {
                  funcionario_id: { type: 'integer' },
                  data_hora: { type: 'string', description: 'Data/Hora do registro (ISO 8601).' },
                  tipo_registro: { type: 'string', enum: ['Entrada', 'Saída'] },
                  observacao: { type: 'string' }
                },
                required: ['funcionario_id', 'data_hora', 'tipo_registro']
              }
            },
            {
              name: 'lancar_vale_funcionario',
              description: 'Lança um adiantamento/vale de pagamento para o colaborador (chama a RPC do banco, gerando o agendamento de vale e a despesa financeira).',
              inputSchema: {
                type: 'object',
                properties: {
                  funcionario_id: { type: 'integer' },
                  valor: { type: 'number', description: 'Valor do adiantamento.' },
                  data_vale: { type: 'string', description: 'Mês/Período de referência (YYYY-MM-DD).' },
                  data_pagamento: { type: 'string', description: 'Data em que será realizado o pagamento YYYY-MM-DD.' },
                  conta_id: { type: 'integer', description: 'Conta financeira pagadora.' }
                },
                required: ['funcionario_id', 'valor', 'data_vale', 'data_pagamento', 'conta_id']
              }
            },
            {
              name: 'relatar_pendencias_ponto',
              description: 'Consulta e relata quais colaboradores possuem pendências na folha de ponto no mês atual (marcações ausentes ou incompletas).',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'consultar_horas_trabalhadas',
              description: 'Consulta as horas trabalhadas, previstas e o saldo de minutos diário de um funcionário em um determinado período.',
              inputSchema: {
                type: 'object',
                properties: {
                  funcionario_id: { type: 'integer', description: 'ID do funcionário.' },
                  data_inicio: { type: 'string', description: 'Data de início YYYY-MM-DD (opcional).' },
                  data_fim: { type: 'string', description: 'Data de fim YYYY-MM-DD (opcional).' }
                },
                required: ['funcionario_id']
              }
            },

            // ==================== EMPREENDIMENTOS / VENDAS ====================
            {
              name: 'listar_empreendimentos',
              description: 'Lista os empreendimentos ativos da construtora.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_unidades_empreendimento',
              description: 'Consulta a tabela de vendas de lotes/apartamentos de um empreendimento.',
              inputSchema: {
                type: 'object',
                properties: {
                  empreendimento_id: { type: 'integer', description: 'ID da obra.' }
                }
              }
            },
            {
              name: 'atualizar_unidade_empreendimento',
              description: 'Atualiza dados de preço ou status de disponibilidade de um lote/unidade.',
              inputSchema: {
                type: 'object',
                properties: {
                  id: { type: 'integer', description: 'ID do lote/unidade.' },
                  valor_base: { type: 'number', description: 'Preço base de tabela.' },
                  status: {
                    type: 'string',
                    enum: ['Disponível', 'Reservado', 'Vendido']
                  }
                },
                required: ['id']
              }
            },
            {
              name: 'listar_documento_tipos',
              description: 'Lista todos os tipos de documentos e suas siglas correspondentes cadastrados no sistema.',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'listar_anexos_por_recurso',
              description: 'Lista todos os anexos cadastrados vinculados a um recurso específico.',
              inputSchema: {
                type: 'object',
                properties: {
                  recurso_tipo: {
                    type: 'string',
                    enum: ['empreendimento', 'empresa', 'lancamento', 'pedido', 'atividade', 'funcionario', 'contrato', 'contrato_terceirizado'],
                    description: 'O tipo do recurso ao qual os anexos pertencem.'
                  },
                  recurso_id: {
                    type: 'integer',
                    description: 'O ID numérico do recurso.'
                  }
                },
                required: ['recurso_tipo', 'recurso_id']
              }
            },
            {
              name: 'upload_anexo_sistema',
              description: 'Realiza o upload de um arquivo em base64 para o Supabase Storage e o vincula ao recurso e aba/categoria corretos com a nomenclatura oficial.',
              inputSchema: {
                type: 'object',
                properties: {
                  conteudo_base64: {
                    type: 'string',
                    description: 'O conteúdo do arquivo codificado em base64.'
                  },
                  nome_arquivo: {
                    type: 'string',
                    description: 'O nome original do arquivo com extensão (ex: rg_joao.pdf).'
                  },
                  recurso_tipo: {
                    type: 'string',
                    enum: ['empreendimento', 'empresa', 'lancamento', 'pedido', 'atividade', 'funcionario', 'contrato', 'contrato_terceirizado'],
                    description: 'O tipo do recurso ao qual o anexo pertence.'
                  },
                  recurso_id: {
                    type: 'integer',
                    description: 'O ID numérico do recurso.'
                  },
                  tipo_documento_id: {
                    type: 'integer',
                    description: 'O ID do tipo de documento (de listar_documento_tipos).'
                  },
                  categoria_aba: {
                    type: 'string',
                    description: 'A categoria ou aba (ex: marketing, juridico, geral, marca, etc.).'
                  },
                  descricao: {
                    type: 'string',
                    description: 'Uma descrição curta para o anexo.'
                  }
                },
                required: ['conteudo_base64', 'nome_arquivo', 'recurso_tipo', 'recurso_id']
              }
            }
          ]
        },
        id
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        // 1. Validar a governança de permissões por cargo
        let security = getToolSecurity(name);
        if (name === 'listar_anexos_por_recurso' || name === 'upload_anexo_sistema') {
          const recursoTipo = args?.recurso_tipo;
          const recursoMap = {
            'empreendimento': 'empreendimentos',
            'empresa': 'empresas',
            'lancamento': 'financeiro',
            'pedido': 'pedidos',
            'atividade': 'atividades',
            'funcionario': 'funcionarios',
            'contrato': 'contratos',
            'contrato_terceirizado': 'contratos'
          };
          const recurso = recursoMap[recursoTipo] || 'empreendimentos';
          const acao = name === 'upload_anexo_sistema' ? 'criar' : 'ver';
          security = { recurso, acao };
        }

        if (security) {
          const permitido = await verificarPermissao(supabase, user.id, security.recurso, security.acao);
          if (!permitido) {
            return {
              jsonrpc,
              error: {
                code: -32003,
                message: `Não autorizado: Seu cargo não tem permissão para '${security.acao}' no recurso '${security.recurso}'.`
              },
              id
            };
          }
        }

        // 2. Executar a ferramenta
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
 * MAPEAR RECURSOS E AÇÕES PARA GOVERNANÇA DE CARGO
 */
function getToolSecurity(toolName) {
  const mapping = {
    // Almoxarifado
    'listar_estoque': { recurso: 'almoxarifado', acao: 'ver' },
    'registrar_movimentacao_estoque': { recurso: 'almoxarifado', acao: 'criar' },
    
    // Atividades
    'listar_atividades': { recurso: 'atividades', acao: 'ver' },
    'criar_atividade': { recurso: 'atividades', acao: 'criar' },
    'atualizar_atividade': { recurso: 'atividades', acao: 'editar' },
    'deletar_atividade': { recurso: 'atividades', acao: 'excluir' },
    
    // CRM / Contatos
    'listar_clientes_crm': { recurso: 'contatos', acao: 'ver' },
    'criar_contato_crm': { recurso: 'contatos', acao: 'criar' },
    'atualizar_contato_crm': { recurso: 'contatos', acao: 'editar' },
    'unir_contatos_crm': { recurso: 'contatos', acao: 'excluir' },
    'listar_colunas_funil': { recurso: 'crm', acao: 'ver' },
    'listar_leads_funil': { recurso: 'crm', acao: 'ver' },
    'mover_lead_funil': { recurso: 'crm', acao: 'editar' },
    
    // RDO
    'listar_diarios_obra': { recurso: 'rdo', acao: 'ver' },
    'criar_diario_obra': { recurso: 'rdo', acao: 'criar' },
    
    // Financeiro
    'listar_contas_financeiras': { recurso: 'financeiro', acao: 'ver' },
    'criar_conta_financeira': { recurso: 'financeiro', acao: 'criar' },
    'criar_categoria_financeira': { recurso: 'financeiro', acao: 'criar' },
    'listar_categorias_financeiras': { recurso: 'financeiro', acao: 'ver' },
    'buscar_lancamentos_financeiros': { recurso: 'financeiro', acao: 'ver' },
    'lancar_despesa': { recurso: 'financeiro', acao: 'criar' },
    'lancar_receita': { recurso: 'financeiro', acao: 'criar' },
    'atualizar_lancamento': { recurso: 'financeiro', acao: 'editar' },
    'deletar_lancamento': { recurso: 'financeiro', acao: 'excluir' },
    
    // Orçamentos
    'listar_orcamentos': { recurso: 'orcamento', acao: 'ver' },
    'listar_itens_orcamento': { recurso: 'orcamento', acao: 'ver' },
    'adicionar_item_orcamento': { recurso: 'orcamento', acao: 'criar' },
    
    // Compras / Pedidos
    'listar_pedidos_compra': { recurso: 'pedidos', acao: 'ver' },
    'criar_pedido_compra': { recurso: 'pedidos', acao: 'criar' },
    'listar_itens_pedido_compra': { recurso: 'pedidos', acao: 'ver' },
    'adicionar_item_pedido_compra': { recurso: 'pedidos', acao: 'criar' },
    'deletar_item_pedido_compra': { recurso: 'pedidos', acao: 'excluir' },
    'marcar_pedido_entregue': { recurso: 'pedidos', acao: 'editar' },
    
    // Funcionários / RH
    'listar_funcionarios': { recurso: 'funcionarios', acao: 'ver' },
    'criar_funcionario': { recurso: 'funcionarios', acao: 'criar' },
    'atualizar_funcionario': { recurso: 'funcionarios', acao: 'editar' },
    'lancar_ponto_funcionario': { recurso: 'ponto', acao: 'criar' },
    'lancar_vale_funcionario': { recurso: 'financeiro', acao: 'criar' },
    'relatar_pendencias_ponto': { recurso: 'funcionarios', acao: 'ver' },
    'consultar_horas_trabalhadas': { recurso: 'funcionarios', acao: 'ver' },
    
    // Empreendimentos / Unidades
    'listar_empreendimentos': { recurso: 'empreendimentos', acao: 'ver' },
    'listar_unidades_empreendimento': { recurso: 'empreendimentos', acao: 'ver' },
    'atualizar_unidade_empreendimento': { recurso: 'empreendimentos', acao: 'editar' },

    // Anexos / Tipos
    'listar_documento_tipos': { recurso: 'painel', acao: 'ver' }
  };
  
  return mapping[toolName] || null;
}

/**
 * FUNÇÃO DE GOVERNANÇA DE PERMISSÕES POR CARGO
 */
async function verificarPermissao(supabase, usuarioId, recurso, acao) {
  try {
    // 1. Obter a funcao_id, is_superadmin e nome da funcao do usuário
    const { data: usuario, error: userErr } = await supabase
      .from('usuarios')
      .select('funcao_id, is_superadmin, funcoes(nome_funcao)')
      .eq('id', usuarioId)
      .maybeSingle();

    if (userErr) {
      console.error(`[MCP Permissões] Erro ao buscar usuário ${usuarioId}:`, userErr.message);
      return false;
    }

    if (!usuario) {
      console.error(`[MCP Permissões] Usuário ${usuarioId} não encontrado.`);
      return false;
    }

    // Superadmins ou Proprietários da organização têm passe livre completo
    const isProprietario = usuario.is_superadmin === true || usuario.funcoes?.nome_funcao === 'Proprietário';
    if (isProprietario) {
      return true;
    }
    
    if (!usuario.funcao_id) {
      console.warn(`[MCP Permissões] Usuário ${usuarioId} não possui funcao_id associada.`);
      return false;
    }

    // 2. Buscar as permissões cadastradas para a função e o recurso
    const { data: permissao, error: permErr } = await supabase
      .from('permissoes')
      .select('pode_ver, pode_criar, pode_editar, pode_excluir')
      .eq('funcao_id', usuario.funcao_id)
      .eq('recurso', recurso)
      .maybeSingle();

    if (permErr) {
      console.error(`[MCP Permissões] Erro ao buscar permissões para funcao_id ${usuario.funcao_id} e recurso ${recurso}:`, permErr.message);
      return false;
    }

    if (!permissao) {
      // Se não houver registro de permissão explícito, assume sem acesso por padrão
      return false;
    }

    // 3. Checar a coluna correspondente à ação solicitada
    switch (acao) {
      case 'ver': return !!permissao.pode_ver;
      case 'criar': return !!permissao.pode_criar;
      case 'editar': return !!permissao.pode_editar;
      case 'excluir': return !!permissao.pode_excluir;
      default: return false;
    }
  } catch (err) {
    console.error('[MCP Permissões] Erro inesperado ao validar permissão:', err);
    return false;
  }
}

/**
 * EXECUTOR DAS FERRAMENTAS DO MCP (Stateless)
 */
async function executeTool(name, args, supabase, user) {
  switch (name) {
    // ==================== ALMOXARIFADO ====================
    case 'listar_estoque': {
      const { empreendimento_id } = args;
      let query = supabase
        .from('estoque')
        .select(`
          id, 
          quantidade_atual, 
          quantidade_em_uso, 
          custo_medio, 
          material:materiais(id, nome, descricao, unidade_medida),
          empreendimento:empreendimentos(id, nome)
        `);

      if (empreendimento_id) {
        query = query.eq('empreendimento_id', empreendimento_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'registrar_movimentacao_estoque': {
      const { empreendimento_id, material_id, quantidade, tipo, funcionario_id, observacao } = args;

      // 1. Buscar ou cadastrar a linha correspondente de estoque
      let { data: estoque, error: findErr } = await supabase
        .from('estoque')
        .select('id, quantidade_atual, quantidade_em_uso')
        .eq('empreendimento_id', empreendimento_id)
        .eq('material_id', material_id)
        .maybeSingle();

      if (findErr) throw new Error(`Erro ao localizar estoque: ${findErr.message}`);

      let estoqueId = estoque?.id;

      if (tipo === 'Entrada') {
        const obsEntrada = observacao || `Entrada manual via MCP`;
        if (estoque) {
          // Incrementa
          const novaQtd = Number(estoque.quantidade_atual) + Number(quantidade);
          const { error: updErr } = await supabase
            .from('estoque')
            .update({ quantidade_atual: novaQtd, ultima_atualizacao: new Date().toISOString() })
            .eq('id', estoqueId);

          if (updErr) throw new Error(updErr.message);
        } else {
          // Cria
          const { data: material } = await supabase
            .from('materiais')
            .select('unidade_medida')
            .eq('id', material_id)
            .single();

          const { data: newEstoque, error: insErr } = await supabase
            .from('estoque')
            .insert({
              empreendimento_id,
              material_id,
              quantidade_atual: quantidade,
              unidade_medida: material?.unidade_medida || 'UN',
              organizacao_id: user.organizacao_id
            })
            .select('id')
            .single();

          if (insErr) throw new Error(insErr.message);
          estoqueId = newEstoque.id;
        }

        // Registrar movimentação de entrada
        const { error: movErr } = await supabase
          .from('movimentacoes_estoque')
          .insert({
            estoque_id: estoqueId,
            tipo: 'Entrada por Compra',
            quantidade,
            usuario_id: user.id,
            observacao: obsEntrada,
            organizacao_id: user.organizacao_id
          });

        if (movErr) throw new Error(movErr.message);
        return { message: 'Material adicionado ao estoque com sucesso!' };

      } else if (tipo === 'Retirada') {
        if (!estoqueId) throw new Error('Não há estoque registrado deste material para esta obra.');
        if (!funcionario_id) throw new Error('ID do funcionário é obrigatório para registrar retiradas.');

        // Executar RPC de Retirada
        const { error: rpcErr } = await supabase.rpc('registrar_retirada_estoque', {
          p_estoque_id: estoqueId,
          p_organizacao_id: user.organizacao_id,
          p_quantidade: quantidade,
          p_usuario_id: user.id,
          p_observacao: observacao || 'Retirada via MCP',
          p_funcionario_id: funcionario_id
        });

        if (rpcErr) throw new Error(rpcErr.message);
        return { message: 'Retirada registrada com sucesso!' };

      } else if (tipo === 'Devolucao') {
        if (!estoqueId) throw new Error('Não há estoque registrado deste material para esta obra.');

        // Executar RPC de Devolução
        const { error: rpcErr } = await supabase.rpc('registrar_devolucao_estoque', {
          p_estoque_id: estoqueId,
          p_organizacao_id: user.organizacao_id,
          p_quantidade: quantidade,
          p_usuario_id: user.id,
          p_observacao: observacao || 'Devolução via MCP'
        });

        if (rpcErr) throw new Error(rpcErr.message);
        return { message: 'Devolução registrada com sucesso!' };
      }
      throw new Error(`Tipo de movimentação inválido: ${tipo}`);
    }

    // ==================== ATIVIDADES ====================
    case 'listar_atividades': {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          id, 
          nome, 
          descricao, 
          tipo_atividade, 
          status, 
          data_inicio_prevista, 
          hora_inicio, 
          duracao_horas,
          contato:contatos(id, nome),
          funcionario:funcionarios(id, full_name)
        `)
        .order('data_inicio_prevista', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_atividade': {
      const { contato_id, funcionario_id, titulo, descricao, tipo, data_inicio, duracao_minutos = 30 } = args;

      const startDateTime = new Date(data_inicio);
      const dataInicioPrevista = data_inicio.split('T')[0];
      const horaInicio = startDateTime.toTimeString().split(' ')[0];
      const duracaoHoras = Number((duracao_minutos / 60).toFixed(2));
      const endDateTime = new Date(startDateTime.getTime() + duracao_minutos * 60 * 1000);
      const dataFimPrevista = endDateTime.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('activities')
        .insert({
          nome: titulo,
          descricao: descricao || '',
          tipo_atividade: tipo,
          contato_id,
          funcionario_id: funcionario_id || null,
          data_inicio_prevista: dataInicioPrevista,
          hora_inicio: horaInicio,
          duracao_horas: duracaoHoras,
          data_fim_prevista: dataFimPrevista,
          status: 'Não iniciado',
          criado_por_usuario_id: user.id,
          organizacao_id: user.organizacao_id
        })
        .select('id, nome, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Atividade agendada com sucesso!', atividade: data };
    }

    case 'atualizar_atividade': {
      const { id, ...fields } = args;
      const { data, error } = await supabase
        .from('activities')
        .update(fields)
        .eq('id', id)
        .select('id, nome, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Atividade atualizada!', atividade: data };
    }

    case 'deletar_atividade': {
      const { id } = args;
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return { message: 'Atividade deletada com sucesso.' };
    }

    // ==================== CRM / CONTATOS ====================
    case 'listar_clientes_crm': {
      const { busca } = args;
      
      let contatoIds = null;
      if (busca) {
        // 1. Buscar se o termo bate com e-mail ou telefone
        const { data: telMatch } = await supabase
          .from('telefones')
          .select('contato_id')
          .ilike('telefone', `%${busca}%`);
          
        const { data: emailMatch } = await supabase
          .from('emails')
          .select('contato_id')
          .ilike('email', `%${busca}%`);
          
        const ids = new Set();
        telMatch?.forEach(t => ids.add(t.contato_id));
        emailMatch?.forEach(e => ids.add(e.contato_id));
        
        if (ids.size > 0) {
          contatoIds = Array.from(ids);
        }
      }

      let query = supabase
        .from('contatos')
        .select(`
          id, 
          nome, 
          status, 
          origem, 
          created_at,
          telefones(telefone),
          emails(email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (busca) {
        if (contatoIds && contatoIds.length > 0) {
          query = query.or(`nome.ilike.%${busca}%,id.in.(${contatoIds.join(',')})`);
        } else {
          query = query.ilike('nome', `%${busca}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      // Formata a resposta para simplificar o consumo pela IA
      return data.map(c => ({
        id: c.id,
        nome: c.nome,
        status: c.status,
        origem: c.origem,
        created_at: c.created_at,
        celular: c.telefones?.[0]?.telefone || null,
        email: c.emails?.[0]?.email || null
      }));
    }

    case 'criar_contato_crm': {
      const { nome, email, celular, origem, status } = args;
      
      // 1. Insere o contato
      const { data: contato, error } = await supabase
        .from('contatos')
        .insert({
          nome,
          origem: origem || null,
          status: status || 'Novo Lead',
          organizacao_id: user.organizacao_id
        })
        .select('id, nome, status')
        .single();

      if (error) throw new Error(error.message);

      // 2. Se informou celular, insere na tabela telefones
      if (celular) {
        await supabase
          .from('telefones')
          .insert({
            contato_id: contato.id,
            telefone: celular,
            organizacao_id: user.organizacao_id
          });
      }

      // 3. Se informou email, insere na tabela emails
      if (email) {
        await supabase
          .from('emails')
          .insert({
            contato_id: contato.id,
            email: email,
            organizacao_id: user.organizacao_id
          });
      }

      return { 
        message: 'Contato e vínculos criados com sucesso!', 
        contato: {
          id: contato.id,
          nome: contato.nome,
          status: contato.status,
          celular,
          email
        }
      };
    }

    case 'atualizar_contato_crm': {
      const { id, nome, status, celular, email } = args;
      
      // 1. Atualizar campos básicos do contato
      const updateData = {};
      if (nome !== undefined) updateData.nome = nome;
      if (status !== undefined) updateData.status = status;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('contatos').update(updateData).eq('id', id);
        if (error) throw new Error(error.message);
      }

      // 2. Atualizar celular se passado
      if (celular !== undefined) {
        await supabase.from('telefones').delete().eq('contato_id', id);
        if (celular) {
          await supabase.from('telefones').insert({
            contato_id: id,
            telefone: celular,
            organizacao_id: user.organizacao_id
          });
        }
      }

      // 3. Atualizar email se passado
      if (email !== undefined) {
        await supabase.from('emails').delete().eq('contato_id', id);
        if (email) {
          await supabase.from('emails').insert({
            contato_id: id,
            email: email,
            organizacao_id: user.organizacao_id
          });
        }
      }

      return { message: 'Ficha do contato e vínculos atualizados com sucesso!' };
    }

    case 'unir_contatos_crm': {
      const { contato_ids } = args;

      // Executa a RPC do Postgres de Fusão Completa de Contatos
      const { error } = await supabase.rpc('auto_merge_contacts_and_relink', {
        p_contact_ids: contato_ids,
        p_organizacao_id: user.organizacao_id
      });

      if (error) throw new Error(error.message);
      return { message: `Mesclagem de ${contato_ids.length} contatos efetuada com sucesso! Vínculos e históricos consolidados.` };
    }

    case 'listar_colunas_funil': {
      const { data, error } = await supabase
        .from('colunas_funil')
        .select('id, nome, ordem, funil_id')
        .order('ordem');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_leads_funil': {
      const { data, error } = await supabase
        .from('contatos_no_funil')
        .select(`
          id,
          contato:contatos(id, nome, celular, status),
          coluna:funil_colunas(id, nome, ordem),
          created_at
        `);

      if (error) throw new Error(error.message);
      return data;
    }

    case 'mover_lead_funil': {
      const { contato_id, coluna_id } = args;
      const { data, error } = await supabase
        .from('contatos_no_funil')
        .update({ coluna_id })
        .eq('contato_id', contato_id)
        .select('id, contato_id, coluna_id')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Lead movido no funil Kanban!', dados: data };
    }

    // ==================== DIÁRIO DE OBRAS ====================
    case 'listar_diarios_obra': {
      const { data, error } = await supabase
        .from('diarios_obra')
        .select(`
          id, 
          data_relatorio, 
          rdo_numero, 
          responsavel_rdo, 
          condicoes_climaticas, 
          condicoes_trabalho, 
          pdf_url,
          empreendimento:empreendimentos(id, nome)
        `)
        .order('data_relatorio', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_diario_obra': {
      const { empreendimento_id, data_relatorio, responsavel_rdo, condicoes_climaticas, condicoes_trabalho } = args;

      const { data, error } = await supabase
        .from('diarios_obra')
        .insert({
          empreendimento_id,
          data_relatorio,
          responsavel_rdo,
          condicoes_climaticas: condicoes_climaticas || 'Ensolarado',
          condicoes_trabalho: condicoes_trabalho || 'Praticável',
          usuario_responsavel_id: user.id,
          organizacao_id: user.organizacao_id,
          status_atividades: [],
          mao_de_obra: []
        })
        .select('id, data_relatorio, rdo_numero')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Relatório Diário de Obra criado!', rdo: data };
    }

    // ==================== FINANCEIRO ====================
    case 'listar_contas_financeiras': {
      const { data, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, tipo, instituicao, agencia, numero_conta')
        .order('nome');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_conta_financeira': {
      const { nome, tipo, saldo_inicial = 0, instituicao, agencia, numero_conta } = args;
      const { data, error } = await supabase
        .from('contas_financeiras')
        .insert({
          nome,
          tipo,
          saldo_inicial,
          instituicao: instituicao || null,
          agencia: agencia || null,
          numero_conta: numero_conta || null,
          organizacao_id: user.organizacao_id
        })
        .select('id, nome, tipo')
        .single();

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

    case 'criar_categoria_financeira': {
      const { nome, tipo, parent_id } = args;
      const { data, error } = await supabase
        .from('categorias_financeiras')
        .insert({
          nome,
          tipo,
          parent_id: parent_id || null,
          organizacao_id: user.organizacao_id
        })
        .select('id, nome, tipo')
        .single();

      if (error) throw new Error(error.message);
      return data;
    }

    case 'buscar_lancamentos_financeiros': {
      const { busca, data_inicio, data_fim, tipo, status, conta_id, categoria_id } = args;
      
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
        .limit(100);

      if (busca) {
        query = query.or(`descricao.ilike.%${busca}%,observacao.ilike.%${busca}%`);
      }
      if (data_inicio) query = query.gte('data_vencimento', data_inicio);
      if (data_fim) query = query.lte('data_vencimento', data_fim);
      if (tipo) query = query.eq('tipo', tipo);
      if (status) query = query.eq('status', status);
      if (conta_id) query = query.eq('conta_id', conta_id);
      if (categoria_id) query = query.eq('categoria_id', categoria_id);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'lancar_despesa': {
      const { descricao, valor, data_vencimento, conta_financeira_id, categoria_id, empreendimento_id, data_pagamento, status = 'Pendente', observacao } = args;

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
        .select('id, descricao, valor, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Despesa lançada com sucesso!', lancamento: data };
    }

    case 'lancar_receita': {
      const { descricao, valor, data_vencimento, conta_financeira_id, categoria_id, empreendimento_id, data_pagamento, status = 'Pendente', observacao } = args;

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
        .select('id, descricao, valor, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Receita lançada com sucesso!', lancamento: data };
    }

    case 'atualizar_lancamento': {
      const { id, ...fields } = args;
      
      // Auto-formatar o sinal se o valor for editado
      if (fields.valor) {
        const { data: lanc } = await supabase.from('lancamentos').select('tipo').eq('id', id).single();
        if (lanc?.tipo === 'Despesa') {
          fields.valor = -Math.abs(fields.valor);
        } else if (lanc?.tipo === 'Receita') {
          fields.valor = Math.abs(fields.valor);
        }
      }

      const { data, error } = await supabase
        .from('lancamentos')
        .update(fields)
        .eq('id', id)
        .select('id, descricao, valor, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Lançamento financeiro atualizado!', lancamento: data };
    }

    case 'deletar_lancamento': {
      const { id } = args;
      const { error } = await supabase
        .from('lancamentos')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return { message: 'Lançamento financeiro deletado com sucesso.' };
    }

    // ==================== ORÇAMENTOS ====================
    case 'listar_orcamentos': {
      const { data, error } = await supabase
        .from('orcamentos')
        .select(`
          id, 
          nome_orcamento, 
          custo_total_previsto, 
          status, 
          empreendimento:empreendimentos(id, nome)
        `);

      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_itens_orcamento': {
      const { orcamento_id } = args;
      const { data, error } = await supabase
        .from('orcamento_itens')
        .select(`
          id, 
          quantidade, 
          custo_unitario, 
          material:materiais(id, nome, unidade_medida)
        `)
        .eq('orcamento_id', orcamento_id);

      if (error) throw new Error(error.message);
      return data;
    }

    case 'adicionar_item_orcamento': {
      const { orcamento_id, material_id, quantidade, valor_unitario } = args;
      const { data, error } = await supabase
        .from('orcamento_itens')
        .insert({
          orcamento_id,
          material_id,
          quantidade,
          custo_unitario: valor_unitario,
          organizacao_id: user.organizacao_id
        })
        .select('id, orcamento_id, quantidade')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Item adicionado ao orçamento!', dados: data };
    }

    // ==================== PEDIDOS / COMPRAS ====================
    case 'listar_pedidos_compra': {
      const { data, error } = await supabase
        .from('pedidos_compra')
        .select(`
          id, 
          data_pedido, 
          status, 
          condicao_pagamento, 
          fornecedor:contatos!fornecedor_id(id, nome), 
          empreendimento:empreendimentos(id, nome)
        `)
        .order('id', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_pedido_compra': {
      const { empreendimento_id, fornecedor_id, fase_id, data_pedido, condicao_pagamento } = args;
      const { data, error } = await supabase
        .from('pedidos_compra')
        .insert({
          empreendimento_id,
          fornecedor_id,
          coluna_fase_id: fase_id,
          data_pedido,
          condicao_pagamento: condicao_pagamento || null,
          status: 'Pendente',
          organizacao_id: user.organizacao_id,
          criado_por_usuario_id: user.id
        })
        .select('id, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Pedido de compras criado!', pedido: data };
    }

    case 'listar_itens_pedido_compra': {
      const { pedido_compra_id } = args;
      const { data, error } = await supabase
        .from('pedidos_compra_itens')
        .select(`
          id, 
          quantidade, 
          preco_unitario_real, 
          material:materiais(id, nome, unidade_medida)
        `)
        .eq('pedido_compra_id', pedido_compra_id);

      if (error) throw new Error(error.message);
      return data;
    }

    case 'adicionar_item_pedido_compra': {
      const { pedido_compra_id, material_id, quantidade, valor_unitario } = args;
      const { data, error } = await supabase
        .from('pedidos_compra_itens')
        .insert({
          pedido_compra_id,
          material_id,
          quantidade,
          preco_unitario_real: valor_unitario,
          organizacao_id: user.organizacao_id
        })
        .select('id, pedido_compra_id, quantidade')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Item adicionado ao pedido de compra!', dados: data };
    }

    case 'deletar_item_pedido_compra': {
      const { id } = args;
      const { error } = await supabase
        .from('pedidos_compra_itens')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
      return { message: 'Item do pedido de compra excluído.' };
    }

    case 'marcar_pedido_entregue': {
      const { pedido_compra_id } = args;

      // Executa a RPC do Postgres de recebimento automático de mercadorias
      const { error } = await supabase.rpc('marcar_pedido_entregue', {
        p_pedido_id: pedido_compra_id,
        p_usuario_id: user.id
      });

      if (error) throw new Error(error.message);
      return { message: 'Pedido marcado como Entregue! Todos os materiais cotados deram entrada automática no estoque do almoxarifado.' };
    }

    // ==================== RECURSOS HUMANOS ====================
    case 'listar_funcionarios': {
      const { data, error } = await supabase
        .from('funcionarios')
        .select(`
          id, 
          full_name, 
          cpf, 
          rg, 
          birth_date, 
          phone, 
          email, 
          admission_date, 
          base_salary, 
          status, 
          numero_ponto, 
          empreendimento:empreendimentos(id, nome)
        `)
        .order('full_name');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'criar_funcionario': {
      const { full_name, cpf, rg, admission_date, empresa_id, empreendimento_atual_id, birth_date, phone, email, base_salary, payment_method, pix_key } = args;

      const { data, error } = await supabase
        .from('funcionarios')
        .insert({
          full_name,
          cpf,
          rg: rg || null,
          admission_date,
          empresa_id,
          empreendimento_atual_id: empreendimento_atual_id || null,
          birth_date: birth_date || null,
          phone: phone || null,
          email: email || null,
          base_salary: base_salary || null,
          payment_method: payment_method || null,
          pix_key: pix_key || null,
          status: 'Ativo',
          organizacao_id: user.organizacao_id
        })
        .select('id, full_name, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Novo funcionário criado com sucesso no RH!', colaborador: data };
    }

    case 'atualizar_funcionario': {
      const { id, ...fields } = args;
      const { data, error } = await supabase
        .from('funcionarios')
        .update(fields)
        .eq('id', id)
        .select('id, full_name, status')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Colaborador atualizado!', colaborador: data };
    }

    case 'lancar_ponto_funcionario': {
      const { funcionario_id, data_hora, tipo_registro, observacao } = args;

      const { data, error } = await supabase
        .from('pontos')
        .insert({
          funcionario_id,
          data_hora,
          tipo_registro: tipo_registro || 'Entrada',
          observacao: observacao || '',
          organizacao_id: user.organizacao_id
        })
        .select('id, data_hora, tipo_registro')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Batida de ponto física registrada!', ponto: data };
    }

    case 'lancar_vale_funcionario': {
      const { funcionario_id, valor, data_vale, data_pagamento, conta_id } = args;

      // Executa a RPC do Postgres de agendamento de adiantamento (Vales)
      const { data, error } = await supabase.rpc('agendar_vale', {
        p_funcionario_id: funcionario_id,
        p_valor_projetado: valor,
        p_periodo_inicio: data_vale,
        p_periodo_fim: data_vale,
        p_data_pagamento: data_pagamento,
        p_conta_id: conta_id,
        p_organizacao_id: user.organizacao_id
      });

      if (error) throw new Error(error.message);
      return { message: 'Vale agendado na folha de pagamento e débito financeiro provisionado!', dados: data };
    }

    case 'relatar_pendencias_ponto': {
      const { data, error } = await supabase.rpc('get_funcionarios_com_pendencias_ponto');
      if (error) throw new Error(error.message);
      return data;
    }

    case 'consultar_horas_trabalhadas': {
      const { funcionario_id, data_inicio, data_fim } = args;
      
      let query = supabase
        .from('saldos_diarios_ponto')
        .select('data, minutos_trabalhados, minutos_previstos, saldo_minutos_dia')
        .eq('funcionario_id', funcionario_id)
        .order('data', { ascending: false });

      if (data_inicio) {
        query = query.gte('data', data_inicio);
      }
      if (data_fim) {
        query = query.lte('data', data_fim);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      return data.map(row => {
        const minTrabalhados = row.minutos_trabalhados ? Number(row.minutos_trabalhados) : 0;
        const minPrevistos = row.minutos_previstos ? Number(row.minutos_previstos) : 0;
        const saldoMinutos = row.saldo_minutos_dia ? Number(row.saldo_minutos_dia) : 0;

        return {
          data: row.data,
          horas_trabalhadas: Number((minTrabalhados / 60).toFixed(2)),
          horas_previstas: Number((minPrevistos / 60).toFixed(2)),
          saldo_horas: Number((saldoMinutos / 60).toFixed(2)),
          minutos_trabalhados: minTrabalhados,
          minutos_previstos: minPrevistos,
          saldo_minutos: saldoMinutos
        };
      });
    }

    // ==================== ANEXOS E UPLOADS (PADRÃO OURO) ====================
    case 'listar_documento_tipos': {
      const { data, error } = await supabase
        .from('documento_tipos')
        .select('id, descricao, sigla')
        .order('descricao');
      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_anexos_por_recurso': {
      const { recurso_tipo, recurso_id } = args;
      const orgId = user.organizacao_id;

      switch (recurso_tipo) {
        case 'empreendimento': {
          const { data, error } = await supabase
            .from('empreendimento_anexos')
            .select('*')
            .eq('empreendimento_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'empresa': {
          const { data, error } = await supabase
            .from('empresa_anexos')
            .select('*')
            .eq('empresa_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'lancamento': {
          const { data, error } = await supabase
            .from('lancamentos_anexos')
            .select('*')
            .eq('lancamento_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'pedido': {
          const { data, error } = await supabase
            .from('pedidos_compra_anexos')
            .select('*')
            .eq('pedido_compra_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'atividade': {
          const { data, error } = await supabase
            .from('activity_anexos')
            .select('*')
            .eq('activity_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'funcionario': {
          const { data, error } = await supabase
            .from('documentos_funcionarios')
            .select('*')
            .eq('funcionario_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'contrato': {
          const { data, error } = await supabase
            .from('contrato_anexos')
            .select('*')
            .eq('contrato_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        case 'contrato_terceirizado': {
          const { data, error } = await supabase
            .from('contratos_terceirizados_anexos')
            .select('*')
            .eq('contrato_id', recurso_id)
            .eq('organizacao_id', orgId);
          if (error) throw new Error(error.message);
          return data;
        }
        default:
          throw new Error(`Tipo de recurso desconhecido: ${recurso_tipo}`);
      }
    }

    case 'upload_anexo_sistema': {
      const { conteudo_base64, nome_arquivo, recurso_tipo, recurso_id, tipo_documento_id, categoria_aba, descricao } = args;
      const orgId = user.organizacao_id;

      // 1. Decodificar o arquivo base64 em um Buffer
      const fileBuffer = Buffer.from(conteudo_base64, 'base64');
      const fileSize = fileBuffer.length;

      // 2. Higienizar o nome original e detectar MimeType
      const sanitizeFileName = (name) => {
        return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w.\-]/g, '_');
      };
      const sanitizedName = sanitizeFileName(nome_arquivo);

      const getMimeType = (fileName) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const mimes = {
          'pdf': 'application/pdf',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'xml': 'application/xml',
          'json': 'application/json',
          'zip': 'application/zip'
        };
        return mimes[ext] || 'application/octet-stream';
      };
      const contentType = getMimeType(nome_arquivo);

      // 3. Obter sigla do documento
      let sigla = 'DOC';
      let docDescricao = 'Documento';
      if (tipo_documento_id) {
        const { data: tipoDoc } = await supabase
          .from('documento_tipos')
          .select('sigla, descricao')
          .eq('id', tipo_documento_id)
          .maybeSingle();
        if (tipoDoc) {
          sigla = tipoDoc.sigla || 'DOC';
          docDescricao = tipoDoc.descricao || 'Documento';
        }
      }

      // 4. Executar upload e inserção no banco baseados no tipo do recurso
      const timeStamp = Date.now();
      switch (recurso_tipo) {
        case 'empreendimento': {
          const bucket = 'empreendimento-anexos';
          const storagePath = `${recurso_id}/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('empreendimento_anexos')
            .insert({
              empreendimento_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              descricao: descricao || '',
              tipo_documento_id: tipo_documento_id || null,
              categoria_aba: categoria_aba || 'geral',
              usuario_id: user.id,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Empreendimento enviado com sucesso!', registro: data };
        }

        case 'empresa': {
          const bucket = 'empresa-anexos';
          const storagePath = `${recurso_id}/anexos/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('empresa_anexos')
            .insert({
              empresa_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              descricao: descricao || '',
              tipo_documento_id: tipo_documento_id || null,
              categoria_aba: categoria_aba || 'geral',
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Empresa enviado com sucesso!', registro: data };
        }

        case 'lancamento': {
          const bucket = 'documentos-financeiro';
          const storagePath = `public/${orgId}/lancamentos/${recurso_id}/${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('lancamentos_anexos')
            .insert({
              lancamento_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              descricao: descricao || '',
              tipo_documento_id: tipo_documento_id || null,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo Financeiro enviado com sucesso!', registro: data };
        }

        case 'pedido': {
          const bucket = 'pedidos-anexos';
          const storagePath = `pedidos/${recurso_id}/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('pedidos_compra_anexos')
            .insert({
              pedido_compra_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              descricao: descricao || '',
              usuario_id: user.id,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Pedido de Compra enviado com sucesso!', registro: data };
        }

        case 'atividade': {
          const bucket = 'activity-anexos';
          const storagePath = `${recurso_id}/${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('activity_anexos')
            .insert({
              activity_id: recurso_id,
              file_path: storagePath,
              file_name: nome_arquivo,
              file_type: contentType,
              file_size: fileSize,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Atividade enviado com sucesso!', registro: data };
        }

        case 'funcionario': {
          const bucket = 'funcionarios-documentos';
          const storagePath = `funcionarios/${recurso_id}/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('documentos_funcionarios')
            .insert({
              funcionario_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_documento: nome_arquivo,
              tipo_documento_id: tipo_documento_id || null,
              criado_por_usuario_id: user.id,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Funcionário enviado com sucesso!', registro: data };
        }

        case 'contrato': {
          const bucket = 'empreendimento-anexos';
          const storagePath = `contratos/${recurso_id}/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('contrato_anexos')
            .insert({
              contrato_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              tipo_documento: docDescricao,
              usuario_id: user.id,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Contrato enviado com sucesso!', registro: data };
        }

        case 'contrato_terceirizado': {
          const bucket = 'contratos-documentos';
          const storagePath = `contratos/${recurso_id}/${sigla}_${timeStamp}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, { contentType, upsert: true });
          if (uploadError) throw new Error(`Falha no upload Storage: ${uploadError.message}`);

          const { data, error } = await supabase
            .from('contratos_terceirizados_anexos')
            .insert({
              contrato_id: recurso_id,
              caminho_arquivo: storagePath,
              nome_arquivo: nome_arquivo,
              tipo_arquivo: contentType,
              tamanho_bytes: fileSize,
              tipo_documento_id: tipo_documento_id || null,
              descricao: descricao || '',
              uploaded_by: user.id,
              organizacao_id: orgId
            })
            .select()
            .single();

          if (error) {
            await supabase.storage.from(bucket).remove([storagePath]);
            throw new Error(`Falha no insert Banco: ${error.message}`);
          }
          return { message: 'Anexo de Contrato Terceirizado enviado com sucesso!', registro: data };
        }

        default:
          throw new Error(`Tipo de recurso desconhecido: ${recurso_tipo}`);
      }
    }

    // ==================== EMPREENDIMENTOS / VENDAS ====================
    case 'listar_empreendimentos': {
      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, status, created_at')
        .order('nome');

      if (error) throw new Error(error.message);
      return data;
    }

    case 'listar_unidades_empreendimento': {
      const { empreendimento_id } = args;
      let query = supabase
        .from('produtos_empreendimento')
        .select('id, unidade, bloco, area_m2, valor_base, valor_venda_calculado, status, empreendimento_id')
        .order('unidade');

      if (empreendimento_id) {
        query = query.eq('empreendimento_id', empreendimento_id);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data;
    }

    case 'atualizar_unidade_empreendimento': {
      const { id, ...fields } = args;
      const { data, error } = await supabase
        .from('produtos_empreendimento')
        .update(fields)
        .eq('id', id)
        .select('id, unidade, status, valor_base')
        .single();

      if (error) throw new Error(error.message);
      return { message: 'Unidade imobiliária atualizada na tabela de vendas!', unidade: data };
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

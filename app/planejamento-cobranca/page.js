// app/planejamento-cobranca/page.js

'use client';

import { useState, useRef } from 'react';
import { 
  Building2, 
  CreditCard, 
  CheckCircle2, 
  Database, 
  ChevronRight, 
  Code, 
  Sparkles, 
  Plus, 
  Trash2, 
  Calendar, 
  Settings, 
  Info, 
  Layers,
  Check,
  RotateCcw,
  Edit2,
  HelpCircle,
  Trash,
  X,
  Eye
} from 'lucide-react';

export default function PlanejamentoCobrancaPage() {
  // Mapa Mental focado em tarefas concretas com Título e Descrição visíveis diretamente no Card
  const defaultNodes = [
    { 
      id: '1', 
      text: 'Roadmap de Faturamento (Elo 57)', 
      desc: 'Fluxo unificado de cadastro de planos, carência de trial e bloqueios.', 
      x: 30, 
      y: 450, 
      parentId: null, 
      color: '#f25a2f', 
      isRoot: true,
      longDesc: 'Esta é a base do nosso ecossistema de faturamento. A partir daqui, definimos as regras para novos cadastros de clientes, aplicação de períodos de carência de 3 meses, criação das assinaturas no Asaas e as regras de controle de acesso a módulos premium do Elo 57 baseados no plano escolhido.'
    },
    
    // Grupo 1: Entrada & Coleta (Amarelo)
    { 
      id: '2', 
      text: '1. LP: Passar plano por parâmetro (?plan=pro)', 
      desc: 'Modificar botões da landing page para carregar código do plano selecionado na URL.', 
      x: 480, 
      y: 50, 
      parentId: '1', 
      color: '#eab308',
      longDesc: 'Quando o cliente estiver navegando na nossa página inicial de vendas e escolher um plano, o sistema vai anexar essa escolha na barra de endereço dele. Assim, quando ele for para a tela de criar conta, o sistema já sabe se ele quer o plano Essencial, Pro ou Ultra, carregando essa configuração automaticamente.'
    },
    { 
      id: '3', 
      text: '2. Cadastro: Wizard de Registro', 
      desc: 'Validar a coleta obrigatória de CNPJ/CPF, CEP completo, telefone e e-mail no formulário.', 
      x: 480, 
      y: 190, 
      parentId: '1', 
      color: '#eab308',
      longDesc: 'Na tela de cadastro, coletaremos os dados de endereço e o CNPJ ou CPF do cliente. O Asaas exige essas informações por lei para poder emitir cobranças e gerar assinaturas. Se o cliente for Pessoa Jurídica, o sistema busca automaticamente a Razão Social pelo CNPJ para facilitar a digitação. Todos esses dados são salvos em nosso banco de dados no Supabase.'
    },
    { 
      id: '3b', 
      text: '3. Cadastro: Redirecionar Pós-Registro', 
      desc: 'Ajustar o retorno do signUpAction para enviar a URL de checkout direto do Asaas.', 
      x: 480, 
      y: 330, 
      parentId: '1', 
      color: '#eab308',
      longDesc: 'Assim que o cliente terminar de criar a sua conta (finalizar o cadastro de 3 etapas), ele não irá para a tela convencional de login. O sistema gerará a assinatura promocional em background e redirecionará o cliente automaticamente para a tela de checkout do Asaas para inserir seu cartão de crédito, garantindo que a conta só seja utilizável após o registro do cartão.'
    },
    
    // Grupo 2: Banco de Dados (Azul)
    { 
      id: '4', 
      text: '4. DB: Criar Tabela public.planos', 
      desc: 'Criar tabela no Supabase contendo código do plano, valores e módulos permitidos.', 
      x: 480, 
      y: 470, 
      parentId: '1', 
      color: '#3b82f6',
      longDesc: 'Criaremos uma tabela interna para organizar os planos. Cada plano listará quais ferramentas estão liberadas (como financeiro, RH, diário de obra) e quais estão bloqueadas. É o mapa de acessos que o sistema consultará para saber o que cada cliente pode fazer.'
    },
    { 
      id: '5', 
      text: '5. DB: Criar Tabela public.promocoes', 
      desc: 'Criar tabela de cupons com desconto percentual e carência (dias de trial).', 
      x: 480, 
      y: 610, 
      parentId: '1', 
      color: '#3b82f6',
      longDesc: 'Uma tabela para controlar nossos cupons promocionais. Ela definirá quantos dias grátis o cliente terá (ex: 90 dias de carência/trial) e se ele tem algum desconto percentual no valor da mensalidade (ex: cupom MUITOLINDO).'
    },
    { 
      id: '6', 
      text: '6. DB: Alterar public.organizacoes', 
      desc: 'Adicionar plano_codigo, seats_contracted e asaas_subscription_id.', 
      x: 480, 
      y: 750, 
      parentId: '1', 
      color: '#3b82f6',
      longDesc: 'Modificamos o cadastro das empresas clientes no banco de dados para anotar qual plano elas escolheram, quantos usuários ativos elas contrataram, o ID da assinatura do Asaas correspondente e a data em que o período de testes vai expirar.'
    },
    { 
      id: '6b', 
      text: '7. DB: Criar RPC prorrogar_trial', 
      desc: 'Criar função SQL no banco para administradores alterarem manualmente a carência.', 
      x: 480, 
      y: 890, 
      parentId: '1', 
      color: '#3b82f6',
      longDesc: 'Criamos uma ferramenta administrativa para que você, Ranniere, consiga prorrogar os dias de testes de um cliente ou alterar a data de vencimento da mensalidade de forma manual e segura directamente no banco de dados, sem risco de quebrar o histórico.'
    },

    // Grupo 3: Integração Asaas API (Roxo)
    { 
      id: '7', 
      text: '8. API: Sincronizar Cliente no Asaas', 
      desc: 'Executar obterOuCriarCliente com CNPJ/CPF e CEP da empresa cadastrada.', 
      x: 920, 
      y: 120, 
      parentId: '3', 
      color: '#a855f7',
      longDesc: 'O sistema pega o CNPJ/CPF e o endereço que o cliente digitou no cadastro e cria uma ficha de cliente dentro do Asaas. Se a empresa já existir lá, o sistema atualiza os dados automaticamente para manter tudo sincronizado.'
    },
    { 
      id: '8', 
      text: '9. API: Calcular Valor e Data do Trial', 
      desc: 'Calcular valor total (seats * plano) com desconto e definir vencimento para hoje + 90 dias.', 
      x: 920, 
      y: 260, 
      parentId: '3', 
      color: '#a855f7',
      longDesc: 'O sistema multiplica a quantidade de usuários contratados pelo valor unitário do plano e aplica o desconto do cupom. Depois, calcula a data exata da primeira cobrança, somando os 90 dias de carência (trial) a partir do dia do cadastro.'
    },
    { 
      id: '9', 
      text: '10. API: Chamar API do Asaas', 
      desc: 'POST /v3/subscriptions enviando billingType como UNDEFINED e o plano recorrente.', 
      x: 920, 
      y: 400, 
      parentId: '3', 
      color: '#a855f7',
      longDesc: 'Envia os dados calculados para o Asaas para registrar a assinatura. Definimos o tipo de cobrança como "Indefinido" para que o próprio checkout do Asaas exiba a opção de Cartão de Crédito e Pix, gerando a URL de pagamento seguro.'
    },
    { 
      id: '9b', 
      text: '11. API: Tratar Chaves Sandbox/Prod', 
      desc: 'Garantir dinamicamente a alternância de chaves dependendo do ambiente.', 
      x: 920, 
      y: 540, 
      parentId: '3', 
      color: '#a855f7',
      longDesc: 'Uma regra interna para que, enquanto estivermos testando localmente, o sistema use cartões e dinheiro simulado do Asaas. Quando colocarmos no ar para clientes reais, o sistema passa a cobrar cartões verdadeiros de forma automática sem mudar o código.'
    },

    // Grupo 4: Interface do Usuário (Laranja)
    { 
      id: '10', 
      text: '12. UI: Tela de Configurações de Assinatura', 
      desc: 'Dashboard exibindo dados da assinatura ativa e dados mascarados do cartão salvo.', 
      x: 1360, 
      y: 50, 
      parentId: '8', 
      color: '#f25a2f',
      longDesc: 'Uma tela dentro do painel de configurações do cliente que mostra o status da conta dele (Ativo, Em Período de Testes, Atrasado), a data da próxima cobrança e a bandeira e final do cartão que ele deixou cadastrado (mascarado por segurança).'
    },
    { 
      id: '11', 
      text: '13. UI: Histórico de Faturas', 
      desc: 'Listagem de faturas com downloads de comprovante e link do checkout do Asaas.', 
      x: 1360, 
      y: 190, 
      parentId: '8', 
      color: '#f25a2f',
      longDesc: 'Uma tabela simples dentro do painel do cliente para ele ver todas as faturas passadas e futuras emitidas pelo Asaas. Ele pode clicar para baixar o PDF do boleto/comprovante ou pagar via Pix.'
    },
    { 
      id: '12', 
      text: '14. UI: Trocar Cartão de Crédito', 
      desc: 'Formulário com validação local de cartão que tokeniza e envia via PUT ao Asaas.', 
      x: 1360, 
      y: 330, 
      parentId: '8', 
      color: '#f25a2f',
      longDesc: 'Um botão na área do cliente para ele atualizar o cartão de crédito caso o dele expire, seja bloqueado ou ele queira trocar o método de pagamento por outro cartão.'
    },

    // Grupo 5: Segurança & Middleware (Vermelho)
    { 
      id: '13', 
      text: '15. Controle: Bloquear Excesso de Assentos', 
      desc: 'Middleware/Trigger impedindo criação de novos usuários se estourar seats_contracted.', 
      x: 1360, 
      y: 470, 
      parentId: '8', 
      color: '#ef4444',
      longDesc: 'Se o cliente contratou um plano para 5 usuários, o sistema bloqueia automaticamente a criação de um 6º usuário na tela de equipe. Para liberar novos cadastros, o cliente deve clicar em um botão para aumentar a quantidade de assentos da sua assinatura.'
    },
    { 
      id: '14', 
      text: '16. Controle: Bloqueio do Módulo BIM', 
      desc: 'Verificar plano do usuário e ocultar/bloquear rota do BIM Manager se plano for Essencial.', 
      x: 1360, 
      y: 610, 
      parentId: '8', 
      color: '#ef4444',
      longDesc: 'Como o sistema sabe quem bloquear? Cada organização salva no banco possui a coluna plano_codigo (ex: essencial ou pro). O menu lateral lê essa informação do usuário logado. Se a organização do usuário for do plano Essencial (que não inclui o módulo BIM), a opção do menu BIM Manager some. Se o usuário tentar digitar o link direto (/bim-manager) no navegador, o sistema bloqueia o acesso e mostra uma mensagem sugerindo o upgrade para o plano Pro.'
    },
    { 
      id: '15', 
      text: '17. Middleware: Bloqueio de Inadimplentes', 
      desc: 'Interceptar navegação e redirecionar para cobrança se status for overdue ou pending.', 
      x: 1360, 
      y: 750, 
      parentId: '8', 
      color: '#ef4444',
      longDesc: 'Se o trial de 3 meses expirar e o Asaas não conseguir cobrar o cartão do cliente (por falta de limite ou cartão cancelado), o status da organização muda para overdue (inadimplente). O middleware do sistema intercepta qualquer tentativa de usar a plataforma e redireciona o usuário para a tela de pagamento, bloqueando o restante.'
    },

    // Grupo 6: Webhooks (Verde)
    { 
      id: '16', 
      text: '18. Webhook: Ativar Org no Banco', 
      desc: 'Escutar PAYMENT_RECEIVED para mudar status para active e prorrogar validade no Supabase.', 
      x: 1800, 
      y: 260, 
      parentId: '12', 
      color: '#10b981',
      longDesc: 'Quando o cliente preenche o cartão no checkout, o Asaas nos envia um aviso silencioso. Nosso webhook recebe, valida a segurança do aviso, encontra a empresa correspondente no Supabase e ativa a conta dela, liberando o acesso ao ERP.'
    },
    { 
      id: '17', 
      text: '19. Webhook: Cancelamento e Atraso', 
      desc: 'Escutar PAYMENT_OVERDUE e SUB_DELETED para suspender o acesso da organização.', 
      x: 1800, 
      y: 400, 
      parentId: '12', 
      color: '#10b981',
      longDesc: 'Se a mensalidade atrasar ou o cliente cancelar o plano, o Asaas envia um alerta ao nosso webhook. O sistema imediatamente altera o status da organização para suspenso no Supabase, bloqueando a entrada dos usuários.'
    }
  ];

  const [nodes, setNodes] = useState(defaultNodes);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  
  // Modal State for detailed business descriptions
  const [activeModalNode, setActiveModalNode] = useState(null);

  // Canvas Panning State (Miro Style)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag state for cards
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Card Dimensions
  const cardWidth = 320;
  const cardHeight = 120;

  // Node Drag Handlers
  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('button')) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    });
  };

  // Canvas Pan Handlers
  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg' || e.target.id === 'canvas-wrapper') {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggedNodeId) {
      setNodes(prev => prev.map(n => {
        if (n.id === draggedNodeId) {
          return {
            ...n,
            x: Math.max(10, e.clientX - dragOffset.x),
            y: Math.max(10, e.clientY - dragOffset.y)
          };
        }
        return n;
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node Operations
  const addNewRootNode = () => {
    const newId = Date.now().toString();
    const colors = ['#f25a2f', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newNode = {
      id: newId,
      text: 'Nova Atividade',
      desc: 'Descrição da tarefa a ser cumprida.',
      longDesc: 'Escreva aqui o detalhamento de negócio desta etapa de forma simples e direta.',
      x: 100 - panOffset.x,
      y: 300 - panOffset.y,
      parentId: null,
      color: randomColor,
      isRoot: true
    };
    setNodes(prev => [...prev, newNode]);
    startEditing(newNode);
  };

  const addChildNode = (parentId) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    const newId = Date.now().toString();
    const newNode = {
      id: newId,
      text: 'Nova Atividade Filha',
      desc: 'Tarefa subsequente conectada.',
      longDesc: 'Detalhamento de negócio para esta subtarefa.',
      x: parent.x + cardWidth + 80,
      y: parent.y + (Math.random() * 120 - 60),
      parentId: parentId,
      color: parent.color
    };
    setNodes(prev => [...prev, newNode]);
    startEditing(newNode);
  };

  const deleteNode = (nodeId) => {
    const getDescendants = (id) => {
      const children = nodes.filter(n => n.parentId === id);
      return children.reduce((acc, child) => {
        return [...acc, child.id, ...getDescendants(child.id)];
      }, []);
    };

    const idsToDelete = [nodeId, ...getDescendants(nodeId)];
    setNodes(prev => prev.filter(n => !idsToDelete.includes(n.id)));
  };

  const startEditing = (node) => {
    setEditingId(node.id);
    setEditingText(node.text);
    setEditingDesc(node.desc || '');
  };

  const saveEdit = () => {
    if (!editingId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === editingId) {
        return { ...n, text: editingText, desc: editingDesc };
      }
      return n;
    }));
    setEditingId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      saveEdit();
    }
  };

  const resetToTemplate = () => {
    setNodes(defaultNodes);
    setPanOffset({ x: 0, y: 0 });
  };

  const clearCanvas = () => {
    setNodes([]);
  };

  // Connection curve drawing
  const getSPath = (startX, startY, endX, endY) => {
    const controlX1 = startX + 60;
    const controlY1 = startY;
    const controlX2 = endX - 60;
    const controlY2 = endY;
    return `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
  };

  return (
    <div 
      className="h-screen w-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col relative select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Dots Grid Pattern - Moves with Pan Offset */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[size:24px_24px] opacity-70 pointer-events-none z-0 transition-all duration-75"
        style={{ backgroundPosition: `${panOffset.x}px ${panOffset.y}px` }}
      ></div>

      {/* Header Dock */}
      <header className="bg-white/90 border-b border-slate-200/60 py-4 px-6 z-25 backdrop-blur-md flex items-center justify-between shadow-sm relative shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-sm">
            E
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Quadro de Atividades do Asaas <span className="text-[10px] font-bold text-[#f25a2f] bg-[#f25a2f]/10 border border-[#f25a2f]/20 px-2 py-0.5 rounded-full uppercase">Miro Canvas</span>
            </h1>
            <p className="text-[10px] text-slate-450 font-light">Seu lindo, clique nos cards para ver o detalhamento completo de negócio sem complicações de código.</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button 
            onClick={resetToTemplate}
            title="Resetar para o Fluxo Original"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-all active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Carregar Fluxo Completo
          </button>
          <button 
            onClick={addNewRootNode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f25a2f] hover:bg-[#d84a22] text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm shadow-[#f25a2f]/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Atividade
          </button>
          <button 
            onClick={clearCanvas}
            title="Limpar Tela"
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-all"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* VIEWPORT CANVAS (Full-width infinite panning area) */}
      <div 
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        className={`flex-1 w-full h-full relative overflow-hidden z-10 ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Infinite Panning Container */}
        <div 
          id="canvas-wrapper"
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
        >
          {/* SVG Connecting Lines */}
          <svg className="absolute w-[3000px] h-[2000px] pointer-events-none z-0">
            {nodes.map(node => {
              if (!node.parentId) return null;
              const parent = nodes.find(n => n.id === node.parentId);
              if (!parent) return null;

              const startX = parent.x + cardWidth;
              const startY = parent.y + cardHeight / 2;
              const endX = node.x;
              const endY = node.y + cardHeight / 2;

              const pathData = getSPath(startX, startY, endX, endY);

              return (
                <g key={`link-${node.id}`}>
                  <path d={pathData} fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
                  <path d={pathData} fill="none" stroke={node.color || '#cbd5e1'} strokeWidth="2.5" strokeLinecap="round" />
                </g>
              );
            })}
          </svg>

          {/* Node Cards */}
          {nodes.map(node => {
            const isEditing = editingId === node.id;
            
            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`
                }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                className={`absolute rounded-2xl border bg-white shadow-sm p-4 flex flex-col justify-between transition-shadow select-none group pointer-events-auto z-10 ${
                  draggedNodeId === node.id ? 'shadow-lg border-slate-400 ring-2 ring-slate-200/50' : 'border-slate-200/80 hover:shadow-md'
                }`}
              >
                {/* Left Color Accent */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl" 
                  style={{ backgroundColor: node.color || '#cbd5e1' }}
                ></div>

                {/* Node Content Editor */}
                <div className="pl-2 pr-6 h-full flex flex-col justify-center gap-1.5 overflow-hidden">
                  {isEditing ? (
                    <div className="flex flex-col gap-2 w-full">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#f25a2f]"
                        placeholder="Título da Tarefa"
                        autoFocus
                      />
                      <textarea
                        value={editingDesc}
                        onChange={(e) => setEditingDesc(e.target.value)}
                        onKeyDown={handleKeyPress}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[10px] text-slate-650 outline-none resize-none h-12 focus:ring-1 focus:ring-[#f25a2f]"
                        placeholder="Descrição do trabalho..."
                      />
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={saveEdit} 
                          className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 text-[10px] font-bold"
                        >
                          Salvar (Ctrl+Enter)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                        <span 
                          onDoubleClick={() => startEditing(node)}
                          className="text-xs font-bold text-slate-850 leading-snug truncate select-none block flex-1"
                        >
                          {node.text}
                        </span>
                        {/* Details Modal Trigger */}
                        <button 
                          onClick={() => setActiveModalNode(node)}
                          className="text-[#f25a2f] hover:text-[#d84a22] p-0.5 rounded hover:bg-[#f25a2f]/5 shrink-0 flex items-center justify-center"
                          title="Ver Detalhamento de Negócio"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p 
                        onDoubleClick={() => startEditing(node)}
                        className="text-[10px] text-slate-500 font-light leading-relaxed line-clamp-3 select-none"
                      >
                        {node.desc || 'Nenhuma descrição fornecida.'}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions Hover Menu */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => addChildNode(node.id)}
                    title="Adicionar nó filho"
                    className="w-5.5 h-5.5 bg-slate-50 hover:bg-[#f25a2f] border border-slate-200 hover:border-[#f25a2f] hover:text-white rounded-lg flex items-center justify-center transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => startEditing(node)}
                    title="Editar Texto"
                    className="w-5.5 h-5.5 bg-slate-50 hover:bg-blue-500 border border-slate-200 hover:border-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                  >
                    <Edit2 className="h-2.5 w-2.5" />
                  </button>
                  <button
                    onClick={() => deleteNode(node.id)}
                    title="Deletar"
                    className="w-5.5 h-5.5 bg-rose-50 hover:bg-rose-500 border border-rose-200 hover:border-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* DETAILED BUSINESS EXPLANATION POP-UP MODAL */}
      {activeModalNode && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setActiveModalNode(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3.5 mb-5">
              <div 
                className="w-3.5 h-8 rounded-full" 
                style={{ backgroundColor: activeModalNode.color || '#cbd5e1' }}
              ></div>
              <div>
                <h3 className="text-lg font-black text-slate-900">{activeModalNode.text}</h3>
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mt-0.5">Detalhamento Operacional e Regras</span>
              </div>
            </div>

            {/* Non-Technical Business Description */}
            <div className="space-y-4 text-sm text-slate-650 font-light leading-relaxed">
              <p className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-slate-700">
                {activeModalNode.longDesc || activeModalNode.desc || 'Nenhuma descrição detalhada disponível para esta atividade.'}
              </p>

              {/* Informative Explanation on Plans Enforcing */}
              {activeModalNode.id === '14' && (
                <div className="mt-4 p-4 bg-[#f25a2f]/10 border border-[#f25a2f]/20 rounded-2xl">
                  <span className="font-bold text-slate-800 block text-xs mb-1">Como o sistema diferencia Org 2 de Org 3?</span>
                  <p className="text-xs text-slate-600 leading-relaxed font-light">
                    O Supabase armazena na tabela de organizações o campo <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold">plano_codigo</code>. 
                    Quando Ranniere (Org 2) se loga, seu cadastro aponta para o plano <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-[#f25a2f]">pro</code>, o que habilita as chaves de acesso a todos os módulos no menu lateral e nas permissões da API. 
                    Se uma nova empresa (Org 3) assinar o plano <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold">essencial</code>, o sistema desabilita visualmente o módulo BIM e bloqueia a navegação para impedir o uso.
                  </p>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end pt-6 mt-6 border-t border-slate-100">
              <button 
                onClick={() => setActiveModalNode(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all active:scale-95"
              >
                Entendi, Devonildo!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Instructions Banner (Bottom Left) */}
      <div className="absolute bottom-5 left-5 bg-white/90 border border-slate-200/80 px-4 py-3 rounded-2xl shadow-md z-30 max-w-sm backdrop-blur-sm flex items-start gap-3 pointer-events-auto">
        <Info className="h-4 w-4 text-[#f25a2f] mt-0.5 flex-shrink-0" />
        <div className="text-[10px] text-slate-500 leading-relaxed font-light">
          <span className="font-bold text-slate-700 block mb-0.5">Navegação do Canvas:</span>
          Arrastar Tela: Clique e arraste no fundo milimetrado.<br />
          Ver Detalhes: Clique no ícone de "Olho" (<Eye className="h-3 w-3 inline" />) no card.<br />
          Mover Cards: Arraste as caixas de tarefas.<br />
          Links: <a href="/cadastro" target="_blank" className="underline font-bold text-[#f25a2f]">Cadastro</a> | <a href="/configuracoes/assinatura" target="_blank" className="underline font-bold text-[#f25a2f]">Assinatura</a>
        </div>
      </div>
    </div>
  );
}

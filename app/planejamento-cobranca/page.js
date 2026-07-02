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
  Trash
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
      isRoot: true 
    },
    
    // Grupo 1: Entrada & Coleta (Amarelo)
    { 
      id: '2', 
      text: '1. LP: Passar plano por parâmetro (?plan=pro)', 
      desc: 'Modificar botões da landing page para carregar código do plano selecionado na URL.', 
      x: 450, 
      y: 50, 
      parentId: '1', 
      color: '#eab308' 
    },
    { 
      id: '3', 
      text: '2. Cadastro: Wizard de Registro', 
      desc: 'Validar a coleta obrigatória de CNPJ/CPF, CEP completo, telefone e e-mail no formulário.', 
      x: 450, 
      y: 190, 
      parentId: '1', 
      color: '#eab308' 
    },
    { 
      id: '3b', 
      text: '3. Cadastro: Redirecionar Pós-Registro', 
      desc: 'Ajustar o retorno do signUpAction para enviar a URL de checkout direto do Asaas.', 
      x: 450, 
      y: 330, 
      parentId: '1', 
      color: '#eab308' 
    },
    
    // Grupo 2: Banco de Dados (Azul)
    { 
      id: '4', 
      text: '4. DB: Criar Tabela public.planos', 
      desc: 'Criar tabela no Supabase contendo código do plano, valores e módulos permitidos.', 
      x: 450, 
      y: 470, 
      parentId: '1', 
      color: '#3b82f6' 
    },
    { 
      id: '5', 
      text: '5. DB: Criar Tabela public.promocoes', 
      desc: 'Criar tabela de cupons com desconto percentual e carência (dias de trial).', 
      x: 450, 
      y: 610, 
      parentId: '1', 
      color: '#3b82f6' 
    },
    { 
      id: '6', 
      text: '6. DB: Alterar public.organizacoes', 
      desc: 'Adicionar plano_codigo, seats_contracted e asaas_subscription_id.', 
      x: 450, 
      y: 750, 
      parentId: '1', 
      color: '#3b82f6' 
    },
    { 
      id: '6b', 
      text: '7. DB: Criar RPC prorrogar_trial', 
      desc: 'Criar função SQL no banco para administradores alterarem manualmente a carência.', 
      x: 450, 
      y: 890, 
      parentId: '1', 
      color: '#3b82f6' 
    },

    // Grupo 3: Integração Asaas API (Roxo)
    { 
      id: '7', 
      text: '8. API: Sincronizar Cliente no Asaas', 
      desc: 'Executar obterOuCriarCliente com CNPJ/CPF e CEP da empresa cadastrada.', 
      x: 880, 
      y: 120, 
      parentId: '3', 
      color: '#a855f7' 
    },
    { 
      id: '8', 
      text: '9. API: Calcular Valor e Data do Trial', 
      desc: 'Calcular valor total (seats * plano) com desconto e definir vencimento para hoje + 90 dias.', 
      x: 880, 
      y: 260, 
      parentId: '3', 
      color: '#a855f7' 
    },
    { 
      id: '9', 
      text: '10. API: Chamar API do Asaas', 
      desc: 'POST /v3/subscriptions enviando billingType como UNDEFINED e o plano recorrente.', 
      x: 880, 
      y: 400, 
      parentId: '3', 
      color: '#a855f7' 
    },
    { 
      id: '9b', 
      text: '11. API: Tratar Chaves Sandbox/Prod', 
      desc: 'Garantir dinamicamente a alternância de chaves dependendo do ambiente.', 
      x: 880, 
      y: 540, 
      parentId: '3', 
      color: '#a855f7' 
    },

    // Grupo 4: Interface do Usuário (Laranja)
    { 
      id: '10', 
      text: '12. UI: Tela de Configurações de Assinatura', 
      desc: 'Dashboard exibindo dados da assinatura ativa e dados mascarados do cartão salvo.', 
      x: 1300, 
      y: 50, 
      parentId: '8', 
      color: '#f25a2f' 
    },
    { 
      id: '11', 
      text: '13. UI: Histórico de Faturas', 
      desc: 'Listagem de faturas com downloads de comprovante e link do checkout do Asaas.', 
      x: 1300, 
      y: 190, 
      parentId: '8', 
      color: '#f25a2f' 
    },
    { 
      id: '12', 
      text: '14. UI: Trocar Cartão de Crédito', 
      desc: 'Formulário com validação local de cartão que tokeniza e envia via PUT ao Asaas.', 
      x: 1300, 
      y: 330, 
      parentId: '8', 
      color: '#f25a2f' 
    },

    // Grupo 5: Segurança & Middleware (Vermelho)
    { 
      id: '13', 
      text: '15. Controle: Bloquear Excesso de Assentos', 
      desc: 'Middleware/Trigger impedindo criação de novos usuários se estourar seats_contracted.', 
      x: 1300, 
      y: 470, 
      parentId: '8', 
      color: '#ef4444' 
    },
    { 
      id: '14', 
      text: '16. Controle: Bloqueio do Módulo BIM', 
      desc: 'Verificar plano do usuário e ocultar/bloquear rota do BIM Manager se plano for Essencial.', 
      x: 1300, 
      y: 610, 
      parentId: '8', 
      color: '#ef4444' 
    },
    { 
      id: '15', 
      text: '17. Middleware: Bloqueio de Inadimplentes', 
      desc: 'Interceptar navegação e redirecionar para cobrança se status for overdue ou pending.', 
      x: 1300, 
      y: 750, 
      parentId: '8', 
      color: '#ef4444' 
    },

    // Grupo 6: Webhooks (Verde)
    { 
      id: '16', 
      text: '18. Webhook: Ativar Org no Banco', 
      desc: 'Escutar PAYMENT_RECEIVED para mudar status para active e prorrogar validade no Supabase.', 
      x: 1720, 
      y: 260, 
      parentId: '12', 
      color: '#10b981' 
    },
    { 
      id: '17', 
      text: '19. Webhook: Cancelamento e Atraso', 
      desc: 'Escutar PAYMENT_OVERDUE e SUB_DELETED para suspender o acesso da organização.', 
      x: 1720, 
      y: 400, 
      parentId: '12', 
      color: '#10b981' 
    }
  ];

  const [nodes, setNodes] = useState(defaultNodes);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  
  // Drag state
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Settings for simulator panel
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [seats, setSeats] = useState(5);
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [trialDays, setTrialDays] = useState(90);
  const [promoCode, setPromoCode] = useState('MUITOLINDO');
  const [hasPromo, setHasPromo] = useState(true);

  // Node Dimensions (Updated to fit Description)
  const cardWidth = 320;
  const cardHeight = 120;

  const planDetails = {
    essencial: { nome: 'Elo Essencial', valor: 127 },
    pro: { nome: 'Elo Pro', valor: 297 },
    ultra: { nome: 'Elo Ultra', valor: 497 }
  };

  // Node Drag Handlers
  const handleMouseDown = (e, nodeId) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('button')) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    });
  };

  const handleMouseMove = (e) => {
    if (!draggedNodeId) return;

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
  };

  const handleMouseUp = () => {
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
      x: 100,
      y: 200 + (Math.random() * 100),
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
  };

  const clearCanvas = () => {
    setNodes([]);
  };

  // Simulator Calculations
  const basePrice = planDetails[selectedPlan].valor;
  const discount = billingCycle === 'YEARLY' ? 0.8 : 1.0;
  const promoDiscount = (hasPromo && promoCode === 'MUITOLINDO') ? 0.9 : 1.0;
  const priceFinal = Math.round(basePrice * discount * promoDiscount);
  const totalPrice = priceFinal * seats;

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
      className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Dots Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[size:20px_20px] opacity-70 pointer-events-none z-0"></div>

      {/* Header Dock */}
      <header className="bg-white/80 border-b border-slate-200/60 py-4 px-6 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-sm">
            E
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Quadro de Atividades do Asaas <span className="text-[10px] font-bold text-[#f25a2f] bg-[#f25a2f]/10 border border-[#f25a2f]/20 px-2 py-0.5 rounded-full uppercase">Visual Board</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-light">Seu lindo, arraste e edite os cards contendo o Título e a Descrição do trabalho de faturamento.</p>
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
            Carregar Fluxo Detalhado
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

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col lg:flex-row relative z-10 overflow-hidden">
        
        {/* VIEWPORT CANVAS */}
        <div className="flex-1 overflow-auto p-4 min-h-[50vh] lg:min-h-0" ref={canvasRef}>
          <div className="w-[2200px] h-[1100px] relative rounded-3xl">
            
            {/* SVG Connecting Lines Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
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

            {/* Render Nodes / Cards */}
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
                  className={`absolute rounded-2xl border bg-white shadow-sm p-4 flex flex-col justify-between transition-shadow cursor-grab active:cursor-grabbing select-none group z-10 ${
                    draggedNodeId === node.id ? 'shadow-lg border-slate-400 ring-2 ring-slate-200/50' : 'border-slate-200/80 hover:shadow-md'
                  }`}
                >
                  {/* Left Color Accent */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl" 
                    style={{ backgroundColor: node.color || '#cbd5e1' }}
                  ></div>

                  {/* Node Content / Inline Editor */}
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
                          className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-[10px] text-slate-600 outline-none resize-none h-12 focus:ring-1 focus:ring-[#f25a2f]"
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
                        <span 
                          onDoubleClick={() => startEditing(node)}
                          className="text-xs font-bold text-slate-800 leading-snug truncate select-none block"
                        >
                          {node.text}
                        </span>
                        <p 
                          onDoubleClick={() => startEditing(node)}
                          className="text-[10px] text-slate-500 font-light leading-relaxed line-clamp-3 select-none"
                        >
                          {node.desc || 'Nenhuma descrição fornecida.'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Actions Overlay */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => addChildNode(node.id)}
                      title="Adicionar nó subsequente"
                      className="w-6 h-6 bg-slate-50 hover:bg-[#f25a2f] border border-slate-200 hover:border-[#f25a2f] hover:text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => startEditing(node)}
                      title="Editar Texto & Descrição"
                      className="w-6 h-6 bg-slate-50 hover:bg-blue-500 border border-slate-200 hover:border-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => deleteNode(node.id)}
                      title="Deletar este nó"
                      className="w-6 h-6 bg-rose-50 hover:bg-rose-500 border border-rose-200 hover:border-rose-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-0">
                <HelpCircle className="h-10 w-10 text-slate-300 mb-2" />
                <h4 className="text-slate-400 font-bold text-sm">Seu board está limpo.</h4>
                <p className="text-slate-450 text-xs mt-1 font-light max-w-sm">Use o botão "Carregar Fluxo Detalhado" para restaurar a lista padrão de tarefas.</p>
              </div>
            )}

          </div>
        </div>

        {/* SIDEBAR PANEL */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/80 p-6 flex flex-col justify-between shadow-lg z-20">
          
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-[#f25a2f] uppercase tracking-wider block">Configuração & Carência</span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Simulador de Recorrência</h2>
              <p className="text-[11px] text-slate-400 mt-1 font-light">Os valores e carências abaixos alimentam as chamadas simuladas de API no Asaas:</p>
            </div>

            {/* Plan Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Selecione o Plano Comercial</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="essencial">Elo Essencial (R$ 127/usuário)</option>
                <option value="pro">Elo Pro (R$ 297/usuário)</option>
                <option value="ultra">Elo Ultra (R$ 497/usuário)</option>
              </select>
            </div>

            {/* Ciclo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Ciclo de Cobrança</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setBillingCycle('MONTHLY')}
                  className={`py-2 rounded-md text-xs font-bold transition-all ${billingCycle === 'MONTHLY' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setBillingCycle('YEARLY')}
                  className={`py-2 rounded-md text-xs font-bold transition-all ${billingCycle === 'YEARLY' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400'}`}
                >
                  Anual (-20%)
                </button>
              </div>
            </div>

            {/* Usuários e Carência */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 block">Usuários (Assentos)</label>
                <input 
                  type="number"
                  min="1"
                  max="100"
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-1 font-bold text-slate-700 outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-500 block">Carência (Trial/Dias)</label>
                <input 
                  type="number"
                  min="0"
                  max="180"
                  value={trialDays}
                  onChange={(e) => setTrialDays(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-1 font-bold text-slate-700 outline-none"
                />
              </div>
            </div>

            {/* Cupom */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500">Cupom Aplicado</label>
                <button
                  onClick={() => setHasPromo(!hasPromo)}
                  className={`text-[9px] font-black uppercase tracking-wider ${hasPromo ? 'text-green-600' : 'text-slate-400'}`}
                >
                  {hasPromo ? 'Ativo (-10%)' : 'Ativar'}
                </button>
              </div>
              {hasPromo && (
                <input 
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-green-700 outline-none uppercase"
                />
              )}
            </div>

            {/* Resumo */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Recorrência Total:</span>
              <span className="text-base font-black text-[#f25a2f]">
                R$ {totalPrice} <span className="text-[10px] font-normal text-slate-450">/ ciclo</span>
              </span>
            </div>

          </div>

          {/* Links e Dicas */}
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3 items-start">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed font-light">
              <span className="font-bold text-slate-700 block">Links Rápidos:</span>
              <ul className="space-y-1 mt-1 font-mono text-[9px] text-[#f25a2f]">
                <li>
                  <a href="/cadastro" className="underline font-bold" target="_blank">Página de Cadastro (/cadastro)</a>
                </li>
                <li>
                  <a href="/configuracoes/assinatura" className="underline font-bold" target="_blank">Minha Assinatura (/configuracoes/assinatura)</a>
                </li>
              </ul>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

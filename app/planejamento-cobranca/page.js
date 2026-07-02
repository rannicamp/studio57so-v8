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
  // Mapa Mental focado em tarefas concretas a serem feitas no projeto
  const defaultNodes = [
    { id: '1', text: 'Roadmap de Faturamento (Elo 57)', x: 30, y: 350, parentId: null, color: '#f25a2f', isRoot: true },
    
    // Grupo 1: Entrada & Coleta (Amarelo)
    { id: '2', text: '1. LP: Passar Parâmetros na URL (?plan=pro&promo=MUITOLINDO)', x: 420, y: 80, parentId: '1', color: '#eab308' },
    { id: '3', text: '2. Cadastro: Validar Coleta de CNPJ, CEP e Telefone no Wizard', x: 420, y: 190, parentId: '1', color: '#eab308' },
    
    // Grupo 2: Banco de Dados (Azul/Indigo)
    { id: '4', text: '3. DB: Criar Tabela public.planos no Supabase', x: 420, y: 310, parentId: '1', color: '#3b82f6' },
    { id: '5', text: '4. DB: Criar Tabela public.promocoes (Cupons de Desconto & Trial)', x: 420, y: 420, parentId: '1', color: '#3b82f6' },
    { id: '6', text: '5. DB: Alterar public.organizacoes (plano_codigo, seats, trial_ends_at)', x: 420, y: 530, parentId: '1', color: '#3b82f6' },

    // Grupo 3: Integração Asaas (Roxo)
    { id: '7', text: '6. API: Sincronizar Cliente no Asaas com CNPJ/CPF da Org', x: 800, y: 220, parentId: '3', color: '#a855f7' },
    { id: '8', text: '7. API: Gerar Assinatura no Asaas com Vencimento Futuro (Carência)', x: 800, y: 340, parentId: '3', color: '#a855f7' },
    { id: '9', text: '8. API: Redirecionar para URL de Checkout após Criação da Conta', x: 800, y: 460, parentId: '3', color: '#a855f7' },

    // Grupo 4: Segurança & Bloqueio (Vermelho)
    { id: '10', text: '9. Controle: Bloquear BIM e Módulos Pro se Plano for Essencial', x: 1180, y: 280, parentId: '8', color: '#ef4444' },
    { id: '11', text: '10. Middleware: Impedir Acesso se status for overdue/pending', x: 1180, y: 400, parentId: '8', color: '#ef4444' },

    // Grupo 5: Confirmação (Verde)
    { id: '12', text: '11. Webhooks: Escutar payment confirm do Asaas e ativar Org', x: 1560, y: 340, parentId: '11', color: '#10b981' }
  ];

  const [nodes, setNodes] = useState(defaultNodes);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  
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

  // Node Dimensions
  const cardWidth = 280;
  const cardHeight = 84;

  const planDetails = {
    essencial: { nome: 'Elo Essencial', valor: 127 },
    pro: { nome: 'Elo Pro', valor: 297 },
    ultra: { nome: 'Elo Ultra', valor: 497 }
  };

  // Node Drag Handlers
  const handleMouseDown = (e, nodeId) => {
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    
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
      text: 'Nova Tarefa / Requisito',
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
      text: 'Nova Subtarefa',
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
  };

  const saveEdit = () => {
    if (!editingId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === editingId) {
        return { ...n, text: editingText };
      }
      return n;
    }));
    setEditingId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
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
              Quadro de Planejamento de Cobrança <span className="text-[10px] font-bold text-[#f25a2f] bg-[#f25a2f]/10 border border-[#f25a2f]/20 px-2 py-0.5 rounded-full uppercase">Tarefas</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-light">Seu lindo, monte o plano de ação arrastando e conectando cards para definirmos a entrega local.</p>
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
            Carregar Checklist de Cobrança
          </button>
          <button 
            onClick={addNewRootNode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f25a2f] hover:bg-[#d84a22] text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm shadow-[#f25a2f]/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar Card Raiz
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
          <div className="w-[2000px] h-[900px] relative rounded-3xl">
            
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
                  className={`absolute rounded-2xl border bg-white shadow-sm p-3.5 flex flex-col justify-between transition-shadow cursor-grab active:cursor-grabbing select-none group z-10 ${
                    draggedNodeId === node.id ? 'shadow-lg border-slate-400 ring-2 ring-slate-200/50' : 'border-slate-200/80 hover:shadow-md'
                  }`}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl" 
                    style={{ backgroundColor: node.color || '#cbd5e1' }}
                  ></div>

                  <div className="pl-3 pr-6 h-full flex items-center">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="w-full bg-slate-50 border border-slate-350 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-[#f25a2f]"
                          autoFocus
                        />
                        <button onClick={saveEdit} className="p-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200">
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <span 
                        onDoubleClick={() => startEditing(node)}
                        className="text-xs font-bold text-slate-800 leading-snug line-clamp-2 select-none"
                      >
                        {node.text}
                      </span>
                    )}
                  </div>

                  {/* Actions Overlay */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => addChildNode(node.id)}
                      title="Adicionar nó filho"
                      className="w-5.5 h-5.5 bg-slate-50 hover:bg-[#f25a2f] border border-slate-200 hover:border-[#f25a2f] hover:text-white rounded flex items-center justify-center transition-all"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => startEditing(node)}
                      title="Editar Texto"
                      className="w-5.5 h-5.5 bg-slate-50 hover:bg-blue-500 border border-slate-200 hover:border-blue-500 hover:text-white rounded flex items-center justify-center transition-all"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => deleteNode(node.id)}
                      title="Deletar"
                      className="w-5.5 h-5.5 bg-rose-50 hover:bg-rose-500 border border-rose-200 hover:border-rose-500 hover:text-white rounded flex items-center justify-center transition-all"
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
                <h4 className="text-slate-400 font-bold text-sm">Seu roadmap está em branco.</h4>
                <p className="text-slate-450 text-xs mt-1 font-light max-w-sm">Use o botão "Carregar Checklist de Cobrança" para restaurar as tarefas padrão do Asaas.</p>
              </div>
            )}

          </div>
        </div>

        {/* SIDEBAR PANEL: CONEXÕES & SIMULAÇÃO */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/80 p-6 flex flex-col justify-between shadow-lg z-20">
          
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-[#f25a2f] uppercase tracking-wider block">Integração Ativa</span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Configuração de Planos</h2>
              <p className="text-[11px] text-slate-400 mt-1 font-light">Defina os valores e ciclos para a carência e simule o payload enviado ao Asaas:</p>
            </div>

            {/* Plan selector */}
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
                <label className="text-xs font-bold text-slate-500">Cupom de Desconto</label>
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

            {/* Resumo Financeiro */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Recorrência Total:</span>
              <span className="text-base font-black text-[#f25a2f]">
                R$ {totalPrice} <span className="text-[10px] font-normal text-slate-450">/ ciclo</span>
              </span>
            </div>

          </div>

          {/* Instruções do Fluxo */}
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3 items-start">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed font-light">
              <span className="font-bold text-slate-700 block">Links Importantes:</span>
              <ul className="space-y-1 mt-1 font-mono text-[9px] text-[#f25a2f]">
                <li>
                  <a href="/cadastro" className="underline" target="_blank">Página de Cadastro (/cadastro)</a>
                </li>
                <li>
                  <a href="/configuracoes/assinatura" className="underline" target="_blank">Página de Assinatura (/configuracoes/assinatura)</a>
                </li>
              </ul>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

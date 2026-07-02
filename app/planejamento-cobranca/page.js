// app/planejamento-cobranca/page.js

'use client';

import { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  HelpCircle,
  Play,
  RotateCcw,
  Edit2,
  Check,
  Download,
  Share2,
  Trash
} from 'lucide-react';

export default function PlanejamentoCobrancaPage() {
  // Pre-load default mind map nodes (our billing planning)
  const defaultNodes = [
    { id: '1', text: 'Onboarding & Cobrança (Elo 57)', x: 50, y: 350, parentId: null, color: '#f25a2f', isRoot: true },
    
    // Branch 1: Entrada
    { id: '2', text: 'Landing Page (Parâmetros de Planos & Cupom na URL)', x: 380, y: 120, parentId: '1', color: '#eab308' },
    { id: '3', text: 'Cadastro (Criação local de Org e Admin)', x: 380, y: 250, parentId: '1', color: '#3b82f6' },
    
    // Branch 2: Integração
    { id: '4', text: 'Sincronização no Asaas (Criar ou Atualizar Cliente com CNPJ)', x: 740, y: 180, parentId: '3', color: '#6366f1' },
    { id: '5', text: 'Criação da Assinatura (Ciclo do Plano com 90 dias de Trial)', x: 740, y: 320, parentId: '3', color: '#a855f7' },
    
    // Branch 3: Checkout
    { id: '6', text: 'Checkout Asaas (Redirecionamento para inserir Cartão de Crédito)', x: 1100, y: 250, parentId: '5', color: '#ec4899' },
    
    // Branch 4: Retorno & Ativação
    { id: '7', text: 'Webhook de Ativação (Atualiza Org para active no Supabase)', x: 1440, y: 180, parentId: '6', color: '#10b981' },
    { id: '8', text: 'Middleware (Bloqueio se status for overdue ou pending_payment)', x: 1440, y: 320, parentId: '6', color: '#ef4444' }
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

  // Node Dimensions used for line drawing
  const cardWidth = 260;
  const cardHeight = 84;

  const planDetails = {
    essencial: { nome: 'Elo Essencial', valor: 127 },
    pro: { nome: 'Elo Pro', valor: 297 },
    ultra: { nome: 'Elo Ultra', valor: 497 }
  };

  // Node Drag Handlers
  const handleMouseDown = (e, nodeId) => {
    // Prevent drag when clicking buttons/inputs
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

    // Track movement relative to canvas
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
      text: 'Novo Tópico',
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
      text: 'Nova Etapa / Tarefa',
      x: parent.x + cardWidth + 80,
      y: parent.y + (Math.random() * 120 - 60),
      parentId: parentId,
      color: parent.color
    };
    setNodes(prev => [...prev, newNode]);
    startEditing(newNode);
  };

  const deleteNode = (nodeId) => {
    // Delete node and recursively all its descendants
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

  return (
    <div 
      className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Background Dots Grid Pattern matching user upload */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[size:20px_20px] opacity-70 pointer-events-none z-0"></div>

      {/* Header Dock */}
      <header className="bg-white/80 border-b border-slate-200/60 py-4 px-6 sticky top-0 z-30 backdrop-blur-md flex items-center justify-between shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-base shadow-sm">
            E
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Planejamento de Cobrança <span className="text-[10px] font-bold text-[#f25a2f] bg-[#f25a2f]/10 border border-[#f25a2f]/20 px-2 py-0.5 rounded-full uppercase">Mapa Mental</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-light">Seu lindo, arraste os cards, dê duplo clique para editar o texto e use o (+) para puxar novos nós!</p>
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
            Restaurar Fluxo Asaas
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
        
        {/* VIEWPORT CANVAS (SCROLLABLE MAP CANVAS) */}
        <div className="flex-1 overflow-auto p-4 min-h-[50vh] lg:min-h-0" ref={canvasRef}>
          <div 
            className="w-[2000px] h-[900px] relative rounded-3xl"
          >
            {/* SVG Connecting Lines Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {nodes.map(node => {
                if (!node.parentId) return null;
                const parent = nodes.find(n => n.id === node.parentId);
                if (!parent) return null;

                // Parent Output Port (right side of card)
                const startX = parent.x + cardWidth;
                const startY = parent.y + cardHeight / 2;

                // Child Input Port (left side of card)
                const endX = node.x;
                const endY = node.y + cardHeight / 2;

                // S-Curve Control Points
                const controlX1 = startX + 60;
                const controlY1 = startY;
                const controlX2 = endX - 60;
                const controlY2 = endY;

                const pathData = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;

                return (
                  <g key={`link-${node.id}`}>
                    {/* Shadow trace for depth */}
                    <path 
                      d={pathData} 
                      fill="none" 
                      stroke="#e2e8f0" 
                      strokeWidth="5" 
                      strokeLinecap="round" 
                    />
                    {/* Main connector line */}
                    <path 
                      d={pathData} 
                      fill="none" 
                      stroke={node.color || '#cbd5e1'} 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                    />
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
                  {/* Card Border Accent */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2.5 rounded-l-2xl" 
                    style={{ backgroundColor: node.color || '#cbd5e1' }}
                  ></div>

                  {/* Node Content / Text Editor */}
                  <div className="pl-3.5 pr-6 h-full flex items-center">
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
                        <button 
                          onClick={saveEdit}
                          className="p-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200"
                        >
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

                  {/* Actions Overlay Dock (Visible on hover) */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => addChildNode(node.id)}
                      title="Adicionar nó filho"
                      className="w-6 h-6 bg-slate-50 hover:bg-[#f25a2f] border border-slate-200 hover:border-[#f25a2f] hover:text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => startEditing(node)}
                      title="Editar Texto"
                      className="w-6 h-6 bg-slate-50 hover:bg-blue-500 border border-slate-200 hover:border-blue-500 hover:text-white rounded-lg flex items-center justify-center transition-all"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => deleteNode(node.id)}
                      title="Deletar este nó e seus filhos"
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
                <h4 className="text-slate-400 font-bold text-sm">Seu mapa mental está limpo.</h4>
                <p className="text-slate-400 text-xs mt-1 font-light max-w-sm">Use o botão "Adicionar Card Raiz" no topo para criar uma caixa e arrastá-la ou resete para carregar a configuração Asaas.</p>
              </div>
            )}

          </div>
        </div>

        {/* SIDEBAR DOCK: ASSINATURA SIMULATOR PANEL */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/80 p-6 flex flex-col justify-between shadow-lg z-20">
          
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-bold text-[#f25a2f] uppercase tracking-wider block">Calculadora de Payload</span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Simulador Recorrente</h2>
              <p className="text-[11px] text-slate-400 mt-1 font-light">Os valores e ciclos abaixo alimentam dinamicamente a assinatura gerada no nó de Checkout do Mapa Mental.</p>
            </div>

            {/* Plano */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Qual o Plano?</label>
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

            {/* Usuários */}
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
                <label className="font-bold text-slate-500 block">Trial (Dias)</label>
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

            {/* Resumo */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Recorrência Total:</span>
              <span className="text-base font-black text-[#f25a2f]">
                R$ {totalPrice} <span className="text-[10px] font-normal text-slate-450">/ ciclo</span>
              </span>
            </div>

          </div>

          {/* Dica do Devonildo */}
          <div className="mt-8 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex gap-3 items-start">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 leading-relaxed font-light">
              <span className="font-bold text-slate-700 block">Dica do Devonildo:</span>
              Este mapa mental e os valores simulados salvam a consistência das rotas no ambiente local. Modifique o mapa à vontade adicionando caixas e notas para organizar as entregas, seu lindo!
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

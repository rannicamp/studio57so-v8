// components/financeiro/conciliacao/ConciliacaoWorkbench.js
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLink, faPlus, faSearch, faSort, faSortUp, faSortDown, 
  faPen, faCheckCircle, faMagic, faSpinner, faTimes, faCheckDouble 
} from '@fortawesome/free-solid-svg-icons';
import { format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';

// --- PALETA DE CORES ---
const MATCH_COLORS = [
    { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800' },
    { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800' },
    { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-800' },
    { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-800' },
    { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-800' },
    { bg: 'bg-lime-50', border: 'border-lime-400', text: 'text-lime-800' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', text: 'text-fuchsia-800' },
];

// --- CABEÇALHO ---
const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "" }) => {
  const isActive = currentSort.key === sortKey;
  return (
    <div onClick={() => onSort(sortKey)} className={`cursor-pointer hover:bg-gray-100 p-2 rounded flex items-center gap-1 select-none transition-colors ${className}`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
      <span className="text-gray-400 text-[10px]">
        {isActive ? <FontAwesomeIcon icon={currentSort.direction === 'asc' ? faSortUp : faSortDown} /> : <FontAwesomeIcon icon={faSort} className="opacity-30" />}
      </span>
    </div>
  );
};

// --- ITEM DA LISTA ---
const TransactionItem = ({ item, isSelected, onClick, type, onEdit, matchIndex, onRejectMatch, onHoverMatch, isHoveredMatch }) => {
  const isCredit = type === 'banco' ? item.tipo === 'CREDIT' : item.tipo === 'Receita';
  const colorClass = isCredit ? 'text-green-600' : 'text-red-600';
  const isConciliado = item.conciliado;
  
  let containerClasses = 'bg-white hover:bg-gray-50 border-gray-100 transition-all';
  let badge = null;

  if (isConciliado) {
      // Visual de item já conciliado (mais apagadinho)
      containerClasses = 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-100';
  } else if (isSelected) {
      containerClasses = 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-[1.01] z-30';
  } else if (matchIndex !== null && matchIndex !== undefined) {
      const colorStyle = MATCH_COLORS[matchIndex % MATCH_COLORS.length];
      const hoverEffect = isHoveredMatch ? 'ring-2 ring-offset-1 ring-purple-400 scale-[1.02]' : '';
      containerClasses = `${colorStyle.bg} ${colorStyle.border} ${colorStyle.text} border-l-4 z-10 relative ${hoverEffect}`;
      
      badge = (
        <div className="absolute -right-2 -top-2 flex shadow-sm z-20 scale-90 hover:scale-110 transition-transform">
           <div className={`flex items-center justify-center w-5 h-5 bg-white border ${colorStyle.border} rounded-full text-[10px] font-bold ${colorStyle.text}`}>
             #{matchIndex + 1}
           </div>
           <button 
             onClick={(e) => { e.stopPropagation(); onRejectMatch(); }}
             className="ml-1 w-5 h-5 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white text-gray-400 border border-gray-200 rounded-full transition-colors shadow-sm"
             title="Rejeitar esta sugestão"
           >
             <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
           </button>
        </div>
      );
  }

  let dataFormatada = '-';
  try {
      const dateObj = typeof item.data === 'string' ? parseISO(item.data) : item.data;
      if (isValid(dateObj)) dataFormatada = format(dateObj, 'dd/MM/yy');
      else dataFormatada = item.data || '-';
  } catch (e) { dataFormatada = '-'; }

  return (
    <div 
      onClick={() => onClick(item)}
      onMouseEnter={onHoverMatch ? () => onHoverMatch(true) : undefined}
      onMouseLeave={onHoverMatch ? () => onHoverMatch(false) : undefined}
      className={`relative group grid grid-cols-[80px_1fr_100px] gap-2 items-center p-2 rounded-lg border mb-2 cursor-pointer text-xs h-12 ${containerClasses}`}
    >
      {badge}
      <div className={`font-mono text-[11px] ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>{dataFormatada}</div>
      <div className="flex items-center gap-2 overflow-hidden min-w-0">
        {isConciliado && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-[10px]" />}
        <span className={`truncate font-medium ${isConciliado ? 'line-through' : ''}`} title={item.descricao}>{item.descricao}</span>
        {type === 'sistema' && onEdit && !isConciliado && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className={`opacity-0 group-hover:opacity-100 p-1 transition-opacity ${isSelected ? 'text-white' : 'text-gray-400 hover:text-blue-600'}`}>
                <FontAwesomeIcon icon={faPen} size="xs" />
            </button>
        )}
      </div>
      <div className={`text-right font-bold truncate ${isSelected ? 'text-white' : (isConciliado ? 'text-gray-400' : colorClass)}`}>
        {Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
    </div>
  );
};

export default function ConciliacaoWorkbench({ extratoItems = [], sistemaItems = [], onConciliar, onCriarLancamento, onEditarLancamento }) {
  const [selectedBanco, setSelectedBanco] = useState(null);
  const [selectedSistema, setSelectedSistema] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMatches, setAiMatches] = useState([]);
  const [hoveredMatchIndex, setHoveredMatchIndex] = useState(null);

  const [bancoSort, setBancoSort] = useState({ key: 'data', direction: 'desc' });
  const [sistemaSort, setSistemaSort] = useState({ key: 'data', direction: 'desc' });
  
  const handleRejectAiMatch = (extratoId, sistemaId) => {
      setAiMatches(prev => prev.filter(m => !(String(m.extratoId) === String(extratoId) && String(m.sistemaId) === String(sistemaId))));
      if (selectedBanco && String(selectedBanco.id) === String(extratoId)) setSelectedBanco(null);
      if (selectedSistema && String(selectedSistema.id) === String(sistemaId)) setSelectedSistema(null);
      toast.info("Sugestão removida.");
  };

  const toggleSelectionBanco = (item) => {
    // Se já estiver conciliado, não faz nada (apenas visualização)
    if (item.conciliado) return;

    const novoBanco = (selectedBanco?.id === item.id ? null : item);
    setSelectedBanco(novoBanco);
    if (novoBanco) {
        const match = aiMatches.find(m => String(m.extratoId) === String(item.id));
        if (match) {
            const itemSistema = sistemaItems.find(s => String(s.id) === String(match.sistemaId));
            if (itemSistema && !itemSistema.conciliado) setSelectedSistema(itemSistema);
        }
    }
  };

  const toggleSelectionSistema = (item) => {
    // Se já estiver conciliado, não faz nada
    if (item.conciliado) return;

    const novoSistema = (selectedSistema?.id === item.id ? null : item);
    setSelectedSistema(novoSistema);
    if (novoSistema) {
        const match = aiMatches.find(m => String(m.sistemaId) === String(item.id));
        if (match) {
            const itemBanco = extratoItems.find(b => String(b.id) === String(match.extratoId));
            if (itemBanco && !itemBanco.conciliado) setSelectedBanco(itemBanco);
        }
    }
  };

  const handleSort = (key, currentSort, setSort) => {
    setSort(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const sortList = (list, sortConfig) => {
    return [...list].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === 'descricao') { valA = valA?.toLowerCase() || ''; valB = valB?.toLowerCase() || ''; }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // --- LÓGICA DE EXIBIÇÃO DO EXTRATO (Atualizada para mostrar conciliados) ---
  const processedExtrato = useMemo(() => {
    // Filtro de busca
    let filtered = extratoItems.filter(i => (i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || i.valor.toString().includes(searchTerm)));
    
    // Separa pendentes e conciliados
    const pendentes = filtered.filter(i => !i.conciliado);
    const conciliados = filtered.filter(i => i.conciliado);

    // Separa pendentes com e sem Match da IA
    const pendentesComMatch = pendentes.filter(i => aiMatches.some(m => String(m.extratoId) === String(i.id)));
    const pendentesSemMatch = pendentes.filter(i => !aiMatches.some(m => String(m.extratoId) === String(i.id)));

    // Retorna: Matches Primeiro -> Pendentes -> Conciliados (no final)
    return [...sortList(pendentesComMatch, bancoSort), ...sortList(pendentesSemMatch, bancoSort), ...sortList(conciliados, bancoSort)];
  }, [extratoItems, searchTerm, bancoSort, aiMatches]);

  // --- LÓGICA DE EXIBIÇÃO DO SISTEMA ---
  const processedSistema = useMemo(() => {
    let filtered = sistemaItems.filter(i => (i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || i.valor.toString().includes(searchTerm)));
    
    const pendentes = filtered.filter(i => !i.conciliado);
    const conciliados = filtered.filter(i => i.conciliado);
    
    const pendentesComMatch = pendentes.filter(i => aiMatches.some(m => String(m.sistemaId) === String(i.id)));
    const pendentesSemMatch = pendentes.filter(i => !aiMatches.some(m => String(m.sistemaId) === String(i.id)));

    return [...sortList(pendentesComMatch, sistemaSort), ...sortList(pendentesSemMatch, sistemaSort), ...sortList(conciliados, sistemaSort)];
  }, [sistemaItems, searchTerm, sistemaSort, aiMatches]);

  // --- AÇÕES ---

  const handleMatch = async () => {
    if (selectedBanco && selectedSistema) {
      await onConciliar(selectedBanco, selectedSistema);
      setAiMatches(prev => prev.filter(m => !(String(m.extratoId) === String(selectedBanco.id) && String(m.sistemaId) === String(selectedSistema.id))));
      setSelectedBanco(null); setSelectedSistema(null);
    }
  };

  // Atalho Teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
        if (selectedBanco && selectedSistema) {
          e.preventDefault(); 
          handleMatch();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBanco, selectedSistema, handleMatch]);

  const handleConciliarTodos = async () => {
    if (aiMatches.length === 0) return;
    if (!confirm(`Deseja confirmar e conciliar automaticamente ${aiMatches.length} pares sugeridos pela IA?`)) return;

    setIsAiLoading(true);
    let count = 0;
    try {
        for (const match of aiMatches) {
            const banco = extratoItems.find(e => String(e.id) === String(match.extratoId));
            const sistema = sistemaItems.find(s => String(s.id) === String(match.sistemaId));
            if (banco && sistema) {
                await onConciliar(banco, sistema);
                count++;
            }
        }
        setAiMatches([]);
        setSelectedBanco(null);
        setSelectedSistema(null);
        toast.success(`${count} lançamentos conciliados com sucesso!`);
    } catch (error) {
        console.error("Erro ao conciliar em lote", error);
        toast.error("Houve um erro durante a conciliação em lote.");
    } finally {
        setIsAiLoading(false);
    }
  };

  const handleAiAutoMatch = async () => {
    const pendentesExtrato = extratoItems.filter(e => !e.conciliado);
    const pendentesSistema = sistemaItems.filter(s => !s.conciliado);

    if (pendentesExtrato.length === 0 || pendentesSistema.length === 0) {
        toast.warning("Preciso de itens pendentes em ambos os lados.");
        return;
    }

    setIsAiLoading(true);
    setAiMatches([]); 

    try {
        const response = await fetch('/api/conciliacao/match-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extrato: pendentesExtrato, sistema: pendentesSistema })
        });
        if (!response.ok) throw new Error("Erro API IA");
        const { matches } = await response.json();
        if (matches && matches.length > 0) {
            setAiMatches(matches); 
            toast.success(`IA: Encontrei ${matches.length} pares! Verifique e clique em 'Conciliar Todos' para confirmar.`);
        } else {
            toast.info("A IA não encontrou correspondências óbvias.");
        }
    } catch (error) { toast.error("Erro na IA: " + error.message); } finally { setIsAiLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[600px] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-white p-3 border-b border-gray-200 flex justify-between items-center shadow-sm z-20">
        <div className="relative w-72">
           <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-xs" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Esquerda: Banco */}
        <div className="flex-1 flex flex-col border-r border-gray-200 bg-white">
          <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Extrato</h3>
                 <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{processedExtrato.length}</span>
             </div>
             <div className="grid grid-cols-[80px_1fr_100px] gap-2 px-2">
                <SortableHeader label="Data" sortKey="data" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} />
                <SortableHeader label="Descrição" sortKey="descricao" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} />
                <SortableHeader label="Valor" sortKey="valor" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} className="justify-end" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
             {processedExtrato.map(item => {
                 const matchIndex = aiMatches.findIndex(m => String(m.extratoId) === String(item.id));
                 const matchData = aiMatches[matchIndex];
                 return (
                    <TransactionItem key={item.id} item={item} type="banco" 
                        isSelected={selectedBanco?.id === item.id}
                        matchIndex={matchIndex !== -1 ? matchIndex : null}
                        isHoveredMatch={matchIndex !== -1 && hoveredMatchIndex === matchIndex}
                        onHoverMatch={(isHovering) => setHoveredMatchIndex(isHovering ? matchIndex : null)}
                        onRejectMatch={() => matchData && handleRejectAiMatch(matchData.extratoId, matchData.sistemaId)}
                        onClick={toggleSelectionBanco} 
                    />
                 );
             })}
          </div>
        </div>

        {/* Centro: Ações */}
        <div className="w-14 bg-gray-50 border-r border-gray-200 flex flex-col items-center justify-center gap-4 py-4 z-20 shadow-sm">
           
           <button 
                onClick={handleMatch} 
                disabled={!selectedBanco || !selectedSistema} 
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform duration-200 ${selectedBanco && selectedSistema ? 'bg-green-500 text-white cursor-pointer hover:scale-110 hover:bg-green-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'}`} 
                title="Conciliar Selecionados (Espaço)"
            >
                <FontAwesomeIcon icon={faLink} />
            </button>
           
           {aiMatches.length > 0 && (
             <button 
                onClick={handleConciliarTodos} 
                disabled={isAiLoading}
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform duration-200 animate-bounce-short bg-purple-600 text-white hover:bg-purple-700 hover:scale-110 border-2 border-purple-200`}
                title={`Conciliar TODOS os ${aiMatches.length} pares sugeridos`}
             >
                {isAiLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckDouble} />}
             </button>
           )}

           <div className="h-8 w-px bg-gray-300 my-2"></div>
           
           <button disabled={!selectedBanco} onClick={() => onCriarLancamento(selectedBanco)} className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all ${selectedBanco ? 'bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`} title="Criar Novo"><FontAwesomeIcon icon={faPlus} /></button>
        </div>

        {/* Direita: Sistema */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Sistema</h3>
                 <div className="flex gap-2 items-center">
                     <button onClick={handleAiAutoMatch} disabled={isAiLoading} className={`text-[10px] px-3 py-1 rounded-full border font-bold transition-all flex items-center gap-1 shadow-sm ${isAiLoading ? 'bg-gray-100 text-gray-400' : 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 border-purple-200 hover:scale-105'}`}>
                        {isAiLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faMagic} />} {isAiLoading ? '...' : 'IA Match'}
                     </button>
                     <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{processedSistema.length}</span>
                 </div>
             </div>
             <div className="grid grid-cols-[80px_1fr_100px] gap-2 px-2">
                <SortableHeader label="Data" sortKey="data" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} />
                <SortableHeader label="Descrição" sortKey="descricao" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} />
                <SortableHeader label="Valor" sortKey="valor" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} className="justify-end" />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
             {processedSistema.map(item => {
                 const matchIndex = aiMatches.findIndex(m => String(m.sistemaId) === String(item.id));
                 const matchData = aiMatches[matchIndex];
                 return (
                   <TransactionItem key={item.id} item={item} type="sistema" 
                      isSelected={selectedSistema?.id === item.id}
                      matchIndex={matchIndex !== -1 ? matchIndex : null}
                      isHoveredMatch={matchIndex !== -1 && hoveredMatchIndex === matchIndex}
                      onHoverMatch={(isHovering) => setHoveredMatchIndex(isHovering ? matchIndex : null)}
                      onRejectMatch={() => matchData && handleRejectAiMatch(matchData.extratoId, matchData.sistemaId)}
                      onClick={toggleSelectionSistema}
                      onEdit={onEditarLancamento}
                   />
                 );
             })}
          </div>
        </div>
      </div>
    </div>
  );
}
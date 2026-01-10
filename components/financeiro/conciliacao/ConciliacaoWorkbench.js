// components/financeiro/conciliacao/ConciliacaoWorkbench.js
"use client";

import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLink, faPlus, faSearch, faSort, faSortUp, faSortDown, faPen, faCheckCircle, faLock 
} from '@fortawesome/free-solid-svg-icons';
import { format, isValid, parseISO } from 'date-fns';

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "" }) => {
  const isActive = currentSort.key === sortKey;
  return (
    <div 
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer hover:bg-gray-100 p-2 rounded flex items-center gap-1 select-none transition-colors ${className}`}
    >
      <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
        {label}
      </span>
      <span className="text-gray-400 text-[10px]">
        {isActive ? (
            <FontAwesomeIcon icon={currentSort.direction === 'asc' ? faSortUp : faSortDown} />
        ) : (
            <FontAwesomeIcon icon={faSort} className="opacity-30" />
        )}
      </span>
    </div>
  );
};

const TransactionItem = ({ item, isSelected, onClick, type, onEdit }) => {
  const isCredit = type === 'banco' ? item.tipo === 'CREDIT' : item.tipo === 'Receita';
  const colorClass = isCredit ? 'text-green-600' : 'text-red-600';
  
  // Se estiver conciliado, muda o estilo totalmente (fica cinza e discreto)
  const isConciliado = item.conciliado;
  
  const bgClass = isSelected 
    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 z-10 relative' 
    : isConciliado 
      ? 'bg-gray-50 border-gray-100 opacity-60 hover:opacity-100' // Conciliado visual
      : 'bg-white hover:bg-gray-50 border-gray-100';

  let dataFormatada = '-';
  try {
      const dateObj = typeof item.data === 'string' ? parseISO(item.data) : item.data;
      if (isValid(dateObj)) dataFormatada = format(dateObj, 'dd/MM/yy');
      else dataFormatada = item.data || '-';
  } catch (e) { dataFormatada = '-'; }

  return (
    <div 
      onClick={() => onClick(item)}
      className={`group grid grid-cols-[80px_1fr_100px] gap-2 items-center p-2 rounded-lg border mb-1 cursor-pointer transition-all text-xs ${bgClass}`}
    >
      <div className="text-gray-500 font-mono text-[11px]">
        {dataFormatada}
      </div>

      <div className="flex items-center gap-2 overflow-hidden">
        {/* Ícone indicativo de conciliado */}
        {isConciliado && (
            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-[10px]" title="Já conciliado" />
        )}
        
        <span className={`truncate font-medium ${isConciliado ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-700'}`} title={item.descricao}>
            {item.descricao}
        </span>

        {type === 'sistema' && onEdit && (
            <button 
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-opacity"
                title="Editar lançamento"
            >
                <FontAwesomeIcon icon={faPen} size="xs" />
            </button>
        )}
      </div>

      <div className={`text-right font-bold ${isConciliado ? 'text-gray-400' : colorClass}`}>
        {Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </div>
    </div>
  );
};

export default function ConciliacaoWorkbench({ 
  extratoItems = [], 
  sistemaItems = [], 
  onConciliar, 
  onCriarLancamento,
  onEditarLancamento 
}) {
  const [selectedBanco, setSelectedBanco] = useState(null);
  const [selectedSistema, setSelectedSistema] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [bancoSort, setBancoSort] = useState({ key: 'data', direction: 'desc' });
  const [sistemaSort, setSistemaSort] = useState({ key: 'data', direction: 'desc' });

  const toggleSelectionBanco = (item) => {
    setSelectedBanco(prev => (prev?.id === item.id ? null : item));
  };

  const toggleSelectionSistema = (item) => {
    setSelectedSistema(prev => (prev?.id === item.id ? null : item));
  };

  const handleSort = (key, currentSort, setSort) => {
    setSort(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortList = (list, sortConfig) => {
    return [...list].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === 'descricao') {
          valA = valA?.toLowerCase() || '';
          valB = valB?.toLowerCase() || '';
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const processedExtrato = useMemo(() => {
    let filtered = extratoItems.filter(i => 
      !i.conciliado && 
      (i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || i.valor.toString().includes(searchTerm))
    );
    return sortList(filtered, bancoSort);
  }, [extratoItems, searchTerm, bancoSort]);

  // --- LÓGICA DE SEPARAÇÃO: PENDENTES NO TOPO, CONCILIADOS NO FUNDO ---
  const processedSistema = useMemo(() => {
    // 1. Filtra
    let filtered = sistemaItems.filter(i => 
      (i.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || i.valor.toString().includes(searchTerm))
    );

    // 2. Separa em grupos
    const pendentes = filtered.filter(i => !i.conciliado);
    const conciliados = filtered.filter(i => i.conciliado);

    // 3. Ordena CADA GRUPO separadamente (respeitando a escolha do usuário)
    const sortedPendentes = sortList(pendentes, sistemaSort);
    const sortedConciliados = sortList(conciliados, sistemaSort);

    // 4. Junta tudo, garantindo que Pendentes venham antes
    return [...sortedPendentes, ...sortedConciliados];

  }, [sistemaItems, searchTerm, sistemaSort]);

  const handleMatch = () => {
    if (selectedBanco && selectedSistema) {
      onConciliar(selectedBanco, selectedSistema);
      setSelectedBanco(null);
      setSelectedSistema(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[600px] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      
      {/* Toolbar */}
      <div className="bg-white p-3 border-b border-gray-200 flex justify-between items-center shadow-sm z-20">
        <div className="relative w-72">
           <input 
             type="text" 
             placeholder="Buscar valor ou descrição..." 
             className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-full transition-all"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
           <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-xs" />
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Esquerda: Banco */}
        <div className="flex-1 flex flex-col border-r border-gray-200 bg-white">
          <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                   <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                   Extrato Bancário
                 </h3>
                 <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{processedExtrato.length}</span>
             </div>
             
             <div className="grid grid-cols-[80px_1fr_100px] gap-2 px-2">
                <SortableHeader label="Data" sortKey="data" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} />
                <SortableHeader label="Descrição" sortKey="descricao" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} />
                <SortableHeader label="Valor" sortKey="valor" currentSort={bancoSort} onSort={(k) => handleSort(k, bancoSort, setBancoSort)} className="justify-end" />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
             {processedExtrato.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-gray-400">
                   <p className="text-xs italic">Nada encontrado</p>
               </div>
             ) : (
               processedExtrato.map(item => (
                 <TransactionItem 
                    key={item.id} 
                    item={item} 
                    type="banco" 
                    isSelected={selectedBanco?.id === item.id}
                    onClick={toggleSelectionBanco} 
                 />
               ))
             )}
          </div>
        </div>

        {/* Centro: Ações */}
        <div className="w-14 bg-gray-50 border-r border-gray-200 flex flex-col items-center justify-center gap-6 z-20 shadow-[0_0_15px_rgba(0,0,0,0.05)]">
           <button 
             onClick={handleMatch}
             disabled={!selectedBanco || !selectedSistema}
             className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all transform duration-200 ${selectedBanco && selectedSistema ? 'bg-green-500 text-white cursor-pointer hover:scale-110 hover:bg-green-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'}`}
             title="Conciliar Selecionados"
           >
             <FontAwesomeIcon icon={faLink} />
           </button>

           <div className="h-8 w-px bg-gray-300"></div>

           <button 
             disabled={!selectedBanco}
             onClick={() => onCriarLancamento(selectedBanco)}
             className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all transform duration-200 ${selectedBanco ? 'bg-white text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-100 hover:scale-110' : 'bg-gray-100 text-gray-300 border border-gray-200 cursor-not-allowed'}`}
             title="Criar Lançamento"
           >
             <FontAwesomeIcon icon={faPlus} />
           </button>
        </div>

        {/* Direita: Sistema */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                   <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                   Sistema (Studio 57)
                 </h3>
                 <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">{processedSistema.length}</span>
             </div>

             <div className="grid grid-cols-[80px_1fr_100px] gap-2 px-2">
                <SortableHeader label="Data" sortKey="data" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} />
                <SortableHeader label="Descrição" sortKey="descricao" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} />
                <SortableHeader label="Valor" sortKey="valor" currentSort={sistemaSort} onSort={(k) => handleSort(k, sistemaSort, setSistemaSort)} className="justify-end" />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
             {processedSistema.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-gray-400">
                   <p className="text-xs italic">Nada pendente</p>
               </div>
             ) : (
               <>
                 {/* LISTA UNIFICADA MAS ORDENADA (PENDENTES -> CONCILIADOS) */}
                 {processedSistema.map(item => (
                   <TransactionItem 
                      key={item.id} 
                      item={item} 
                      type="sistema" 
                      isSelected={selectedSistema?.id === item.id}
                      onClick={toggleSelectionSistema}
                      onEdit={onEditarLancamento}
                   />
                 ))}
                 
                 {/* SEPARADOR VISUAL SE HOUVER CONCILIADOS */}
                 {processedSistema.some(i => i.conciliado) && processedSistema.some(i => !i.conciliado) && (
                    <div className="py-2 flex items-center justify-center gap-2 opacity-50">
                        <div className="h-px bg-gray-300 w-12"></div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Itens já conciliados</span>
                        <div className="h-px bg-gray-300 w-12"></div>
                    </div>
                 )}
               </>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
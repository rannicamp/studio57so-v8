// components/bim/BimLinkActivityModal.js
'use client';

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faCalendarAlt, faTimes, faLink, 
    faChevronRight, faCube, faFilter 
} from '@fortawesome/free-solid-svg-icons';

export default function BimLinkActivityModal({ isOpen, onClose, activities, onLink, selectedCount }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

    // Lógica de Filtragem Inteligente
    const filteredActivities = useMemo(() => {
        return activities.filter(act => {
            // 1. Filtro de Texto (Nome)
            const matchText = act.nome.toLowerCase().includes(searchTerm.toLowerCase());

            // 2. Lógica de Datas (Real primeiro, senão Previsto)
            const startDate = act.data_inicio_real || act.data_inicio_prevista;
            const endDate = act.data_fim_real || act.data_fim_prevista;

            let matchDate = true;
            if (dateFilter.start && startDate) {
                matchDate = matchDate && (startDate >= dateFilter.start);
            }
            if (dateFilter.end && endDate) {
                matchDate = matchDate && (endDate <= dateFilter.end);
            }

            return matchText && matchDate;
        });
    }, [activities, searchTerm, dateFilter]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-gray-100 max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-gray-800 uppercase text-xs tracking-widest flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} className="text-blue-500" />
                            Vincular Atividade Existente
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                            {selectedCount} elementos selecionados no modelo
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                {/* Área de Filtros */}
                <div className="p-4 bg-white border-b space-y-3">
                    {/* Pesquisa */}
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input 
                            type="text"
                            placeholder="Buscar atividade pelo nome..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>

                    {/* Filtros de Data */}
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Início</label>
                            <input 
                                type="date"
                                value={dateFilter.start}
                                onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                                className="w-full p-2 bg-gray-50 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex-1 relative">
                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Fim</label>
                            <input 
                                type="date"
                                value={dateFilter.end}
                                onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                                className="w-full p-2 bg-gray-50 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button 
                            onClick={() => setDateFilter({start: '', end: ''})}
                            className="self-end p-2 text-gray-400 hover:text-blue-500 transition-colors"
                            title="Limpar Datas"
                        >
                            <FontAwesomeIcon icon={faFilter} className="text-sm" />
                        </button>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50/30">
                    {filteredActivities.length > 0 ? (
                        <div className="grid gap-2">
                            {filteredActivities.map(act => {
                                const displayStart = act.data_inicio_real || act.data_inicio_prevista;
                                const displayEnd = act.data_fim_real || act.data_fim_prevista;
                                const isReal = !!act.data_inicio_real;

                                return (
                                    <button 
                                        key={act.id} 
                                        onClick={() => onLink(act.id)}
                                        className="w-full text-left p-4 bg-white hover:bg-blue-50 rounded-xl border border-gray-100 hover:border-blue-200 shadow-sm transition-all group flex items-center justify-between"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="font-black text-gray-700 text-sm group-hover:text-blue-700">{act.nome}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${
                                                    act.status === 'Concluído' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {act.status}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                                                    <FontAwesomeIcon icon={faCalendarAlt} />
                                                    {displayStart ? new Date(displayStart).toLocaleDateString() : '--'} 
                                                    {isReal && <span className="text-blue-500 text-[8px]">(REAL)</span>}
                                                </span>
                                            </div>
                                        </div>
                                        <FontAwesomeIcon icon={faChevronRight} className="text-gray-300 group-hover:text-blue-400 transition-all" />
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-10 text-center flex flex-col items-center gap-3">
                            <FontAwesomeIcon icon={faCube} className="text-3xl text-gray-200" />
                            <p className="text-xs text-gray-400 font-bold uppercase italic">Nenhuma atividade encontrada com estes filtros.</p>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-gray-50 border-t text-[9px] text-gray-400 font-bold uppercase text-center tracking-tighter">
                    Clique na atividade para confirmar o vínculo 4D
                </div>
            </div>
        </div>
    );
}
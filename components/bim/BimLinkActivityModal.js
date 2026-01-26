// Caminho: components/bim/BimLinkActivityModal.js
'use client';

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faCalendarAlt, faTimes, faLink, 
    faChevronRight, faCube, faFilter 
} from '@fortawesome/free-solid-svg-icons';

export default function BimLinkActivityModal({ isOpen, onClose, activities, onLink, targetElement }) {
    const [searchTerm, setSearchTerm] = useState('');

    // Lógica de Filtragem Simples
    const filteredActivities = useMemo(() => {
        if (!activities) return [];
        return activities.filter(act => 
            act.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [activities, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} /> Vincular Elemento
                        </h3>
                        {targetElement && (
                            <p className="text-[10px] opacity-80 uppercase tracking-widest mt-1">
                                Para: {targetElement.elementName}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                {/* Busca */}
                <div className="p-3 border-b bg-gray-50 flex gap-2 shrink-0">
                    <div className="relative flex-1">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input 
                            type="text" 
                            placeholder="Buscar atividade..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2 bg-gray-50 custom-scrollbar">
                    {filteredActivities.length > 0 ? (
                        <div className="space-y-2">
                            {filteredActivities.map(act => (
                                <button 
                                    key={act.id}
                                    onClick={() => onLink(act)}
                                    className="w-full bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all text-left group flex justify-between items-center"
                                >
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-700 group-hover:text-blue-600">{act.nome}</h4>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                act.status === 'Concluído' ? 'bg-green-100 text-green-700' : 
                                                act.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {act.status}
                                            </span>
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <FontAwesomeIcon icon={faCalendarAlt} />
                                                {act.data_inicio_prevista ? new Date(act.data_inicio_prevista).toLocaleDateString() : 'S/D'}
                                            </span>
                                        </div>
                                    </div>
                                    <FontAwesomeIcon icon={faChevronRight} className="text-gray-300 group-hover:text-blue-500" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 text-center text-gray-400">
                            <p className="text-sm">Nenhuma atividade encontrada.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
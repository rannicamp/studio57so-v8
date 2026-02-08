'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faLink, faSearch, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BimLinkActivityModal({ 
    isOpen, 
    onClose, 
    activities = [], // Recebe a lista de atividades do page.js
    onLink, // Função que executa o vínculo
    targetElement, // O elemento que estamos vinculando { externalId, projetoBimId }
    selectedCount = 1 
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    // Filtra atividades pelo termo de busca
    const filteredActivities = activities.filter(act => 
        act.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirm = async () => {
        if (!selectedActivityId) {
            toast.warning("Selecione uma atividade para vincular.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Chama a função do pai (page.js) passando o ID da atividade escolhida
            await onLink(selectedActivityId);
            onClose();
        } catch (error) {
            console.error("Erro no modal:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        const s = String(status || '').toLowerCase();
        if (s.includes('concl')) return 'bg-green-100 text-green-700';
        if (s.includes('anda') || s.includes('inic')) return 'bg-blue-100 text-blue-700';
        if (s.includes('atra') || s.includes('bloq')) return 'bg-red-100 text-red-700';
        return 'bg-gray-100 text-gray-600';
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <FontAwesomeIcon icon={faLink} className="text-blue-600" />
                            Vincular Atividade
                        </h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                            {selectedCount > 1 
                                ? `Vinculando ${selectedCount} elementos selecionados` 
                                : `Elemento: ${targetElement?.elementName || targetElement?.externalId || '...'}`
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Busca */}
                <div className="p-3 border-b">
                    <div className="relative">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                        <input 
                            type="text" 
                            placeholder="Buscar atividade..." 
                            className="w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[200px]">
                    {filteredActivities.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs">
                            Nenhuma atividade encontrada.
                        </div>
                    ) : (
                        filteredActivities.map(act => (
                            <div 
                                key={act.id}
                                onClick={() => setSelectedActivityId(act.id)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    selectedActivityId === act.id 
                                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold text-gray-700 line-clamp-1">{act.nome}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${getStatusColor(act.status)}`}>
                                        {act.status || 'N/A'}
                                    </span>
                                </div>
                                <div className="mt-1 flex gap-2 text-[9px] text-gray-500">
                                    <span>Início: {act.data_inicio_prevista ? new Date(act.data_inicio_prevista).toLocaleDateString() : '-'}</span>
                                    <span>Fim: {act.data_fim_prevista ? new Date(act.data_fim_prevista).toLocaleDateString() : '-'}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!selectedActivityId || isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                    >
                        {isSubmitting ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                        {isSubmitting ? 'Salvando...' : 'Confirmar Vínculo'}
                    </button>
                </div>
            </div>
        </div>
    );
}
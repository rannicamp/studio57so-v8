'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faLayerGroup, faTasks, faCamera, 
    faStickyNote, faFilter 
} from '@fortawesome/free-solid-svg-icons';
import BimProperties from './BimProperties';
import BimElementPlanning from './BimElementPlanning';
import BimNotesList from './BimNotesList';
import BimFilterPanel from './BimFilterPanel'; // <--- Importando o novo componente

export default function BimInspector({ 
    elementExternalId, 
    selectedElements = [], 
    selectedCount = 0, 
    projetoBimId, 
    urnAutodesk, 
    onOpenLink,
    onOpenCreate,
    onOpenNote,
    onRestoreNote,
    viewer // <--- Precisamos receber o viewer aqui agora para passar pro filtro
}) {
    // Se não tiver nada selecionado, o padrão pode ser 'filter' ou 'notes'
    const [activeTab, setActiveTab] = useState(selectedCount > 0 ? 'properties' : 'filter');

    useEffect(() => {
        if (selectedCount > 0) {
            setActiveTab('properties');
        }
    }, [selectedCount]);

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 transition-all duration-300">
            
            {/* HEADER */}
            <div className="bg-white border-b shrink-0">
                <div className="flex items-center justify-center p-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                        {selectedCount > 1 ? `${selectedCount} SELECIONADOS` : (elementExternalId ? 'ELEMENTO SELECIONADO' : 'FERRAMENTAS BIM')}
                    </h3>
                </div>
                
                {/* Abas */}
                <div className="flex">
                    {/* Aba DADOS (Propriedades) */}
                    <button onClick={() => setActiveTab('properties')} disabled={selectedCount === 0} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'properties' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                        <FontAwesomeIcon icon={faLayerGroup} className="text-sm"/> Dados
                    </button>
                    
                    {/* Aba 4D (Planejamento) */}
                    <button onClick={() => setActiveTab('planning')} disabled={selectedCount !== 1} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'planning' ? 'border-orange-500 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed'}`}>
                        <FontAwesomeIcon icon={faTasks} className="text-sm"/> 4D
                    </button>

                    {/* NOVA ABA: FILTRO */}
                    <button onClick={() => setActiveTab('filter')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'filter' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faFilter} className="text-sm"/> Busca
                    </button>

                    {/* Aba NOTAS */}
                    <button onClick={() => setActiveTab('notes')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'notes' ? 'border-purple-600 text-purple-600 bg-purple-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faStickyNote} className="text-sm"/> Notas
                    </button>
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-hidden relative bg-gray-50/30 flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
                    {activeTab === 'properties' && selectedCount > 0 && (
                        <BimProperties 
                            selectedIds={selectedElements}
                            elementExternalId={elementExternalId} 
                            selectedCount={selectedCount}
                            projetoBimId={projetoBimId} 
                            urnAutodesk={urnAutodesk} 
                        />
                    )}

                    {activeTab === 'planning' && elementExternalId && (
                        <BimElementPlanning elementExternalId={elementExternalId} projetoBimId={projetoBimId} elementName={`ID: ${String(elementExternalId).substring(0, 8)}`} onOpenLink={onOpenLink} onOpenCreate={onOpenCreate} />
                    )}

                    {/* Renderização do Painel de Filtros */}
                    {activeTab === 'filter' && (
                        <BimFilterPanel viewer={viewer} projetoBimId={projetoBimId} />
                    )}

                    {activeTab === 'notes' && (
                        <BimNotesList onSelectNote={(note) => { 
                            if(onRestoreNote) onRestoreNote(note); 
                        }} />
                    )}
                </div>

                {/* FOOTER (Só aparece se tiver seleção para notas, ou se estiver na aba de notas) */}
                {activeTab !== 'filter' && (
                    <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                        <button 
                            onClick={() => onOpenNote({ externalId: elementExternalId, projetoBimId: projetoBimId })} 
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg text-xs font-bold shadow-md shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <FontAwesomeIcon icon={faCamera} /> {selectedCount > 0 ? 'Relatar Problema' : 'Criar Nota Geral'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
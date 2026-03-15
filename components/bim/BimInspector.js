'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faLayerGroup, faTasks, faCamera, 
    faStickyNote, faFilter, faListCheck, faChevronDown, faChevronRight 
} from '@fortawesome/free-solid-svg-icons';
import BimProperties from './BimProperties';
import BimElementPlanning from './BimElementPlanning';
import BimElementBudget from './BimElementBudget';
import BimNotesList from './BimNotesList';
import BimFilterPanel from './BimFilterPanel';

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
    viewer 
}) {
    // Se tiver itens selecionados, muda para properties ou mantém onde estava
    const [activeTab, setActiveTab] = useState('filter');
    const [expandedRowId, setExpandedRowId] = useState(null);

    // 1. Sanitização do ID (Single)
    const safeId = (typeof elementExternalId === 'object' && elementExternalId !== null)
        ? elementExternalId.externalId
        : elementExternalId;

    // 2. Resolve ID do Projeto
    const currentElementObj = selectedElements.find(el => (el.externalId || el) === safeId);
    const activeProjectId = currentElementObj?.projetoBimId && currentElementObj?.projetoBimId !== 'N/A' 
        ? currentElementObj.projetoBimId 
        : projetoBimId;

    // 3. Lista de IDs para Lote
    const selectedIdsOnly = selectedElements.map(el => el.externalId || el);

    useEffect(() => {
        if (selectedCount > 0) {
            // Se selecionar vários, vai para a aba 4D ou Lista, dependendo da sua preferência.
            // Aqui mantive a lógica padrão, mas você pode mudar para 'planning' se quiser forçar.
            if (activeTab === 'filter') setActiveTab('selection');
        }
    }, [selectedCount]);

    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl z-30 transition-all duration-300">
            
            {/* HEADER */}
            <div className="bg-white border-b shrink-0">
                <div className="flex items-center justify-center p-3 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest text-center">
                        {selectedCount > 1 ? `${selectedCount} SELECIONADOS` : (safeId ? 'ELEMENTO SELECIONADO' : 'FERRAMENTAS BIM')}
                    </h3>
                </div>
                
                {/* Abas */}
                <div className="flex overflow-x-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('selection')} disabled={selectedCount === 0} className={`min-w-[60px] flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'selection' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-400 hover:bg-gray-50 disabled:opacity-40'}`}>
                        <FontAwesomeIcon icon={faListCheck} className="text-sm"/> Lista
                    </button>

                    <button onClick={() => setActiveTab('properties')} disabled={selectedCount === 0} className={`min-w-[60px] flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'properties' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:bg-gray-50 disabled:opacity-40'}`}>
                        <FontAwesomeIcon icon={faLayerGroup} className="text-sm"/> Dados
                    </button>
                    
                    {/* MUDANÇA AQUI: disabled={selectedCount === 0} (Antes era !== 1) */}
                    <button onClick={() => setActiveTab('planning')} disabled={selectedCount === 0} className={`min-w-[60px] flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'planning' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-400 hover:bg-gray-50 disabled:opacity-40'}`}>
                        <FontAwesomeIcon icon={faTasks} className="text-sm"/> 4D
                    </button>

                    <button onClick={() => setActiveTab('filter')} className={`min-w-[60px] flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'filter' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faFilter} className="text-sm"/> Busca
                    </button>

                    <button onClick={() => setActiveTab('notes')} className={`min-w-[60px] flex-1 py-3 text-[10px] font-bold uppercase tracking-wide border-b-2 transition-all flex flex-col gap-1 items-center justify-center ${activeTab === 'notes' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-400 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faStickyNote} className="text-sm"/> Notas
                    </button>
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-hidden relative bg-gray-50/30 flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar h-full">
                    
                    {activeTab === 'selection' && selectedCount > 0 && (
                        <div className="p-2">
                            {/* Lista Expansível */}
                            <div className="space-y-1">
                                {selectedElements.map((item, idx) => {
                                    const displayId = item.externalId ? item.externalId : item;
                                    const displayFamilia = item.familia || 'Desconhecido';
                                    const displayTipo = item.tipo && item.tipo !== '-' ? item.tipo : '';
                                    const fullName = displayTipo ? `${displayFamilia} - ${displayTipo}` : displayFamilia;
                                    const isExpanded = expandedRowId === displayId;

                                    return (
                                        <div key={`${displayId}-${idx}`} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                                            <button 
                                                onClick={() => setExpandedRowId(isExpanded ? null : displayId)} 
                                                className="w-full text-left p-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                    <FontAwesomeIcon 
                                                        icon={isExpanded ? faChevronDown : faChevronRight} 
                                                        className="text-[10px] text-gray-400 shrink-0 w-3" 
                                                    />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-[10px] font-bold text-gray-700 truncate" title={fullName}>
                                                            {displayFamilia} {displayTipo && <span className="text-blue-600 font-medium">| {displayTipo}</span>}
                                                        </span>
                                                        <span className="font-mono text-[9px] text-gray-400 truncate mt-0.5" title={displayId}>
                                                            {displayId}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                            
                                            {/* Conteúdo Expansível (Materiais/Budget) */}
                                            {isExpanded && (
                                                <div className="border-t border-gray-100 bg-gray-50/50 p-1">
                                                    <BimElementBudget 
                                                        projetoBimId={activeProjectId} 
                                                        selectedIds={[displayId]} 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'properties' && selectedCount > 0 && (
                        <BimProperties 
                            viewer={viewer}
                            selectedIds={selectedIdsOnly} 
                            elementExternalId={safeId} 
                            selectedCount={selectedCount}
                            projetoBimId={activeProjectId} 
                            urnAutodesk={urnAutodesk} 
                            onOpenLink={onOpenLink}
                            onOpenCreate={onOpenCreate}
                            onOpenNote={onOpenNote}
                        />
                    )}

                    {/* MUDANÇA AQUI: Passamos a lista e o count para o componente 4D */}
                    {activeTab === 'planning' && selectedCount > 0 && (
                        <BimElementPlanning 
                            elementExternalId={safeId} // Fallback para single
                            selectedIds={selectedIdsOnly} // ARRAY DE IDS
                            selectedCount={selectedCount} // CONTAGEM
                            projetoBimId={activeProjectId} 
                            elementName={selectedCount > 1 ? `${selectedCount} Itens` : `ID: ${String(safeId).substring(0, 8)}`} 
                            onOpenLink={onOpenLink} 
                            onOpenCreate={onOpenCreate} 
                        />
                    )}

                    {activeTab === 'filter' && (
                        <BimFilterPanel viewer={viewer} projetoBimId={activeProjectId} />
                    )}

                    {activeTab === 'notes' && (
                        <BimNotesList onSelectNote={(note) => { 
                            if(onRestoreNote) onRestoreNote(note); 
                        }} />
                    )}
                </div>

                {activeTab !== 'filter' && activeTab !== 'selection' && activeTab !== 'planning' && (
                    <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                        <button 
                            onClick={() => onOpenNote({ externalId: safeId, projetoBimId: activeProjectId })} 
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
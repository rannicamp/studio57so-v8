'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { extrairDadosDoModelo } from '@/utils/bim/bim-extractor';
import Link from 'next/link';

// Componentes UI
import BimSidebar from '@/components/bim/BimSidebar';
import BimInspector from '@/components/bim/BimInspector';
import AutodeskViewerAPI from '@/components/bim/AutodeskViewerAPI';
import GanttChart from '@/components/atividades/GanttChart'; 
import BimLinkActivityModal from '@/components/bim/BimLinkActivityModal';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import BimNoteModal from '@/components/bim/BimNoteModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronLeft, faChevronRight, faHome, 
    faStream, faChevronDown, faLayerGroup, faSpinner 
} from '@fortawesome/free-solid-svg-icons';

// Hooks Personalizados
import { useBimViewer } from '@/hooks/bim/useBimViewer';
import { useBimModels } from '@/hooks/bim/useBimModels';
import { useBimNotes } from '@/hooks/bim/useBimNotes';
import { useBimEvolution } from '@/hooks/bim/useBimEvolution'; 

export default function BimManagerPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { organizacao_id, user } = useAuth();
  
    // 1. Hook do Visualizador (Core)
    const { 
        viewerInstance, setViewerInstance, 
        selectedElements, setSelectedElements, 
        fastSelectionCount, 
        activeFile, activeUrn, resolveSelection 
    } = useBimViewer();

    // 2. Hook de Evolução (Colorir Status)
    const { 
        isEvolutionMode, 
        isLoadingEvolution, 
        toggleEvolutionMode 
    } = useBimEvolution(viewerInstance, organizacao_id);

    // 3. Estados de Layout
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [isGanttOpen, setIsGanttOpen] = useState(false);
    const [isInspectorVisible, setIsInspectorVisible] = useState(true);

    // 4. Hook de Gerenciamento de Modelos
    const { 
        loadedFiles, selectedModels, 
        handleToggleModel, handleLoadSet, handleClearAll,
        loadedModelsRef 
    } = useBimModels(viewerInstance, setIsGanttOpen);

    // FIX: Garante que temos um arquivo ativo para passar o ID do projeto
    const fileInUse = activeFile || (loadedFiles.length > 0 ? loadedFiles[0] : null);

    // 5. Hook de Notas
    const {
        isNoteModalOpen, setIsNoteModalOpen,
        noteCaptureData, 
        handleOpenNoteCreation, 
        handleRestoreNote, 
        onNoteSuccess
    } = useBimNotes(viewerInstance, activeFile);

    // 6. Estados dos Modais de Atividades
    const [contextTarget, setContextTarget] = useState(null); 
    const [modalInitialData, setModalInitialData] = useState(null); 
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activityToEdit, setActivityToEdit] = useState(null);

    // --- QUERIES E DADOS ---

    // Busca todas as atividades da organização
    const { data: allActivities = [] } = useQuery({
        queryKey: ['bimActivities', organizacao_id],
        queryFn: async () => {
            if (!organizacao_id) return [];
            const { data } = await supabase
                .from('activities')
                .select('*')
                .eq('organizacao_id', organizacao_id)
                .order('data_inicio_prevista');
            return data || [];
        },
        enabled: !!organizacao_id
    });

    // Filtra atividades visíveis com base nos projetos carregados (para o Gantt)
    const visibleActivities = useMemo(() => {
        if (!loadedFiles || loadedFiles.length === 0) return [];
        
        const activeProjectIds = loadedFiles
            .map(f => f.empreendimento_id ? String(f.empreendimento_id) : null)
            .filter(Boolean);
            
        if (activeProjectIds.length === 0) return [];

        return allActivities
            .filter(act => act.empreendimento_id && activeProjectIds.includes(String(act.empreendimento_id)))
            .map(act => ({ 
                ...act, 
                start_date: act.data_inicio_prevista, 
                end_date: act.data_fim_prevista 
            }));
    }, [allActivities, loadedFiles]);

    // --- HANDLERS (Ações do Usuário) ---

    // Selecionar elementos no Viewer ao clicar no Gantt
    const handleActivitySelect = async (activity) => {
        if (!viewerInstance || !activity) return;

        // Busca quais elementos estão ligados a essa atividade na tabela de VÍNCULOS
        const { data: links } = await supabase
            .from('atividades_elementos')
            .select('external_id')
            .eq('atividade_id', activity.id);

        if (!links || links.length === 0) { 
            viewerInstance.clearSelection(); 
            return; 
        }

        const externalIdsToSelect = links.map(l => l.external_id);
        const allModels = viewerInstance.impl.modelQueue().getModels();
        const allDbIds = [];

        // Converte ExternalID -> DbID em todos os modelos
        await Promise.all(allModels.map(m => new Promise(resolve => {
            m.getExternalIdMapping(map => {
                externalIdsToSelect.forEach(eid => { 
                    if(map[eid]) { 
                        viewerInstance.select(map[eid], m); 
                        allDbIds.push(map[eid]); 
                    } 
                });
                resolve();
            });
        })));

        if (allDbIds.length > 0) { 
            viewerInstance.fitToView(allDbIds); 
            toast.info(`${allDbIds.length} elementos vinculados.`); 
        }
    };

    // ABRIR MODAL DE VÍNCULO (Com suporte a múltiplos itens)
    const handleOpenLink = (targetData) => {
        resolveSelection(targetData, (ids) => {
            setContextTarget({ 
                ...targetData, 
                externalIds: ids 
            });
            setIsLinkModalOpen(true);
        });
    };

    // ABRIR MODAL DE CRIAÇÃO (CORRIGIDO PARA EVITAR ERRO DE SCHEMA)
    const handleOpenCreate = (targetData) => {
        resolveSelection(targetData, (ids) => { 
            // 1. Guardamos os dados BIM aqui no contexto (não mandamos pro modal poluir)
            setContextTarget({
                ...targetData,
                ids_para_vincular: ids // Lista de IDs para usar DEPOIS de criar
            }); 
            
            // 2. Preparamos dados LIMPOS para o Modal de Atividade
            // removemos projeto_bim_id e elementos_bim daqui para não quebrar o insert
            setModalInitialData({ 
                nome: targetData.elementName ? `Instalação ${targetData.elementName}` : '', 
                empreendimento_id: activeFile?.empreendimento_id 
            }); 
            
            setIsCreateModalOpen(true); 
        });
    };

    // EXECUTAR VÍNCULO (Apenas Link)
    const executeLink = async (activityId) => {
        if (!contextTarget || !activityId) {
            toast.error("Dados incompletos para vínculo.");
            return;
        }

        const ids = contextTarget.externalIds || [contextTarget.externalId];
        
        const rows = ids.map(id => ({ 
            organizacao_id: organizacao_id || user?.user_metadata?.organizacao_id, 
            atividade_id: activityId, 
            projeto_bim_id: contextTarget.projetoBimId, 
            external_id: String(id) 
        }));

        const { error } = await supabase
            .from('atividades_elementos')
            .upsert(rows, { onConflict: 'atividade_id, projeto_bim_id, external_id' });

        if (!error) { 
            toast.success("Atividade vinculada com sucesso!"); 
            setIsLinkModalOpen(false); 
            setContextTarget(null); 
            queryClient.invalidateQueries(['bimElementLinks']); 
            queryClient.invalidateQueries(['bimActivities']);
        } else {
            console.error(error);
            toast.error("Erro ao salvar vínculo.");
        }
    };

    // CALLBACK APÓS CRIAR NOVA ATIVIDADE (CORRIGIDO: VINCULA APÓS CRIAR)
    // O AtividadeModal precisa chamar onSuccess(novaAtividade)
    const executeCreate = async (novaAtividade) => { 
        setIsCreateModalOpen(false); 
        
        // Verifica se o modal retornou a atividade e se temos itens para vincular
        if (novaAtividade?.id && contextTarget?.ids_para_vincular) {
            try {
                const rows = contextTarget.ids_para_vincular.map(id => ({ 
                    organizacao_id: organizacao_id || user?.user_metadata?.organizacao_id, 
                    atividade_id: novaAtividade.id, 
                    projeto_bim_id: contextTarget.projetoBimId, 
                    external_id: String(id) 
                }));

                const { error } = await supabase
                    .from('atividades_elementos') // TABELA CERTA DE VINCULOS
                    .insert(rows);

                if (error) throw error;
                
                toast.success("Atividade criada e vinculada automaticamente!");
            } catch (err) {
                console.error("Erro ao vincular após criar:", err);
                toast.warning("Atividade criada, mas houve erro ao vincular elementos.");
            }
        } else {
            // Se o modal não retornar o objeto, apenas fecha
            if (contextTarget) toast.success("Atividade criada.");
        }

        setActivityToEdit(null); 
        setModalInitialData(null); 
        setContextTarget(null);
        queryClient.invalidateQueries(['bimActivities']);
        queryClient.invalidateQueries(['bimElementLinks']); // Atualiza painel lateral
    };

    // Sincronizar propriedades
    const handleSelectContext = useCallback(async (ctx) => {
        if (ctx.type === 'sync' && viewerInstance) {
            const urnClean = ctx.file.urn_autodesk.replace(/^urn:/, '');
            const m = loadedModelsRef.current[urnClean];
            
            if(m) { 
                toast.promise(
                    extrairDadosDoModelo(m, ctx.file.id, organizacao_id),
                    {
                        loading: 'Extraindo dados...',
                        success: 'Sincronizado!',
                        error: 'Erro na extração.'
                    }
                );
                setTimeout(() => queryClient.invalidateQueries(['bimElementProperties']), 2000);
            } else {
                toast.error("Modelo não carregado.");
            }
        }
    }, [viewerInstance, organizacao_id, queryClient, loadedModelsRef]);

    // --- RENDERIZAÇÃO ---

    return (
        <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col font-sans">
            <div className="flex flex-1 overflow-hidden relative">
                
                {/* BARRA LATERAL ESQUERDA */}
                <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
                    <BimSidebar 
                        onFileSelect={(f) => { 
                            const clean = f.urn_autodesk.replace(/^urn:/, ''); 
                            if(!selectedModels.includes(clean)) handleToggleModel(f); 
                        }} 
                        onToggleModel={handleToggleModel} 
                        onSelectContext={handleSelectContext} 
                        selectedModels={selectedModels} 
                        activeUrn={activeUrn} 
                        onLoadSet={handleLoadSet} 
                        onClearAll={handleClearAll} 
                    />
                </div>

                {/* ÁREA PRINCIPAL */}
                <main className="flex-1 h-full relative flex min-w-0 bg-white">
                    <div className="flex-1 relative h-full w-full flex flex-col min-w-0">
                        
                        {/* Botões Superiores */}
                        <div className="absolute top-4 left-4 z-[60] flex gap-2">
                            <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all">
                                <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} />
                            </button>
                            <Link href="/painel" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Voltar ao Painel">
                                <FontAwesomeIcon icon={faHome} />
                            </Link>
                            
                            <button 
                                onClick={toggleEvolutionMode} 
                                disabled={isLoadingEvolution || !viewerInstance}
                                className={`bg-white/90 p-2 rounded-lg shadow-sm border transition-all flex items-center gap-2 ${isEvolutionMode ? 'text-green-600 border-green-300 ring-1 ring-green-100 bg-green-50' : 'text-gray-600 hover:text-green-600'}`}
                            >
                                {isLoadingEvolution ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLayerGroup} />}
                                {isEvolutionMode && <span className="text-[10px] font-bold uppercase hidden md:inline">Evolução</span>}
                            </button>

                            <button onClick={() => setIsGanttOpen(!isGanttOpen)} className={`bg-white/90 p-2 rounded-lg shadow-sm border transition-all flex items-center gap-2 ${isGanttOpen ? 'text-blue-600 border-blue-300 ring-1' : ''}`}>
                                <FontAwesomeIcon icon={faStream} /> 
                                {visibleActivities.length > 0 && !isGanttOpen && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full font-bold ml-1">{visibleActivities.length}</span>}
                            </button>
                        </div>

                        <div className="absolute top-4 right-4 z-[60]">
                            <button onClick={() => setIsInspectorVisible(!isInspectorVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white transition-all hover:text-purple-600">
                                <FontAwesomeIcon icon={isInspectorVisible ? faChevronRight : faChevronLeft} />
                            </button>
                        </div>

                        {/* VISUALIZADOR 3D */}
                        <div className="flex-1 w-full relative">
                            <AutodeskViewerAPI urn={null} onViewerReady={setViewerInstance} />
                        </div>

                        {/* PAINEL GANTT */}
                        <div className={`absolute bottom-0 left-0 right-0 z-[50] bg-white border-t border-gray-200 shadow-[0_-5px_30px_rgba(0,0,0,0.15)] transition-all duration-500 ease-in-out flex flex-col`} style={{ height: isGanttOpen ? '45%' : '0px' }}>
                            <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50 shrink-0">
                                <div className="flex items-center gap-2"><FontAwesomeIcon icon={faStream} className="text-blue-600 text-xs" /><span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cronograma ({visibleActivities.length} atv.)</span></div>
                                <button onClick={() => setIsGanttOpen(false)} className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faChevronDown} /></button>
                            </div>
                            <div className="flex-1 overflow-hidden relative bg-white p-2">
                                {visibleActivities.length > 0 ? (
                                    <div className="h-full overflow-auto custom-scrollbar">
                                        <GanttChart activities={visibleActivities} onEditActivity={handleActivitySelect} />
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2"><p className="text-sm">Nenhuma atividade.</p></div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* INSPECTOR */}
                    <div className={`${isInspectorVisible ? 'w-80 border-l' : 'w-0 border-none'} bg-white transition-all duration-300 flex flex-col overflow-hidden shrink-0 z-20 shadow-xl`}>
                        <BimInspector 
                            viewer={viewerInstance} 
                            elementExternalId={selectedElements[0]} 
                            selectedElements={selectedElements}     
                            selectedCount={fastSelectionCount} 
                            projetoBimId={fileInUse?.id} 
                            urnAutodesk={activeUrn || fileInUse?.urn_autodesk} 
                            onOpenLink={handleOpenLink} 
                            onOpenCreate={handleOpenCreate} 
                            onOpenNote={handleOpenNoteCreation} 
                            onRestoreNote={handleRestoreNote} 
                        />
                    </div>
                </main>
            </div>

            {/* MODAIS */}
            <BimLinkActivityModal 
                isOpen={isLinkModalOpen} 
                onClose={() => setIsLinkModalOpen(false)} 
                activities={allActivities} 
                onLink={executeLink} 
                targetElement={contextTarget} 
                selectedCount={contextTarget?.externalIds?.length || 1} 
            />
            
            {isCreateModalOpen && (
                <AtividadeModal 
                    isOpen={isCreateModalOpen} 
                    onClose={() => { setIsCreateModalOpen(false); setActivityToEdit(null); }} 
                    onSuccess={executeCreate} // IMPORTANTE: AtividadeModal deve retornar o objeto criado aqui
                    initialData={modalInitialData} 
                    activityToEdit={activityToEdit} 
                />
            )}
            
            <BimNoteModal 
                isOpen={isNoteModalOpen} 
                onClose={() => setIsNoteModalOpen(false)} 
                captureData={noteCaptureData} 
                activities={visibleActivities || []} 
                onSuccess={onNoteSuccess} 
            />
        </div>
    );
}
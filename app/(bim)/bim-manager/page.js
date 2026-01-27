// Caminho: app/(bim)/bim-manager/page.js
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
import { faChevronLeft, faChevronRight, faHome, faStream, faChevronDown } from '@fortawesome/free-solid-svg-icons';

// Hooks Personalizados
import { useBimViewer } from '@/hooks/bim/useBimViewer';
import { useBimModels } from '@/hooks/bim/useBimModels';
import { useBimNotes } from '@/hooks/bim/useBimNotes';

export default function BimManagerPage() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id } = useAuth();
  
  // 1. Hook do Viewer (Base)
  const { 
    viewerInstance, setViewerInstance, 
    selectedElements, setSelectedElements, 
    activeFile, activeUrn, resolveSelection 
  } = useBimViewer();

  // 2. UI States
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isGanttOpen, setIsGanttOpen] = useState(false);

  // 3. Hook de Modelos
  const { 
      loadedFiles, selectedModels, 
      handleToggleModel, handleLoadSet, loadedModelsRef 
  } = useBimModels(viewerInstance, setIsGanttOpen);

  // 4. Hook de Notas
  const {
      isNoteModalOpen, setIsNoteModalOpen,
      noteCaptureData, 
      handleOpenNoteCreation, 
      handleRestoreNote, // <--- Aqui ele recebe a função do Hook
      onNoteSuccess
  } = useBimNotes(viewerInstance, activeFile);

  // 5. Lógica de Atividades
  const [contextTarget, setContextTarget] = useState(null); 
  const [modalInitialData, setModalInitialData] = useState(null); 
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState(null);

  const { data: allActivities = [] } = useQuery({
    queryKey: ['bimActivities', organizacao_id],
    queryFn: async () => {
      if (!organizacao_id) return [];
      const { data } = await supabase.from('activities').select('*').eq('organizacao_id', organizacao_id).order('data_inicio_prevista');
      return data || [];
    },
    enabled: !!organizacao_id
  });

  const visibleActivities = useMemo(() => {
    if (loadedFiles.length === 0) return [];
    const activeProjectIds = loadedFiles.map(f => f.empreendimento_id ? String(f.empreendimento_id) : null).filter(Boolean);
    if (activeProjectIds.length === 0) return [];
    return allActivities.filter(act => act.empreendimento_id && activeProjectIds.includes(String(act.empreendimento_id)))
        .map(act => ({ ...act, start_date: act.data_inicio_prevista, end_date: act.data_fim_prevista }));
  }, [allActivities, loadedFiles]);

  const handleActivitySelect = async (activity) => {
      if (!viewerInstance || !activity) return;
      const { data: links } = await supabase.from('atividades_elementos').select('external_id').eq('atividade_id', activity.id);
      if (!links || links.length === 0) { viewerInstance.clearSelection(); return; }
      
      const externalIdsToSelect = links.map(l => l.external_id);
      const allModels = viewerInstance.impl.modelQueue().getModels();
      const allDbIds = [];

      await Promise.all(allModels.map(m => new Promise(r => m.getExternalIdMapping(map => {
          externalIdsToSelect.forEach(eid => { if(map[eid]) { viewerInstance.select(map[eid], m); allDbIds.push(map[eid]); } });
          r();
      }))));

      if (allDbIds.length > 0) { viewerInstance.fitToView(allDbIds); toast.info(`${allDbIds.length} vinculados.`); }
      else toast.warning("Elementos não encontrados.");
  };

  const handleOpenLink = (targetData) => resolveSelection(targetData, (ids) => { setContextTarget({ ...targetData, externalIds: ids }); setIsLinkModalOpen(true); });
  const handleOpenCreate = (targetData) => resolveSelection(targetData, (ids) => { 
      setContextTarget(targetData); 
      setModalInitialData({ nome: targetData.elementName ? `Instalação ${targetData.elementName}` : '', projeto_bim_id: targetData.projetoBimId, elementos_bim: ids, empreendimento_id: activeFile?.empreendimento_id }); 
      setIsCreateModalOpen(true); 
  });

  const executeLink = async (activity) => {
      const ids = contextTarget.externalIds || [contextTarget.externalId];
      const rows = ids.map(id => ({ organizacao_id, atividade_id: activity.id, projeto_bim_id: contextTarget.projetoBimId, external_id: String(id) }));
      const { error } = await supabase.from('atividades_elementos').insert(rows);
      if (!error || error.code === '23505') { toast.success("Vinculado!"); setIsLinkModalOpen(false); setContextTarget(null); queryClient.invalidateQueries(['bimElementLinks']); }
      else toast.error(error.message);
  };

  const executeCreate = () => { setIsCreateModalOpen(false); setActivityToEdit(null); setModalInitialData(null); };

  const handleSelectContext = useCallback(async (ctx) => {
      if (ctx.type === 'sync' && viewerInstance) {
          const m = loadedModelsRef.current[ctx.file.urn_autodesk.replace(/^urn:/, '')];
          if(m) { await extrairDadosDoModelo(m, ctx.file.id, organizacao_id); toast.success("Sincronizado!"); queryClient.invalidateQueries(['bimElementProperties']); }
      }
  }, [viewerInstance, organizacao_id, queryClient, loadedModelsRef]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50 flex-col font-sans">
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`${isSidebarVisible ? 'w-80' : 'w-0'} transition-all duration-300 border-r bg-white z-20 shrink-0 overflow-hidden`}>
            <BimSidebar 
                onFileSelect={(f) => { const clean = f.urn_autodesk.replace(/^urn:/, ''); if(!selectedModels.includes(clean)) handleToggleModel(f); }} 
                onToggleModel={handleToggleModel}
                onSelectContext={handleSelectContext}
                selectedModels={selectedModels}
                activeUrn={activeUrn} 
                onLoadSet={handleLoadSet} 
            />
        </div>

        <main className="flex-1 h-full relative flex min-w-0 bg-white">
            <div className="flex-1 relative h-full w-full flex flex-col">
                <div className="absolute top-4 left-4 z-[60] flex gap-2">
                    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white"><FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} /></button>
                    <Link href="/dashboard" className="bg-white/90 p-2 rounded-lg shadow-sm border text-gray-600 hover:bg-white"><FontAwesomeIcon icon={faHome} /></Link>
                    <button onClick={() => setIsGanttOpen(!isGanttOpen)} className={`bg-white/90 p-2 rounded-lg shadow-sm border ${isGanttOpen ? 'text-blue-600 border-blue-300' : ''}`}>
                        <FontAwesomeIcon icon={faStream} /> {visibleActivities.length > 0 && !isGanttOpen && <span className="bg-blue-600 text-white text-[10px] px-1.5 rounded-full font-bold ml-1">{visibleActivities.length}</span>}
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <AutodeskViewerAPI urn={null} onViewerReady={setViewerInstance} />
                </div>

                <div className={`absolute bottom-0 left-0 right-0 z-[50] bg-white border-t border-gray-200 shadow-[0_-5px_30px_rgba(0,0,0,0.15)] transition-all duration-500 ease-in-out flex flex-col`} style={{ height: isGanttOpen ? '45%' : '0px' }}>
                    <div className="h-10 border-b flex items-center justify-between px-4 bg-gray-50 shrink-0">
                        <div className="flex items-center gap-2"><FontAwesomeIcon icon={faStream} className="text-blue-600 text-xs" /><span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Cronograma ({visibleActivities.length} atv.)</span></div>
                        <button onClick={() => setIsGanttOpen(false)} className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faChevronDown} /></button>
                    </div>
                    <div className="flex-1 overflow-hidden relative bg-white p-2">
                        {visibleActivities.length > 0 ? <div className="h-full overflow-auto custom-scrollbar"><GanttChart activities={visibleActivities} onEditActivity={handleActivitySelect} /></div> : <div className="h-full flex flex-col items-center justify-center text-gray-400"><p className="text-sm">Nenhuma atividade.</p></div>}
                    </div>
                </div>
            </div>

            {selectedElements.length > 0 && (
                <BimInspector 
                    elementExternalId={selectedElements[0]} 
                    projetoBimId={activeFile?.id} 
                    urnAutodesk={activeUrn} 
                    onClose={() => setSelectedElements([])}
                    onOpenLink={handleOpenLink}
                    onOpenCreate={handleOpenCreate}
                    onOpenNote={handleOpenNoteCreation}
                    onRestoreNote={handleRestoreNote} // <--- Passando a função para o Inspector
                />
            )}
        </main>
      </div>

      <BimLinkActivityModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} activities={allActivities} onLink={executeLink} targetElement={contextTarget} selectedCount={contextTarget?.externalIds?.length || 1} />
      {isCreateModalOpen && <AtividadeModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setActivityToEdit(null); }} onSuccess={executeCreate} initialData={modalInitialData} activityToEdit={activityToEdit} />}
      <BimNoteModal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} captureData={noteCaptureData} activities={visibleActivities} onSuccess={onNoteSuccess} />
    </div>
  );
}
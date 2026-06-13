'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import GanttChart from '@/components/atividades/GanttChart'; import BimLinkActivityModal from '@/components/bim/BimLinkActivityModal';
import AtividadeModal from '@/components/atividades/AtividadeModal';
import BimNoteModal from '@/components/bim/BimNoteModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight, faHome, faStream, faChevronDown, faLayerGroup, faSpinner, faFileInvoiceDollar, faPenNib, faEraser
} from '@fortawesome/free-solid-svg-icons';
import BimQuantitativosOverlay from '@/components/bim/BimQuantitativosOverlay';
import BimMarkupToolbar from '@/components/bim/BimMarkupToolbar';

// Hooks Personalizados
import { useBimViewer } from '@/hooks/bim/useBimViewer';
import { useBimModels } from '@/hooks/bim/useBimModels';
import { useBimNotes } from '@/hooks/bim/useBimNotes';
import { useBimEvolution } from '@/hooks/bim/useBimEvolution';
import { useBimMarkup } from '@/hooks/bim/useBimMarkup';

export default function BimManagerPage() {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { organizacao_id, user } = useAuth();
 // 1. Hook do Visualizador (Core)
 const { viewerInstance, setViewerInstance, selectedElements, setSelectedElements, fastSelectionCount, activeFile, activeUrn, resolveSelection } = useBimViewer();

 // 2. Hook de Evolução (Colorir Status)
 const { isEvolutionMode, isLoadingEvolution, toggleEvolutionMode } = useBimEvolution(viewerInstance, organizacao_id);

 // 2.5 Hook de Marcação e Desenho no Modelo 3D (Markup)
 const { isMarkupActive, activeTool, setMarkupTool, enterMarkupMode, leaveMarkupMode, undo, clearMarkups, generateMarkupData, showSavedMarkup, hideMarkups
 } = useBimMarkup(viewerInstance);

 // 2.6 Wrapper para restaurar notas (Padrão + Markup SVG)
 const handleRestoreNoteWrapper = (note) => {
 // 1. Restaura visualização padrão (Câmera + Seleção)
 handleRestoreNote(note);
 // 2. Restaura o desenho por cima (Markup) se existir
 if (note.markup_svg) {
 showSavedMarkup(note.markup_svg);
 } else {
 hideMarkups(); // Limpa a tela caso a nota anterior tivesse desenho
 }
 };

 // 3. Estados de Layout
 const [isSidebarVisible, setIsSidebarVisible] = useState(true);
 const [isGanttOpen, setIsGanttOpen] = useState(false);
 const [isInspectorVisible, setIsInspectorVisible] = useState(true);
 const [isQuantitativosOpen, setIsQuantitativosOpen] = useState(false);
 const [activeMainTab, setActiveMainTab] = useState('viewer'); // 'viewer' | 'orcamento'

 // 4. Hook de Gerenciamento de Modelos
 const { loadedFiles, selectedModels, handleToggleModel, handleLoadSet, handleClearAll,
 loadedModelsRef } = useBimModels(viewerInstance, setIsGanttOpen);

 // FIX: Garante que temos um arquivo ativo para passar o ID do projeto
 const fileInUse = activeFile || (loadedFiles.length > 0 ? loadedFiles[0] : null);

 // 5. Hook de Notas
 const {
 isNoteModalOpen, setIsNoteModalOpen,
 noteCaptureData, handleOpenNoteCreation, handleOpenMarkupNoteCreation,
 handleRestoreNote, onNoteSuccess
 } = useBimNotes(viewerInstance, activeFile);

 // 6. Estados dos Modais de Atividades
 const [contextTarget, setContextTarget] = useState(null); const [modalInitialData, setModalInitialData] = useState(null); const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [activityToEdit, setActivityToEdit] = useState(null);

 // Estados de Vistas e Pranchas 2D (BIM 2.0)
 const [isVistasDropdownOpen, setIsVistasDropdownOpen] = useState(false);
 const [vistaAtiva, setVistaAtiva] = useState(null);
 const vistasDropdownRef = useRef(null);

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

 // ─── BIM 2.0: PRANCHAS 2D E VISTAS ───
 const { data: vistas = [] } = useQuery({
  queryKey: ['projetos_bim_vistas', fileInUse?.id],
  queryFn: async () => {
    if (!fileInUse?.id) return [];
    const { data, error } = await supabase
      .from('projetos_bim_vistas')
      .select('*')
      .eq('projeto_bim_id', fileInUse.id)
      .order('tipo', { ascending: false }) // 3D primeiro, depois 2D
      .order('nome');
    if (error) console.error('[BIM Vistas] Erro ao carregar:', error);
    return data || [];
  },
  enabled: !!fileInUse?.id,
 });

 const handleSelectVista = useCallback(async (vista) => {
  if (!viewerInstance || !fileInUse) return;
  
  const rawUrn = fileInUse.urn_autodesk.replace(/^urn:/, '');
  const fullUrn = `urn:${rawUrn}`;
  const toastId = toast.loading(`Carregando vista: ${vista.nome}...`);

  window.Autodesk.Viewing.Document.load(fullUrn, (doc) => {
    const node = doc.getRoot().search({ 'guid': vista.guid })[0];
    if (node) {
      // Descarrega os modelos atuais e carrega apenas a prancha 2D/vista
      const models = viewerInstance.impl.modelQueue().getModels();
      models.forEach(m => viewerInstance.impl.unloadModel(m));
      
      viewerInstance.loadDocumentNode(doc, node).then(() => {
        toast.success(`Vista ${vista.nome} carregada!`, { id: toastId });
        viewerInstance.fitToView();
      }).catch(err => {
        toast.error("Erro ao abrir vista no visualizador.", { id: toastId });
        console.error(err);
      });
    } else {
      toast.error("Vista não encontrada no modelo.", { id: toastId });
    }
  }, (err) => {
    toast.error("Falha ao carregar documento da Autodesk.", { id: toastId });
    console.error(err);
  });
 }, [viewerInstance, fileInUse]);

 const handleVoltar3D = useCallback(() => {
  if (!viewerInstance || !fileInUse) return;
  // Limpa a seleção e recarrega o modelo no estado inicial do 3D geral
  handleClearAll();
  handleToggleModel(fileInUse);
 }, [viewerInstance, fileInUse, handleClearAll, handleToggleModel]);

 // Fecha o dropdown ao clicar fora
 useEffect(() => {
  const clickOutside = (e) => {
    if (vistasDropdownRef.current && !vistasDropdownRef.current.contains(e.target)) {
      setIsVistasDropdownOpen(false);
    }
  };
  document.addEventListener('mousedown', clickOutside);
  return () => document.removeEventListener('mousedown', clickOutside);
 }, []);

 // Filtra atividades visíveis com base nos projetos carregados (para o Gantt)
 const visibleActivities = useMemo(() => {
 if (!loadedFiles || loadedFiles.length === 0) return [];
 const activeProjectIds = loadedFiles
 .map(f => f.empreendimento_id ? String(f.empreendimento_id) : null)
 .filter(Boolean);
 if (activeProjectIds.length === 0) return [];

 return allActivities
 .filter(act => act.empreendimento_id && activeProjectIds.includes(String(act.empreendimento_id)))
 .map(act => ({ ...act, start_date: act.data_inicio_prevista, end_date: act.data_fim_prevista }));
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
      selectExternalIdsInViewer([]);
      return;
    }

    const externalIdsToSelect = links.map(l => l.external_id);
    await selectExternalIdsInViewer(externalIdsToSelect, `elementos vinculados selecionados.`);
  };

  // Tratar comando de seleção vindo do Quantitativos Overlay
  const handleShowQuantitativos = (externalIds, label, modelos) => {
    setActiveMainTab('viewer');
    if (modelos && modelos.length > 0) {
      const loadedIds = loadedFiles.map(f => f.id);
      const missingModels = modelos.filter(m => !loadedIds.includes(m.id));
      if (missingModels.length > 0) {
        toast.info('Modelos vinculados não estão carregados, realizando auto-load...');
        handleLoadSet(modelos);
        // Manda pro localStorage pra rodar no auto-load effect
        localStorage.setItem('bimSelectionPending', JSON.stringify({
          externalIds, notify: label || 'elementos destacados no modelo.', modelos
        }));
        return;
      }
    }
    selectExternalIdsInViewer(externalIds, label);
  };

  // Função genérica para selecionar external_ids no viewer com isolamento inteligente e ghosting
  const selectExternalIdsInViewer = async (externalIdsList, successMessage = 'elementos selecionados.') => {
    if (!viewerInstance) return;

    const allModels = viewerInstance.impl.modelQueue().getModels();
    if (allModels.length === 0) return;

    // Ativa o ghosting globalmente para o visualizador
    viewerInstance.setGhosting(true);

    if (!externalIdsList || externalIdsList.length === 0) {
      // Se não há seleção, restaura tudo (exibe todos os modelos e remove isolamento)
      allModels.forEach(m => {
        viewerInstance.showModel(m.id);
        viewerInstance.isolate(null, m);
      });
      viewerInstance.clearSelection();
      return;
    }

    let totalSelecionados = 0;
    const aggregateDocs = [];

    // Converte ExternalID -> DbID em todos os modelos e agrupa
    await Promise.all(allModels.map(m => new Promise(resolve => {
      m.getExternalIdMapping(map => {
        const dbIdsInThisModel = [];
        externalIdsList.forEach(eid => { 
          if(map[eid]) { 
            dbIdsInThisModel.push(map[eid]); 
            totalSelecionados++;
          } 
        });
        if (dbIdsInThisModel.length > 0) {
          aggregateDocs.push({ id: m.id, model: m, ids: dbIdsInThisModel, selection: dbIdsInThisModel });
        }
        resolve();
      });
    })));

    if (aggregateDocs.length > 0) { 
      viewerInstance.clearSelection();
      
      // Identifica o empreendimento alvo da seleção
      const targetEmpreendimentoIds = [...new Set(
        aggregateDocs
          .map(doc => doc.model?.studio57_context?.empreendimento_id)
          .filter(Boolean)
          .map(String)
      )];

      // Itera sobre todos os modelos para aplicar isolamento ou ocultação
      allModels.forEach(m => {
        const modelEmpId = m.studio57_context?.empreendimento_id ? String(m.studio57_context.empreendimento_id) : null;
        
        // Se pertencer ao mesmo empreendimento dos elementos selecionados
        if (modelEmpId && targetEmpreendimentoIds.includes(modelEmpId)) {
          viewerInstance.showModel(m.id); // Garante que esteja visível
          
          const docForModel = aggregateDocs.find(doc => doc.id === m.id);
          if (docForModel) {
            // Se tem elementos selecionados nesse modelo, isola-os
            viewerInstance.isolate(docForModel.ids, m);
          } else {
            // Se não tem elementos selecionados mas é do mesmo empreendimento, deixa em ghosting
            viewerInstance.isolate([0], m); // Isola ID inexistente para forçar o ghost completo no modelo
          }
        } else {
          // Se for de outro empreendimento, oculta completamente
          viewerInstance.hideModel(m.id);
        }
      });

      // Suporte para Múltiplas Seleções em Multiplos Modelos
      if (viewerInstance.setAggregateSelection) {
        viewerInstance.setAggregateSelection(aggregateDocs);
      } else {
        aggregateDocs.forEach(doc => viewerInstance.select(doc.ids, doc.model));
      }

      // Centraliza a câmera no primeiro pacote de elementos
      try {
        viewerInstance.fitToView(aggregateDocs[0].ids, aggregateDocs[0].model);
      } catch (e) {
        console.warn("Aviso ao focar visualizador", e);
      }
      toast.info(`${totalSelecionados} ${successMessage}`); 
    } else {
      viewerInstance.clearSelection();
      // Em caso de não encontrar elementos nos modelos atuais, podemos restaurar visibilidade de tudo
      allModels.forEach(m => {
        viewerInstance.showModel(m.id);
        viewerInstance.isolate(null, m);
      });
      toast.warning('Os elementos não foram encontrados ou não estão visíveis nos arquivos 3D carregados.');
    }
  };

 // Efeito para checar pedido de seleção pendente via localStorage (ex: vindo do Quantitativos)
 useEffect(() => {
 if (!viewerInstance) return;

 const pending = localStorage.getItem('bimSelectionPending');
 if (pending) {
 try {
 const { externalIds, notify, modelos } = JSON.parse(pending);
 if (externalIds && externalIds.length > 0) {
 if (modelos && modelos.length > 0) {
 const loadedIds = loadedFiles.map(f => f.id);
 const missingModels = modelos.filter(m => !loadedIds.includes(m.id));
 // Se todos os modelos vieram pro Viewer já
 if (missingModels.length === 0) {
 setTimeout(() => {
 selectExternalIdsInViewer(externalIds, notify || 'elementos destacados no modelo.');
 localStorage.removeItem('bimSelectionPending');
 window.hasRequestedPendingLoad = false;
 }, 500);
 } else {
 // Existem modelos não carregados
 if (!window.hasRequestedPendingLoad) {
 window.hasRequestedPendingLoad = true;
 toast.info('Modelos vinculados não estão carregados, realizando auto-load...');
 handleLoadSet(modelos); // Dispara carregamento; O useEffect rodará de novo quando finalizar
 }
 }
 } else {
 // Sem dados de pre-load, fallback padrao
 setTimeout(() => {
 selectExternalIdsInViewer(externalIds, notify || 'elementos destacados no modelo.');
 localStorage.removeItem('bimSelectionPending');
 }, 500);
 }
 }
 } catch (e) {
 console.error("Erro ao ler seleção pendente", e);
 localStorage.removeItem('bimSelectionPending');
 }
 }
 }, [viewerInstance, loadedFiles]); // Roda quando o viewer inicia ou novos arquivos carregam
 const handleOpenLink = (targetData) => {
 resolveSelection(targetData, (ids) => {
 setContextTarget({ ...targetData, externalIds: ids });
 setIsLinkModalOpen(true);
 });
 };

 // ABRIR MODAL DE CRIAÇÃO (CORRIGIDO PARA EVITAR ERRO DE SCHEMA)
 const handleOpenCreate = (targetData) => {
 resolveSelection(targetData, (ids) => { // 1. Guardamos os dados BIM aqui no contexto (não mandamos pro modal poluir)
 setContextTarget({
 ...targetData,
 ids_para_vincular: ids // Lista de IDs para usar DEPOIS de criar
 }); // 2. Preparamos dados LIMPOS para o Modal de Atividade
 // removemos projeto_bim_id e elementos_bim daqui para não quebrar o insert
 setModalInitialData({ nome: targetData.elementName ? `Instalação ${targetData.elementName}` : '', empreendimento_id: activeFile?.empreendimento_id }); setIsCreateModalOpen(true); });
 };

 // EXECUTAR VÍNCULO (Apenas Link)
 const executeLink = async (activityId) => {
 if (!contextTarget || !activityId) {
 toast.error("Dados incompletos para vínculo.");
 return;
 }

 const ids = contextTarget.externalIds || [contextTarget.externalId];
 const rows = ids.map(id => ({ organizacao_id: organizacao_id || user?.user_metadata?.organizacao_id, atividade_id: activityId, projeto_bim_id: contextTarget.projetoBimId, external_id: String(id) }));

 const { error } = await supabase
 .from('atividades_elementos')
 .upsert(rows, { onConflict: 'atividade_id, projeto_bim_id, external_id' });

 if (!error) { toast.success("Atividade vinculada com sucesso!"); setIsLinkModalOpen(false); setContextTarget(null); queryClient.invalidateQueries(['bimElementLinks']); queryClient.invalidateQueries(['bimActivities']);
 } else {
 console.error(error);
 toast.error("Erro ao salvar vínculo.");
 }
 };

 // CALLBACK APÓS CRIAR NOVA ATIVIDADE (CORRIGIDO: VINCULA APÓS CRIAR)
 // O AtividadeModal precisa chamar onSuccess(novaAtividade)
 const executeCreate = async (novaAtividade) => { setIsCreateModalOpen(false); // Verifica se o modal retornou a atividade e se temos itens para vincular
 if (novaAtividade?.id && contextTarget?.ids_para_vincular) {
 try {
 const rows = contextTarget.ids_para_vincular.map(id => ({ organizacao_id: organizacao_id || user?.user_metadata?.organizacao_id, atividade_id: novaAtividade.id, projeto_bim_id: contextTarget.projetoBimId, external_id: String(id) }));

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

 setActivityToEdit(null); setModalInitialData(null); setContextTarget(null);
 queryClient.invalidateQueries(['bimActivities']);
 queryClient.invalidateQueries(['bimElementLinks']); // Atualiza painel lateral
 };

 // Sincronizar propriedades
 const handleSelectContext = useCallback(async (ctx) => {
 if (ctx.type === 'sync' && viewerInstance) {
 const urnClean = ctx.file.urn_autodesk.replace(/^urn:/, '');
 const m = loadedModelsRef.current[urnClean];
 if(m) { toast.promise(
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
   onFileSelect={(f) => { const clean = f.urn_autodesk.replace(/^urn:/, ''); if(!selectedModels.includes(clean)) handleToggleModel(f); }} 
   onToggleModel={handleToggleModel} 
   onSelectContext={handleSelectContext} 
   selectedModels={selectedModels} 
   activeUrn={activeUrn} 
   onLoadSet={handleLoadSet} 
   onClearAll={handleClearAll} 
   activeMainTab={activeMainTab}
   setActiveMainTab={setActiveMainTab}
 />
 </div>

 {/* ÁREA PRINCIPAL */}
 <main className="flex-1 h-full relative flex min-w-0 bg-white">
  {/* Botões Superiores do Cockpit */}
  <div className="absolute top-4 left-4 z-[60] flex gap-2 items-center">
    {/* Toggle Sidebar */}
    <button onClick={() => setIsSidebarVisible(!isSidebarVisible)} className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-md border border-gray-200 text-gray-650 hover:bg-white hover:text-gray-800 transition-all active:scale-95 flex items-center justify-center">
      <FontAwesomeIcon icon={isSidebarVisible ? faChevronLeft : faChevronRight} className="text-xs" />
    </button>
    {/* Home */}
    <Link href="/painel" className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-md border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 flex items-center justify-center" title="Voltar ao Painel">
      <FontAwesomeIcon icon={faHome} className="text-xs" />
    </Link>

    {/* Ferramentas Exclusivas do Visualizador 3D */}
    {activeMainTab === 'viewer' && (
      <>
        <div className="h-6 w-px bg-gray-200 mx-1"></div>

        {/* Evolução */}
        <button onClick={toggleEvolutionMode} disabled={isLoadingEvolution || !viewerInstance}
          className={`bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-md border border-gray-200 transition-all flex items-center gap-1.5 active:scale-95 ${isEvolutionMode ? 'text-green-600 border-green-300 bg-green-50' : 'text-gray-555 hover:text-green-600 hover:bg-gray-50'}`}
          title="Evolução Física da Obra"
        >
          {isLoadingEvolution ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLayerGroup} />}
          {isEvolutionMode && <span className="text-[10px] font-black uppercase hidden md:inline">Evolução</span>}
        </button>

        {/* Cronograma Gantt */}
        <button onClick={() => setIsGanttOpen(!isGanttOpen)} 
          className={`bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-md border border-gray-200 transition-all flex items-center gap-1.5 active:scale-95 ${isGanttOpen ? 'text-blue-600 border-blue-300 bg-blue-50 animate-pulse' : 'text-gray-555 hover:text-blue-600 hover:bg-gray-50'}`}
          title="Cronograma de Atividades"
        >
          <FontAwesomeIcon icon={faStream} /> 
          {visibleActivities.length > 0 && !isGanttOpen && (
            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black ml-1">{visibleActivities.length}</span>
          )}
        </button>

        {/* Ferramenta de Anotação/Marcação */}
        <div className="flex items-center bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-gray-200 divide-x divide-gray-150 overflow-hidden">
          <button onClick={() => isMarkupActive ? leaveMarkupMode() : enterMarkupMode()} disabled={!viewerInstance}
            className={`p-2 transition-all flex items-center gap-1.5 active:scale-95 ${isMarkupActive ? 'text-blue-600 bg-blue-50' : 'text-gray-555 hover:text-blue-600 hover:bg-gray-50'}`}
            title="Desenhar Anotações no Modelo"
          >
            <FontAwesomeIcon icon={faPenNib} />
            <span className="text-[10px] font-black uppercase hidden md:inline">Marcação</span>
          </button>
          <button onClick={() => { hideMarkups(); selectExternalIdsInViewer([]); toast.info("Visualização limpa."); }} disabled={!viewerInstance}
            className="p-2 px-2.5 text-red-500 hover:bg-red-50 transition-all"
            title="Limpar Marcações e Seleção"
          >
            <FontAwesomeIcon icon={faEraser} />
          </button>
        </div>
      </>
    )}
  </div>

  {/* Inspector Toggle Button */}
  {activeMainTab === 'viewer' && (
    <div className="absolute top-4 right-4 z-[60]">
      <button onClick={() => setIsInspectorVisible(!isInspectorVisible)} className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-md border border-gray-200 text-gray-500 hover:bg-white hover:text-purple-650 transition-all active:scale-95 flex items-center justify-center">
        <FontAwesomeIcon icon={isInspectorVisible ? faChevronRight : faChevronLeft} className="text-xs" />
      </button>
    </div>
  )}

  {/* CONTEÚDO CENTRAL (Visualizador 3D ou Planilha de Orçamento) */}
  <div className="flex-1 relative h-full w-full flex flex-col min-w-0 bg-white">
    {/* Visualizador 3D (controlado via CSS para não descarregar a URN em memória) */}
    <div className={`flex-1 w-full relative ${activeMainTab === 'viewer' ? 'block' : 'hidden'}`}>
      {isMarkupActive && (
        <BimMarkupToolbar activeTool={activeTool} setMarkupTool={setMarkupTool} onUndo={undo} onClear={clearMarkups} onSave={() => {
          const data = generateMarkupData();
          if (data && data.svgString) {
            handleOpenMarkupNoteCreation(data);
            leaveMarkupMode();
          } else {
            toast.warning("Desenhe algo antes de salvar.");
          }
        }} onCancel={leaveMarkupMode} />
      )}

      {/* SELETOR DE VISTAS/PRANCHAS 2D (BIM 2.0) */}
      {fileInUse && vistas && vistas.length > 0 && (
        <div className="absolute top-4 right-4 z-[60]">
          <div className="relative" ref={vistasDropdownRef}>
            <button
              onClick={() => setIsVistasDropdownOpen(!isVistasDropdownOpen)}
              className="bg-white/95 backdrop-blur-sm border border-gray-200 px-4 py-2 rounded-xl shadow-md text-xs font-bold text-gray-700 hover:bg-white flex items-center gap-2 transition-all active:scale-95 border-b"
            >
              <FontAwesomeIcon icon={faLayerGroup} className="text-blue-500 text-xs" />
              <span>{vistaAtiva ? vistaAtiva.nome : 'Modelo 3D Geral'}</span>
              <FontAwesomeIcon icon={faChevronDown} className="text-gray-400 text-[10px]" />
            </button>
            {isVistasDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col z-[100] animate-in fade-in slide-in-from-top-1 duration-200 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Desenhos e Vistas</span>
                </div>
                <button
                  onClick={() => {
                    setVistaAtiva(null);
                    setIsVistasDropdownOpen(false);
                    handleVoltar3D();
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2 ${!vistaAtiva ? 'bg-blue-50/50 text-blue-600' : 'text-gray-700'}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Modelo 3D Geral
                </button>
                {vistas.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setVistaAtiva(v);
                      setIsVistasDropdownOpen(false);
                      handleSelectVista(v);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center gap-2 ${vistaAtiva?.id === v.id ? 'bg-blue-50/50 text-blue-600 font-bold' : 'text-gray-700'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${v.tipo === '2d' ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
                    <span className="truncate">{v.nome}</span>
                    <span className="ml-auto text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full uppercase font-bold">{v.tipo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AutodeskViewerAPI urn={null} onViewerReady={setViewerInstance} />
    </div>

    {/* Planilha de Orçamento Integrada */}
    {activeMainTab === 'orcamento' && (
      <div className="flex-1 w-full h-full bg-gray-50 overflow-hidden">
        <BimQuantitativosOverlay 
          onClose={() => setActiveMainTab('viewer')} 
          onShowInModel={handleShowQuantitativos} 
          empreendimentoContextId={fileInUse?.empreendimento_id}
          modelosContextIds={loadedFiles.map(f => f.id)}
        />
      </div>
    )}

    {/* PAINEL GANTT (Exclusivo do Visualizador 3D) */}
    {activeMainTab === 'viewer' && (
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
    )}
  </div>

  {/* INSPECTOR (Oculto se a aba for Orçamento) */}
  <div className={`${isInspectorVisible && activeMainTab === 'viewer' ? 'w-80 border-l' : 'w-0 border-none'} bg-white transition-all duration-300 flex flex-col overflow-hidden shrink-0 z-20 shadow-xl`}>
    <BimInspector viewer={viewerInstance} elementExternalId={selectedElements[0]} selectedElements={selectedElements} selectedCount={fastSelectionCount} projetoBimId={fileInUse?.id} urnAutodesk={activeUrn || fileInUse?.urn_autodesk} onOpenLink={handleOpenLink} onOpenCreate={handleOpenCreate} onOpenNote={handleOpenNoteCreation} onRestoreNote={handleRestoreNoteWrapper} />
  </div>
 </main>
 </div>

 {/* MODAIS */}
 <BimLinkActivityModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} activities={allActivities} onLink={executeLink} targetElement={contextTarget} selectedCount={contextTarget?.externalIds?.length || 1} />
 {isCreateModalOpen && (
 <AtividadeModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setActivityToEdit(null); }} onSuccess={executeCreate} // IMPORTANTE: AtividadeModal deve retornar o objeto criado aqui
 initialData={modalInitialData} activityToEdit={activityToEdit} />
 )}
 <BimNoteModal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} captureData={noteCaptureData} activities={visibleActivities || []} onSuccess={onNoteSuccess} />
 </div>
 );
}
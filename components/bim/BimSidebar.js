'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFolder, faFolderOpen, faChevronRight, faChevronDown, faLayerGroup, 
    faSearch, faGhost, faSpinner, faClock, faPlus, faDatabase,
    faCheckSquare, faSquare, faTrash, faTrashRestore, faBan, faRecycle,
    faCloudUploadAlt, faCog, faEllipsisV, faExclamationTriangle, faPen,
    faSave, faCube, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BimUploadModal from './BimUploadModal';
import BimEditModal from './BimEditModal';
import BimSetModal from './BimSetModal';

// Helper de Polling
function FileStatusPoller({ file, onComplete }) {
    useEffect(() => {
        if (file.status !== 'processing') return;
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/aps/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urn: file.urn_autodesk }) });
                const data = await res.json();
                if (data.status === 'success') onComplete(file.id, 'Concluido');
                else if (data.status === 'failed' || data.status === 'timeout') onComplete(file.id, 'Erro');
            } catch (err) { console.error(err); }
        };
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, [file, onComplete]);
    return null;
}

export default function BimSidebar({ 
    onSelectContext, 
    onFileSelect, 
    onToggleModel, 
    selectedModels = [], 
    selectedContext, 
    activeUrn, 
    syncStates = {},
    onLoadSet,
    onClearAll // <--- NOVA PROP RECEBIDA
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Estados de Modais
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSetModalOpen, setIsSetModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('create');
  const [fileToAction, setFileToAction] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedState = localStorage.getItem('studio57_bim_sidebar_state');
        if (savedState) setExpandedItems(JSON.parse(savedState));
    }
  }, []);

  const toggleExpand = (key) => {
      setExpandedItems(prev => {
          const newState = { ...prev, [key]: !prev[key] };
          localStorage.setItem('studio57_bim_sidebar_state', JSON.stringify(newState));
          return newState;
      });
  };

  const handleDisciplineClick = (disc) => { toggleExpand(disc.uniqueId); onSelectContext(disc); };

  // Abertura de Modais
  const openCreateModal = () => { setUploadMode('create'); setFileToAction(null); setIsUploadModalOpen(true); };
  const openVersionModal = (file) => { setUploadMode('version'); setFileToAction(file); setIsUploadModalOpen(true); };
  const openEditModal = (file) => { setFileToAction(file); setIsEditModalOpen(true); };
  
  // Mutações
  const { mutate: updateFileStatus } = useMutation({
      mutationFn: async ({ id, status }) => { await supabase.from('projetos_bim').update({ status }).eq('id', id); },
      onSuccess: () => { queryClient.invalidateQueries(['bimStructureWithFiles']); toast.success("Arquivo pronto!"); }
  });
  const { mutate: moveToTrash } = useMutation({
      mutationFn: async (fileId) => { await supabase.from('projetos_bim').update({ is_lixeira: true }).eq('id', fileId); },
      onSuccess: () => { toast.success("Movido para lixeira"); queryClient.invalidateQueries(['bimStructureWithFiles']); }
  });
  const { mutate: restoreFromTrash } = useMutation({
      mutationFn: async (fileId) => { await supabase.from('projetos_bim').update({ is_lixeira: false }).eq('id', fileId); },
      onSuccess: () => { toast.success("Restaurado!"); queryClient.invalidateQueries(['bimStructureWithFiles']); }
  });
  const { mutate: deleteForever } = useMutation({
      mutationFn: async (fileId) => { await supabase.from('projetos_bim').delete().eq('id', fileId); },
      onSuccess: () => { toast.success("Excluído."); queryClient.invalidateQueries(['bimStructureWithFiles']); }
  });
  const { mutate: emptyTrash, isPending: isEmptying } = useMutation({
      mutationFn: async () => { await supabase.from('projetos_bim').delete().eq('organizacao_id', organizacaoId).eq('is_lixeira', true); },
      onSuccess: () => { toast.success("Lixeira vazia!"); queryClient.invalidateQueries(['bimStructureWithFiles']); setIsTrashOpen(false); }
  });
  const { mutate: deleteSet } = useMutation({
      mutationFn: async (setId) => { await supabase.from('bim_vistas_federadas').delete().eq('id', setId); },
      onSuccess: () => { toast.success("Conjunto excluído."); queryClient.invalidateQueries(['bimStructureWithFiles']); }
  });

  // --- QUERY UNIFICADA E ESTRUTURAÇÃO DA ÁRVORE ---
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bimStructureWithFiles', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return { tree: [], trash: [], allFiles: [] };
      
      const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
      const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
      const { data: todosArquivos } = await supabase.from('projetos_bim')
        .select('id, nome_arquivo, criado_em, urn_autodesk, empreendimento_id, disciplina_id, empresa_id, versao, is_lixeira, status')
        .eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });
      const { data: conjuntos } = await supabase.from('bim_vistas_federadas')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('criado_em', { ascending: false });

      if (!todosArquivos) return { tree: [], trash: [], allFiles: [] };

      const arquivosAtivos = todosArquivos.filter(f => !f.is_lixeira);
      const arquivosLixeira = todosArquivos.filter(f => f.is_lixeira);
      const arvoreLimpa = [];

      empresas?.forEach(emp => {
        const obrasDaEmpresa = obras?.filter(o => String(o.empresa_proprietaria_id) === String(emp.id)) || [];
        const obrasComConteudo = [];
        
        obrasDaEmpresa.forEach(obra => {
            const conjuntosDaObra = conjuntos?.filter(c => String(c.empreendimento_id) === String(obra.id)) || [];
            
            const conjuntosNodes = conjuntosDaObra.map(set => ({
                id: set.id,
                type: 'set', 
                nome: set.nome,
                data: set 
            }));

            const disciplinasAtivas = disciplinas?.map(disc => {
                const arquivosDaPasta = arquivosAtivos.filter(f => f.empreendimento_id === obra.id && f.disciplina_id === disc.id) || [];
                if (arquivosDaPasta.length === 0) return null;
                return { id: disc.id, type: 'folder', sigla: disc.sigla, nome: disc.nome, uniqueId: `${obra.id}-${disc.id}`, children: arquivosDaPasta };
            }).filter(Boolean) || [];

            const childrenCombinados = [...conjuntosNodes, ...disciplinasAtivas];

            if (childrenCombinados.length > 0) {
                obrasComConteudo.push({ 
                    id: obra.id, 
                    type: 'obra', 
                    nome: obra.nome, 
                    children: childrenCombinados 
                });
            }
        });
        
        if (obrasComConteudo.length > 0) arvoreLimpa.push({ id: emp.id, type: 'empresa', nome: emp.nome_fantasia || emp.razao_social, children: obrasComConteudo });
      });

      return { tree: arvoreLimpa, trash: arquivosLixeira, allFiles: todosArquivos };
    },
    enabled: !!organizacaoId,
    refetchInterval: 10000 
  });

  const rawStructure = data?.tree || [];
  const trashFiles = data?.trash || [];
  const allFiles = data?.allFiles || [];

  const filteredStructure = useMemo(() => {
    if (!searchTerm) return rawStructure;
    const lowerTerm = searchTerm.toLowerCase();
    const filterNode = (nodes) => {
      return nodes.reduce((acc, node) => {
        const matchesSelf = node.nome?.toLowerCase().includes(lowerTerm) || node.sigla?.toLowerCase().includes(lowerTerm);
        const hasMatchingFiles = node.type === 'folder' && node.children?.some(f => f.nome_arquivo.toLowerCase().includes(lowerTerm));
        const filteredChildren = (node.children && node.type !== 'folder') ? filterNode(node.children) : node.children;
        
        if (matchesSelf || hasMatchingFiles || (filteredChildren && filteredChildren.length > 0)) {
           if (node.type !== 'set' && node.type !== 'folder' && (!filteredChildren || filteredChildren.length === 0) && !matchesSelf) return acc;
           
          acc.push({ ...node, children: filteredChildren, forceExpand: true });
        }
        return acc;
      }, []);
    };
    return filterNode(rawStructure);
  }, [rawStructure, searchTerm]);

  // --- AÇÕES ---
  const getSelectedFilesForSave = () => allFiles.filter(f => selectedModels.includes(f.urn_autodesk));

  const handleLoadSet = (set) => {
      if (!onLoadSet) return;
      const idsDoConjunto = set.projetos_ids || [];
      const arquivosParaCarregar = [];
      idsDoConjunto.forEach(idSalvo => {
          const arquivoVivo = allFiles.find(f => f.id === idSalvo && !f.is_lixeira);
          if (arquivoVivo) arquivosParaCarregar.push(arquivoVivo);
      });
      if (arquivosParaCarregar.length === 0) {
          toast.error("Arquivos não encontrados.");
          return;
      }
      onLoadSet(arquivosParaCarregar);
      toast.success(`Carregando: ${set.nome}`);
  };

  if (isLoading) return <div className="p-6 text-blue-500 animate-pulse font-bold text-xs flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

  return (
    <div className="w-72 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm relative">
      
      {/* HEADER: BOTÕES SIMULTÂNEOS */}
      <div className="p-6 border-b border-gray-50 bg-white z-10 flex flex-col gap-3">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Navegador BIM</h2>
        
        <button onClick={openCreateModal} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faPlus} /> ADICIONAR NOVO
        </button>

        {/* ÁREA DE BOTÕES DE SELEÇÃO (SALVAR E LIMPAR) */}
        {selectedModels.length > 0 && (
            <div className="flex gap-2 animate-in slide-in-from-top-2">
                <button 
                    onClick={() => setIsSetModalOpen(true)}
                    className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 py-2 rounded-xl font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                    title="Salvar como vista federada"
                >
                    <FontAwesomeIcon icon={faSave} /> SALVAR ({selectedModels.length})
                </button>

                <button 
                    onClick={onClearAll}
                    className="w-10 bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 rounded-xl font-bold text-[10px] transition-all active:scale-95 flex items-center justify-center"
                    title="Limpar seleção atual"
                >
                    <FontAwesomeIcon icon={faTimesCircle} className="text-sm" />
                </button>
            </div>
        )}

        <div className="relative group mt-1">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs group-focus-within:text-blue-500" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none text-gray-600 font-medium" />
        </div>
      </div>

      {/* ÁRVORE HIERÁRQUICA */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar bg-gray-50/30 relative">
        {openMenuId && (<div className="fixed inset-0 z-20 cursor-default" onClick={() => setOpenMenuId(null)}></div>)}

        {filteredStructure.length === 0 ? (
            <div className="text-center py-10 opacity-30 flex flex-col items-center">
                <FontAwesomeIcon icon={faGhost} size="2x" className="mb-2 text-gray-400" />
                <p className="text-[10px] font-bold text-gray-500">VAZIO</p>
            </div>
        ) : (
            filteredStructure.map(emp => (
                <div key={emp.id} className="mb-2">
                    {/* EMPRESA */}
                    <div onClick={() => toggleExpand(`empresa-${emp.id}`)} className="flex items-center gap-2 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all group select-none">
                        <FontAwesomeIcon icon={(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) ? faChevronDown : faChevronRight} className="text-[8px] text-gray-300 w-3" />
                        <span className="text-xs font-black text-gray-700 truncate uppercase tracking-tight flex-1">{emp.nome}</span>
                    </div>

                    {(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) && (
                        <div className="ml-3 pl-2 border-l border-gray-200 mt-1 space-y-1">
                            {emp.children.map(obra => (
                                <div key={obra.id}>
                                    {/* OBRA */}
                                    <div onClick={() => toggleExpand(`obra-${obra.id}`)} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer group select-none">
                                        <FontAwesomeIcon icon={(expandedItems[`obra-${obra.id}`] || obra.forceExpand) ? faFolderOpen : faFolder} className="text-yellow-400 text-xs" />
                                        <span className="text-xs font-bold text-gray-600 truncate flex-1">{obra.nome}</span>
                                    </div>

                                    {(expandedItems[`obra-${obra.id}`] || obra.forceExpand) && (
                                        <div className="ml-4 mt-1 space-y-2">
                                            {obra.children.map(child => {
                                                if (child.type === 'set') {
                                                    const set = child.data;
                                                    return (
                                                        <div key={`set-${set.id}`} onClick={() => handleLoadSet(set)} className="group relative flex items-center gap-2 p-2 bg-white border border-purple-100 hover:border-purple-300 hover:shadow-sm rounded-lg cursor-pointer transition-all mb-1">
                                                            <div className="w-6 h-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0"><FontAwesomeIcon icon={faCube} className="text-[9px]" /></div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-bold text-gray-700 truncate">{set.nome}</p>
                                                                <p className="text-[8px] text-gray-400">{set.projetos_ids?.length || 0} arquivos</p>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(`set-${set.id}`); }} className="p-1 text-gray-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"><FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" /></button>
                                                            {openMenuId === `set-${set.id}` && (
                                                                <div className="absolute right-0 top-8 w-32 bg-white border border-gray-200 shadow-xl rounded-lg z-30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                                                    <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); if(confirm('Excluir conjunto?')) deleteSet(set.id); }} className="w-full text-left px-3 py-2 text-[10px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-2"><FontAwesomeIcon icon={faTrash} /> Excluir</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                const disc = child;
                                                const isFolderOpen = expandedItems[disc.uniqueId] || disc.forceExpand;
                                                return (
                                                    <div key={disc.uniqueId}>
                                                        <div onClick={() => handleDisciplineClick(disc)} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all select-none ${isFolderOpen ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}>
                                                            <FontAwesomeIcon icon={isFolderOpen ? faChevronDown : faChevronRight} className="text-[8px] opacity-50 w-2" />
                                                            <FontAwesomeIcon icon={faLayerGroup} className="text-[10px]" />
                                                            <span className="text-[10px] uppercase tracking-wide">{disc.sigla}</span>
                                                        </div>

                                                        {isFolderOpen && (
                                                            <div className="ml-3 pl-2 border-l border-blue-100 mt-1 space-y-2 animate-fade-in pb-2">
                                                                {disc.children.map(file => {
                                                                    const isActive = activeUrn === file.urn_autodesk;
                                                                    const isSelected = selectedModels.includes(file.urn_autodesk);
                                                                    const isProcessing = file.status === 'processing';
                                                                    const isError = file.status === 'Erro';

                                                                    return (
                                                                        <div key={file.id} 
                                                                             onClick={(e) => { e.stopPropagation(); if(!isProcessing && !isError) onFileSelect(file); }} 
                                                                             className={`group relative p-2 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] mb-1 ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'} ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
                                                                        >
                                                                            {isProcessing && (<FileStatusPoller file={file} onComplete={(id, status) => updateFileStatus({ id, status })} />)}
                                                                            <div className="flex items-start gap-2 relative">
                                                                                <button onClick={(e) => { e.stopPropagation(); if(!isProcessing && !isError) onToggleModel(file); }} className={`mt-0.5 transition-colors ${isActive ? 'text-blue-200 hover:text-white' : 'text-gray-300 hover:text-blue-500'}`}>
                                                                                    {isProcessing ? <FontAwesomeIcon icon={faCog} spin className="text-blue-500" /> : isError ? <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" /> : <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className="text-[12px]" />}
                                                                                </button>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className={`text-[10px] font-bold truncate leading-tight ${isActive ? 'text-white' : 'text-gray-700'}`}>{file.nome_arquivo}</p>
                                                                                    <div className={`flex items-center gap-1 mt-1 text-[8px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                                                                                        {isProcessing ? <span className="text-blue-500 font-bold animate-pulse">PROCESSANDO...</span> : isError ? <span className="text-red-500 font-bold">FALHA</span> : <><FontAwesomeIcon icon={faClock} /> {new Date(file.criado_em).toLocaleDateString()} <span className="opacity-50">•</span> v{file.versao}</>}
                                                                                    </div>
                                                                                </div>
                                                                                {!isProcessing && !isError && (
                                                                                    <div className="relative">
                                                                                        <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(file.id); }} className={`p-1 px-2 rounded hover:bg-black/10 transition-all ${isActive ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}><FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" /></button>
                                                                                        {openMenuId === file.id && (
                                                                                            <div className="absolute right-0 top-6 w-44 bg-white border border-gray-200 shadow-xl rounded-lg z-30 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                                                                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); openVersionModal(file); }} className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors border-b border-gray-50"><FontAwesomeIcon icon={faCloudUploadAlt} className="w-3" /> Atualizar Versão</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); openEditModal(file); }} className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors border-b border-gray-50"><FontAwesomeIcon icon={faPen} className="w-3" /> Editar / Mover</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); onSelectContext({ type: 'sync', file }); }} className="w-full text-left px-4 py-2 text-[11px] font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors border-b border-gray-50"><FontAwesomeIcon icon={faDatabase} className="w-3" /> Sincronizar DB</button>
                                                                                                <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); if(confirm('Mover para lixeira?')) moveToTrash(file.id); }} className="w-full text-left px-4 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"><FontAwesomeIcon icon={faTrash} className="w-3" /> Mover p/ Lixeira</button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-100">
        <div onClick={() => setIsTrashOpen(!isTrashOpen)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600"><FontAwesomeIcon icon={faRecycle} className="text-gray-500" /> Lixeira ({trashFiles.length})</div>
            <FontAwesomeIcon icon={isTrashOpen ? faChevronDown : faChevronRight} className="text-[10px] text-gray-400" />
        </div>
        {isTrashOpen && (
            <div className="bg-gray-50 border-t border-gray-200 max-h-48 overflow-y-auto p-2">
                {trashFiles.length > 0 && <button onClick={() => { if(confirm('Apagar tudo?')) emptyTrash(); }} disabled={isEmptying} className="w-full mb-2 text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 py-1.5 rounded hover:bg-red-100 flex items-center justify-center gap-2"><FontAwesomeIcon icon={faBan} /> Esvaziar</button>}
                <div className="space-y-2">
                    {trashFiles.map(file => (
                        <div key={file.id} className="bg-white p-2 rounded border border-gray-200 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity">
                            <div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-gray-600 truncate decoration-line-through">{file.nome_arquivo}</p></div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => restoreFromTrash(file.id)} className="p-1.5 text-green-500 hover:bg-green-50 rounded"><FontAwesomeIcon icon={faTrashRestore} className="text-xs" /></button>
                                <button onClick={() => { if(confirm('Excluir?')) deleteForever(file.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><FontAwesomeIcon icon={faBan} className="text-xs" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      
      <BimUploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} preSelectedContext={selectedContext} onSuccess={() => refetch()} mode={uploadMode} fileToUpdate={fileToAction} />
      <BimEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} fileToEdit={fileToAction} onSuccess={() => refetch()} />
      <BimSetModal isOpen={isSetModalOpen} onClose={() => setIsSetModalOpen(false)} selectedFiles={getSelectedFilesForSave()} onSuccess={() => refetch()} />
    </div>
  );
}
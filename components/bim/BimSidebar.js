// Caminho: components/bim/BimSidebar.js
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFolder, faFolderOpen, faChevronRight, 
    faChevronDown, faLayerGroup, faSearch, faGhost, 
    faSpinner, faClock, faPlus, faDatabase,
    faCheckSquare, faSquare, faTrash, faTrashRestore, faBan, faRecycle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BimUploadModal from './BimUploadModal';

export default function BimSidebar({ 
    onSelectContext, 
    onFileSelect, 
    onToggleModel, 
    selectedModels = [], 
    selectedContext, 
    activeUrn, 
    syncStates = {} 
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false); // Estado para abrir/fechar lixeira

  // Persistência do estado de expansão
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const savedState = localStorage.getItem('studio57_bim_sidebar_state');
        if (savedState) {
            try {
                setExpandedItems(JSON.parse(savedState));
            } catch (e) {
                console.error("Erro ao restaurar sidebar:", e);
            }
        }
    }
  }, []);

  const toggleExpand = (key) => {
      setExpandedItems(prev => {
          const newState = { ...prev, [key]: !prev[key] };
          localStorage.setItem('studio57_bim_sidebar_state', JSON.stringify(newState));
          return newState;
      });
  };

  const handleDisciplineClick = (disc) => {
      toggleExpand(disc.uniqueId); 
      onSelectContext(disc);       
  };

  // --- MUTAÇÕES (Ações de Lixeira) ---

  // 1. Mover para Lixeira (Soft Delete)
  const { mutate: moveToTrash } = useMutation({
      mutationFn: async (fileId) => {
          const { error } = await supabase
              .from('projetos_bim')
              .update({ is_lixeira: true })
              .eq('id', fileId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast.success("Arquivo movido para a lixeira");
          queryClient.invalidateQueries(['bimStructureWithFiles']);
      },
      onError: (err) => toast.error("Erro ao excluir: " + err.message)
  });

  // 2. Restaurar da Lixeira
  const { mutate: restoreFromTrash } = useMutation({
      mutationFn: async (fileId) => {
          const { error } = await supabase
              .from('projetos_bim')
              .update({ is_lixeira: false })
              .eq('id', fileId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast.success("Arquivo restaurado!");
          queryClient.invalidateQueries(['bimStructureWithFiles']);
      },
      onError: (err) => toast.error("Erro ao restaurar: " + err.message)
  });

  // 3. Excluir Permanentemente (Um arquivo específico)
  const { mutate: deleteForever } = useMutation({
      mutationFn: async (fileId) => {
          const { error } = await supabase
              .from('projetos_bim')
              .delete()
              .eq('id', fileId);
          if (error) throw error;
      },
      onSuccess: () => {
          toast.success("Arquivo excluído permanentemente.");
          queryClient.invalidateQueries(['bimStructureWithFiles']);
      },
      onError: (err) => toast.error("Erro fatal: " + err.message)
  });

  // 4. Esvaziar Lixeira (Todos da organização)
  const { mutate: emptyTrash, isPending: isEmptying } = useMutation({
      mutationFn: async () => {
          const { error } = await supabase
              .from('projetos_bim')
              .delete()
              .eq('organizacao_id', organizacaoId)
              .eq('is_lixeira', true);
          if (error) throw error;
      },
      onSuccess: () => {
          toast.success("Lixeira esvaziada!");
          queryClient.invalidateQueries(['bimStructureWithFiles']);
          setIsTrashOpen(false);
      },
      onError: (err) => toast.error("Erro ao esvaziar lixeira: " + err.message)
  });


  // --- QUERY PRINCIPAL ---
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bimStructureWithFiles', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return { tree: [], trash: [] };

      // Busca dados básicos
      const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
      const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');

      // Busca TODOS os arquivos (Lixeira e Normais)
      const { data: todosArquivos } = await supabase
        .from('projetos_bim')
        .select('id, nome_arquivo, criado_em, urn_autodesk, empreendimento_id, disciplina_id, versao, is_lixeira')
        .eq('organizacao_id', organizacaoId)
        .order('criado_em', { ascending: false });

      if (!todosArquivos) return { tree: [], trash: [] };

      // 1. Separa o que é lixeira do que é ativo
      const arquivosAtivos = todosArquivos.filter(f => !f.is_lixeira);
      const arquivosLixeira = todosArquivos.filter(f => f.is_lixeira);

      // 2. Monta a árvore apenas com os ativos
      const arvoreLimpa = [];

      empresas?.forEach(emp => {
        const obrasDaEmpresa = obras?.filter(o => String(o.empresa_proprietaria_id) === String(emp.id)) || [];
        const obrasComConteudo = [];

        obrasDaEmpresa.forEach(obra => {
            const disciplinasAtivas = disciplinas?.map(disc => {
                const arquivosDaPasta = arquivosAtivos.filter(f => 
                    f.empreendimento_id === obra.id && f.disciplina_id === disc.id
                ) || [];

                if (arquivosDaPasta.length === 0) return null;

                return {
                    id: disc.id,
                    type: 'folder',
                    sigla: disc.sigla,
                    nome: disc.nome,
                    uniqueId: `${obra.id}-${disc.id}`,
                    children: arquivosDaPasta
                };
            }).filter(Boolean) || [];

            if (disciplinasAtivas.length > 0) {
                obrasComConteudo.push({
                    id: obra.id,
                    type: 'obra',
                    nome: obra.nome,
                    children: disciplinasAtivas
                });
            }
        });

        if (obrasComConteudo.length > 0) {
            arvoreLimpa.push({
                id: emp.id,
                type: 'empresa',
                nome: emp.nome_fantasia || emp.razao_social,
                children: obrasComConteudo
            });
        }
      });

      return { tree: arvoreLimpa, trash: arquivosLixeira };
    },
    enabled: !!organizacaoId,
  });

  const rawStructure = data?.tree || [];
  const trashFiles = data?.trash || [];

  // Filtro de busca (Aplica-se à árvore)
  const filteredStructure = useMemo(() => {
    if (!searchTerm) return rawStructure;
    const lowerTerm = searchTerm.toLowerCase();

    const filterNode = (nodes) => {
      return nodes.reduce((acc, node) => {
        const matchesSelf = node.nome?.toLowerCase().includes(lowerTerm) || node.sigla?.toLowerCase().includes(lowerTerm);
        const hasMatchingFiles = node.type === 'folder' && node.children?.some(f => f.nome_arquivo.toLowerCase().includes(lowerTerm));
        
        const filteredChildren = node.children && node.type !== 'folder' ? filterNode(node.children) : node.children;
        
        if (matchesSelf || hasMatchingFiles || (filteredChildren && filteredChildren.length > 0)) {
          acc.push({ ...node, children: filteredChildren, forceExpand: true });
        }
        return acc;
      }, []);
    };

    return filterNode(rawStructure);
  }, [rawStructure, searchTerm]);

  if (isLoading) return <div className="p-6 text-blue-500 animate-pulse font-bold text-xs flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

  return (
    <div className="w-72 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm relative">
      
      {/* HEADER */}
      <div className="p-6 border-b border-gray-50 bg-white z-10 flex flex-col gap-4">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Navegador BIM</h2>
        <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
            <FontAwesomeIcon icon={faPlus} />
            ADICIONAR NOVO
        </button>
        <div className="relative group">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs group-focus-within:text-blue-500" />
            <input 
                type="text" 
                placeholder="Buscar arquivos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-gray-600 font-medium placeholder-gray-300" 
            />
        </div>
      </div>

      {/* ÁRVORE DE ARQUIVOS (ATIVOS) */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar bg-gray-50/30">
        {filteredStructure.length === 0 ? (
            <div className="text-center py-10 opacity-30 flex flex-col items-center">
                <FontAwesomeIcon icon={faGhost} size="2x" className="mb-2 text-gray-400" />
                <p className="text-[10px] font-bold text-gray-500">VAZIO</p>
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-[10px] text-blue-500 mt-2 hover:underline">Limpar</button>
                )}
            </div>
        ) : (
            filteredStructure.map(emp => (
                <div key={emp.id} className="mb-2">
                    <div 
                        onClick={() => toggleExpand(`empresa-${emp.id}`)} 
                        className="flex items-center gap-2 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all group select-none"
                    >
                        <FontAwesomeIcon 
                            icon={(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) ? faChevronDown : faChevronRight} 
                            className="text-[8px] text-gray-300 w-3" 
                        />
                        <span className="text-xs font-black text-gray-700 truncate uppercase tracking-tight flex-1">{emp.nome}</span>
                    </div>

                    {(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) && (
                        <div className="ml-3 pl-2 border-l border-gray-200 mt-1 space-y-1">
                            {emp.children.map(obra => (
                                <div key={obra.id}>
                                    <div 
                                        onClick={() => toggleExpand(`obra-${obra.id}`)} 
                                        className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer group select-none"
                                    >
                                        <FontAwesomeIcon 
                                            icon={(expandedItems[`obra-${obra.id}`] || obra.forceExpand) ? faFolderOpen : faFolder} 
                                            className="text-yellow-400 text-xs" 
                                        />
                                        <span className="text-xs font-bold text-gray-600 truncate flex-1">{obra.nome}</span>
                                    </div>

                                    {(expandedItems[`obra-${obra.id}`] || obra.forceExpand) && (
                                        <div className="ml-4 mt-1 space-y-2">
                                            {obra.children.map(disc => {
                                                const isFolderOpen = expandedItems[disc.uniqueId] || disc.forceExpand;
                                                return (
                                                    <div key={disc.uniqueId}>
                                                        <div 
                                                            onClick={() => handleDisciplineClick(disc)}
                                                            className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all select-none ${isFolderOpen ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                                                        >
                                                            <FontAwesomeIcon icon={isFolderOpen ? faChevronDown : faChevronRight} className="text-[8px] opacity-50 w-2" />
                                                            <FontAwesomeIcon icon={faLayerGroup} className="text-[10px]" />
                                                            <span className="text-[10px] uppercase tracking-wide">{disc.sigla}</span>
                                                            <span className="text-[9px] bg-gray-200 text-gray-500 px-1 rounded-full ml-auto">{disc.children.length}</span>
                                                        </div>

                                                        {isFolderOpen && (
                                                            <div className="ml-3 pl-2 border-l border-blue-100 mt-1 space-y-2 animate-fade-in">
                                                                {disc.children.map(file => {
                                                                    const isActive = activeUrn === file.urn_autodesk;
                                                                    const isSelected = selectedModels.includes(file.urn_autodesk);
                                                                    const isSyncing = syncStates[file.id]?.isSyncing;
                                                                    const progress = syncStates[file.id]?.progress || 0;

                                                                    return (
                                                                        <div 
                                                                            key={file.id}
                                                                            onClick={(e) => { e.stopPropagation(); onFileSelect(file); }}
                                                                            className={`group relative p-2 rounded-lg border cursor-pointer transition-all hover:scale-[1.02] ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'}`}
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); onToggleModel(file); }}
                                                                                    className={`mt-0.5 transition-colors ${isActive ? 'text-blue-200 hover:text-white' : 'text-gray-300 hover:text-blue-500'}`}
                                                                                >
                                                                                    <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className="text-[12px]" />
                                                                                </button>

                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className={`text-[10px] font-bold truncate leading-tight ${isActive ? 'text-white' : 'text-gray-700'}`}>
                                                                                        {file.nome_arquivo}
                                                                                    </p>
                                                                                    <div className={`flex items-center gap-1 mt-1 text-[8px] ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                                                                                        <FontAwesomeIcon icon={faClock} /> 
                                                                                        {new Date(file.criado_em).toLocaleDateString()} 
                                                                                        <span className="opacity-50">•</span> v{file.versao}
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                <div className="flex items-center ml-1 gap-1">
                                                                                    {/* Botão Sync */}
                                                                                    {isSyncing ? (
                                                                                        <div className="relative flex items-center justify-center">
                                                                                            <FontAwesomeIcon icon={faSpinner} spin className={`${isActive ? 'text-white' : 'text-blue-500'} text-[10px]`} />
                                                                                            <span className="absolute -top-3 text-[7px] font-black">{progress}%</span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <button 
                                                                                            onClick={(e) => { e.stopPropagation(); onSelectContext({ type: 'sync', file }); }}
                                                                                            className={`p-1 rounded transition-colors ${isActive ? 'text-blue-200 hover:bg-blue-500' : 'text-gray-300 hover:text-blue-600 hover:bg-blue-50'}`}
                                                                                            title="Sincronizar Propriedades"
                                                                                        >
                                                                                            <FontAwesomeIcon icon={faDatabase} className="text-[10px]" />
                                                                                        </button>
                                                                                    )}

                                                                                    {/* Botão Excluir (Mover para Lixeira) */}
                                                                                    <button 
                                                                                        onClick={(e) => { 
                                                                                            e.stopPropagation(); 
                                                                                            if(confirm('Mover para lixeira?')) moveToTrash(file.id);
                                                                                        }}
                                                                                        className={`p-1 rounded transition-colors ${isActive ? 'text-red-300 hover:bg-red-500' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                                                                                        title="Mover para Lixeira"
                                                                                    >
                                                                                        <FontAwesomeIcon icon={faTrash} className="text-[10px]" />
                                                                                    </button>
                                                                                </div>
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

      {/* LIXEIRA (FOOTER ACORDION) */}
      <div className="border-t border-gray-200 bg-gray-100">
        <div 
            onClick={() => setIsTrashOpen(!isTrashOpen)}
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
        >
            <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                <FontAwesomeIcon icon={faRecycle} className="text-gray-500" />
                Lixeira ({trashFiles.length})
            </div>
            <FontAwesomeIcon icon={isTrashOpen ? faChevronDown : faChevronRight} className="text-[10px] text-gray-400" />
        </div>

        {isTrashOpen && (
            <div className="bg-gray-50 border-t border-gray-200 max-h-48 overflow-y-auto p-2">
                
                {trashFiles.length > 0 && (
                    <button 
                        onClick={() => { if(confirm('Tem certeza? Isso apagará os arquivos PERMANENTEMENTE.')) emptyTrash(); }}
                        disabled={isEmptying}
                        className="w-full mb-2 text-[10px] font-bold text-red-500 bg-red-50 border border-red-100 py-1.5 rounded hover:bg-red-100 flex items-center justify-center gap-2"
                    >
                        {isEmptying ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faBan} />}
                        Esvaziar Lixeira
                    </button>
                )}

                <div className="space-y-2">
                    {trashFiles.length === 0 ? (
                        <p className="text-[10px] text-gray-400 text-center py-2">Lixeira vazia.</p>
                    ) : (
                        trashFiles.map(file => (
                            <div key={file.id} className="bg-white p-2 rounded border border-gray-200 flex items-center justify-between opacity-75 hover:opacity-100 transition-opacity">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-gray-600 truncate decoration-line-through">{file.nome_arquivo}</p>
                                    <p className="text-[8px] text-gray-400">{new Date(file.criado_em).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => restoreFromTrash(file.id)}
                                        className="p-1.5 text-green-500 hover:bg-green-50 rounded" 
                                        title="Restaurar"
                                    >
                                        <FontAwesomeIcon icon={faTrashRestore} className="text-xs" />
                                    </button>
                                    <button 
                                        onClick={() => { if(confirm('Excluir permanentemente?')) deleteForever(file.id); }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded" 
                                        title="Excluir Definitivamente"
                                    >
                                        <FontAwesomeIcon icon={faBan} className="text-xs" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )}
      </div>
      
      <BimUploadModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          preSelectedContext={selectedContext}
          onSuccess={() => refetch()} 
      />
    </div>
  );
}
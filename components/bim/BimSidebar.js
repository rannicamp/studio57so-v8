'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFolder, faFolderOpen, faChevronRight, faChevronDown, 
    faSearch, faGhost, faSpinner, faPlus, faRecycle, faSave, faCube, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

import BimFileItem from './BimFileItem';
import BimUploadModal from './BimUploadModal';
import BimEditModal from './BimEditModal';
import BimSetModal from './BimSetModal';

export default function BimSidebar({ 
    onSelectContext, onFileSelect, onToggleModel, 
    selectedModels = [], selectedContext, activeUrn, 
    onLoadSet, onClearAll 
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // Estados de Modais
  const [modalState, setModalState] = useState({ upload: false, edit: false, set: false, mode: 'create', file: null });

  useEffect(() => {
    const saved = localStorage.getItem('studio57_bim_sidebar_state');
    if (saved) setExpandedItems(JSON.parse(saved));
  }, []);

  const toggleExpand = (key) => {
      setExpandedItems(prev => {
          const newState = { ...prev, [key]: !prev[key] };
          localStorage.setItem('studio57_bim_sidebar_state', JSON.stringify(newState));
          return newState;
      });
  };

  // Função de ação disparada pelo item individual
  const handleFileAction = useCallback((type, file) => {
      if (type === 'sync') {
          console.log("🚀 Devonildo disparando sincronização!");
          onSelectContext({ type: 'sync', file });
      } else if (type === 'version') {
          setModalState({ ...modalState, upload: true, mode: 'version', file });
      } else if (type === 'edit') {
          setModalState({ ...modalState, edit: true, file });
      } else if (type === 'trash') {
          if(confirm('Mover para lixeira?')) moveToTrash(file.id);
      }
  }, [onSelectContext]);

  const { mutate: moveToTrash } = useMutation({
      mutationFn: async (fileId) => await supabase.from('projetos_bim').update({ is_lixeira: true }).eq('id', fileId),
      onSuccess: () => { toast.success("Movido para lixeira"); queryClient.invalidateQueries(['bimStructureWithFiles']); }
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bimStructureWithFiles', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return { tree: [], trash: [], allFiles: [] };
      const { data: emps } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obs } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
      const { data: discs } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
      const { data: files } = await supabase.from('projetos_bim').select('*').eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });
      const { data: sets } = await supabase.from('bim_vistas_federadas').select('*').eq('organizacao_id', organizacaoId);

      const arvore = [];
      emps?.forEach(emp => {
        const obrasFilhas = obs?.filter(o => String(o.empresa_proprietaria_id) === String(emp.id)).map(obra => {
            const conjuntos = sets?.filter(s => String(s.empreendimento_id) === String(obra.id)).map(s => ({ id: s.id, type: 'set', nome: s.nome, data: s }));
            const disciplinasAtivas = discs?.map(d => {
                const fds = files?.filter(f => !f.is_lixeira && f.empreendimento_id === obra.id && f.disciplina_id === d.id) || [];
                return fds.length > 0 ? { id: d.id, type: 'folder', sigla: d.sigla, uniqueId: `${obra.id}-${d.id}`, children: fds } : null;
            }).filter(Boolean);
            const content = [...(conjuntos || []), ...(disciplinasAtivas || [])];
            return content.length > 0 ? { id: obra.id, type: 'obra', nome: obra.nome, children: content } : null;
        }).filter(Boolean);
        if (obrasFilhas?.length > 0) arvore.push({ id: emp.id, type: 'empresa', nome: emp.nome_fantasia || emp.razao_social, children: obrasFilhas });
      });
      return { tree: arvore, trash: files?.filter(f => f.is_lixeira) || [], allFiles: files || [] };
    },
    enabled: !!organizacaoId
  });

  const filtered = useMemo(() => {
    if (!searchTerm) return data?.tree || [];
    const term = searchTerm.toLowerCase();
    const filter = (nodes) => nodes.reduce((acc, n) => {
        const match = n.nome?.toLowerCase().includes(term) || n.sigla?.toLowerCase().includes(term);
        const childs = n.children ? filter(n.children) : null;
        if (match || (childs && childs.length > 0)) acc.push({ ...n, children: childs, forceExpand: true });
        return acc;
    }, []);
    return filter(data?.tree || []);
  }, [data, searchTerm]);

  if (isLoading) return <div className="p-6 text-blue-500 animate-pulse text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

  return (
    <div className="w-72 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm">
      <div className="p-6 border-b border-gray-50 bg-white z-10 flex flex-col gap-3">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Navegador BIM</h2>
        <button onClick={() => setModalState({ ...modalState, upload: true, mode: 'create', file: null })} className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-bold text-xs shadow-md shadow-blue-100 flex items-center justify-center gap-2 transition-all active:scale-95">
            <FontAwesomeIcon icon={faPlus} /> NOVO ARQUIVO
        </button>
        {selectedModels.length > 0 && (
            <div className="flex gap-2 animate-in slide-in-from-top-1">
                <button onClick={() => setModalState({ ...modalState, set: true })} className="flex-1 bg-purple-100 text-purple-700 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-2"><FontAwesomeIcon icon={faSave} /> SALVAR ({selectedModels.length})</button>
                <button onClick={onClearAll} className="w-10 bg-red-50 text-red-500 border border-red-100 rounded-xl"><FontAwesomeIcon icon={faTimesCircle} /></button>
            </div>
        )}
        <div className="relative mt-1">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs outline-none font-medium" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 bg-gray-50/30 custom-scrollbar">
        {filtered.map(emp => (
            <div key={emp.id} className="mb-2">
                <div onClick={() => toggleExpand(`empresa-${emp.id}`)} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer">
                    <FontAwesomeIcon icon={(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) ? faChevronDown : faChevronRight} className="text-[8px] text-gray-300 w-3" />
                    <span className="text-xs font-black text-gray-700 uppercase">{emp.nome}</span>
                </div>
                {(expandedItems[`empresa-${emp.id}`] || emp.forceExpand) && (
                    <div className="ml-3 pl-2 border-l border-gray-200 mt-1 space-y-1">
                        {emp.children.map(obra => (
                            <div key={obra.id}>
                                <div onClick={() => toggleExpand(`obra-${obra.id}`)} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer">
                                    <FontAwesomeIcon icon={(expandedItems[`obra-${obra.id}`] || obra.forceExpand) ? faFolderOpen : faFolder} className="text-yellow-400 text-xs" />
                                    <span className="text-xs font-bold text-gray-600">{obra.nome}</span>
                                </div>
                                {(expandedItems[`obra-${obra.id}`] || obra.forceExpand) && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {obra.children.map(child => {
                                            if (child.type === 'set') return (
                                                <div key={child.id} onClick={() => onLoadSet(data.allFiles.filter(f => child.data.projetos_ids.includes(f.id)))} className="flex items-center gap-2 p-2 bg-white border border-purple-100 rounded-lg cursor-pointer hover:shadow-sm">
                                                    <FontAwesomeIcon icon={faCube} className="text-purple-600 text-[10px]" />
                                                    <span className="text-[10px] font-bold text-gray-700">{child.nome}</span>
                                                </div>
                                            );
                                            const open = expandedItems[child.uniqueId] || child.forceExpand;
                                            return (
                                                <div key={child.uniqueId}>
                                                    <div onClick={() => toggleExpand(child.uniqueId)} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer ${open ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-500'}`}>
                                                        <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} className="text-[8px] w-2" />
                                                        <span className="text-[10px] uppercase tracking-wider">{child.sigla}</span>
                                                    </div>
                                                    {open && (
                                                        <div className="ml-3 pl-2 border-l border-blue-100 mt-1">
                                                            {child.children.map(f => (
                                                                <BimFileItem 
                                                                    key={f.id} file={f} 
                                                                    isActive={activeUrn === f.urn_autodesk.replace(/^urn:/, '')}
                                                                    isSelected={selectedModels.includes(f.urn_autodesk.replace(/^urn:/, ''))}
                                                                    onFileSelect={onFileSelect} onToggleModel={onToggleModel}
                                                                    onAction={handleFileAction}
                                                                />
                                                            ))}
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
        ))}
      </div>

      <BimUploadModal isOpen={modalState.upload} onClose={() => setModalState({...modalState, upload: false})} preSelectedContext={selectedContext} onSuccess={() => refetch()} mode={modalState.mode} fileToUpdate={modalState.file} />
      <BimEditModal isOpen={modalState.edit} onClose={() => setModalState({...modalState, edit: false})} fileToEdit={modalState.file} onSuccess={() => refetch()} />
      <BimSetModal isOpen={modalState.set} onClose={() => setModalState({...modalState, set: false})} selectedFiles={data?.allFiles?.filter(f => selectedModels.includes(f.urn_autodesk.replace(/^urn:/, '')))} onSuccess={() => refetch()} />
    </div>
  );
}
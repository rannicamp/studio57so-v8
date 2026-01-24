'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBuilding, faFolder, faFolderOpen, faChevronRight, 
    faChevronDown, faCity, faLayerGroup, faSearch, faGhost, 
    faSpinner, faCube, faClock
} from '@fortawesome/free-solid-svg-icons';

export default function BimSidebar({ onSelectContext, onFileSelect, selectedContext, activeUrn }) {
  const supabase = createClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [searchTermInput, setSearchTermInput] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // DEBOUNCE: Espera 300ms antes de filtrar
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearchTerm(searchTermInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTermInput]);

  // RESTORE: Recupera estado expandido do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('studio57_bim_sidebar_expanded');
        if (saved) try { setExpandedItems(JSON.parse(saved)); } catch(e){}
    }
  }, []);

  const toggleExpand = (key) => {
      setExpandedItems(prev => {
          const newState = { ...prev, [key]: !prev[key] };
          localStorage.setItem('studio57_bim_sidebar_expanded', JSON.stringify(newState));
          return newState;
      });
  };

  const handleDisciplineClick = (disc) => {
      toggleExpand(disc.uniqueId); 
      onSelectContext(disc);       
  };

  const { data: rawStructure = [], isLoading } = useQuery({
    queryKey: ['bimStructureFinal', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];
      const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
      const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');
      const { data: todosArquivos } = await supabase.from('projetos_bim').select('id, nome_arquivo, criado_em, urn_autodesk, empreendimento_id, disciplina_id, versao').eq('organizacao_id', organizacaoId).order('criado_em', { ascending: false });

      if (!empresas) return [];
      const arvore = [];

      empresas.forEach(emp => {
        const obrasEmp = obras?.filter(o => String(o.empresa_proprietaria_id) === String(emp.id)) || [];
        const obrasComFiles = [];

        obrasEmp.forEach(obra => {
            const discAtivas = disciplinas?.map(disc => {
                const files = todosArquivos?.filter(f => f.empreendimento_id === obra.id && f.disciplina_id === disc.id) || [];
                if (files.length === 0) return null;
                return {
                    id: disc.id, type: 'folder', sigla: disc.sigla, nome: disc.nome,
                    uniqueId: `${obra.id}-${disc.id}`, obraId: obra.id, empresaId: emp.id, children: files
                };
            }).filter(Boolean) || [];

            if (discAtivas.length > 0) {
                obrasComFiles.push({ id: obra.id, type: 'obra', nome: obra.nome, empresaId: emp.id, children: discAtivas });
            }
        });

        if (obrasComFiles.length > 0) arvore.push({ id: emp.id, type: 'empresa', nome: emp.nome_fantasia || emp.razao_social, children: obrasComFiles });
      });
      return arvore;
    },
    enabled: !!organizacaoId,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false
  });

  const filteredStructure = useMemo(() => {
    if (!debouncedSearchTerm) return rawStructure;
    const lower = debouncedSearchTerm.toLowerCase();
    const filter = (nodes) => nodes.reduce((acc, node) => {
        const match = node.nome?.toLowerCase().includes(lower) || node.sigla?.toLowerCase().includes(lower);
        const hasFiles = node.type === 'folder' && node.children?.some(f => f.nome_arquivo.toLowerCase().includes(lower));
        const children = node.children && node.type !== 'folder' ? filter(node.children) : node.children;
        if (match || hasFiles || (children && children.length > 0)) {
            acc.push({ ...node, children, forceExpand: true });
        }
        return acc;
    }, []);
    return filter(rawStructure);
  }, [rawStructure, debouncedSearchTerm]);

  if (isLoading) return <div className="p-6 text-blue-500 text-xs font-bold animate-pulse"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

  return (
    <div className="w-72 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm z-20 relative">
      <div className="p-6 border-b border-gray-50">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Navegador BIM</h2>
        <div className="relative group">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
            <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchTermInput}
                onChange={(e) => setSearchTermInput(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 transition-all outline-none" 
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        {filteredStructure.map(emp => (
            <div key={emp.id} className="mb-2">
                <div onClick={() => toggleExpand(`e-${emp.id}`)} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <FontAwesomeIcon icon={(expandedItems[`e-${emp.id}`] || emp.forceExpand) ? faChevronDown : faChevronRight} className="text-[8px] text-gray-300 w-3" />
                    <FontAwesomeIcon icon={faBuilding} className="text-blue-600 text-[10px]" />
                    <span className="text-xs font-black text-gray-700 truncate">{emp.nome}</span>
                </div>
                {(expandedItems[`e-${emp.id}`] || emp.forceExpand) && (
                    <div className="ml-3 pl-2 border-l border-gray-100 mt-1">
                        {emp.children.map(obra => (
                            <div key={obra.id}>
                                <div onClick={() => toggleExpand(`o-${obra.id}`)} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded-md cursor-pointer">
                                    <FontAwesomeIcon icon={(expandedItems[`o-${obra.id}`] || obra.forceExpand) ? faFolderOpen : faFolder} className="text-yellow-400 text-xs" />
                                    <span className="text-xs font-bold text-gray-600 truncate">{obra.nome}</span>
                                </div>
                                {(expandedItems[`o-${obra.id}`] || obra.forceExpand) && (
                                    <div className="ml-4 mt-1 space-y-1">
                                        {obra.children.map(disc => {
                                            const isOpen = expandedItems[disc.uniqueId] || disc.forceExpand;
                                            return (
                                                <div key={disc.uniqueId}>
                                                    <div onClick={() => handleDisciplineClick(disc)} className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer ${isOpen ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                                                        <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} className="text-[8px] opacity-50 w-2" />
                                                        <span className="text-[10px]">{disc.sigla}</span>
                                                    </div>
                                                    {isOpen && (
                                                        <div className="ml-3 pl-2 border-l border-blue-100 mt-1 space-y-1">
                                                            {disc.children.map(file => (
                                                                <div key={file.id} onClick={() => onFileSelect(file.urn_autodesk)} className={`p-1.5 rounded cursor-pointer text-[10px] hover:bg-blue-50 ${activeUrn === file.urn_autodesk ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-500'}`}>
                                                                    <FontAwesomeIcon icon={faCube} className="mr-1" /> {file.nome_arquivo}
                                                                </div>
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
    </div>
  );
}
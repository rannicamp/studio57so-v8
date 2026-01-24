// Caminho: components/bim/BimSidebar.js
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBuilding, faFolder, faFolderOpen, faChevronRight, 
    faChevronDown, faCity, faLayerGroup, faSearch, faGhost, 
    faSpinner, faCube, faClock
} from '@fortawesome/free-solid-svg-icons';

// Adicionamos 'onFileSelect' para permitir abrir o arquivo direto do menu
export default function BimSidebar({ onSelectContext, onFileSelect, selectedContext, activeUrn }) {
  const supabase = createClient();
  const { organizacao_id: organizacaoId } = useAuth();
  
  const [expandedItems, setExpandedItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // 1. BUSCA ESTRUTURA COMPLETA (COM ARQUIVOS)
  const { data: rawStructure = [], isLoading } = useQuery({
    queryKey: ['bimStructureWithFiles', organizacaoId],
    queryFn: async () => {
      if (!organizacaoId) return [];

      // A. Buscas Básicas
      const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId).order('nome_fantasia');
      const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id').eq('organizacao_id', organizacaoId).order('nome');
      const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('id, sigla, nome').eq('organizacao_id', organizacaoId).order('sigla');

      // B. [NOVO] Buscar TODOS os arquivos com metadados para exibir nos cards
      const { data: todosArquivos } = await supabase
        .from('projetos_bim')
        .select('id, nome_arquivo, criado_em, urn_autodesk, empreendimento_id, disciplina_id, versao')
        .eq('organizacao_id', organizacaoId)
        .order('criado_em', { ascending: false });

      if (!empresas) return [];

      const arvoreLimpa = [];

      empresas.forEach(emp => {
        const obrasDaEmpresa = obras?.filter(o => String(o.empresa_proprietaria_id) === String(emp.id)) || [];
        const obrasComConteudo = [];

        obrasDaEmpresa.forEach(obra => {
            // C. Mapeia disciplinas e injeta os arquivos dentro delas
            const disciplinasAtivas = disciplinas?.map(disc => {
                // Filtra arquivos desta pasta específica
                const arquivosDaPasta = todosArquivos?.filter(f => 
                    f.empreendimento_id === obra.id && f.disciplina_id === disc.id
                ) || [];

                if (arquivosDaPasta.length === 0) return null;

                return {
                    id: disc.id,
                    type: 'folder',
                    sigla: disc.sigla,
                    nome: disc.nome,
                    uniqueId: `${obra.id}-${disc.id}`,
                    obraId: obra.id,
                    empresaId: emp.id,
                    children: arquivosDaPasta // Anexa os arquivos como filhos da disciplina
                };
            }).filter(Boolean) || [];

            if (disciplinasAtivas.length > 0) {
                obrasComConteudo.push({
                    id: obra.id,
                    type: 'obra',
                    nome: obra.nome,
                    empresaId: emp.id,
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

      return arvoreLimpa;
    },
    enabled: !!organizacaoId,
    staleTime: 1000 * 30 
  });

  // 2. FILTRAGEM (SEARCH)
  const filteredStructure = useMemo(() => {
    if (!searchTerm) return rawStructure;
    const lowerTerm = searchTerm.toLowerCase();

    const filterNode = (nodes) => {
      return nodes.reduce((acc, node) => {
        // Verifica se o nó ou algum ARQUIVO dentro dele bate com a busca
        const matchesSelf = node.nome?.toLowerCase().includes(lowerTerm) || node.sigla?.toLowerCase().includes(lowerTerm);
        
        // Se for uma pasta (disciplina), verifica os arquivos dentro
        const hasMatchingFiles = node.type === 'folder' && node.children?.some(f => f.nome_arquivo.toLowerCase().includes(lowerTerm));

        const filteredChildren = node.children && node.type !== 'folder' ? filterNode(node.children) : node.children;
        
        if (matchesSelf || hasMatchingFiles || (filteredChildren && filteredChildren.length > 0)) {
          setExpandedItems(prev => ({ ...prev, [`${node.type}-${node.id}`]: true, [`${node.uniqueId}`]: true }));
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };

    return filterNode(rawStructure);
  }, [rawStructure, searchTerm]);

  const toggleExpand = (key) => setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));

  // Função auxiliar para lidar com clique na disciplina (abre pasta e seleciona contexto)
  const handleDisciplineClick = (disc) => {
      toggleExpand(disc.uniqueId); // Abre/Fecha sanfona
      onSelectContext(disc);       // Atualiza contexto da página principal
  };

  if (isLoading) return <div className="p-6 text-blue-500 animate-pulse font-bold text-xs flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>;

  return (
    <div className="w-72 bg-white border-r border-gray-100 h-full flex flex-col shadow-sm">
      
      {/* Header */}
      <div className="p-6 border-b border-gray-50 bg-white z-10">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Navegador BIM</h2>
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

      {/* Árvore */}
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar bg-gray-50/30">
        {filteredStructure.length === 0 ? (
            <div className="text-center py-10 opacity-30 flex flex-col items-center">
                <FontAwesomeIcon icon={faGhost} size="2x" className="mb-2 text-gray-400" />
                <p className="text-[10px] font-bold text-gray-500">VAZIO</p>
                {searchTerm ? (
                    <button onClick={() => setSearchTerm('')} className="text-[10px] text-blue-500 mt-2 hover:underline">Limpar</button>
                ) : (
                    <p className="text-[9px] text-gray-400 mt-2 max-w-[150px]">Use "Novo Upload" para começar.</p>
                )}
            </div>
        ) : (
            filteredStructure.map(emp => (
                <div key={emp.id} className="mb-2">
                    {/* Nível 1: Empresa */}
                    <div 
                        onClick={() => toggleExpand(`empresa-${emp.id}`)} 
                        className="flex items-center gap-2 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all group select-none"
                    >
                        <FontAwesomeIcon icon={expandedItems[`empresa-${emp.id}`] ? faChevronDown : faChevronRight} className="text-[8px] text-gray-300 w-3" />
                        <span className="text-xs font-black text-gray-700 truncate uppercase tracking-tight flex-1">{emp.nome}</span>
                    </div>

                    {/* Nível 2: Obras */}
                    {expandedItems[`empresa-${emp.id}`] && (
                        <div className="ml-3 pl-2 border-l border-gray-200 mt-1 space-y-1">
                            {emp.children.map(obra => (
                                <div key={obra.id}>
                                    <div 
                                        onClick={() => toggleExpand(`obra-${obra.id}`)} 
                                        className="flex items-center gap-2 p-1.5 hover:bg-white rounded-md cursor-pointer group select-none"
                                    >
                                        <FontAwesomeIcon icon={expandedItems[`obra-${obra.id}`] ? faFolderOpen : faFolder} className="text-yellow-400 text-xs" />
                                        <span className="text-xs font-bold text-gray-600 truncate flex-1">{obra.nome}</span>
                                    </div>

                                    {/* Nível 3: Disciplinas (Pastas) */}
                                    {expandedItems[`obra-${obra.id}`] && (
                                        <div className="ml-4 mt-1 space-y-2">
                                            {obra.children.map(disc => {
                                                const isFolderOpen = expandedItems[disc.uniqueId];
                                                return (
                                                    <div key={disc.uniqueId}>
                                                        {/* Cabeçalho da Pasta */}
                                                        <div 
                                                            onClick={() => handleDisciplineClick(disc)}
                                                            className={`
                                                                flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-all select-none
                                                                ${isFolderOpen ? 'text-blue-700 bg-blue-50 font-bold' : 'text-gray-500 hover:text-gray-800'}
                                                            `}
                                                        >
                                                            <FontAwesomeIcon icon={isFolderOpen ? faChevronDown : faChevronRight} className="text-[8px] opacity-50 w-2" />
                                                            <FontAwesomeIcon icon={faLayerGroup} className="text-[10px]" />
                                                            <span className="text-[10px] uppercase tracking-wide">{disc.sigla}</span>
                                                            <span className="text-[9px] bg-gray-200 text-gray-500 px-1 rounded-full ml-auto">{disc.children.length}</span>
                                                        </div>

                                                        {/* Nível 4: ARQUIVOS (Os Cards!) */}
                                                        {isFolderOpen && (
                                                            <div className="ml-3 pl-2 border-l border-blue-100 mt-1 space-y-2 animate-fade-in">
                                                                {disc.children.map(file => {
                                                                    const isActive = activeUrn === file.urn_autodesk;
                                                                    return (
                                                                        <div 
                                                                            key={file.id}
                                                                            onClick={(e) => { e.stopPropagation(); onFileSelect(file.urn_autodesk); }}
                                                                            className={`
                                                                                group relative p-2 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]
                                                                                ${isActive 
                                                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                                                                                    : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm'
                                                                                }
                                                                            `}
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                <div className={`mt-0.5 p-1 rounded ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-50 text-blue-500'}`}>
                                                                                    <FontAwesomeIcon icon={faCube} className="text-[10px]" />
                                                                                </div>
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
    </div>
  );
}
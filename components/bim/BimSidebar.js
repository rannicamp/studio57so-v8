'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faFolder, faFolderOpen, faChevronRight, faChevronDown, faCity, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

export default function BimSidebar({ onSelectContext, selectedContext }) {
  const supabase = createClientComponentClient();
  const [structure, setStructure] = useState([]);
  const [expandedItems, setExpandedItems] = useState({});
  const [loading, setLoading] = useState(true);

  // Busca a estrutura hierárquica: Empresas -> Empreendimentos
  useEffect(() => {
    async function fetchStructure() {
      // 1. Busca Empresas
      const { data: empresas } = await supabase.from('cadastro_empresa').select('id, nome_fantasia');
      
      // 2. Busca Empreendimentos
      const { data: obras } = await supabase.from('empreendimentos').select('id, nome, empresa_proprietaria_id');

      // 3. Busca Disciplinas (categorias)
      const { data: disciplinas } = await supabase.from('disciplinas_projetos').select('*').order('sigla');

      // Monta a árvore
      const tree = empresas?.map(emp => ({
        ...emp,
        type: 'empresa',
        children: obras?.filter(obra => obra.empresa_proprietaria_id === emp.id).map(obra => ({
            ...obra,
            type: 'obra',
            children: disciplinas?.map(disc => ({
                ...disc,
                type: 'disciplina',
                parentId: obra.id, // Vincula disciplina à obra visualmente
                uniqueId: `${obra.id}-${disc.sigla}` // ID único para seleção
            }))
        }))
      })) || [];

      setStructure(tree);
      setLoading(false);
    }
    fetchStructure();
  }, []);

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) return <div className="p-4 text-xs text-gray-400">Carregando estrutura...</div>;

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
           <FontAwesomeIcon icon={faBuilding} className="text-orange-600"/> Explorador de Projetos
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {structure.map(empresa => (
          <div key={empresa.id} className="mb-2">
            {/* Nível 1: Empresa */}
            <div 
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer text-sm font-bold text-gray-800"
                onClick={() => toggleExpand(`emp-${empresa.id}`)}
            >
                <FontAwesomeIcon icon={expandedItems[`emp-${empresa.id}`] ? faChevronDown : faChevronRight} className="text-[10px] text-gray-400 w-3"/>
                <FontAwesomeIcon icon={faCity} className="text-blue-600"/>
                <span className="truncate">{empresa.nome_fantasia}</span>
            </div>

            {/* Nível 2: Empreendimentos */}
            {expandedItems[`emp-${empresa.id}`] && (
                <div className="pl-4 border-l border-gray-200 ml-2 mt-1 space-y-1">
                    {empresa.children?.map(obra => (
                        <div key={obra.id}>
                            <div 
                                className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-xs text-gray-700 font-medium"
                                onClick={() => toggleExpand(`obra-${obra.id}`)}
                            >
                                <FontAwesomeIcon icon={expandedItems[`obra-${obra.id}`] ? faFolderOpen : faFolder} className="text-yellow-500"/>
                                <span className="truncate">{obra.nome}</span>
                            </div>

                            {/* Nível 3: Disciplinas (Pastas Virtuais) */}
                            {expandedItems[`obra-${obra.id}`] && (
                                <div className="pl-5 space-y-0.5 mt-1">
                                    {obra.children?.map(disc => {
                                        const isSelected = selectedContext?.uniqueId === disc.uniqueId;
                                        return (
                                            <div 
                                                key={disc.id}
                                                onClick={() => onSelectContext({ type: 'folder', ...disc, obraId: obra.id, empresaId: empresa.id })}
                                                className={`
                                                    flex items-center gap-2 p-1.5 rounded cursor-pointer text-[11px] transition-colors
                                                    ${isSelected ? 'bg-blue-100 text-blue-800 font-bold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}
                                                `}
                                            >
                                                <FontAwesomeIcon icon={faLayerGroup} className={isSelected ? 'text-blue-500' : 'text-gray-300'}/>
                                                <span className="truncate">{disc.sigla} - {disc.nome}</span>
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
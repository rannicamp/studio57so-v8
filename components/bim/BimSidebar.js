// Caminho: components/bim/BimSidebar.js
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faBuilding, faFolder, faFolderOpen, faChevronRight, 
    faChevronDown, faCity, faLayerGroup, faSpinner, faGhost, faDatabase 
} from '@fortawesome/free-solid-svg-icons';

export default function BimSidebar({ onSelectContext, selectedContext }) {
  const supabase = createClient();
  const [expandedItems, setExpandedItems] = useState({});

  const { data: structure = [], isLoading } = useQuery({
    queryKey: ['bimStructureZero'], // Nova chave para ignorar cache antigo
    queryFn: async () => {
      // BUSCA TOTAL: Sem filtros, traz tudo o que existe na tabela
      const { data: projetos, error } = await supabase
        .from('projetos_bim')
        .select(`
            id,
            empresa_id, 
            empreendimento_id, 
            disciplina_id,
            cadastro_empresa (id, nome_fantasia, razao_social),
            empreendimentos (id, nome),
            disciplinas_projetos (id, sigla, nome)
        `);

      if (error) {
          console.error("Erro Fatal no Supabase:", error);
          return [];
      }

      const tree = [];

      projetos?.forEach(proj => {
        // Garantimos que sempre haverá um ID, nem que seja 'null'
        const empId = proj.cadastro_empresa?.id || proj.empresa_id || 'vazio';
        const empNome = proj.cadastro_empresa?.nome_fantasia || proj.cadastro_empresa?.razao_social || 'Empresa não vinculada';
        
        const obraId = proj.empreendimentos?.id || proj.empreendimento_id || 'vazio';
        const obraNome = proj.empreendimentos?.nome || 'Obra não vinculada';

        const discId = proj.disciplinas_projetos?.id || proj.disciplina_id || 'vazio';
        const discNome = proj.disciplinas_projetos ? `${proj.disciplinas_projetos.sigla} - ${proj.disciplinas_projetos.nome}` : 'Pasta Geral';

        // 1. Criar ou achar Empresa
        let empNode = tree.find(e => String(e.id) === String(empId));
        if (!empNode) {
          empNode = { id: empId, nome: empNome, children: [] };
          tree.push(empNode);
        }

        // 2. Criar ou achar Obra
        let obraNode = empNode.children.find(o => String(o.id) === String(obraId));
        if (!obraNode) {
          obraNode = { id: obraId, nome: obraNome, children: [] };
          empNode.children.push(obraNode);
        }

        // 3. Criar Disciplina (Contexto de clique)
        const uniqueId = `${obraId}-${discId}`;
        if (!obraNode.children.find(d => d.uniqueId === uniqueId)) {
          obraNode.children.push({
            id: discId,
            nome: discNome,
            uniqueId: uniqueId,
            obraId: obraId,
            empresaId: empId,
            type: 'folder'
          });
        }
      });

      return tree;
    },
    staleTime: 0
  });

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return (
      <div className="p-4 text-xs text-blue-500 font-bold animate-pulse">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> 
          ESTACA ZERO: LENDO TUDO...
      </div>
  );

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 h-full flex flex-col select-none">
      <div className="p-4 border-b border-gray-200 bg-blue-600 text-white shadow-md">
        <h2 className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
           <FontAwesomeIcon icon={faDatabase}/> Todos os Arquivos (Debug)
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {structure.length === 0 ? (
            <div className="p-10 text-center opacity-40">
                <FontAwesomeIcon icon={faGhost} className="text-3xl mb-2" />
                <p className="text-[10px] font-bold uppercase">Banco totalmente vazio</p>
            </div>
        ) : (
            structure.map(emp => (
              <div key={`emp-${emp.id}`} className="mb-1">
                <div 
                    className="flex items-center gap-2 p-2 hover:bg-gray-200 rounded cursor-pointer text-xs font-bold text-gray-800" 
                    onClick={() => toggleExpand(`e-${emp.id}`)}
                >
                    <FontAwesomeIcon icon={expandedItems[`e-${emp.id}`] ? faChevronDown : faChevronRight} className="text-[9px] w-2"/>
                    <FontAwesomeIcon icon={faCity} className="text-blue-500"/>
                    <span className="truncate">{emp.nome}</span>
                </div>

                {expandedItems[`e-${emp.id}`] && (
                    <div className="pl-4 border-l ml-3 space-y-1 mt-1">
                        {emp.children.map(obra => (
                            <div key={`obra-${obra.id}`}>
                                <div 
                                    className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-[11px] font-semibold text-gray-600" 
                                    onClick={() => toggleExpand(`o-${obra.id}`)}
                                >
                                    <FontAwesomeIcon icon={expandedItems[`o-${obra.id}`] ? faFolderOpen : faFolder} className="text-yellow-500"/>
                                    <span className="truncate">{obra.nome}</span>
                                </div>

                                {expandedItems[`o-${obra.id}`] && (
                                    <div className="pl-5 space-y-0.5 border-l ml-2">
                                        {obra.children.map(disc => (
                                            <div 
                                                key={disc.uniqueId}
                                                onClick={() => onSelectContext(disc)}
                                                className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-[10px] uppercase transition-all ${selectedContext?.uniqueId === disc.uniqueId ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-blue-50'}`}
                                            >
                                                <FontAwesomeIcon icon={faLayerGroup} className="w-3"/>
                                                <span className="truncate">{disc.nome}</span>
                                            </div>
                                        ))}
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
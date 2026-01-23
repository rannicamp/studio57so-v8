// Caminho: app/components/bim/ProjectList.js
'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileCode, faClock, faCheck, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';

export default function ProjectList({ onSelectProject, activeUrn }) {
  const supabase = createClientComponentClient();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca os projetos ao carregar
  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projetos_bim')
        .select('*')
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
    } finally {
      setLoading(false);
    }
  }

  // Função para deletar (opcional, mas útil para limpar testes)
  async function handleDelete(id, e) {
    e.stopPropagation(); // Evita selecionar ao clicar em deletar
    if(!confirm('Tem certeza que deseja apagar este registro do histórico?')) return;

    await supabase.from('projetos_bim').delete().eq('id', id);
    fetchProjects(); // Recarrega a lista
  }

  if (loading) return <div className="p-4 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2"/> Carregando lista...</div>;

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {projects.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">Nenhum projeto encontrado.</p>
      )}

      {projects.map((proj) => {
        const isActive = proj.urn_autodesk === activeUrn;
        
        return (
          <div 
            key={proj.id}
            onClick={() => onSelectProject(proj.urn_autodesk)}
            className={`
              relative p-3 rounded-lg border cursor-pointer transition-all group
              ${isActive 
                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm' 
                : 'bg-white border-gray-200 hover:border-orange-400 hover:shadow-md'
              }
            `}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`
                  w-8 h-8 rounded flex items-center justify-center shrink-0
                  ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-600'}
                `}>
                  <FontAwesomeIcon icon={faFileCode} />
                </div>
                
                <div className="min-w-0">
                  <h4 className={`text-sm font-bold truncate ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                    {proj.nome_arquivo}
                  </h4>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                    {new Date(proj.criado_em).toLocaleDateString('pt-BR')} às {new Date(proj.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>

              {/* Botão de Status / Ativo */}
              <div className="flex flex-col items-end gap-1">
                 {isActive && (
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                        ATIVO
                    </span>
                 )}
                 <button 
                    onClick={(e) => handleDelete(proj.id, e)}
                    className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remover do histórico"
                 >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                 </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
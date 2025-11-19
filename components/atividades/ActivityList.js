// components/atividades/ActivityList.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faLevelUpAlt, faSitemap } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

// Função auxiliar de datas
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const partes = cleanDate.split('-');
    if (partes.length !== 3) return dateStr;
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
}

const calculateBusinessDays = (d1, d2) => {
    if (!d1 || !d2) return 0;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    let count = 0;
    const curDate = new Date(date1.getTime());
    while (curDate <= date2) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count > 0 ? count - 1 : 0;
};

export default function ActivityList({ activities, requestSort, sortConfig, onEditClick, onDeleteClick, onStatusChange, canEdit, canDelete }) {
  
  // Lógica para Organizar Pai -> Filhos
  const organizedActivities = useMemo(() => {
      if (!activities) return [];

      // 1. Separar quem é Pai (ou órfão na lista atual) e quem é Filho
      const map = new Map();
      const roots = [];

      // Mapeia todas as atividades para acesso rápido
      activities.forEach(act => map.set(act.id, { ...act, children: [] }));

      // Organiza a hierarquia
      activities.forEach(act => {
          if (act.atividade_pai_id && map.has(act.atividade_pai_id)) {
              // Se tem pai e o pai está nesta lista filtrada, adiciona como filho
              map.get(act.atividade_pai_id).children.push(map.get(act.id));
          } else {
              // Se não tem pai OU o pai foi filtrado (não está na lista visível), vira raiz
              roots.push(map.get(act.id));
          }
      });

      // Função recursiva para "achatar" a lista na ordem correta para a tabela
      const flatten = (nodes, depth = 0) => {
          let flatList = [];
          // Ordena os nós atuais baseados na config de sort (se houver)
          const sortedNodes = [...nodes].sort((a, b) => {
               if (!sortConfig || !sortConfig.key) return 0;
               if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
               if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
               return 0;
          });

          sortedNodes.forEach(node => {
              flatList.push({ ...node, depth }); // Adiciona profundidade para indentação
              if (node.children.length > 0) {
                  flatList = [...flatList, ...flatten(node.children, depth + 1)];
              }
          });
          return flatList;
      };

      return flatten(roots);
  }, [activities, sortConfig]);


  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />;
    return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />;
  };
  
  if (!activities || activities.length === 0) {
    return <p className="p-4 text-gray-500">Nenhuma atividade encontrada.</p>;
  }

  const statusColors = {
    'Não Iniciado': 'bg-gray-100 text-gray-800', 'Em Andamento': 'bg-blue-100 text-blue-800',
    'Concluído': 'bg-green-100 text-green-800', 'Pausado': 'bg-yellow-100 text-yellow-800',
    'Aguardando Material': 'bg-purple-100 text-purple-800', 'Cancelado': 'bg-red-100 text-red-800',
  };

  const SortableHeader = ({ sortKey, children, className = '' }) => (
    <button onClick={() => requestSort(sortKey)} className={`flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 ${className}`}>
      {children}{getSortIcon(sortKey)}
    </button>
  );

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="nome">Atividade</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="status">Status</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_inicio_prevista">Início</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_fim_prevista">Fim Previsto</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_fim_real">Fim Real</SortableHeader></th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {organizedActivities.map((activity) => {
            const isCompletedLate = activity.data_fim_real && activity.data_fim_prevista && activity.data_fim_real > activity.data_fim_prevista;
            const delayInDays = isCompletedLate ? calculateBusinessDays(activity.data_fim_prevista, activity.data_fim_real) : 0;
            
            // Estilo de Indentação
            const paddingLeft = activity.depth > 0 ? `${activity.depth * 30 + 16}px` : '16px';
            const isSubtask = activity.depth > 0;

            return (
              <tr key={activity.id} className={`hover:bg-gray-50 ${isSubtask ? 'bg-gray-50/50' : ''}`}>
                <td className="py-4 whitespace-nowrap font-medium text-gray-900" style={{ paddingLeft }}>
                    <div className="flex items-center gap-2">
                        {isSubtask && <FontAwesomeIcon icon={faLevelUpAlt} className="text-gray-400 rotate-90 fa-xs" />}
                        <div className="flex flex-col">
                             <span>{activity.nome}</span>
                             {/* Se for um "órfão" (tem pai ID mas o pai não ta na lista), mostra quem é o pai */}
                             {activity.atividade_pai && activity.depth === 0 && (
                                 <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faSitemap} /> Subtarefa de: {activity.atividade_pai.nome}
                                 </span>
                             )}
                        </div>
                    </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <select 
                    value={activity.status} 
                    onChange={(e) => onStatusChange(activity.id, e.target.value)} 
                    disabled={!canEdit} 
                    className={`w-full p-1 border rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 ${statusColors[activity.status] || ''} ${!canEdit ? 'cursor-not-allowed' : ''}`} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option>
                  </select>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(activity.data_inicio_prevista)}</td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(activity.data_fim_prevista)}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={isCompletedLate ? 'text-red-600 font-bold' : ''}>{formatDate(activity.data_fim_real)}</span>
                  {isCompletedLate && <span className="block text-red-600 font-bold text-xs">({delayInDays} dias atraso)</span>}
                </td>
                <td className="px-4 py-4 text-center space-x-2">
                  {canEdit && (
                    <button onClick={() => onEditClick(activity)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-300">Editar</button>
                  )}
                  {canDelete && (
                    <button onClick={() => onDeleteClick(activity.id)} className="text-red-500 hover:text-red-700 px-2"><FontAwesomeIcon icon={faSort} transform={{ rotate: 45 }} className="hidden" /> Excluir</button>
                  )}
                  {canDelete && (
                      <button onClick={() => onDeleteClick(activity.id)} className="bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 text-xs">✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
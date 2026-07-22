// components/atividades/ActivityList.js
"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faLevelUpAlt, faSitemap, faTasks, faSearch, faEdit, faTrash, faCopy, faClipboardCheck, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { useMemo, useState, useEffect } from 'react';

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

export default function ActivityList({ activities, allActivitiesSummary = [], empreendimentos, requestSort, sortConfig, onEditClick, onDeleteClick, onDuplicateClick, onStatusChange, onToggleRdo, canEdit, canDelete, canCreate }) {

  // Calcula a profundidade global de cada ID usando o resumo de atividades da organização
  const globalDepths = useMemo(() => {
    const depths = new Map();
    if (!allActivitiesSummary || allActivitiesSummary.length === 0) return depths;

    const parentMap = new Map();
    allActivitiesSummary.forEach(act => parentMap.set(act.id, act.atividade_pai_id));

    const getDepth = (id) => {
      if (depths.has(id)) return depths.get(id);
      
      const parentId = parentMap.get(id);
      if (!parentId) {
        depths.set(id, 0);
        return 0;
      }
      
      const parentDepth = getDepth(parentId);
      const currentDepth = parentDepth + 1;
      depths.set(id, currentDepth);
      return currentDepth;
    };

    allActivitiesSummary.forEach(act => getDepth(act.id));
    return depths;
  }, [allActivitiesSummary]);

  const [page, setPage] = useState(1);
  const limit = 50;

  // Reseta para a página 1 sempre que a lista filtrada de atividades mudar
  useEffect(() => {
    setPage(1);
  }, [activities]);

  // Lógica para Organizar Pai -> Filhos
  const organizedActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];

    const map = new Map();
    const roots = [];

    activities.forEach(act => map.set(act.id, { ...act, children: [] }));

    activities.forEach(act => {
      if (act.atividade_pai_id && map.has(act.atividade_pai_id)) {
        map.get(act.atividade_pai_id).children.push(map.get(act.id));
      } else {
        roots.push(map.get(act.id));
      }
    });

    const flatten = (nodes, depth = 0) => {
      let flatList = [];
      const sortedNodes = [...nodes].sort((a, b) => {
        if (!sortConfig || !sortConfig.key) return 0;
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });

      sortedNodes.forEach(node => {
        flatList.push({ ...node, depth });
        if (node.children && node.children.length > 0) {
          flatList = flatList.concat(flatten(node.children, depth + 1));
        }
      });
      return flatList;
    };

    return flatten(roots);
  }, [activities, sortConfig]);

  // Calcula contadores de paginação local
  const totalCount = organizedActivities.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Fatiamento local de atividades para exibição leve
  const paginatedActivities = useMemo(() => {
    const from = (page - 1) * limit;
    const to = page * limit;
    return organizedActivities.slice(from, to);
  }, [organizedActivities, page]);


 const getSortIcon = (key) => {
 if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400" />;
 return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} /> : <FontAwesomeIcon icon={faSortDown} />;
 };

 if (!activities || activities.length === 0) {
 return (
 <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200 mt-4 mx-2">
 <FontAwesomeIcon icon={faSearch} className="text-5xl text-gray-300 mb-4" />
 <h3 className="text-lg font-semibold text-gray-700">Nenhuma atividade encontrada</h3>
 <p className="text-gray-500 text-sm mt-1">Não há tarefas correspondentes a esses filtros na listagem.</p>
 </div>
 );
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
    <>
     <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider w-[65px]">RDO</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[30%] min-w-[200px] max-w-[250px]"><SortableHeader sortKey="nome">Atividade</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[15%] min-w-[120px] max-w-[150px]"><SortableHeader sortKey="responsavel_texto">Responsável</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[15%] min-w-[120px] max-w-[150px]"><SortableHeader sortKey="empreendimento_id">Empreendimento</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[150px] min-w-[130px]"><SortableHeader sortKey="status">Status</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[110px]"><SortableHeader sortKey="data_inicio_prevista">Início</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[110px]"><SortableHeader sortKey="data_fim_prevista">Fim Previsto</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-[110px]"><SortableHeader sortKey="data_fim_real">Fim Real</SortableHeader></th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-[100px]">Ações</th>
          </tr>
        </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {paginatedActivities.map((activity) => {
 const isCompletedLate = activity.data_fim_real && activity.data_fim_prevista && activity.data_fim_real > activity.data_fim_prevista;
 const delayInDays = isCompletedLate ? calculateBusinessDays(activity.data_fim_prevista, activity.data_fim_real) : 0;

  // Estilo de Indentação (Infinita de acordo com a profundidade real na árvore)
  const depth = activity.depth !== undefined ? activity.depth : (globalDepths.get(activity.id) || 0);
  const paddingLeft = depth > 0 ? `${depth * 28 + 16}px` : '16px';
  const isSubtask = depth > 0;

  return (
  <tr key={activity.id} className={`hover:bg-gray-50 ${isSubtask ? 'bg-gray-50/50' : ''}`}>
  <td className="px-3 py-3 text-center whitespace-nowrap">
    <button
      type="button"
      onClick={() => onToggleRdo && onToggleRdo(activity.id, activity.exibe_rdo)}
      title={activity.exibe_rdo !== false ? "Exibida no Diário de Obras (RDO) - Clique para alternar" : "Oculta do Diário de Obras (RDO) - Clique para alternar"}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        activity.exibe_rdo !== false ? 'bg-emerald-500' : 'bg-gray-300 hover:bg-gray-400'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          activity.exibe_rdo !== false ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  </td>
  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 max-w-[320px]" style={{ paddingLeft }}>
  <div className="flex items-center gap-2 min-w-0 w-full">
  {isSubtask && <FontAwesomeIcon icon={faLevelUpAlt} className="text-gray-400 rotate-90 fa-xs flex-shrink-0" />}
  <div className="flex flex-col min-w-0 w-full">
  <span className="text-sm font-semibold truncate" title={activity.nome}>{activity.nome}</span>
 </div>
 </div>
 </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 w-[15%] min-w-[120px] max-w-[150px]">
              <span className="block truncate" title={activity.responsavel_texto || 'Sem responsável'}>
                {activity.responsavel_texto || <span className="text-gray-400 italic">Sem responsável</span>}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 w-[15%] min-w-[120px] max-w-[150px]">
              <span className="block truncate font-semibold text-purple-700 bg-purple-50 border border-purple-100 rounded px-2 py-0.5 w-fit max-w-full" title={(() => {
                const emp = empreendimentos?.find(e => e.id == activity.empreendimento_id);
                return emp ? emp.nome : '-';
              })()}>
                {(() => {
                  const emp = empreendimentos?.find(e => e.id == activity.empreendimento_id);
                  return emp ? emp.nome : '-';
                })()}
              </span>
            </td>
            <td className="px-4 py-3 whitespace-nowrap w-[150px] min-w-[130px]">
              <select
                value={activity.status}
                onChange={(e) => onStatusChange(activity.id, e.target.value)}
                disabled={!canEdit}
                className={`w-full p-1 border rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 max-w-[155px] ${statusColors[activity.status] || ''} ${!canEdit ? 'cursor-not-allowed' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option>
              </select>
            </td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 w-[110px]">{formatDate(activity.data_inicio_prevista)}</td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 w-[110px]">{formatDate(activity.data_fim_prevista)}</td>
 <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 w-[110px]">
 <span className={isCompletedLate ? 'text-red-600 font-bold' : ''}>{formatDate(activity.data_fim_real)}</span>
 {isCompletedLate && <span className="block text-red-600 font-bold text-xs">({delayInDays} dias atraso)</span>}
 </td>
 <td className="px-4 py-3 text-center w-[100px]">
    <div className="flex items-center justify-center gap-3">
      {canEdit && (
        <button 
          onClick={() => onEditClick(activity)} 
          className="text-blue-600 hover:text-blue-800 p-1 transition-colors" 
          title="Editar Atividade"
        >
          <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
        </button>
      )}
      {canCreate && onDuplicateClick && (
        <button 
          onClick={() => onDuplicateClick(activity)} 
          className="text-gray-500 hover:text-gray-700 p-1 transition-colors" 
          title="Duplicar Atividade"
        >
          <FontAwesomeIcon icon={faCopy} className="w-4 h-4" />
        </button>
      )}
      {canDelete && (
        <button 
          onClick={() => onDeleteClick(activity.id)} 
          className="text-red-500 hover:text-red-700 p-1 transition-colors" 
          title="Excluir Atividade"
        >
          <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
        </button>
      )}
    </div>
  </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>

  {/* Controles de Paginação Local */}
  {totalPages > 1 && (
    <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-b-lg border-t border-gray-200 gap-4 mt-1">
      <span className="text-sm text-gray-600">
        Mostrando <span className="font-semibold">{(page - 1) * limit + 1}</span> a{' '}
        <span className="font-semibold">{Math.min(page * limit, totalCount)}</span> de{' '}
        <span className="font-semibold">{totalCount}</span> atividades
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <span className="text-sm font-semibold text-gray-700">
          Página {page} de {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Próximo
        </button>
      </div>
    </div>
  )}
  </>
 );
}
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

export default function ActivityList({ activities, requestSort, sortConfig, onEditClick, onDeleteClick, onStatusChange }) {

  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <FontAwesomeIcon icon={faSort} className="text-gray-400" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <FontAwesomeIcon icon={faSortUp} />;
    }
    return <FontAwesomeIcon icon={faSortDown} />;
  };
  
  if (!activities || activities.length === 0) {
    return <p className="p-4 text-gray-500">Nenhuma atividade encontrada para este empreendimento.</p>;
  }

  const statusColors = {
    'Não Iniciado': 'bg-gray-100 text-gray-800',
    'Em Andamento': 'bg-blue-100 text-blue-800',
    'Concluído': 'bg-green-100 text-green-800',
    'Pausado': 'bg-yellow-100 text-yellow-800',
    'Aguardando Material': 'bg-purple-100 text-purple-800',
    'Cancelado': 'bg-red-100 text-red-800',
  };

  const SortableHeader = ({ sortKey, children }) => (
    <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900">
      {children}
      {getSortIcon(sortKey)}
    </button>
  );

  return (
    <div className="border-t border-gray-200">
      <div className="grid grid-cols-12 gap-4 bg-gray-100 p-4 text-left text-sm">
        <div className="col-span-3"><SortableHeader sortKey="tipo_atividade">Categoria</SortableHeader></div>
        <div className="col-span-3"><SortableHeader sortKey="nome">Nome da Atividade</SortableHeader></div>
        <div className="col-span-1"><SortableHeader sortKey="status">Status</SortableHeader></div>
        <div className="col-span-1"><SortableHeader sortKey="data_inicio_prevista">Início</SortableHeader></div>
        <div className="col-span-1"><SortableHeader sortKey="duracao_dias">Duração</SortableHeader></div>
        <div className="col-span-1"><SortableHeader sortKey="data_fim_prevista">Fim</SortableHeader></div>
        <div className="col-span-2 text-center font-semibold text-gray-700">Ações</div>
      </div>
      <ul className="divide-y divide-gray-200">
        {activities.map((activity) => (
          <li key={activity.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 text-sm">
            <div className="col-span-3 text-gray-700 truncate" title={activity.tipo_atividade}>{activity.tipo_atividade}</div>
            <div className="col-span-3 font-medium text-gray-900">{activity.nome}</div>
            <div className="col-span-1">
              <select
                value={activity.status}
                onChange={(e) => onStatusChange(activity.id, e.target.value)}
                className={`w-full p-1 border rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 ${statusColors[activity.status] || 'bg-gray-100 text-gray-800'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="Não Iniciado">Não Iniciado</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Concluído">Concluído</option>
                <option value="Pausado">Pausado</option>
                <option value="Aguardando Material">Aguardando Material</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
            <div className="col-span-1 text-gray-700">{activity.data_inicio_prevista || 'N/A'}</div>
            <div className="col-span-1 text-gray-700">{activity.duracao_dias !== null ? `${activity.duracao_dias} dias` : 'N/A'}</div>
            <div className="col-span-1 text-gray-700">{activity.data_fim_prevista || 'N/A'}</div>
            <div className="col-span-2 text-center space-x-2">
              <button onClick={() => onEditClick(activity)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-300">Editar</button>
              <button onClick={() => onDeleteClick(activity.id)} className="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-red-600">Deletar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
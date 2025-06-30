import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

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

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR');
}

export default function ActivityList({ activities, requestSort, sortConfig, onEditClick, onDeleteClick, onStatusChange }) {
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
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_inicio_prevista">Início Previsto</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_inicio_real">Início Real</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_fim_prevista">Fim Previsto</SortableHeader></th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"><SortableHeader sortKey="data_fim_real">Fim Real</SortableHeader></th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">Ações</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activities.map((activity) => {
            const isCompletedLate = activity.data_fim_real && activity.data_fim_prevista && activity.data_fim_real > activity.data_fim_prevista;
            const delayInDays = isCompletedLate ? calculateBusinessDays(activity.data_fim_prevista, activity.data_fim_real) : 0;
            return (
              <tr key={activity.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{activity.nome}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <select value={activity.status} onChange={(e) => onStatusChange(activity.id, e.target.value)} className={`w-full p-1 border rounded-md text-xs focus:ring-blue-500 focus:border-blue-500 ${statusColors[activity.status] || ''}`} onClick={(e) => e.stopPropagation()}>
                    <option>Não Iniciado</option><option>Em Andamento</option><option>Concluído</option><option>Pausado</option><option>Aguardando Material</option><option>Cancelado</option>
                  </select>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(activity.data_inicio_prevista)}</td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(activity.data_inicio_real)}</td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDate(activity.data_fim_prevista)}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={isCompletedLate ? 'text-red-600 font-bold' : ''}>{formatDate(activity.data_fim_real)}</span>
                  {isCompletedLate && <span className="block text-red-600 font-bold text-xs">({delayInDays} dias de atraso)</span>}
                </td>
                <td className="px-4 py-4 text-center space-x-2">
                  <button onClick={() => onEditClick(activity)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-300">Editar</button>
                  <button onClick={() => onDeleteClick(activity.id)} className="bg-red-500 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-red-600">Deletar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
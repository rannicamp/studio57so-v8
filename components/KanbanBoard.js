"use client";
import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

const TaskCard = ({ activity, onEditActivity }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = activity.data_fim_prevista ? new Date(activity.data_fim_prevista + 'T00:00:00') : null;
    const isOverdue = prazo && prazo < today && activity.status !== 'Concluído';

    return (
        <div
            className={`bg-white p-3 rounded-md shadow border-l-4 ${isOverdue ? 'border-red-500' : 'border-blue-500'} cursor-pointer hover:shadow-lg transition-shadow duration-200 kanban-card`}
            onClick={() => onEditActivity(activity)}
        >
            <h4 className="font-bold text-sm text-gray-800 line-clamp-2">{activity.nome}</h4>
            {activity.descricao && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{activity.descricao}</p>}
            <div className="text-xs text-gray-500 mt-3 flex justify-between items-center">
                {/* **A CORREÇÃO ESTÁ AQUI**: Usando 'responsavel_texto' para mostrar o nome */}
                <span>{activity.responsavel_texto || 'Sem responsável'}</span>
                {prazo && (
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                        {prazo.toLocaleDateString('pt-BR')}
                    </span>
                )}
            </div>
            {isOverdue && (
                <div className="text-xs font-bold text-red-600 mt-2 flex items-center gap-1">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    TAREFA ATRASADA
                </div>
            )}
        </div>
    );
};

export default function KanbanBoard({ activities, onEditActivity, onStatusChange }) {
    const statusColumns = useMemo(() => [
        { id: 'Não Iniciado', title: 'Não Iniciado' },
        { id: 'Em Andamento', title: 'Em Andamento' },
        { id: 'Pausado', title: 'Pausado' },
        { id: 'Aguardando Material', title: 'Aguardando Material' },
        { id: 'Concluído', title: 'Concluído' },
        { id: 'Cancelado', title: 'Cancelado' },
    ], []);

    const groupedData = useMemo(() => {
        const groups = {};
        statusColumns.forEach(col => {
            groups[col.id] = activities.filter(a => a.status === col.id);
        });
        return groups;
    }, [activities, statusColumns]);

    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e, newStatus) => {
        e.preventDefault();
        const activityId = parseInt(e.dataTransfer.getData('activityId'), 10);
        const currentStatus = activities.find(a => a.id === activityId)?.status;
        if (activityId && currentStatus !== newStatus) {
            onStatusChange(activityId, newStatus);
        }
    };

    return (
        <div className="flex gap-4 overflow-x-auto p-2">
            {statusColumns.map(column => (
                <div 
                    key={column.id} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className="w-80 flex-shrink-0 bg-gray-100 rounded-lg shadow-sm flex flex-col"
                >
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b">
                        <h3>{column.title} ({groupedData[column.id]?.length || 0})</h3>
                    </div>
                    <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
                        {groupedData[column.id] && groupedData[column.id].map(activity => (
                             <div 
                                key={activity.id}
                                draggable="true" 
                                onDragStart={(e) => e.dataTransfer.setData('activityId', activity.id)}
                             >
                                <TaskCard
                                    activity={activity}
                                    onEditActivity={onEditActivity}
                                />
                             </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
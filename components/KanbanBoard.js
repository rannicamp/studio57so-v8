"use client";
import { useMemo } from 'react';

// Componente do "Cartão de Tarefa"
const TaskCard = ({ activity, onEditActivity }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = activity.data_fim_prevista ? new Date(activity.data_fim_prevista + 'T00:00:00') : null;
    const isOverdue = prazo && prazo < today && activity.status !== 'Concluído';

    return (
        <div
            className={`bg-white p-4 rounded-lg shadow-sm mb-4 cursor-pointer hover:shadow-lg transition-shadow duration-200 border-l-4 ${isOverdue ? 'border-red-500' : 'border-transparent'}`}
            onClick={() => onEditActivity(activity)}
        >
            <h4 className="font-bold text-gray-800">{activity.nome}</h4>
            {activity.descricao && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{activity.descricao}</p>}

            <div className="text-xs text-gray-500 mt-3 flex justify-between items-center">
                <span>
                    {activity.responsavel?.full_name || 'Sem responsável'}
                </span>
                {prazo && (
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                        {prazo.toLocaleDateString('pt-BR')}
                    </span>
                )}
            </div>
            {isOverdue && <div className="text-xs font-bold text-red-600 mt-1">TAREFA ATRASADA</div>}
        </div>
    );
};

// Componente do Quadro Kanban
export default function KanbanBoard({ activities, onEditActivity }) {
    const columns = useMemo(() => {
        const statusOrder = ['Não Iniciado', 'Em Andamento', 'Pausado', 'Aguardando Material', 'Concluído', 'Cancelado'];
        
        const grouped = statusOrder.map(status => ({
            title: status,
            tasks: activities.filter(a => a.status === status)
        }));

        return grouped;

    }, [activities]);

    const statusColors = {
        'Não Iniciado': 'bg-gray-200',
        'Em Andamento': 'bg-blue-200',
        'Pausado': 'bg-yellow-200',
        'Aguardando Material': 'bg-purple-200',
        'Concluído': 'bg-green-200',
        'Cancelado': 'bg-red-200',
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
            {columns.map(col => (
                <div key={col.title} className={`rounded-lg p-3 ${statusColors[col.title] || 'bg-gray-200'}`}>
                    <h3 className="font-bold text-md text-gray-800 mb-4 px-1">
                        {col.title} ({col.tasks.length})
                    </h3>
                    <div className="space-y-4 h-[calc(100vh-250px)] overflow-y-auto">
                        {col.tasks.map(activity => (
                            <TaskCard
                                key={activity.id}
                                activity={activity}
                                onEditActivity={onEditActivity}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
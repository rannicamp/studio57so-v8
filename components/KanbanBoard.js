"use client";
import { useMemo, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSync } from '@fortawesome/free-solid-svg-icons';

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
                <span>{activity.responsavel_texto || 'Sem responsável'}</span>
                
                <div className="flex items-center gap-2">
                    {activity.is_recorrente && (
                        <FontAwesomeIcon icon={faSync} title="Tarefa Recorrente" />
                    )}
                    {prazo && (
                        <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                            {prazo.toLocaleDateString('pt-BR')}
                        </span>
                    )}
                </div>
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

export default function KanbanBoard({ activities, onEditActivity, onStatusChange, canEdit }) {
    const statusColumns = useMemo(() => [
        { id: 'Não Iniciado', title: 'Não Iniciado' },
        { id: 'Em Andamento', title: 'Em Andamento' },
        { id: 'Pausado', title: 'Pausado' },
        { id: 'Aguardando Material', title: 'Aguardando Material' },
        { id: 'Concluído', title: 'Concluído' },
        { id: 'Cancelado', title: 'Cancelado' },
    ], []);

    const scrollContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('button')) {
            return;
        }
        setIsDragging(true);
        const container = scrollContainerRef.current;
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
    };

    const handleMouseLeaveOrUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.style.cursor = 'grab';
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const container = scrollContainerRef.current;
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX); 
        container.scrollLeft = scrollLeft - walk;
    };

    const groupedData = useMemo(() => {
        const groups = {};
        statusColumns.forEach(col => {
            groups[col.id] = activities.filter(a => a.status === col.id);
        });
        return groups;
    }, [activities, statusColumns]);

    const handleDragOver = (e) => {
        if (canEdit) e.preventDefault();
    };
    
    const handleDrop = (e, newStatus) => {
        if (!canEdit) return;
        e.preventDefault();
        const activityId = parseInt(e.dataTransfer.getData('activityId'), 10);
        const currentStatus = activities.find(a => a.id === activityId)?.status;
        if (activityId && currentStatus !== newStatus) {
            onStatusChange(activityId, newStatus);
        }
    };

    return (
        <div 
            ref={scrollContainerRef}
            className={`flex gap-4 overflow-x-auto p-2 ${canEdit ? 'cursor-grab' : 'cursor-default'}`}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
        >
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
                                draggable={canEdit} // Só pode arrastar se puder editar
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
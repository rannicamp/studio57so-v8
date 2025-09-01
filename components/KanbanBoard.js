"use client";
import { useMemo, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import TaskCard from './TaskCard';

export default function KanbanBoard({ 
    activities, 
    onEditActivity, // Renomeado para onCardClick na passagem para o TaskCard
    onStatusChange, 
    canEdit,
    onDeleteActivity,
    onDuplicateActivity
}) { 

    const [editingColumnId, setEditingColumnId] = useState(null);
    const [editedColumnName, setEditedColumnName] = useState("");
    const [draggedItem, setDraggedItem] = useState(null);
    const scrollContainerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const statusColumns = useMemo(() => [
        { id: 'Não Iniciado', title: 'Não Iniciado' }, { id: 'Em Andamento', title: 'Em Andamento' },
        { id: 'Pausado', title: 'Pausado' }, { id: 'Aguardando Material', title: 'Aguardando Material' },
        { id: 'Concluído', title: 'Concluído' }, { id: 'Cancelado', title: 'Cancelado' },
    ], []);

    const handleMouseDown = (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('button')) { return; }
        setIsDragging(true);
        const container = scrollContainerRef.current;
        setStartX(e.pageX - container.offsetLeft);
        setScrollLeft(container.scrollLeft);
        container.style.cursor = 'grabbing';
    };

    const handleMouseLeaveOrUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (scrollContainerRef.current) { scrollContainerRef.current.style.cursor = 'grab'; }
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
        statusColumns.forEach(col => { groups[col.id] = activities.filter(a => a.status === col.id); });
        return groups;
    }, [activities, statusColumns]);

    const handleDragStart = (e, item, type) => {
        e.stopPropagation();
        setDraggedItem({ item, type });
        if (type === 'card') { e.dataTransfer.setData("activityId", item.id); }
    };

    const handleDragOver = (e) => { if (canEdit) e.preventDefault(); };

    const handleDrop = (e, newStatus) => {
        if (!canEdit) return;
        e.preventDefault();
        const activityId = parseInt(e.dataTransfer.getData('activityId'), 10);
        const currentStatus = activities.find(a => a.id === activityId)?.status;
        if (activityId && currentStatus !== newStatus) { onStatusChange(activityId, newStatus); }
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
                    <div className="p-3 text-sm font-semibold text-gray-700 border-b bg-gray-50 rounded-t-lg flex justify-between items-center cursor-move" draggable onDragStart={(e) => handleDragStart(e, column, 'column')} onDragEnd={() => setDraggedItem(null)}>
                       <h3 className="flex-grow">{column.title} ({groupedData[column.id]?.length || 0})</h3>
                    </div>
                    <div className="p-2 space-y-3 min-h-[100px] overflow-y-auto flex-1">
                        {(groupedData[column.id] || []).map(activity => (
                             <div 
                                key={activity.id}
                                draggable={canEdit}
                                onDragStart={(e) => handleDragStart(e, activity, 'card')}
                             >
                                <TaskCard
                                    activity={activity}
                                    onEditActivity={onEditActivity} // Passando a função de clique
                                    onDeleteActivity={onDeleteActivity}
                                    onDuplicateActivity={onDuplicateActivity}
                                    allColumns={statusColumns}
                                    onStatusChange={onStatusChange}
                                />
                             </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
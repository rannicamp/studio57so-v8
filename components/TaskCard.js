"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSync, faCalendarAlt, faUser, faEllipsisV, faEdit, faTrash, faCopy, faClock, faSitemap } from '@fortawesome/free-solid-svg-icons';

export default function TaskCard({ activity, onEditActivity, onDeleteActivity, onDuplicateActivity, allColumns, onStatusChange }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prazo = activity.data_fim_prevista ? new Date(activity.data_fim_prevista + 'T00:00:00Z') : null;
    const isOverdue = prazo && prazo < today && activity.status !== 'Concluído';

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    // Função para calcular dias úteis
    const calculateBusinessDays = (d1, d2) => {
        if (!d1 || !d2) return 0;
        const date1 = new Date(d1.replace(/-/g, '/'));
        const date2 = new Date(d2.replace(/-/g, '/'));
        let count = 0;
        const curDate = new Date(date1.getTime());
        while (curDate <= date2) {
            const dayOfWeek = curDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
            curDate.setDate(curDate.getDate() + 1);
        }
        return count;
    };

    const duracaoDias = calculateBusinessDays(activity.data_inicio_prevista, activity.data_fim_prevista);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleActionClick = (e, action) => {
        e.stopPropagation();
        action();
        setIsMenuOpen(false);
    };

    // Adicionado para permitir arrastar o card
    const handleDragStart = (e) => {
        e.dataTransfer.setData('activityId', activity.id);
    };

    return (
        <div
            draggable="true"
            onDragStart={handleDragStart}
            className={`bg-white rounded-md shadow p-3 border-l-4 ${isOverdue ? 'border-red-500' : 'border-blue-500'} hover:shadow-lg transition-shadow duration-200 cursor-pointer kanban-card flex flex-col justify-between min-h-[160px]`}
            onClick={() => onEditActivity(activity)}
        >
            <div>
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-gray-800 truncate pr-2" title={activity.nome}>{activity.nome}</p>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => handleActionClick(e, () => onDuplicateActivity(activity))} title="Duplicar Atividade" className="action-button text-gray-400 hover:text-blue-600">
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <p className="text-xs text-gray-500">#{activity.id}</p>
                    </div>
                </div>
                
                {/* ***** INÍCIO DA ADIÇÃO ***** */}
                {activity.atividade_pai && (
                    <div className="mb-2 text-xs text-gray-500 bg-gray-100 p-1 rounded-md flex items-center gap-2">
                        <FontAwesomeIcon icon={faSitemap} className="text-gray-400" />
                        <span>Sub-tarefa de: <span className="font-semibold">{activity.atividade_pai.nome}</span></span>
                    </div>
                )}
                {/* ***** FIM DA ADIÇÃO ***** */}

                {isOverdue && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold p-1 rounded-md mb-2 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>TAREFA ATRASADA</span>
                    </div>
                )}

                <div className="text-xs text-gray-600 mt-1 space-y-1">
                    <p className="flex items-center gap-2" title="Datas Previstas">
                        <FontAwesomeIcon icon={faCalendarAlt} className="w-3" />
                        <span>{formatDate(activity.data_inicio_prevista)} a {formatDate(activity.data_fim_prevista)}</span>
                    </p>
                    <p className="flex items-center gap-2" title="Duração Prevista">
                        <FontAwesomeIcon icon={faClock} className="w-3" />
                        <span>Duração: {duracaoDias} {duracaoDias === 1 ? 'dia útil' : 'dias úteis'}</span>
                    </p>
                    <p className="flex items-center gap-2" title="Responsável">
                        <FontAwesomeIcon icon={faUser} className="w-3" />
                        <span>{activity.responsavel_texto || 'Sem responsável'}</span>
                    </p>
                </div>
            </div>

            <div className="relative mt-2 pt-2 border-t action-button">
                <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="text-xs font-semibold text-gray-600 hover:text-gray-900 w-full text-left flex justify-between items-center">
                    <span>Status: {activity.status}</span>
                    <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                {isMenuOpen && (
                    <div ref={menuRef} className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-md shadow-lg z-20 border">
                        <p className="p-2 font-semibold text-xs text-gray-500 border-b">Mover para...</p>
                        {allColumns.map(status => (
                            <button key={status.id} onClick={(e) => handleActionClick(e, () => onStatusChange(activity.id, status.id))} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                {status.title}
                            </button>
                        ))}
                        <div className="border-t"></div>
                         <button onClick={(e) => handleActionClick(e, () => onEditActivity(activity))} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                            <FontAwesomeIcon icon={faEdit} /> Editar
                        </button>
                        <button onClick={(e) => handleActionClick(e, () => onDeleteActivity(activity.id))} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <FontAwesomeIcon icon={faTrash} /> Excluir
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
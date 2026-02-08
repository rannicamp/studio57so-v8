// components/ActivityCalendar.js

"use client";

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

// Componente para um único evento/atividade dentro do calendário
const CalendarEvent = ({ activity, onActivityClick }) => {
    const statusColors = {
        'Em Andamento': 'bg-blue-500',
        'Concluído': 'bg-green-500',
        'Pausado': 'bg-yellow-500',
        'Cancelado': 'bg-red-500',
        'Não Iniciado': 'bg-gray-400',
        'Aguardando Material': 'bg-purple-500',
    };
    const color = statusColors[activity.status] || 'bg-gray-400';

    return (
        <div
            onClick={() => onActivityClick(activity)}
            className={`p-1 mb-1 rounded-md text-white text-xs cursor-pointer hover:opacity-80 truncate ${color}`}
            title={activity.nome}
        >
            {activity.nome}
        </div>
    );
};

// Componente principal do Calendário
export default function ActivityCalendar({ activities, onActivityClick }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const calendarGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid = [];
        let dayCounter = 1;

        for (let i = 0; i < 6; i++) { // 6 semanas para cobrir todos os layouts de mês
            const week = [];
            for (let j = 0; j < 7; j++) { // 7 dias da semana
                if ((i === 0 && j < firstDayOfMonth) || dayCounter > daysInMonth) {
                    week.push({ day: null });
                } else {
                    const date = new Date(year, month, dayCounter);
                    const dateString = date.toISOString().split('T')[0];
                    const dayActivities = activities.filter(act => {
                        const startDate = act.data_inicio_prevista;
                        const endDate = act.data_fim_prevista;
                        return startDate && endDate && dateString >= startDate && dateString <= endDate;
                    });
                    
                    week.push({
                        day: dayCounter,
                        date: date,
                        isToday: new Date().toDateString() === date.toDateString(),
                        activities: dayActivities
                    });
                    dayCounter++;
                }
            }
            grid.push(week);
            if (dayCounter > daysInMonth) break;
        }
        return grid;
    }, [currentDate, activities]);

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <button onClick={goToPreviousMonth} className="p-2 hover:bg-gray-100 rounded-full">
                    <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <h2 className="text-xl font-bold text-gray-800">
                    {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={goToNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
                    <FontAwesomeIcon icon={faChevronRight} />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200">
                {weekDays.map(day => (
                    <div key={day} className="text-center font-semibold text-sm py-2 bg-gray-50">{day}</div>
                ))}
                {calendarGrid.flat().map((cell, index) => (
                    <div key={index} className="bg-white min-h-[120px] p-1">
                        {cell.day && (
                            <>
                                <div className={`text-xs ${cell.isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold' : 'text-gray-500'}`}>
                                    {cell.day}
                                </div>
                                <div className="mt-1">
                                    {cell.activities.map(activity => (
                                        <CalendarEvent key={activity.id} activity={activity} onActivityClick={onActivityClick} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é responsável por renderizar uma visualização de calendário mensal.
// Ele recebe uma lista de 'activities' e as distribui nos dias corretos do mês.
// O componente gerencia a navegação entre os meses e destaca o dia atual.
// Ele não modifica dados, apenas os exibe.
// --------------------------------------------------------------------------------
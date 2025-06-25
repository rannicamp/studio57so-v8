"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

// Função para formatar a data
const formatDate = (date) => {
    if (!date) return 'N/A';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('pt-BR', options);
};

// Configurações de status (CORRIGIDO AQUI)
const statusConfig = {
    'Em Andamento': { color: 'bg-blue-500', label: 'Em Andamento' },
    'Concluído': { color: 'bg-green-500', label: 'Concluído' },
    'Pausado': { color: 'bg-yellow-500', label: 'Pendente' },
    'Cancelado': { color: 'bg-red-500', label: 'Atrasado' },
    'Não Iniciado': { color: 'bg-gray-400', label: 'Não Iniciado' },
    'Aguardando Material': { color: 'bg-purple-500', label: 'Aguardando Material' },
};

// Componente para a coluna do dia
const DayColumn = ({ date }) => {
    const day = date.getUTCDay();
    const isWeekend = day === 6 || day === 0; // Sábado ou Domingo
    return (
        <div className={`w-20 text-center border-r border-gray-200 py-1 flex-shrink-0 ${isWeekend ? 'bg-red-100' : ''}`}>
            <div className="font-medium text-xs">{date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div className="font-bold">{date.getUTCDate()}</div>
            <div className="text-xs text-gray-500">{date.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })}</div>
        </div>
    );
}

export default function GanttChart({ activities }) {
    const [sortConfig, setSortConfig] = useState({ key: 'category', direction: 'ascending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
        if (sortConfig.direction === 'ascending') return <FontAwesomeIcon icon={faSortUp} className="ml-2" />;
        return <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
    };

    const { groupedTasks, timelineDates, totalDays, todayMarkerPosition } = useMemo(() => {
        const validActivities = activities 
            ? activities.filter(act => act.data_inicio_prevista && act.data_fim_prevista) 
            : [];

        if (validActivities.length === 0) {
            return { groupedTasks: {}, timelineDates: [], totalDays: 0, todayMarkerPosition: null };
        }

        const tasksWithDates = validActivities.map(act => ({
            ...act,
            startDate: new Date(`${act.data_inicio_prevista}T00:00:00Z`),
            endDate: new Date(`${act.data_fim_prevista}T00:00:00Z`),
        }));

        const allDates = tasksWithDates.flatMap(t => [t.startDate, t.endDate]);
        const minDate = new Date(Math.min.apply(null, allDates));
        const maxDate = new Date(Math.max.apply(null, allDates));
        
        let currentDate = new Date(minDate);
        currentDate.setUTCDate(currentDate.getUTCDate() - 1);
        let finalDate = new Date(maxDate);
        finalDate.setUTCDate(finalDate.getUTCDate() + 1);

        const dates = [];
        let tempDate = new Date(currentDate);
        while (tempDate <= finalDate) {
            dates.push(new Date(tempDate));
            tempDate.setUTCDate(tempDate.getUTCDate() + 1);
        }

        const groups = tasksWithDates.reduce((acc, task) => {
            const category = task.tipo_atividade || 'Sem Categoria';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const todayIndex = dates.findIndex(d => d.getTime() === today.getTime());
        
        let todayMarkerPosition = null;
        if (todayIndex !== -1) {
            todayMarkerPosition = `${todayIndex * 80 + 40}px`;
        }

        return { groupedTasks: groups, timelineDates: dates, totalDays: dates.length, todayMarkerPosition };

    }, [activities]);

    const sortedGroupEntries = useMemo(() => {
        const entries = Object.entries(groupedTasks);
        if (sortConfig.key === 'category') {
            entries.sort(([keyA], [keyB]) => {
                const comparison = keyA.localeCompare(keyB);
                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return entries;
    }, [groupedTasks, sortConfig]);

    const getBarPosition = (task) => {
        const timelineStart = timelineDates[0].getTime();
        const startOffsetDays = (task.startDate.getTime() - timelineStart) / (1000 * 60 * 60 * 24);
        const diffTime = Math.abs(task.endDate - task.startDate);
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        return {
            left: `${startOffsetDays * 80}px`,
            width: `${durationDays * 80}px`,
        };
    };

    if (totalDays === 0) {
        return <p className="p-4 text-center text-gray-500">Nenhuma atividade com datas válidas para exibir no gráfico.</p>;
    }

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="flex">
                <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
                    <div className="h-[61px] flex items-center p-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-20">
                         <button onClick={() => requestSort('category')} className="flex items-center font-semibold text-gray-800 hover:text-gray-900">
                            <span>TAREFAS</span>
                            {getSortIcon('category')}
                        </button>
                    </div>
                    <div>
                        {sortedGroupEntries.map(([category, tasksInCategory]) => (
                            <div key={category}>
                                <div className="w-full p-2 border-b border-t border-gray-200 bg-gray-100">
                                    <h4 className="font-bold text-gray-700 text-sm uppercase truncate" title={category}>{category}</h4>
                                </div>
                                {tasksInCategory.map((task) => (
                                    <div key={task.id} className="p-3 border-b border-gray-100 min-h-[60px]">
                                        <div className="font-medium text-gray-800 text-sm truncate" title={task.nome}>{task.nome}</div>
                                        <div className="text-xs text-gray-500">{formatDate(task.startDate)} - {formatDate(task.endDate)}</div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <div className="relative" style={{ width: `${totalDays * 80}px` }}>
                        <div className="flex sticky top-0 bg-white z-10 border-b border-gray-200">
                            {timelineDates.map(date => <DayColumn key={date.toISOString()} date={date} />)}
                        </div>
                        <div>
                            {sortedGroupEntries.map(([category, tasksInCategory]) => (
                                <div key={category}>
                                    <div className="w-full h-[37px] border-b border-t border-gray-200 bg-gray-100"></div>
                                    {tasksInCategory.map((task) => {
                                        const { left, width } = getBarPosition(task);
                                        const config = statusConfig[task.status] || { color: 'bg-gray-300', label: 'Indefinido' };
                                        return (
                                            <div key={task.id} className="relative h-[60px] border-b border-gray-100">
                                                <div
                                                    className={`absolute h-8 rounded-md ${config.color} transition-all duration-200 ease-in-out hover:opacity-80 flex items-center px-2`}
                                                    style={{ left, width, top: '14px' }}
                                                    title={`${task.nome} (${config.label})`}
                                                >
                                                    <span className="text-white text-xs font-semibold truncate">{task.nome}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        {todayMarkerPosition && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none"
                                style={{ left: todayMarkerPosition }}
                                title="Hoje"
                            ></div>
                        )}
                    </div>
                </div>
            </div>
            <div className="bg-white p-4 mt-2 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Legenda</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {Object.values(statusConfig).map(status => (
                        <div key={status.label} className="flex items-center gap-2">
                            <div className={`w-4 h-4 ${status.color} rounded-sm`}></div>
                            <span className="text-xs text-gray-600">{status.label}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-0.5 h-full bg-red-500"></div>
                        </div>
                        <span className="text-xs text-gray-600">Hoje</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faHistory, faCircle } from '@fortawesome/free-solid-svg-icons';

// Funções auxiliares (sem alterações)
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const DayColumn = ({ date }) => {
    const day = date.getUTCDay();
    const isWeekend = day === 6 || day === 0;
    return (
        <div className={`w-20 text-center border-r border-gray-200 py-1 flex-shrink-0 ${isWeekend ? 'bg-red-50' : ''}`}>
            <div className="font-medium text-xs">{date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div className="font-bold">{date.getUTCDate()}</div>
            <div className="text-xs text-gray-500">{date.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })}</div>
        </div>
    );
}

// NOVO: Componente da Legenda
const GanttLegend = () => {
    return (
        <div className="mt-4 p-3 flex justify-center items-center gap-6 text-xs text-gray-600 border-t bg-gray-50">
            <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCircle} className="text-gray-300" />
                <span>Planejado</span>
            </div>
            <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCircle} className="text-blue-500" />
                <span>Real (No Prazo)</span>
            </div>
             <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCircle} className="text-red-500" />
                <span>Real (Atrasado)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-0.5 h-4 bg-red-500"></div>
                <span>Hoje</span>
            </div>
        </div>
    );
};


// Componente Principal do Gráfico de Gantt
export default function GanttChart({ activities }) {
    const [sortConfig, setSortConfig] = useState({ key: 'tipo_atividade', direction: 'ascending' });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
        return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} className="ml-2" /> : <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
    };

    const { sortedGroupEntries, deliveryTasks, timelineDates, totalDays, todayMarkerPosition } = useMemo(() => {
        const validActivities = activities ? activities.filter(act => act.data_inicio_prevista && act.data_fim_prevista) : [];
        if (validActivities.length === 0) return { sortedGroupEntries: [], deliveryTasks: [], timelineDates: [], totalDays: 0, todayMarkerPosition: null };

        const tasksWithDates = validActivities.map(act => ({
            ...act,
            startDate: new Date(`${act.data_inicio_prevista}T00:00:00Z`),
            endDate: new Date(`${act.data_fim_prevista}T00:00:00Z`),
            realStartDate: act.data_inicio_real ? new Date(`${act.data_inicio_real}T00:00:00Z`) : null,
            realEndDate: act.data_fim_real ? new Date(`${act.data_fim_real}T00:00:00Z`) : null,
        }));
        
        // **LÓGICA DE SEPARAÇÃO**
        const deliveryTasks = tasksWithDates.filter(t => t.tipo_atividade === 'Entrega de Pedido');
        const mainTasks = tasksWithDates.filter(t => t.tipo_atividade !== 'Entrega de Pedido');

        let minDate = new Date(Math.min.apply(null, tasksWithDates.map(t => t.startDate)));
        let maxDate = new Date(Math.max.apply(null, tasksWithDates.map(t => t.realEndDate || t.endDate)));
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (today > maxDate) maxDate = today;

        const dates = [];
        let tempDate = new Date(minDate);
        tempDate.setUTCDate(tempDate.getUTCDate() - 1);
        while (tempDate <= maxDate) {
            dates.push(new Date(tempDate));
            tempDate.setUTCDate(tempDate.getUTCDate() + 1);
        }

        const groups = mainTasks.reduce((acc, task) => {
            const category = task.tipo_atividade || 'Sem Categoria';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});
        
        const todayIndex = dates.findIndex(d => d.getTime() === today.getTime());
        const todayMarkerPosition = todayIndex !== -1 ? `${todayIndex * 80 + 40}px` : null;

        const entries = Object.entries(groups);
        if (sortConfig.key === 'tipo_atividade') {
            entries.sort(([keyA], [keyB]) => sortConfig.direction === 'ascending' ? keyA.localeCompare(keyB) : keyB.localeCompare(keyA));
        }

        return { sortedGroupEntries: entries, deliveryTasks, timelineDates: dates, totalDays: dates.length, todayMarkerPosition };
    }, [activities, sortConfig]);


    const daysSinceStart = (date) => {
        if (!timelineDates[0] || !date) return 0;
        return (date.getTime() - timelineDates[0].getTime()) / (1000 * 60 * 60 * 24);
    };

    if (totalDays === 0) return <p className="p-4 text-center text-gray-500">Nenhuma atividade com datas válidas para exibir no gráfico.</p>;
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Função de renderização para uma linha de tarefa
    const renderTaskRow = (task) => {
        const plannedLeft = daysSinceStart(task.startDate) * 80;
        const plannedWidth = (daysSinceStart(task.endDate) - daysSinceStart(task.startDate) + 1) * 80;
        let realLeft = 0, realWidth = 0;
        if(task.realStartDate) {
            realLeft = daysSinceStart(task.realStartDate) * 80;
            const endPoint = task.realEndDate || (task.status === 'Em Andamento' ? today : null);
            if (endPoint) {
                realWidth = (daysSinceStart(endPoint) - daysSinceStart(task.realStartDate) + 1) * 80;
            }
        }
        const isOverdue = task.realEndDate && task.endDate && task.realEndDate > task.endDate;
        const realBarColor = isOverdue ? 'bg-red-500' : 'bg-blue-500';

        return (
             <div key={task.id} className="relative h-[60px] border-b border-gray-100">
                <div className="absolute h-1/2 top-0 left-0 right-0">
                    <div className="absolute h-5 bg-gray-300 rounded-md flex items-center" style={{ left: `${plannedLeft}px`, width: `${plannedWidth}px`, top: '4px' }}>
                        <span className="text-gray-800 text-[10px] font-semibold truncate px-2">{task.nome}</span>
                    </div>
                </div>
                <div className="absolute h-1/2 bottom-0 left-0 right-0">
                    {realWidth > 0 && (
                        <div className={`absolute h-5 ${realBarColor} rounded-md flex items-center`} style={{ left: `${realLeft}px`, width: `${realWidth}px`, bottom: '4px' }}>
                            <span className="text-white text-[10px] font-semibold truncate px-2">{task.nome}</span>
                        </div>
                    )}
                </div>
                {task.data_fim_original && (
                    <FontAwesomeIcon icon={faHistory} className="absolute text-orange-500" style={{ left: `${plannedLeft + plannedWidth + 5}px`, top: '8px' }} title={`Reprogramado. Fim original: ${formatDate(task.data_fim_original)}`} />
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="flex">
                <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
                    <div className="h-[61px] flex items-center p-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-20">
                         <button onClick={() => requestSort('tipo_atividade')} className="flex items-center font-semibold text-gray-800 hover:text-gray-900">
                            <span>TAREFAS</span>
                            {getSortIcon('tipo_atividade')}
                        </button>
                    </div>
                    <div>
                        {sortedGroupEntries.map(([category, tasksInCategory]) => (
                            <div key={category}>
                                <div className="w-full p-2 border-b border-t border-gray-200 bg-gray-100"><h4 className="font-bold text-gray-700 text-sm uppercase truncate" title={category}>{category}</h4></div>
                                {tasksInCategory.map((task) => (
                                    <div key={task.id} className="p-3 border-b border-gray-100 min-h-[60px] flex flex-col justify-center">
                                        <div className="font-medium text-gray-800 text-sm truncate" title={task.nome}>{task.nome}</div>
                                        <div className="text-xs text-gray-500">Previsto: {formatDate(task.data_inicio_prevista)} - {formatDate(task.data_fim_prevista)}</div>
                                        {task.data_inicio_real && <div className="text-xs text-blue-600">Real: {formatDate(task.data_inicio_real)} - {formatDate(task.data_fim_real)}</div>}
                                    </div>
                                ))}
                            </div>
                        ))}
                         {deliveryTasks.length > 0 && (
                             <div key="delivery-category">
                                <div className="w-full p-2 border-b border-t-2 border-blue-200 bg-blue-50"><h4 className="font-bold text-blue-800 text-sm uppercase truncate">ENTREGA DE PEDIDOS</h4></div>
                                {deliveryTasks.map((task) => (
                                     <div key={task.id} className="p-3 border-b border-gray-100 min-h-[60px] flex flex-col justify-center">
                                        <div className="font-medium text-gray-800 text-sm truncate" title={task.nome}>{task.nome}</div>
                                        <div className="text-xs text-gray-500">Previsto: {formatDate(task.data_inicio_prevista)} - {formatDate(task.data_fim_prevista)}</div>
                                        {task.data_inicio_real && <div className="text-xs text-blue-600">Real: {formatDate(task.data_inicio_real)} - {formatDate(task.data_fim_real)}</div>}
                                    </div>
                                ))}
                            </div>
                         )}
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
                                    {tasksInCategory.map(renderTaskRow)}
                                </div>
                            ))}
                            {deliveryTasks.length > 0 && (
                                <div key="delivery-timeline">
                                    <div className="w-full h-[37px] border-b border-t-2 border-blue-200 bg-blue-50"></div>
                                    {deliveryTasks.map(renderTaskRow)}
                                </div>
                            )}
                        </div>
                        {todayMarkerPosition && (<div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none" style={{ left: todayMarkerPosition }} title="Hoje"></div>)}
                    </div>
                </div>
            </div>
            <GanttLegend />
        </div>
    );
}
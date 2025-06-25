"use client";

import { useMemo } from 'react';

// Função para formatar a data, corrigindo o problema de fuso horário na exibição
const formatDate = (date) => {
    if (!date) return 'N/A';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('pt-BR', options);
};

// Objeto para mapear o status da tarefa para as cores e legendas
const statusConfig = {
    'Em Andamento': { color: 'bg-blue-500', label: 'Em Progresso' },
    'Concluído': { color: 'bg-green-500', label: 'Concluído' },
    'Pausado': { color: 'bg-yellow-500', label: 'Pendente' },
    'Cancelado': { color: 'bg-red-500', label: 'Atrasado' },
    'Não iniciado': { color: 'bg-gray-400', label: 'Não Iniciado' },
    'Aguardando material': { color: 'bg-purple-500', label: 'Aguardando Material' },
};

// Pequeno componente para a coluna de cada dia, para deixar o código mais limpo
const DayColumn = ({ date }) => (
    <div className="w-20 text-center border-r border-gray-200 py-1 flex-shrink-0">
        <div className="font-medium text-xs">{date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })}</div>
        <div className="font-bold">{date.getDate()}</div>
        <div className="text-xs text-gray-500">{date.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })}</div>
    </div>
);


export default function GanttChart({ activities }) {

    const { groupedTasks, timelineDates, totalDays } = useMemo(() => {
        const validActivities = activities 
            ? activities.filter(act => act.data_inicio_prevista && act.data_fim_prevista) 
            : [];

        if (validActivities.length === 0) {
            return { groupedTasks: {}, timelineDates: [], totalDays: 0 };
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
        currentDate.setDate(currentDate.getDate() - 1);
        let finalDate = new Date(maxDate);
        finalDate.setDate(finalDate.getDate() + 1);

        const dates = [];
        while (currentDate <= finalDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const groups = tasksWithDates.reduce((acc, task) => {
            const category = task.tipo_atividade || 'Sem Categoria';
            if (!acc[category]) acc[category] = [];
            acc[category].push(task);
            return acc;
        }, {});

        return { groupedTasks: groups, timelineDates: dates, totalDays: dates.length };

    }, [activities]);

    const getBarPosition = (task) => {
        if (!task.startDate || !task.endDate) return { left: '0%', width: '0%' };

        const timelineStart = timelineDates[0].getTime();
        const diffTime = Math.abs(task.endDate - task.startDate);
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const startOffsetDays = (task.startDate.getTime() - timelineStart) / (1000 * 60 * 60 * 24);
        
        return {
            left: `${(startOffsetDays / totalDays) * 100}%`,
            width: `${(durationDays / totalDays) * 100}%`,
        };
    };

    if (totalDays === 0) {
        return <p className="p-4 text-center text-gray-500">Nenhuma atividade com datas válidas para exibir no gráfico.</p>;
    }

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Cabeçalho Fixo da Timeline */}
            <div className="border-b border-gray-200 bg-gray-50 flex sticky top-0 z-20">
                <div className="w-80 p-4 border-r border-gray-200 flex-shrink-0">
                    <h3 className="font-semibold text-gray-800">Tarefas</h3>
                </div>
                <div className="flex-1 overflow-x-auto">
                    <div className="flex" style={{ width: `${totalDays * 80}px` }}>
                        {timelineDates.map(date => <DayColumn key={date.toISOString()} date={date} />)}
                    </div>
                </div>
            </div>

            {/* Corpo Rolável do Gráfico */}
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
                {Object.entries(groupedTasks).map(([category, tasksInCategory]) => (
                    <div key={category}>
                        {/* Título da Categoria/Etapa - Removido o 'sticky' que causava o problema */}
                        <div className="flex">
                            <div className="w-full p-2 border-b border-t border-gray-200 bg-gray-100">
                                <h4 className="font-bold text-gray-700 text-sm uppercase">{category}</h4>
                            </div>
                        </div>
                        
                        {tasksInCategory.map((task) => {
                            const { left, width } = getBarPosition(task);
                            const config = statusConfig[task.status] || { color: 'bg-gray-300', label: 'Indefinido' };
                            return (
                                <div key={task.id} className="flex border-b border-gray-100 min-h-[60px] hover:bg-gray-50">
                                    <div className="w-80 p-3 border-r border-gray-200 flex-shrink-0">
                                        <div className="font-medium text-gray-800 text-sm truncate" title={task.name}>{task.name}</div>
                                        <div className="text-xs text-gray-500">{formatDate(task.startDate)} - {formatDate(task.endDate)}</div>
                                    </div>
                                    <div className="flex-1 relative" style={{ minWidth: `${totalDays * 80}px` }}>
                                        <div
                                            className={`absolute h-8 rounded-md ${config.color} transition-all duration-200 ease-in-out hover:opacity-80 flex items-center px-2`}
                                            style={{ left, width, top: '14px' }}
                                            title={`${task.name} (${config.label})`}
                                        >
                                            <span className="text-white text-xs font-semibold truncate">{task.name}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Legenda */}
            <div className="bg-white rounded-xl p-4 mt-2 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Legenda</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {Object.values(statusConfig).map(status => (
                        <div key={status.label} className="flex items-center gap-2">
                            <div className={`w-4 h-4 ${status.color} rounded-sm`}></div>
                            <span className="text-xs text-gray-600">{status.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
// components/atividades/GanttChart.js
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faHistory, faCircle, faCalendarDay, faLevelUpAlt } from '@fortawesome/free-solid-svg-icons';

const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
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

const GanttLegend = () => (
    <div className="mt-4 p-3 flex justify-center items-center gap-6 text-xs text-gray-600 border-t bg-gray-50 no-print">
        <div className="flex items-center gap-2"><FontAwesomeIcon icon={faCircle} className="text-gray-300" /><span>Planejado</span></div>
        <div className="flex items-center gap-2"><FontAwesomeIcon icon={faCircle} className="text-blue-500" /><span>Real (No Prazo)</span></div>
        <div className="flex items-center gap-2"><FontAwesomeIcon icon={faCircle} className="text-red-500" /><span>Real (Atrasado)</span></div>
        <div className="flex items-center gap-2"><div className="w-0.5 h-4 bg-red-500"></div><span>Hoje</span></div>
    </div>
);

export default function GanttChart({ activities, onEditActivity }) {
    const [sortConfig, setSortConfig] = useState({ key: 'data_inicio_prevista', direction: 'ascending' });
    const scrollContainerRef = useRef(null);

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

    // --- LÓGICA PRINCIPAL DE DADOS ---
    const { structuredTasks, timelineDates, totalDays, todayMarkerPosition } = useMemo(() => {
        // 1. Filtragem Agressiva: Remove "Entrega de Pedido"
        const validActivities = activities ? activities.filter(act => {
            // Verifica existência de datas
            if (!act.data_inicio_prevista || !act.data_fim_prevista) return false;
            
            // Verifica Tipo de Atividade (Case Insensitive e Trimmed)
            const tipo = act.tipo_atividade ? act.tipo_atividade.toLowerCase().trim() : '';
            if (tipo.includes('entrega') && tipo.includes('pedido')) return false;
            if (tipo === 'entrega') return false;
            
            return true;
        }) : [];

        if (validActivities.length === 0) return { structuredTasks: [], timelineDates: [], totalDays: 0, todayMarkerPosition: null };

        // 2. Preparação dos Dados (Datas)
        const tasksWithDates = validActivities.map(act => ({
            ...act,
            startDate: new Date(`${act.data_inicio_prevista}T00:00:00Z`),
            endDate: new Date(`${act.data_fim_prevista}T00:00:00Z`),
            realStartDate: act.data_inicio_real ? new Date(`${act.data_inicio_real}T00:00:00Z`) : null,
            realEndDate: act.data_fim_real ? new Date(`${act.data_fim_real}T00:00:00Z`) : null,
        }));

        // 3. Definição da Linha do Tempo (Min/Max Dates)
        let minDate = new Date(Math.min.apply(null, tasksWithDates.map(t => t.startDate)));
        let maxDate = new Date(Math.max.apply(null, tasksWithDates.map(t => t.realEndDate || t.endDate)));
        
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        if (today > maxDate) maxDate = today;

        const dates = [];
        let tempDate = new Date(minDate);
        tempDate.setUTCDate(tempDate.getUTCDate() - 7); // Margem de segurança antes
        maxDate.setUTCDate(maxDate.getUTCDate() + 14);  // Margem de segurança depois
        while (tempDate <= maxDate) {
            dates.push(new Date(tempDate));
            tempDate.setUTCDate(tempDate.getUTCDate() + 1);
        }

        const todayIndex = dates.findIndex(d => d.getTime() === today.getTime());
        const todayMarkerPosition = todayIndex !== -1 ? `${todayIndex * 80 + 40}px` : null;

        // 4. LÓGICA DE HIERARQUIA (PAI -> FILHO -> NETO)
        
        // Mapa auxiliar para encontrar filhos rapidamente
        const childrenMap = {};
        tasksWithDates.forEach(task => {
            if (task.atividade_pai_id) {
                if (!childrenMap[task.atividade_pai_id]) childrenMap[task.atividade_pai_id] = [];
                childrenMap[task.atividade_pai_id].push(task);
            }
        });

        // Identifica Raízes (Atividades sem pai ou cujo pai não está na lista filtrada)
        // Nota: Para ser estrito "Pai", não deve ter pai_id.
        // Se quisermos mostrar "netos órfãos" como raiz, precisaríamos ajustar, mas vamos assumir árvore completa.
        const roots = tasksWithDates.filter(t => !t.atividade_pai_id);

        // Função de ordenação
        const sortFn = (a, b) => {
             if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
             if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
             return 0;
        };

        roots.sort(sortFn);

        // Construção da lista plana (Flattening) com 3 níveis
        const flattenedList = [];
        
        roots.forEach(root => {
            // NÍVEL 0: PAI
            flattenedList.push({ ...root, level: 0 });
            
            const children = childrenMap[root.id] || [];
            children.sort(sortFn); // Ordena filhos por data ou nome

            children.forEach(child => {
                // NÍVEL 1: FILHO
                flattenedList.push({ ...child, level: 1 });

                const grandchildren = childrenMap[child.id] || [];
                grandchildren.sort(sortFn); // Ordena netos

                grandchildren.forEach(grandchild => {
                    // NÍVEL 2: NETO
                    flattenedList.push({ ...grandchild, level: 2 });
                    
                    // Se houver bisnetos (Nível 3+), adicione lógica recursiva aqui se necessário.
                    // Por enquanto paramos no neto conforme solicitado.
                });
            });
        });

        return { structuredTasks: flattenedList, timelineDates: dates, totalDays: dates.length, todayMarkerPosition };
    }, [activities, sortConfig]);
    
    // Scroll inicial para "Hoje"
    useEffect(() => {
        const scrollToToday = () => {
            const container = scrollContainerRef.current;
            if (container && todayMarkerPosition) {
                const markerPos = parseFloat(todayMarkerPosition.replace('px', ''));
                const containerWidth = container.offsetWidth;
                const scrollPos = markerPos - (containerWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        };
        const timer = setTimeout(() => { scrollToToday(); }, 100);
        return () => clearTimeout(timer);
    }, [todayMarkerPosition]);


    const daysSinceStart = (date) => {
        if (!timelineDates[0] || !date) return 0;
        return (date.getTime() - timelineDates[0].getTime()) / (1000 * 60 * 60 * 24);
    };

    if (totalDays === 0) return <p className="p-4 text-center text-gray-500">Nenhuma atividade de obra para exibir no gráfico.</p>;
    
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const renderTaskRow = (task) => {
        const plannedLeft = daysSinceStart(task.startDate) * 80;
        const plannedWidth = (daysSinceStart(task.endDate) - daysSinceStart(task.startDate) + 1) * 80;
        
        let realLeft = 0, realWidth = 0;
        
        if (task.realStartDate) {
            realLeft = daysSinceStart(task.realStartDate) * 80;
            
            let endPoint = task.realEndDate;
            if (task.status === 'Em Andamento' && !task.realEndDate) {
                endPoint = today;
            }

            if (endPoint) {
                realWidth = (daysSinceStart(endPoint) - daysSinceStart(task.realStartDate) + 1) * 80;
            }
        }
        
        const isOverdue = task.realEndDate && task.endDate && task.realEndDate > task.endDate;
        const realBarColor = isOverdue ? 'bg-red-500' : 'bg-blue-500';

        return (
             <div key={task.id} className="relative h-[60px] border-b border-gray-100 hover:bg-gray-50 transition-colors">
                 {/* Barra Planejada (Cinza) */}
                 <div className="absolute h-1/2 top-0 left-0 right-0">
                     <div className="absolute h-5 bg-gray-300 rounded-md flex items-center overflow-hidden opacity-80" style={{ left: `${plannedLeft}px`, width: `${plannedWidth}px`, top: '4px' }}>
                     </div>
                 </div>
                 {/* Barra Real (Colorida) */}
                 <div className="absolute h-1/2 bottom-0 left-0 right-0">
                     {realWidth > 0 && (
                         <div className={`absolute h-5 ${realBarColor} rounded-md flex items-center overflow-hidden shadow-sm`} style={{ left: `${realLeft}px`, width: `${realWidth}px`, bottom: '4px' }}>
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
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            {/* Header de Controle */}
            <div className="p-4 border-b no-print flex justify-between items-center bg-gray-50">
                <h3 className="font-semibold text-gray-700">Cronograma de Atividades</h3>
                <button 
                    onClick={() => {
                        const container = scrollContainerRef.current;
                        if (container && todayMarkerPosition) {
                            const markerPos = parseFloat(todayMarkerPosition.replace('px', ''));
                            const containerWidth = container.offsetWidth;
                            const scrollPos = markerPos - (containerWidth / 2);
                            container.scrollTo({ left: scrollPos, behavior: 'smooth' });
                        }
                    }}
                    className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 text-sm shadow-sm flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faCalendarDay} className="text-blue-500" />
                    Ir para Hoje
                </button>
            </div>

            <div className="flex">
                {/* COLUNA DA ESQUERDA (NOMES E HIERARQUIA) */}
                <div className="w-96 flex-shrink-0 border-r border-gray-200 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-20">
                    {/* Header da Coluna */}
                    <div className="h-[61px] flex items-center p-4 border-b border-gray-200 bg-gray-50">
                         <button onClick={() => requestSort('nome')} className="flex items-center font-bold text-gray-700 text-xs uppercase tracking-wider hover:text-blue-600 transition-colors">
                             <span>Atividade</span>
                             {getSortIcon('nome')}
                         </button>
                    </div>
                    {/* Lista de Atividades */}
                    <div>
                        {structuredTasks.map((task) => {
                            // Definindo classes baseadas no nível
                            let paddingClass = 'pl-4'; // Nível 0
                            let borderClass = '';
                            let bgClass = 'bg-white';
                            let textClass = 'text-gray-800 font-semibold';
                            
                            if (task.level === 1) { // Filho
                                paddingClass = 'pl-8';
                                borderClass = 'border-l-4 border-l-transparent hover:border-l-blue-300';
                                bgClass = 'bg-gray-50/50';
                                textClass = 'text-gray-700';
                            } else if (task.level === 2) { // Neto
                                paddingClass = 'pl-12';
                                borderClass = 'border-l-4 border-l-transparent hover:border-l-blue-500';
                                bgClass = 'bg-gray-100/50';
                                textClass = 'text-gray-600 text-sm';
                            }

                            return (
                                <div 
                                    key={task.id} 
                                    onClick={() => onEditActivity(task)}
                                    className={`
                                        py-1 border-b border-gray-100 h-[60px] flex flex-col justify-center cursor-pointer hover:bg-blue-50 transition-colors group
                                        ${paddingClass} ${borderClass} ${bgClass}
                                    `}
                                >
                                    <div className="flex items-center">
                                        {task.level > 0 && <FontAwesomeIcon icon={faLevelUpAlt} className="text-gray-400 mr-2 transform rotate-90" style={{ width: '10px' }} />}
                                        <div className={`truncate pr-2 ${textClass}`} title={task.nome}>
                                            {task.nome}
                                        </div>
                                    </div>
                                    <div className={`text-[10px] mt-0.5 flex gap-2 ${task.level > 0 ? 'pl-5' : ''}`}>
                                        <span className="text-gray-400">Prev: {formatDate(task.data_inicio_prevista)}</span>
                                        {task.data_inicio_real && <span className="text-blue-600 font-medium">Real: {formatDate(task.data_inicio_real)}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* COLUNA DA DIREITA (TIMELINE) */}
                <div className="flex-1 overflow-x-auto custom-scrollbar" ref={scrollContainerRef}>
                    <div className="relative" style={{ width: `${totalDays * 80}px` }}>
                        {/* Header de Datas */}
                        <div className="flex sticky top-0 bg-white z-10 border-b border-gray-200 h-[61px] shadow-sm">
                            {timelineDates.map(date => <DayColumn key={date.toISOString()} date={date} />)}
                        </div>
                        
                        {/* Linhas do Gráfico */}
                        <div>
                            {structuredTasks.map(task => renderTaskRow(task))}
                        </div>

                        {/* Marcador de Hoje */}
                        {todayMarkerPosition && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{ left: todayMarkerPosition }} title="Hoje">
                                <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <GanttLegend />
        </div>
    );
}
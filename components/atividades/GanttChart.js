// components/atividades/GanttChart.js
"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearchPlus, faSearchMinus, faCalendarDay 
} from '@fortawesome/free-solid-svg-icons';

// Utilitário de formatação de data
const formatDate = (dateString) => {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        return 'N/A';
    }
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

// --- CONSTANTES DE LAYOUT ---
const ROW_HEIGHT = 32;   
const HEADER_HEIGHT = 48; 

// Componente da Coluna de Dia
const DayColumn = ({ date, width }) => {
    const day = date.getUTCDay();
    const isWeekend = day === 6 || day === 0;
    
    return (
        <div 
            className={`text-center border-r border-gray-100 flex-shrink-0 flex flex-col justify-center ${isWeekend ? 'bg-red-50/50' : ''}`}
            style={{ width: `${width}px`, minWidth: `${width}px`, height: `${HEADER_HEIGHT}px` }}
        >
            <div className="font-medium text-[9px] uppercase text-gray-400 leading-none mb-0.5">
                {date.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}
            </div>
            <div className="font-bold text-[10px] text-gray-700 leading-none">
                {date.getUTCDate()}
            </div>
        </div>
    );
};

// Legenda
const GanttLegend = () => (
    <div className="flex gap-4 p-2 bg-gray-50 border-t text-[10px] text-gray-600 justify-end shrink-0">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Planejado</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Realizado</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Atrasado</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> Hoje</div>
    </div>
);

export default function GanttChart({ activities, onEditActivity }) {
    // --- ESTADO DO ZOOM ---
    const [columnWidth, setColumnWidth] = useState(40); 

    // Refs para sincronizar scroll
    const taskListRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // --- FUNÇÕES DE ZOOM ---
    const zoomIn = () => setColumnWidth(prev => Math.min(prev + 10, 120));
    const zoomOut = () => setColumnWidth(prev => Math.max(prev - 5, 20));

    // --- SINCRONIA DE SCROLL VERTICAL ---
    const handleScrollRight = (e) => {
        if (taskListRef.current) taskListRef.current.scrollTop = e.target.scrollTop;
    };

    const handleWheelLeft = (e) => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop += e.deltaY;
    };

    // 1. Range de Datas
    const { startDate, endDate, totalDays } = useMemo(() => {
        if (!activities || activities.length === 0) {
            const now = new Date();
            return { startDate: now, endDate: now, totalDays: 1 };
        }

        let min = new Date(activities[0].start_date || new Date());
        let max = new Date(activities[0].end_date || new Date());

        activities.forEach(act => {
            if (act.start_date) {
                const start = new Date(act.start_date);
                if (start < min) min = start;
            }
            if (act.end_date) {
                const end = new Date(act.end_date);
                if (end > max) max = end;
            }
        });

        // Margem de segurança visual
        min.setDate(min.getDate() - 5);
        max.setDate(max.getDate() + 15);

        // Resetar horas para garantir cálculos de dias inteiros
        min.setHours(0, 0, 0, 0);
        max.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(max - min);
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        return { startDate: min, endDate: max, totalDays };
    }, [activities]);

    // 2. Array de Datas
    const timelineDates = useMemo(() => {
        const dates = [];
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, [startDate, totalDays]);

    // 3. Estruturar Tarefas
    const structuredTasks = useMemo(() => {
        return activities.map(act => {
            const start = new Date(act.start_date);
            // Zera horas para evitar bug de fuso
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(act.end_date || act.start_date);
            end.setHours(0, 0, 0, 0);
            
            let startDiff = 0;
            if (!isNaN(start)) {
                // Math.floor aqui garante que pegamos o dia correto
                startDiff = Math.floor((start - startDate) / (1000 * 60 * 60 * 24));
            }
            
            let duration = 1;
            if (!isNaN(start) && !isNaN(end)) {
                duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
                // Tarefas de 1 dia (inicio == fim) tem duração 0 na subtração, forçamos 1
                if (duration < 1) duration = 1;
                // Adiciona 1 dia para incluir o dia final visualmente
                else duration += 1; 
            }

            return { ...act, startDiff, duration };
        });
    }, [activities, startDate]);

    // 4. Marcador de Hoje (Posição em Pixels) - CORREÇÃO CRÍTICA
    const todayMarkerPosition = useMemo(() => {
        const today = new Date();
        // ZERAR AS HORAS é o segredo para não pular o dia
        today.setHours(0, 0, 0, 0);
        
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);

        if (today >= start && today <= end) {
            const diffTime = today.getTime() - start.getTime();
            // Math.floor para índice exato do dia
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // Centraliza no meio da coluna do dia correto
            return (diffDays * columnWidth) + (columnWidth / 2);
        }
        return null;
    }, [startDate, endDate, columnWidth]);

    // --- FUNÇÃO PARA ROLAR ATÉ "HOJE" ---
    const scrollToToday = () => {
        if (scrollContainerRef.current && todayMarkerPosition) {
            const containerWidth = scrollContainerRef.current.clientWidth;
            scrollContainerRef.current.scrollTo({
                left: todayMarkerPosition - (containerWidth / 2),
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToToday();
        }, 100);
        return () => clearTimeout(timer);
    }, [todayMarkerPosition]);

    // Renderização da Barra
    const renderTaskBar = (task) => {
        const left = task.startDiff * columnWidth;
        const width = task.duration * columnWidth;
        
        let barColor = 'bg-blue-500';
        let progressColor = 'bg-blue-700';
        
        if (task.status === 'Concluído') { barColor = 'bg-green-500'; progressColor = 'bg-green-700'; }
        else if (task.status === 'Atrasado') { barColor = 'bg-red-500'; progressColor = 'bg-red-700'; }
        else if (task.status === 'Pausado') { barColor = 'bg-yellow-400'; progressColor = 'bg-yellow-600'; }

        const isLate = task.end_date && new Date(task.end_date) < new Date() && task.status !== 'Concluído';
        if (isLate) { barColor = 'bg-red-400'; }

        return (
            <div 
                className={`absolute top-1 bottom-1 rounded shadow-sm ${barColor} cursor-pointer hover:brightness-110 transition-all flex items-center`}
                style={{ left: `${left}px`, width: `${width}px` }}
                onClick={() => onEditActivity(task)}
                title={`${task.nome} (${task.status})`}
            >
                {task.progresso > 0 && (
                    <div 
                        className={`h-full rounded-l ${progressColor} opacity-50`} 
                        style={{ width: `${task.progresso}%` }}
                    ></div>
                )}
                {/* Nome flutuante se a barra for pequena */}
                <span className={`text-[9px] font-bold text-white px-2 truncate sticky left-0 ${width < 40 ? 'hidden group-hover:block absolute -top-5 bg-gray-800 text-white z-50 rounded p-1 w-max' : ''}`}>
                    {task.nome}
                </span>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden text-xs">
            {/* Header de Controles */}
            <div className="p-2 border-b bg-gray-50 flex justify-between items-center shrink-0">
                <div className="text-gray-500 font-medium text-[10px] uppercase flex items-center gap-2">
                    Horizonte Temporal
                    {/* BOTÃO VOLTAR PARA HOJE */}
                    {todayMarkerPosition && (
                        <button 
                            onClick={scrollToToday}
                            className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition-colors ml-2"
                            title="Centralizar em Hoje"
                        >
                            <FontAwesomeIcon icon={faCalendarDay} />
                            <span>Hoje</span>
                        </button>
                    )}
                </div>
                
                {/* Controles de Zoom */}
                <div className="flex items-center gap-2">
                    <button onClick={zoomOut} className="p-1 px-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600 shadow-sm active:scale-95 transition-all" title="Ver mais dias">
                        <FontAwesomeIcon icon={faSearchMinus} className="text-xs" />
                    </button>
                    <span className="text-[10px] font-bold text-gray-400 w-8 text-center">{columnWidth}px</span>
                    <button onClick={zoomIn} className="p-1 px-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600 shadow-sm active:scale-95 transition-all" title="Ver detalhes">
                        <FontAwesomeIcon icon={faSearchPlus} className="text-xs" />
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* COLUNA ESQUERDA: LISTA DE TAREFAS */}
                <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)] flex flex-col">
                    {/* Header Fixo */}
                    <div 
                        className="border-b border-gray-200 bg-gray-50 flex items-center px-3 font-bold text-gray-600 text-[10px] uppercase tracking-wider shrink-0"
                        style={{ height: `${HEADER_HEIGHT}px` }}
                    >
                        Atividade
                    </div>
                    {/* Lista com Scroll Oculto (Controlado pelo lado direito) */}
                    <div 
                        ref={taskListRef}
                        onWheel={handleWheelLeft}
                        className="overflow-hidden flex-1"
                    >
                        {structuredTasks.map(task => (
                            <div 
                                key={task.id} 
                                className="border-b border-gray-50 flex items-center px-3 hover:bg-blue-50 cursor-pointer transition-colors"
                                style={{ height: `${ROW_HEIGHT}px` }}
                                onClick={() => onEditActivity(task)}
                            >
                                <div className="truncate font-medium text-gray-700 text-[10px]" title={task.nome}>
                                    {task.nome}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* COLUNA DIREITA: TIMELINE */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScrollRight}
                    className="flex-1 overflow-auto custom-scrollbar bg-white"
                >
                    <div className="relative" style={{ width: `${totalDays * columnWidth}px` }}>
                        {/* Header de Datas (Sticky) */}
                        <div className="flex sticky top-0 bg-white z-10 border-b border-gray-200 shadow-sm">
                            {timelineDates.map(date => (
                                <DayColumn 
                                    key={date.toISOString()} 
                                    date={date} 
                                    width={columnWidth} 
                                />
                            ))}
                        </div>
                        
                        {/* Corpo do Gráfico */}
                        <div className="relative">
                            {/* Grid de Fundo */}
                            <div className="absolute inset-0 flex pointer-events-none">
                                {timelineDates.map((_, i) => (
                                    <div key={i} className="border-r border-dashed border-gray-100 h-full" style={{ width: `${columnWidth}px` }}></div>
                                ))}
                            </div>

                            {/* Linhas de Tarefa */}
                            {structuredTasks.map(task => (
                                <div 
                                    key={task.id} 
                                    className="relative border-b border-gray-50 hover:bg-gray-50 transition-colors group"
                                    style={{ height: `${ROW_HEIGHT}px` }}
                                >
                                    {renderTaskBar(task)}
                                </div>
                            ))}
                        </div>

                        {/* Marcador de Hoje */}
                        {todayMarkerPosition && (
                            <div 
                                className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]" 
                                style={{ left: `${todayMarkerPosition}px` }} 
                            >
                                <div className="absolute -top-1 -left-[3px] w-[7px] h-[7px] bg-red-500 rounded-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <GanttLegend />
        </div>
    );
}
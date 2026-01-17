// app/(main)/financeiro/auditoria/page.js
"use client";

import { useLayout } from '@/contexts/LayoutContext';
import { useState, useEffect } from 'react';
import AuditoriaKanban from '@/components/financeiro/AuditoriaKanban';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCalendar, faFilter } from '@fortawesome/free-solid-svg-icons';

export default function AuditoriaPage() {
    const { setPageTitle } = useLayout();
    
    // Estado de filtro inicializado com o mês atual
    const [filters, setFilters] = useState(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        return {
            startDate: firstDay,
            endDate: lastDay,
            searchTerm: '',
            status: [], 
            tipo: ['Despesa'] // Auditoria foca em despesas geralmente
        };
    });

    useEffect(() => {
        setPageTitle('Auditoria Financeira IA');
    }, [setPageTitle]);

    // Função para atualizar as datas quando o usuário muda o input
    const handleDateChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="w-full p-4 max-w-7xl space-y-4">
            {/* Cabeçalho com Controles */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                
                {/* Título e Voltar */}
                <div className="flex items-center gap-4">
                    <Link href="/financeiro" className="text-gray-400 hover:text-indigo-600 transition p-2 rounded-full hover:bg-indigo-50">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Centro de Auditoria</h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <FontAwesomeIcon icon={faFilter} className="text-gray-300"/>
                            Gerencie e audite seus lançamentos por período
                        </p>
                    </div>
                </div>
                
                {/* Seletores de Data */}
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">Período:</span>
                        
                        <div className="relative">
                            <input 
                                type="date" 
                                value={filters.startDate}
                                onChange={(e) => handleDateChange('startDate', e.target.value)}
                                className="pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-700 bg-white shadow-sm hover:border-indigo-300 transition-colors"
                            />
                            <FontAwesomeIcon icon={faCalendar} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                        </div>
                        
                        <span className="text-gray-400 font-medium">até</span>
                        
                        <div className="relative">
                            <input 
                                type="date" 
                                value={filters.endDate}
                                onChange={(e) => handleDateChange('endDate', e.target.value)}
                                className="pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-700 bg-white shadow-sm hover:border-indigo-300 transition-colors"
                            />
                            <FontAwesomeIcon icon={faCalendar} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* O Kanban recebe os filtros e se atualiza automaticamente graças ao React Query */}
            <AuditoriaKanban filters={filters} />
        </div>
    );
}
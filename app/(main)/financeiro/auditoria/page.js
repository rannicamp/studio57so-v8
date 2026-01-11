// app/(main)/financeiro/auditoria/page.js
"use client";

import { useLayout } from '@/contexts/LayoutContext';
import { useState, useEffect } from 'react';
import AuditoriaKanban from '@/components/financeiro/AuditoriaKanban'; // <--- Novo Componente
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faFilter } from '@fortawesome/free-solid-svg-icons';

export default function AuditoriaPage() {
    const { setPageTitle } = useLayout();
    
    // Estado simples de filtro para começar (Mês Atual)
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

    return (
        <div className="container mx-auto p-4 max-w-7xl space-y-4">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-4">
                    <Link href="/financeiro" className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Centro de Auditoria</h1>
                        <p className="text-xs text-gray-500">Visualização Kanban do período: {filters.startDate} a {filters.endDate}</p>
                    </div>
                </div>
                
                {/* Aqui você pode adicionar inputs para mudar a data do filtro depois */}
            </div>

            <AuditoriaKanban filters={filters} />
        </div>
    );
}
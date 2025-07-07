"use client";

import { useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import KpiBuilderManager from '../../../../components/financeiro/KpiBuilderManager';

export default function KpiBuilderPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle("Construtor de Índices e KPIs Financeiros");
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <Link href="/financeiro" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para o Painel Financeiro
            </Link>
            <div className="bg-white p-6 rounded-lg shadow mt-4">
                <KpiBuilderManager />
            </div>
        </div>
    );
}
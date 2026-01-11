// app/(main)/financeiro/auditoria/page.js
"use client";

import { useLayout } from '@/contexts/LayoutContext';
import { useEffect } from 'react';
import AuditoriaFinanceira from '@/components/financeiro/AuditoriaFinanceira';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function AuditoriaPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle('Auditoria Financeira IA');
    }, [setPageTitle]);

    return (
        <div className="container mx-auto p-4 max-w-6xl space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Link href="/financeiro" className="text-gray-400 hover:text-gray-600 transition p-2 rounded-full hover:bg-gray-100">
                    <FontAwesomeIcon icon={faArrowLeft} />
                </Link>
                <h1 className="text-2xl font-bold text-gray-800">Centro de Auditoria</h1>
            </div>

            <AuditoriaFinanceira />
        </div>
    );
}
"use client";

import { useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import Link from 'next/link';
import AdsManager from '../../../../components/comercial/AdsManager';

export default function AnunciosPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle("Gerenciador de Anúncios da Meta");
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gerenciador de Anúncios</h1>
            <p className="text-gray-600">
                Visualize o desempenho de suas campanhas e anúncios da Meta diretamente no sistema.
            </p>
            <div className="bg-white p-6 rounded-lg shadow mt-4">
                <AdsManager />
            </div>
        </div>
    );
}
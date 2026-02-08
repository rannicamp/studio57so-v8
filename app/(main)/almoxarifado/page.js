// app/(main)/almoxarifado/page.js
"use client";

import { useLayout } from '../../../contexts/LayoutContext';
import AlmoxarifadoManager from '../../../components/almoxarifado/AlmoxarifadoManager';
import { useEffect } from 'react';

export default function AlmoxarifadoPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle('Almoxarifado');
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 uppercase">Gestão de Estoque</h1>
            </div>
            <AlmoxarifadoManager />
        </div>
    );
}
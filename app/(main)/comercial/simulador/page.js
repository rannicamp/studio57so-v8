"use client";

import { useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import SimuladorVendas from '../../../../components/comercial/SimuladorVendas'; // Vamos criar este componente a seguir

export default function SimuladorPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle("Simulador de Propostas de Venda");
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <SimuladorVendas />
            </div>
        </div>
    );
}
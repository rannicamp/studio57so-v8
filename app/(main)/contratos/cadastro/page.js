"use client";

import { useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import ContratoForm from '../../../../components/contratos/ContratoForm'; // O formulário que vamos criar
import Link from 'next/link';

export default function CadastroContratoPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle("Cadastro de Novo Contrato");
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <Link href="/contratos" className="text-blue-500 hover:underline mb-4 inline-block">
                &larr; Voltar para a Lista de Contratos
            </Link>
            <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
                <ContratoForm />
            </div>
        </div>
    );
}
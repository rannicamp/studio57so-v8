"use client";

import { useEffect } from 'react';
import { useLayout } from '../../../../../contexts/LayoutContext';
import ImportacaoFinanceiraManager from '../../../../../components/financeiro/ImportacaoFinanceiraManager';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function ImportacaoFinanceiraPage() {
    const { setPageTitle } = useLayout();

    useEffect(() => {
        setPageTitle("Assistente de Importação Financeira");
    }, [setPageTitle]);

    return (
        <div className="space-y-6">
            <Link href="/financeiro" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para o Painel Financeiro
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Importar Lançamentos do Sistema Antigo</h1>
            <p className="text-gray-600">
                Siga os passos para importar seus dados. O assistente irá ajudá-lo a mapear colunas e criar contas ou categorias que não existem.
            </p>
            <div className="bg-white p-6 rounded-lg shadow mt-4">
                <ImportacaoFinanceiraManager />
            </div>
        </div>
    );
}
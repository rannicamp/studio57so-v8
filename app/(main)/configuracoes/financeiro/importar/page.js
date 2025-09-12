"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext'; // Caminho de importação corrigido e padronizado
import ImportacaoFinanceiraManager from '@/components/financeiro/ImportacaoFinanceiraManager'; // Componente correto importado
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

export default function ImportacaoFinanceiraPage() {
    const router = useRouter();
    const { hasPermission, loading: authLoading } = useAuth();

    // Verificamos a permissão específica para esta página
    const canViewPage = hasPermission('config_financeiro_importar', 'pode_ver');

    useEffect(() => {
        // Se a autenticação terminou e o usuário NÃO PODE ver a página, redireciona
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);

    // Enquanto o estado de autenticação está carregando, mostramos um spinner
    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-gray-600">Verificando permissões...</span>
            </div>
        );
    }

    // Se o usuário não tiver permissão, mostramos uma mensagem de acesso negado
    if (!canViewPage) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para acessar esta página.</p>
            </div>
        );
    }

    // Se o usuário tiver permissão, a página é renderizada normalmente
    return (
        <div className="space-y-6">
            <Link href="/configuracoes" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faArrowLeft} />
                Voltar para Configurações
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
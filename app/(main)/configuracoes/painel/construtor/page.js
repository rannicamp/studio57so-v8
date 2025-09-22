//app\(main)\configuracoes\painel\construtor\page.js
"use client";

// 1. IMPORTAMOS O NOSSO GERENCIADOR INTELIGENTE
import ConstrutorKpiManager from '@/components/painel/ConstrutorKpiManager';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

// A PÁGINA AGORA FICA ASSIM, BEM MAIS LIMPA E SIMPLES
export default function ConstrutorKpiPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const canViewPage = hasPermission('config_kpi_builder', 'pode_ver');

    useEffect(() => {
        if (!authLoading && !canViewPage) {
            router.push('/');
        }
    }, [authLoading, canViewPage, router]);

    if (authLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    }

    if (!canViewPage) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para acessar o construtor de KPIs.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Gerenciador de KPIs</h1>
            <p className="text-gray-600 mb-6">Crie, edite e gerencie os indicadores que aparecerão no seu painel de controle.</p>
            
            {/* 2. A PÁGINA AGORA CHAMA O GERENCIADOR PARA FAZER TODO O TRABALHO PESADO */}
            <ConstrutorKpiManager />
        </div>
    );
}
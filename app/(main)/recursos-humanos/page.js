// app/(main)/recursos-humanos/page.js
"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '../../../contexts/LayoutContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faClock, faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

// Importando os componentes que antes eram páginas
import GerenciamentoFuncionarios from '../../../components/rh/GerenciamentoFuncionarios';
import GerenciamentoPonto from '../../../components/rh/GerenciamentoPonto';

export default function RecursosHumanosPage() {
    const { setPageTitle } = useLayout();
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    
    const [activeTab, setActiveTab] = useState('funcionarios');

    // Permissões
    const canViewFuncionarios = hasPermission('funcionarios', 'pode_ver');
    const canViewPonto = hasPermission('ponto', 'pode_ver');

    useEffect(() => {
        setPageTitle("Recursos Humanos");
        // Se o usuário não pode ver nenhuma das abas, redireciona para a home
        if (!authLoading && !canViewFuncionarios && !canViewPonto) {
            router.push('/');
        }
    }, [setPageTitle, authLoading, canViewFuncionarios, canViewPonto, router]);

    const TabButton = ({ tabName, label, icon, isVisible }) => {
        if (!isVisible) return null;
        return (
            <button
                onClick={() => setActiveTab(tabName)}
                className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 ${
                    activeTab === tabName
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <FontAwesomeIcon icon={icon} /> {label}
            </button>
        );
    };
    
    if (authLoading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando...</div>;
    }

    if (!canViewFuncionarios && !canViewPonto) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para acessar esta seção.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Recursos Humanos</h1>
            
            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="flex gap-4 px-4">
                    <TabButton tabName="funcionarios" label="Funcionários" icon={faUsers} isVisible={canViewFuncionarios} />
                    <TabButton tabName="ponto" label="Controle de Ponto" icon={faClock} isVisible={canViewPonto} />
                </nav>
            </div>

            <div className="mt-4">
                {activeTab === 'funcionarios' && canViewFuncionarios && <GerenciamentoFuncionarios />}
                {activeTab === 'ponto' && canViewPonto && <GerenciamentoPonto />}
            </div>
        </div>
    );
}
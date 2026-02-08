"use client";

import { useState, useEffect, useRef } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebounce } from 'use-debounce';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTags, 
    faFileImport, 
    faHandshake, 
    faArrowLeft, 
    faShieldAlt,
    faSpinner,
    faLock
} from '@fortawesome/free-solid-svg-icons';

// Componentes
import CategoriasManager from '@/components/financeiro/CategoriasManager';
import ImportacaoFinanceiraManager from '@/components/financeiro/ImportacaoFinanceiraManager';
import ConciliacaoManager from '@/components/financeiro/ConciliacaoManager';

const CONFIG_FINANCEIRO_UI_STATE_KEY = 'configFinanceiroUiState';

// Função para buscar dados iniciais (necessário para Conciliação)
async function fetchInitialData(organizacao_id) {
    const supabase = createClient();
    if (!organizacao_id) return { contas: [] };
    
    const { data: contas } = await supabase
        .from('contas_financeiras')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('nome');

    return { contas: contas || [] };
}

export default function ConfigFinanceiroPage() {
    const { setPageTitle } = useLayout();
    const router = useRouter();
    const { hasPermission, loading: authLoading, user } = useAuth();
    const organizacao_id = user?.organizacao_id;

    // Permissões
    const canView = hasPermission('financeiro', 'pode_ver'); // Reutilizando permissão do financeiro
    
    // Estado das Abas com Persistência
    const [activeTab, setActiveTab] = useState('categorias');
    const hasRestoredUiState = useRef(false);

    // Carregar Estado Salvo
    useEffect(() => {
        setPageTitle('Configurações Financeiras');
        if (!hasRestoredUiState.current) {
            const savedUiState = localStorage.getItem(CONFIG_FINANCEIRO_UI_STATE_KEY);
            if (savedUiState) {
                const parsed = JSON.parse(savedUiState);
                if (parsed.activeTab) setActiveTab(parsed.activeTab);
            }
            hasRestoredUiState.current = true;
        }
    }, [setPageTitle]);

    // Salvar Estado (Debounce para não salvar a cada clique frenético)
    const [debouncedActiveTab] = useDebounce(activeTab, 500);
    useEffect(() => {
        if (hasRestoredUiState.current) {
            localStorage.setItem(CONFIG_FINANCEIRO_UI_STATE_KEY, JSON.stringify({ activeTab: debouncedActiveTab }));
        }
    }, [debouncedActiveTab]);

    // Busca de Dados (Contas)
    const { data: initialData, isLoading: isLoadingData } = useQuery({
        queryKey: ['configFinanceiroData', organizacao_id],
        queryFn: () => fetchInitialData(organizacao_id),
        enabled: !!organizacao_id && canView,
        staleTime: 300000 // 5 minutos de cache
    });

    const contas = initialData?.contas || [];

    // Componente de Botão da Aba
    const TabButton = ({ tabName, label, icon }) => (
        <button 
            onClick={() => setActiveTab(tabName)} 
            className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === tabName 
                ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
        > 
            <FontAwesomeIcon icon={icon} className={activeTab === tabName ? 'text-blue-500' : 'text-gray-400'} /> 
            {label} 
        </button>
    );

    // Verificações de Carregamento e Permissão
    if (authLoading || isLoadingData) {
        return (
            <div className="flex justify-center items-center h-64">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" />
                <span className="ml-3 text-gray-500">Carregando central financeira...</span>
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg mt-6">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para acessar as configurações financeiras.</p>
                <button onClick={() => router.back()} className="mt-4 text-sm text-red-800 underline">Voltar</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <Link href="/configuracoes" className="text-gray-500 hover:text-blue-600 text-xs font-bold uppercase tracking-wide flex items-center gap-2 mb-1 transition-colors">
                        <FontAwesomeIcon icon={faArrowLeft} /> Voltar para Configurações
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800">Central Financeira</h1>
                    <p className="text-sm text-gray-500">Gerencie categorias, importações e ferramentas avançadas.</p>
                </div>
                
                {/* Botões de Ação Rápida (Ferramentas de Topo) */}
                <div className="flex gap-2">
                    <Link href="/financeiro/auditoria" className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-indigo-600 text-sm font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition-all">
                        <FontAwesomeIcon icon={faShieldAlt} className="mr-2 text-indigo-500" /> 
                        Auditoria
                    </Link>
                </div>
            </div>

            {/* Navegação de Abas */}
            <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0 overflow-hidden">
                <nav className="-mb-px flex overflow-x-auto scrollbar-hide" aria-label="Tabs">
                    <TabButton tabName="categorias" label="Categorias e Plano de Contas" icon={faTags} />
                    <TabButton tabName="importacao" label="Assistente de Importação" icon={faFileImport} />
                    <TabButton tabName="conciliacao" label="Ferramenta de Conciliação" icon={faHandshake} />
                </nav>
            </div>

            {/* Conteúdo das Abas */}
            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-200 min-h-[500px]">
                
                {activeTab === 'categorias' && (
                    <div className="animate-fade-in">
                        <div className="mb-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Plano de Contas</h2>
                            <p className="text-sm text-gray-500">Organize suas receitas e despesas em categorias hierárquicas.</p>
                        </div>
                        <CategoriasManager />
                    </div>
                )}

                {activeTab === 'importacao' && (
                    <div className="animate-fade-in">
                        <div className="mb-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Importação de Dados</h2>
                            <p className="text-sm text-gray-500">Importe planilhas ou extratos antigos para popular o sistema.</p>
                        </div>
                        <ImportacaoFinanceiraManager />
                    </div>
                )}

                {activeTab === 'conciliacao' && (
                    <div className="animate-fade-in">
                        <div className="mb-6 pb-4 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">Conciliação Avançada</h2>
                            <p className="text-sm text-gray-500">Ferramenta manual para bater extratos bancários com lançamentos do sistema.</p>
                        </div>
                        {/* Conciliação precisa das contas carregadas */}
                        <ConciliacaoManager contas={contas} />
                    </div>
                )}

            </div>
        </div>
    );
}
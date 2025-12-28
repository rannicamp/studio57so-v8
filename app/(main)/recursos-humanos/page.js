// app/(main)/recursos-humanos/page.js
'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useDebounce } from 'use-debounce'; // Importante para performance
import Link from 'next/link';

// Ícones
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUsers, 
    faClock, 
    faSearch, 
    faFilter, 
    faPlus,
    faLock,
    faFileImport,
    faTimes
} from '@fortawesome/free-solid-svg-icons';

// Componentes Filhos
import GerenciamentoFuncionarios from '../../../components/rh/GerenciamentoFuncionarios';
import GerenciamentoPonto from '../../../components/rh/GerenciamentoPonto';

// --- CONFIGURAÇÃO DE PERSISTÊNCIA ---
const RH_UI_STATE_KEY = 'STUDIO57_RH_UI_STATE_V1';

const getCachedUiState = () => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(RH_UI_STATE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        return null;
    }
};

export default function RecursosHumanosPage() {
    const { permissions } = useAuth();
    const { setPageTitle } = useLayout();
    
    // Recupera estado salvo ou usa padrões
    const cachedState = getCachedUiState();

    // --- ESTADOS ---
    // Se tiver salvo, usa. Se não, tenta definir baseado na permissão (lógica no useEffect abaixo)
    const [activeTab, setActiveTab] = useState(cachedState?.activeTab || ''); 
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);
    
    // Debounce para não travar a digitação (espera 500ms para filtrar)
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    // Estado local (não persistido)
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const hasRestoredUiState = useRef(false);

    // Permissões
    const podeVerFuncionarios = permissions.funcionarios?.pode_ver;
    const podeVerPonto = permissions.ponto?.pode_ver;
    const canCreateFuncionario = permissions.funcionarios?.pode_criar;
    const canCreatePonto = permissions.ponto?.pode_criar;

    // --- EFEITOS ---

    // 1. Título da Página
    useEffect(() => {
        setPageTitle('Recursos Humanos');
    }, [setPageTitle]);

    // 2. Define aba inicial se não houver cache ou se a permissão mudou
    useEffect(() => {
        if (!activeTab) {
            if (podeVerFuncionarios) setActiveTab('funcionarios');
            else if (podeVerPonto) setActiveTab('ponto');
        }
    }, [podeVerFuncionarios, podeVerPonto, activeTab]);

    // 3. Persistência Automática
    useEffect(() => {
        // Evita salvar o estado inicial vazio antes da hidratação completa
        if (typeof window !== 'undefined') {
            const stateToSave = {
                activeTab,
                searchTerm,
                showFilters
            };
            localStorage.setItem(RH_UI_STATE_KEY, JSON.stringify(stateToSave));
        }
    }, [activeTab, searchTerm, showFilters]);

    // Bloqueio de Acesso
    if (!podeVerFuncionarios && !podeVerPonto) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FontAwesomeIcon icon={faLock} size="3x" className="mb-4 text-gray-300" />
                <p>Você não tem permissão para acessar o RH.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6 container mx-auto p-4 md:p-6 animate-in fade-in duration-500">
            
            {/* --- HEADER PADRÃO OURO --- */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-30">
                
                {/* Lado Esquerdo: Navegação de Abas */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {activeTab === 'funcionarios' ? 'Gestão de Funcionários' : 'Controle de Ponto'}
                    </h2>
                    
                    <div className="flex bg-gray-100 p-1 rounded-lg w-fit shadow-inner">
                        {podeVerFuncionarios && (
                            <button
                                onClick={() => setActiveTab('funcionarios')}
                                className={`px-5 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                                    activeTab === 'funcionarios' 
                                    ? 'bg-white text-blue-600 shadow-sm transform scale-105' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                Funcionários
                            </button>
                        )}
                        {podeVerPonto && (
                            <button
                                onClick={() => setActiveTab('ponto')}
                                className={`px-5 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                                    activeTab === 'ponto' 
                                    ? 'bg-white text-blue-600 shadow-sm transform scale-105' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                                }`}
                            >
                                <FontAwesomeIcon icon={faClock} className="mr-2" />
                                Ponto
                            </button>
                        )}
                    </div>
                </div>

                {/* Lado Direito: Ferramentas */}
                <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                    
                    {/* Busca Inteligente */}
                    <div className="relative flex-grow xl:flex-grow-0 min-w-[280px] group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-500 text-gray-400">
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <input 
                            type="text" 
                            placeholder={activeTab === 'funcionarios' ? "Buscar por nome, cargo, CPF..." : "Filtrar funcionário no ponto..."}
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                                title="Limpar busca"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        )}
                    </div>

                    {/* Botão de Filtros */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`border font-medium py-2.5 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${
                            showFilters 
                            ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-300' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Filtros Avançados"
                    >
                        <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500" : "text-gray-400"} />
                    </button>

                    <div className="h-8 w-px bg-gray-300 mx-1 hidden xl:block"></div>

                    {/* AÇÃO 1: Novo Funcionário */}
                    {activeTab === 'funcionarios' && canCreateFuncionario && (
                        <Link 
                            href="/funcionarios/cadastro" 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg flex items-center transition-all duration-200 transform hover:-translate-y-0.5"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo
                        </Link>
                    )}

                    {/* AÇÃO 2: Importar Ponto */}
                    {activeTab === 'ponto' && canCreatePonto && (
                        <button 
                            onClick={() => setIsImporterOpen(true)}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-bold py-2.5 px-5 rounded-lg shadow-sm flex items-center transition duration-200"
                        >
                            <FontAwesomeIcon icon={faFileImport} className="mr-2 text-gray-500" /> Importar
                        </button>
                    )}
                </div>
            </div>

            {/* Conteúdo Dinâmico */}
            <div className="min-h-[400px]">
                {activeTab === 'funcionarios' && podeVerFuncionarios && (
                    <GerenciamentoFuncionarios 
                        searchTerm={debouncedSearchTerm} // Passa o valor com debounce
                    />
                )}
                {activeTab === 'ponto' && podeVerPonto && (
                    <GerenciamentoPonto 
                        searchTerm={debouncedSearchTerm} 
                        isImporterOpen={isImporterOpen} 
                        onCloseImporter={() => setIsImporterOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}
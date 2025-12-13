// app/(main)/recursos-humanos/page.js
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUsers, 
    faClock, 
    faSearch, 
    faFilter, 
    faPlus,
    faLock,
    faFileImport
} from '@fortawesome/free-solid-svg-icons';
import GerenciamentoFuncionarios from '../../../components/rh/GerenciamentoFuncionarios';
import GerenciamentoPonto from '../../../components/rh/GerenciamentoPonto';
import Link from 'next/link';
import { useLayout } from '@/contexts/LayoutContext';

export default function RecursosHumanosPage() {
    const { permissions } = useAuth();
    const { setPageTitle } = useLayout();

    // Estados do Padrão Ouro (UI)
    const [activeTab, setActiveTab] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    
    // Novo Estado para controlar o Modal de Importação do Ponto
    const [isImporterOpen, setIsImporterOpen] = useState(false);

    const podeVerFuncionarios = permissions.funcionarios?.pode_ver;
    const podeVerPonto = permissions.ponto?.pode_ver;
    const canCreateFuncionario = permissions.funcionarios?.pode_criar;
    const canCreatePonto = permissions.ponto?.pode_criar; // Permissão para importar

    // Define a aba inicial baseada na permissão
    useEffect(() => {
        if (podeVerFuncionarios) {
            setActiveTab('funcionarios');
        } else if (podeVerPonto) {
            setActiveTab('ponto');
        }
    }, [podeVerFuncionarios, podeVerPonto]);

    // Atualiza título da página
    useEffect(() => {
        setPageTitle('Recursos Humanos');
    }, [setPageTitle]);

    if (!podeVerFuncionarios && !podeVerPonto) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <FontAwesomeIcon icon={faLock} size="3x" className="mb-4 text-gray-300" />
                <p>Você não tem permissão para acessar o RH.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            
            {/* --- HEADER PADRÃO OURO --- */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-lg shadow-sm">
                
                {/* Lado Esquerdo: Título e Abas */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {activeTab === 'funcionarios' ? 'Gestão de Funcionários' : 'Controle de Ponto'}
                    </h2>
                    
                    {/* Navegação de Abas (Estilo Pílula) */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                        {podeVerFuncionarios && (
                            <button
                                onClick={() => setActiveTab('funcionarios')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    activeTab === 'funcionarios' 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faUsers} className="mr-2" />
                                Funcionários
                            </button>
                        )}
                        {podeVerPonto && (
                            <button
                                onClick={() => setActiveTab('ponto')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                    activeTab === 'ponto' 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <FontAwesomeIcon icon={faClock} className="mr-2" />
                                Ponto
                            </button>
                        )}
                    </div>
                </div>

                {/* Lado Direito: Pesquisa e Ações */}
                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    
                    {/* Caixa de Pesquisa */}
                    <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder={activeTab === 'funcionarios' ? "Buscar funcionário..." : "Buscar no ponto..."}
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                    </div>

                    {/* Botão de Filtros */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${
                            showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                        title="Filtros Avançados"
                    >
                        <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500" : "text-gray-500"} />
                    </button>

                    {/* AÇÃO 1: Novo Funcionário */}
                    {activeTab === 'funcionarios' && canCreateFuncionario && (
                        <Link 
                            href="/funcionarios/cadastro" 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
                        >
                            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Novo
                        </Link>
                    )}

                    {/* AÇÃO 2: Importar Ponto (AGORA AQUI NO TOPO) */}
                    {activeTab === 'ponto' && canCreatePonto && (
                        <button 
                            onClick={() => setIsImporterOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
                        >
                            <FontAwesomeIcon icon={faFileImport} className="mr-2" /> Importar
                        </button>
                    )}
                </div>
            </div>

            {/* Conteúdo das Abas */}
            <div>
                {activeTab === 'funcionarios' && podeVerFuncionarios && (
                    <GerenciamentoFuncionarios searchTerm={searchTerm} />
                )}
                {activeTab === 'ponto' && podeVerPonto && (
                    <GerenciamentoPonto 
                        searchTerm={searchTerm} 
                        isImporterOpen={isImporterOpen} 
                        onCloseImporter={() => setIsImporterOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}
// components/comercial/TabelaVendasGeral.js
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faSort, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useDebounce } from 'use-debounce'; // Vamos usar debounce para não salvar a cada milissegundo

// Helper para ler o cache inicial (evita flash de conteúdo)
const getCachedUiState = (key) => {
    if (typeof window === 'undefined' || !key) return null;
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.error("Erro ao ler cache:", e);
        return null;
    }
};

const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'N/D';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function TabelaVendasGeral({ initialProdutos = [], uiStateKey = null }) {
    
    // 1. Tenta carregar estado salvo SE uma chave foi fornecida
    const cachedState = getCachedUiState(uiStateKey);

    const [produtos, setProdutos] = useState(initialProdutos);
    
    // Inicializa estados com valor do cache (ou padrão)
    const [filtroEmpreendimento, setFiltroEmpreendimento] = useState(cachedState?.filtroEmpreendimento || '');
    const [filtroStatus, setFiltroStatus] = useState(cachedState?.filtroStatus || '');
    const [sortConfig, setSortConfig] = useState(cachedState?.sortConfig || { key: 'empreendimento', direction: 'ascending' });

    // Para evitar salvar a cada digitação/clique rápido
    const [debouncedFiltroEmpreendimento] = useDebounce(filtroEmpreendimento, 500);
    const [debouncedFiltroStatus] = useDebounce(filtroStatus, 500);
    const [debouncedSortConfig] = useDebounce(sortConfig, 500);

    // Ref para controlar se já restauramos o estado (para não sobrescrever no first render)
    const hasRestoredUiState = useRef(true);

    // 2. EFEITO DE PERSISTÊNCIA
    useEffect(() => {
        // Só salva se tivermos uma chave e se o componente já tiver montado/restaurado
        if (typeof window !== 'undefined' && uiStateKey && hasRestoredUiState.current) {
            const stateToSave = {
                filtroEmpreendimento: debouncedFiltroEmpreendimento,
                filtroStatus: debouncedFiltroStatus,
                sortConfig: debouncedSortConfig
            };
            localStorage.setItem(uiStateKey, JSON.stringify(stateToSave));
        }
    }, [debouncedFiltroEmpreendimento, debouncedFiltroStatus, debouncedSortConfig, uiStateKey]);

    // Atualiza produtos se a prop mudar (ex: recarregamento de dados)
    useEffect(() => {
        setProdutos(initialProdutos);
    }, [initialProdutos]);

    const empreendimentosUnicos = useMemo(() => {
        const nomes = initialProdutos.map(p => p.empreendimentos?.nome).filter(Boolean);
        return [...new Set(nomes)].sort();
    }, [initialProdutos]);

    const statusUnicos = useMemo(() => {
        const statuses = initialProdutos.map(p => p.status).filter(Boolean);
        return [...new Set(statuses)].sort();
    }, [initialProdutos]);

    const produtosFiltrados = useMemo(() => {
        let produtosFiltrados = [...initialProdutos];

        if (filtroEmpreendimento) {
            produtosFiltrados = produtosFiltrados.filter(p => p.empreendimentos?.nome === filtroEmpreendimento);
        }

        if (filtroStatus) {
            produtosFiltrados = produtosFiltrados.filter(p => p.status === filtroStatus);
        }

        return produtosFiltrados;
    }, [initialProdutos, filtroEmpreendimento, filtroStatus]);

    const sortedProdutos = useMemo(() => {
        let sortableItems = [...produtosFiltrados];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'empreendimentos.nome') {
                    aValue = a.empreendimentos?.nome || '';
                    bValue = b.empreendimentos?.nome || '';
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [produtosFiltrados, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
        if (sortConfig.direction === 'ascending') return ' ▲';
        return ' ▼';
    };

    const clearFilters = () => {
        setFiltroEmpreendimento('');
        setFiltroStatus('');
        // O useEffect vai limpar o localStorage automaticamente
    };

    const hasActiveFilters = filtroEmpreendimento || filtroStatus;

    const statusClasses = {
        'Disponível': 'bg-green-100 text-green-800',
        'Reservado': 'bg-yellow-100 text-yellow-800',
        'Vendido': 'bg-red-100 text-red-800'
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            {/* Seção de Filtros */}
            <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-6 items-end">
                <div className="flex-grow w-full md:w-auto">
                    <label htmlFor="filtro-empreendimento" className="block text-sm font-medium text-gray-700 mb-1">
                        <FontAwesomeIcon icon={faFilter} className="mr-1 text-gray-400" />
                        Filtrar por Empreendimento
                    </label>
                    <select
                        id="filtro-empreendimento"
                        value={filtroEmpreendimento}
                        onChange={(e) => setFiltroEmpreendimento(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="">Todos os Empreendimentos</option>
                        {empreendimentosUnicos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                    </select>
                </div>
                <div className="flex-grow w-full md:w-auto">
                    <label htmlFor="filtro-status" className="block text-sm font-medium text-gray-700 mb-1">
                        <FontAwesomeIcon icon={faFilter} className="mr-1 text-gray-400" />
                        Filtrar por Status
                    </label>
                    <select
                        id="filtro-status"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="">Todos os Status</option>
                        {statusUnicos.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                </div>
                
                {/* Botão Limpar Filtros */}
                {hasActiveFilters && (
                    <div className="w-full md:w-auto pb-0.5">
                        <button 
                            onClick={clearFilters}
                            className="w-full md:w-auto px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 hover:text-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                            Limpar Filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Tabela de Produtos */}
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('unidade')}>
                                Unidade {getSortIcon('unidade')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('matricula')}>
                                Matrícula {getSortIcon('matricula')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('empreendimentos.nome')}>
                                Empreendimento {getSortIcon('empreendimentos.nome')}
                            </th>
                             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('tipo')}>
                                Tipo {getSortIcon('tipo')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('area_m2')}>
                                Área (m²) {getSortIcon('area_m2')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('status')}>
                                Status {getSortIcon('status')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => requestSort('valor_venda_calculado')}>
                                Valor de Venda {getSortIcon('valor_venda_calculado')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedProdutos.length > 0 ? sortedProdutos.map((produto) => (
                            <tr key={produto.id} className="hover:bg-blue-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{produto.unidade}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.matricula || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.empreendimentos?.nome || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.tipo}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parseFloat(produto.area_m2).toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[produto.status] || 'bg-gray-100 text-gray-800'}`}>
                                        {produto.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(produto.valor_venda_calculado)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <FontAwesomeIcon icon={faFilter} className="text-3xl text-gray-300 mb-2" />
                                        <p>Nenhum produto encontrado com os filtros selecionados.</p>
                                        <button onClick={clearFilters} className="mt-2 text-blue-600 hover:underline text-xs font-medium">
                                            Limpar Filtros
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Contador de Resultados */}
            <div className="mt-4 text-xs text-gray-500 text-right">
                Exibindo {sortedProdutos.length} de {initialProdutos.length} unidades
            </div>
        </div>
    );
}
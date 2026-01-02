// components/comercial/TabelaVendasGeral.js
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFilter, faSort, faTimes, 
    faCheckCircle, faClock, faHandshake, faBuilding 
} from '@fortawesome/free-solid-svg-icons';
import { useDebounce } from 'use-debounce';

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
    
    // 1. Carrega estado inicial
    const cachedState = getCachedUiState(uiStateKey);

    const [produtos, setProdutos] = useState(initialProdutos);
    const [filtroEmpreendimento, setFiltroEmpreendimento] = useState(cachedState?.filtroEmpreendimento || '');
    const [filtroStatus, setFiltroStatus] = useState(cachedState?.filtroStatus || '');
    const [sortConfig, setSortConfig] = useState(cachedState?.sortConfig || { key: 'empreendimento', direction: 'ascending' });

    // Debounce para persistência
    const [debouncedFiltroEmpreendimento] = useDebounce(filtroEmpreendimento, 500);
    const [debouncedFiltroStatus] = useDebounce(filtroStatus, 500);
    const [debouncedSortConfig] = useDebounce(sortConfig, 500);

    const hasRestoredUiState = useRef(true);

    // 2. Persistência
    useEffect(() => {
        if (typeof window !== 'undefined' && uiStateKey && hasRestoredUiState.current) {
            const stateToSave = {
                filtroEmpreendimento: debouncedFiltroEmpreendimento,
                filtroStatus: debouncedFiltroStatus,
                sortConfig: debouncedSortConfig
            };
            localStorage.setItem(uiStateKey, JSON.stringify(stateToSave));
        }
    }, [debouncedFiltroEmpreendimento, debouncedFiltroStatus, debouncedSortConfig, uiStateKey]);

    useEffect(() => {
        setProdutos(initialProdutos);
    }, [initialProdutos]);

    // --- FILTRAGEM (Calculada ANTES dos KPIs) ---
    const produtosFiltrados = useMemo(() => {
        let lista = [...initialProdutos];
        if (filtroEmpreendimento) lista = lista.filter(p => p.empreendimentos?.nome === filtroEmpreendimento);
        if (filtroStatus) lista = lista.filter(p => p.status === filtroStatus);
        return lista;
    }, [initialProdutos, filtroEmpreendimento, filtroStatus]);

    // --- CÁLCULO DOS KPIS (AGORA DINÂMICO) 📊 ---
    // CORREÇÃO: Usamos 'produtosFiltrados' em vez de 'initialProdutos'
    const kpis = useMemo(() => {
        const stats = { total: 0, disponivel: 0, reservado: 0, vendido: 0 };
        
        produtosFiltrados.forEach(p => {
            stats.total++;
            if (p.status === 'Disponível') stats.disponivel++;
            else if (p.status === 'Reservado') stats.reservado++;
            else if (p.status === 'Vendido') stats.vendido++;
        });
        
        return stats;
    }, [produtosFiltrados]); // <--- Dependência alterada para reagir aos filtros

    // --- ORDENAÇÃO E LISTAS AUXILIARES ---
    const empreendimentosUnicos = useMemo(() => {
        const nomes = initialProdutos.map(p => p.empreendimentos?.nome).filter(Boolean);
        return [...new Set(nomes)].sort();
    }, [initialProdutos]);

    const statusUnicos = useMemo(() => {
        const statuses = initialProdutos.map(p => p.status).filter(Boolean);
        return [...new Set(statuses)].sort();
    }, [initialProdutos]);

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

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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
        if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-300 ml-1 opacity-50" />;
        return <span className="ml-1 text-blue-500">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>;
    };

    const clearFilters = () => {
        setFiltroEmpreendimento('');
        setFiltroStatus('');
    };

    const hasActiveFilters = filtroEmpreendimento || filtroStatus;
    
    const statusClasses = {
        'Disponível': 'bg-green-100 text-green-800 border-green-200',
        'Reservado': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'Vendido': 'bg-red-100 text-red-800 border-red-200'
    };

    return (
        <div className="space-y-6 animate-fade-in">
            
            {/* --- BLOCO DE KPIS DINÂMICOS --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-blue-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">
                            {filtroEmpreendimento ? 'Total (Filtrado)' : 'Total Geral'}
                        </p>
                        <p className="text-2xl font-bold text-gray-800">{kpis.total}</p>
                    </div>
                    <FontAwesomeIcon icon={faBuilding} className="text-blue-200 text-3xl" />
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-green-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Disponíveis</p>
                        <p className="text-2xl font-bold text-green-600">{kpis.disponivel}</p>
                    </div>
                    <FontAwesomeIcon icon={faCheckCircle} className="text-green-200 text-3xl" />
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-yellow-400 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Reservadas</p>
                        <p className="text-2xl font-bold text-yellow-600">{kpis.reservado}</p>
                    </div>
                    <FontAwesomeIcon icon={faClock} className="text-yellow-200 text-3xl" />
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-red-500 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase">Vendidas</p>
                        <p className="text-2xl font-bold text-red-600">{kpis.vendido}</p>
                    </div>
                    <FontAwesomeIcon icon={faHandshake} className="text-red-200 text-3xl" />
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                {/* Filtros */}
                <div className="flex flex-col md:flex-row flex-wrap gap-4 mb-6 items-end">
                    <div className="flex-grow w-full md:w-auto">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            <FontAwesomeIcon icon={faFilter} className="mr-1" /> Empreendimento
                        </label>
                        <select
                            value={filtroEmpreendimento}
                            onChange={(e) => setFiltroEmpreendimento(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        >
                            <option value="">Todos</option>
                            {empreendimentosUnicos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                        </select>
                    </div>
                    <div className="flex-grow w-full md:w-auto">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            <FontAwesomeIcon icon={faFilter} className="mr-1" /> Status
                        </label>
                        <select
                            value={filtroStatus}
                            onChange={(e) => setFiltroStatus(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                        >
                            <option value="">Todos</option>
                            {statusUnicos.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                    </div>
                    
                    {hasActiveFilters && (
                        <div className="w-full md:w-auto pb-0.5">
                            <button 
                                onClick={clearFilters}
                                className="w-full md:w-auto px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 hover:text-red-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium border border-transparent hover:border-gray-300"
                            >
                                <FontAwesomeIcon icon={faTimes} /> Limpar
                            </button>
                        </div>
                    )}
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('unidade')}>Unidade {getSortIcon('unidade')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('matricula')}>Matrícula {getSortIcon('matricula')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('empreendimentos.nome')}>Empreendimento {getSortIcon('empreendimentos.nome')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('tipo')}>Tipo {getSortIcon('tipo')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('area_m2')}>Área (m²) {getSortIcon('area_m2')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('status')}>Status {getSortIcon('status')}</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => requestSort('valor_venda_calculado')}>Valor {getSortIcon('valor_venda_calculado')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedProdutos.length > 0 ? sortedProdutos.map((produto) => (
                                <tr key={produto.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">{produto.unidade}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.matricula || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{produto.empreendimentos?.nome || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.tipo}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parseFloat(produto.area_m2).toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${statusClasses[produto.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {produto.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold text-right">{formatCurrency(produto.valor_venda_calculado)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-sm text-gray-500 bg-gray-50">
                                        <div className="flex flex-col items-center justify-center">
                                            <FontAwesomeIcon icon={faFilter} className="text-3xl text-gray-300 mb-2" />
                                            <p>Nenhum produto encontrado com os filtros atuais.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-xs text-gray-400 text-right">
                    Exibindo {sortedProdutos.length} de {initialProdutos.length} registros
                </div>
            </div>
        </div>
    );
}
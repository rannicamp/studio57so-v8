// components/comercial/TabelaVendasGeral.js

'use client';

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faSort } from '@fortawesome/free-solid-svg-icons';

// Função para formatar números como moeda brasileira (BRL)
const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'N/D';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function TabelaVendasGeral({ initialProdutos = [] }) {
    const [produtos, setProdutos] = useState(initialProdutos);
    const [filtroEmpreendimento, setFiltroEmpreendimento] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'empreendimento', direction: 'ascending' });

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

                // Tratamento especial para ordenação por empreendimento
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

    const statusClasses = {
        'Disponível': 'bg-green-100 text-green-800',
        'Reservado': 'bg-yellow-100 text-yellow-800',
        'Vendido': 'bg-red-100 text-red-800'
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            {/* Seção de Filtros */}
            <div className="flex flex-wrap gap-4 mb-6 items-center">
                <div className="flex-grow">
                    <label htmlFor="filtro-empreendimento" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Empreendimento</label>
                    <select
                        id="filtro-empreendimento"
                        value={filtroEmpreendimento}
                        onChange={(e) => setFiltroEmpreendimento(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Todos os Empreendimentos</option>
                        {empreendimentosUnicos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                    </select>
                </div>
                <div className="flex-grow">
                    <label htmlFor="filtro-status" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status</label>
                    <select
                        id="filtro-status"
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Todos os Status</option>
                        {statusUnicos.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('unidade')}>
                                Unidade {getSortIcon('unidade')}
                            </th>
                            {/* ================================================================================= */}
                            {/* NOVA COLUNA ADICIONADA AQUI                                                     */}
                            {/* ================================================================================= */}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('matricula')}>
                                Matrícula {getSortIcon('matricula')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('empreendimentos.nome')}>
                                Empreendimento {getSortIcon('empreendimentos.nome')}
                            </th>
                             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('tipo')}>
                                Tipo {getSortIcon('tipo')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('area_m2')}>
                                Área (m²) {getSortIcon('area_m2')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('status')}>
                                Status {getSortIcon('status')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => requestSort('valor_venda_calculado')}>
                                Valor de Venda {getSortIcon('valor_venda_calculado')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedProdutos.length > 0 ? sortedProdutos.map((produto) => (
                            <tr key={produto.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{produto.unidade}</td>
                                {/* ================================================================================= */}
                                {/* NOVO DADO DA MATRÍCULA ADICIONADO AQUI                                          */}
                                {/* ================================================================================= */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.matricula || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{produto.empreendimentos?.nome || 'N/A'}</td>
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
                                {/* ================================================================================= */}
                                {/* COLSPAN AJUSTADO AQUI                                                           */}
                                {/* ================================================================================= */}
                                <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                                    Nenhum produto encontrado com os filtros selecionados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
"use client";

import { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faFilter, faTimes, faPenToSquare, faTrash, faSort, faSortUp, faSortDown, faCheckCircle, faCircle } from '@fortawesome/free-solid-svg-icons'; // Corrigido aqui

// Componente de Cabeçalho de Tabela Ordenável
const SortableHeader = ({ label, sortKey, sortConfig, requestSort, className = '' }) => {
    const getIcon = () => {
        if (sortConfig.key !== sortKey) return faSort;
        return sortConfig.direction === 'ascending' ? faSortUp : faSortDown;
    };
    return (
        <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider ${className}`}>
            <button onClick={() => requestSort(sortKey)} className="flex items-center gap-2 hover:text-gray-900">
                <span>{label}</span>
                <FontAwesomeIcon icon={getIcon()} className="text-gray-400" />
            </button>
        </th>
    );
};

export default function LancamentosManager({
    lancamentos: initialLancamentos,
    loading: initialLoading,
    contas,
    categorias,
    empreendimentos,
    onEdit,
    onDelete
}) {
    const [lancamentos, setLancamentos] = useState(initialLancamentos);
    const [loading, setLoading] = useState(initialLoading);
    
    // Filtros
    const [filters, setFilters] = useState({
        searchTerm: '',
        contaId: '',
        categoriaId: '',
        empreendimentoId: '',
        startDate: '',
        endDate: '',
        status: ''
    });
    
    // Ordenação
    const [sortConfig, setSortConfig] = useState({ key: 'data_vencimento', direction: 'descending' });

    useEffect(() => {
        setLancamentos(initialLancamentos);
        setLoading(initialLoading);
    }, [initialLancamentos, initialLoading]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ searchTerm: '', contaId: '', categoriaId: '', empreendimentoId: '', startDate: '', endDate: '', status: '' });
    };
    
    const requestSort = (key) => {
        let direction = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    // Nova função para determinar o status do pagamento
    const getPaymentStatus = (item) => {
        if (item.status === 'Pago') {
            return { text: 'Paga', className: 'bg-green-100 text-green-800' };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(item.data_vencimento || item.data_transacao);
        if (dueDate < today) {
            return { text: 'Atrasada', className: 'bg-red-100 text-red-800' };
        }
        return { text: 'A Pagar', className: 'bg-yellow-100 text-yellow-800' };
    };

    const filteredAndSortedLancamentos = useMemo(() => {
        let filtered = [...lancamentos];

        if (filters.contaId) filtered = filtered.filter(l => l.conta_id == filters.contaId);
        if (filters.categoriaId) filtered = filtered.filter(l => l.categoria_id == filters.categoriaId);
        if (filters.empreendimentoId) filtered = filtered.filter(l => l.empreendimento_id == filters.empreendimentoId);
        if (filters.status) {
             if (filters.status === 'Atrasada') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                filtered = filtered.filter(l => l.status !== 'Pago' && new Date(l.data_vencimento || l.data_transacao) < today);
            } else {
                filtered = filtered.filter(l => l.status === filters.status);
            }
        }
        if (filters.startDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) >= new Date(filters.startDate));
        if (filters.endDate) filtered = filtered.filter(l => new Date(l.data_vencimento || l.data_transacao) <= new Date(filters.endDate + 'T23:59:59'));
        
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(l =>
                l.descricao.toLowerCase().includes(term) ||
                (l.favorecido?.nome && l.favorecido.nome.toLowerCase().includes(term)) ||
                (l.favorecido?.razao_social && l.favorecido.razao_social.toLowerCase().includes(term))
            );
        }

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }, [lancamentos, filters, sortConfig]);
    
    const formatCurrency = (value, tipo) => {
        const signal = tipo === 'Receita' ? '+' : '-';
        return `${signal} ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(value || 0))}`;
    };
    
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    return (
        <div className="space-y-4">
             <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2"><FontAwesomeIcon icon={faFilter} /> Filtros</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" name="searchTerm" placeholder="Buscar por descrição ou favorecido..." value={filters.searchTerm} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm lg:col-span-4" />
                    <select name="contaId" value={filters.contaId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm"><option value="">Todas as Contas</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                    <select name="categoriaId" value={filters.categoriaId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm"><option value="">Todas as Categorias</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                    <select name="empreendimentoId" value={filters.empreendimentoId} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm"><option value="">Todos Empreendimentos</option>{empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded-md shadow-sm">
                        <option value="">Todos os Status</option>
                        <option value="Pago">Paga</option>
                        <option value="Pendente">A Pagar</option>
                        <option value="Atrasada">Atrasada</option>
                    </select>
                    <div><label className="text-xs">De:</label><input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md shadow-sm"/></div>
                    <div><label className="text-xs">Até:</label><input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full p-2 border rounded-md shadow-sm"/></div>
                    <div className="lg:col-span-2 flex justify-end items-end"><button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 w-full md:w-auto"><FontAwesomeIcon icon={faTimes} /> Limpar Filtros</button></div>
                 </div>
            </div>
            
            {loading ? (
                <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
            ) : (
                 <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableHeader label="Vencimento" sortKey="data_vencimento" sortConfig={sortConfig} requestSort={requestSort} />
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Descrição</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Favorecido</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase">Conta (Banco)</th>
                                <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valor</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Conciliado</th>
                                <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredAndSortedLancamentos.length === 0 ? (
                                <tr><td colSpan="8" className="text-center py-10 text-gray-500">Nenhum lançamento encontrado para os filtros aplicados.</td></tr>
                            ) : filteredAndSortedLancamentos.map(item => {
                                const statusInfo = getPaymentStatus(item);
                                return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 text-sm font-semibold">{formatDate(item.data_vencimento || item.data_transacao)}</td>
                                        <td className="px-4 py-4 text-sm font-medium">{item.descricao} {item.parcela_info && <span className="text-xs text-gray-500">({item.parcela_info})</span>}</td>
                                        <td className="px-4 py-4 text-sm">{item.favorecido?.nome || item.favorecido?.razao_social || 'N/A'}</td>
                                        <td className="px-4 py-4 text-sm">{item.conta?.nome} {item.conta?.instituicao && `(${item.conta.instituicao})`}</td>
                                        <td className={`px-4 py-4 text-right text-sm font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor, item.tipo)}</td>
                                        <td className="px-4 py-4 text-center text-xs">
                                            <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${statusInfo.className}`}>
                                                {statusInfo.text}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <FontAwesomeIcon 
                                                icon={item.conciliado ? faCheckCircle : faCircle}
                                                className={item.conciliado ? 'text-green-500' : 'text-red-500'}
                                                title={item.conciliado ? 'Conciliado' : 'Não Conciliado'}
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button onClick={() => onEdit(item)} className="text-blue-500 hover:text-blue-700 mr-3"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                            <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
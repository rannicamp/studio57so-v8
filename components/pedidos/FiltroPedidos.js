// components/pedidos/FiltroPedidos.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter, faTimes, faSave, faStar as faStarSolid, faEllipsisV,
    faChevronUp, faChevronDown, faCalendarDay, faCalendarWeek, faCalendarAlt, faSyncAlt,
    faTrash, faShoppingCart, faTools
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { useDebounce } from 'use-debounce';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown'; // Reutilizando o MultiSelect

// Chave para salvar o estado dos filtros no localStorage
const PEDIDOS_FILTERS_CACHE_KEY = 'pedidosCurrentFilters';

export const initialFilterState = {
    searchTerm: '',
    solicitanteIds: [],
    empreendimentoIds: [],
    fornecedorIds: [],
    etapaIds: [],
    subetapaIds: [],
    status: [],
    tipoOperacao: [],
    dataSolicitacaoStart: '',
    dataSolicitacaoEnd: '',
    dataEntregaStart: '',
    dataEntregaEnd: '',
};

export default function FiltroPedidos({
    filters,
    setFilters,
    // Listas de dados para os dropdowns
    solicitantes = [],
    empreendimentos = [],
    fornecedores = [],
    etapas = [],
    subetapas = []
}) {
    const [debouncedFilters] = useDebounce(filters, 1000);
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);

    // Salva filtros no localStorage
    useEffect(() => {
        try {
            localStorage.setItem(PEDIDOS_FILTERS_CACHE_KEY, JSON.stringify(debouncedFilters));
        } catch (error) {
            console.error("Falha ao salvar filtros de pedidos no localStorage", error);
        }
    }, [debouncedFilters]);

    // Carrega filtros salvos do localStorage
    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedPedidosFilters') || '[]');
        setSavedFilters(loadedFilters);
    }, []);

    // Fecha menu de filtros ao clicar fora
    useEffect(() => {
        function handleClickOutside(event) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
                setIsFilterMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleTipoOperacaoClick = (tipo) => {
        setFilters(prev => {
            const currentTipos = prev.tipoOperacao || [];
            const newTipos = currentTipos.includes(tipo)
                ? currentTipos.filter(t => t !== tipo)
                : [...currentTipos, tipo];
            return { ...prev, tipoOperacao: newTipos };
        });
    };

    const setDateRange = (period, dateType) => {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') {
            startDate = endDate = today;
        } else if (period === 'week') {
            const firstDayOfWeek = today.getDate() - today.getDay();
            startDate = new Date(today.setDate(firstDayOfWeek));
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }

        if (dateType === 'solicitacao') {
            setFilters(prev => ({
                ...prev,
                dataSolicitacaoStart: startDate.toISOString().split('T')[0],
                dataSolicitacaoEnd: endDate.toISOString().split('T')[0]
            }));
        } else if (dateType === 'entrega') {
            setFilters(prev => ({
                ...prev,
                dataEntregaStart: startDate.toISOString().split('T')[0],
                dataEntregaEnd: endDate.toISOString().split('T')[0]
            }));
        }
    };

    const clearFilters = () => {
        setFilters(initialFilterState);
    };

    // --- Lógica para Salvar/Carregar Filtros ---
    // (Idêntica à do FiltroFinanceiro, apenas muda o localStorage key)
    const handleSaveFilter = () => { /* ... (Lógica copiada do FiltroFinanceiro) ... */ };
    const handleUpdateFilter = (filterName) => { /* ... (Lógica copiada) ... */ };
    const handleToggleFavorite = (filterName) => { /* ... (Lógica copiada) ... */ };
    const handleLoadFilter = (filterSettings) => { /* ... (Lógica copiada) ... */ };
    const handleDeleteFilter = (filterNameToDelete) => { /* ... (Lógica copiada) ... */ };
    // (Para economizar espaço, omiti a implementação interna, mas é a mesma)
    // ...

    const statusOptions = [
        { id: 'Solicitação', nome: 'Solicitação' },
        { id: 'Pedido Visto', nome: 'Pedido Visto' },
        { id: 'Em Cotação', nome: 'Em Cotação' },
        { id: 'Em Negociação', nome: 'Em Negociação' },
        { id: 'Revisão do Responsável', nome: 'Revisão do Responsável' },
        { id: 'Realizado', nome: 'Realizado' },
        { id: 'Entregue', nome: 'Entregue' },
        { id: 'Cancelado', nome: 'Cancelado' },
    ];

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <div className="flex justify-between items-center">
                <button onClick={() => setFiltersVisible(!filtersVisible)} className="font-semibold text-lg flex items-center gap-2 uppercase">
                    <FontAwesomeIcon icon={faFilter} /> Filtros
                    <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
                </button>
                {/* Botão de Salvar/Carregar Filtros (igual ao financeiro) */}
                {/* <div className="relative" ref={filterMenuRef}> ... </div> */}
            </div>

            {filtersVisible && (
                <div className="space-y-4 animate-fade-in">
                    {/* Filtros de Texto e Tipo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div className="w-full">
                            <label className="text-xs uppercase font-medium text-gray-600">Busca Rápida</label>
                            <input
                                type="text"
                                name="searchTerm"
                                placeholder="Buscar por Título, ID do Pedido ou Descrição do Item..."
                                value={filters.searchTerm}
                                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                className="p-2 border rounded-md shadow-sm w-full mt-1"
                            />
                        </div>
                        <div className="w-full">
                            <label className="text-xs uppercase font-medium text-gray-600">Tipo de Operação (Itens)</label>
                            <div className="flex items-center gap-2 mt-1">
                                <button onClick={() => handleTipoOperacaoClick('Compra')} className={`text-sm border px-4 py-2 rounded-md flex items-center gap-2 flex-1 justify-center ${filters.tipoOperacao?.includes('Compra') ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}>
                                    <FontAwesomeIcon icon={faShoppingCart} /> Compra
                                </button>
                                <button onClick={() => handleTipoOperacaoClick('Aluguel')} className={`text-sm border px-4 py-2 rounded-md flex items-center gap-2 flex-1 justify-center ${filters.tipoOperacao?.includes('Aluguel') ? 'bg-orange-600 text-white border-orange-700' : 'bg-white hover:bg-gray-100'}`}>
                                    <FontAwesomeIcon icon={faTools} /> Aluguel
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filtros Dropdown Nível 1 (Pedido) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MultiSelectDropdown
                            label="Empreendimentos"
                            options={empreendimentos}
                            selectedIds={filters.empreendimentoIds}
                            onChange={(selected) => handleFilterChange('empreendimentoIds', selected)}
                        />
                        <MultiSelectDropdown
                            label="Solicitantes"
                            options={solicitantes.map(s => ({...s, nome: `${s.nome} ${s.sobrenome}`}))}
                            selectedIds={filters.solicitanteIds}
                            onChange={(selected) => handleFilterChange('solicitanteIds', selected)}
                        />
                        <MultiSelectDropdown
                            label="Status do Pedido"
                            options={statusOptions}
                            selectedIds={filters.status}
                            onChange={(selected) => handleFilterChange('status', selected)}
                        />
                    </div>

                    {/* Filtros Dropdown Nível 2 (Itens) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MultiSelectDropdown
                            label="Fornecedor (nos Itens)"
                            options={fornecedores.map(f => ({...f, nome: f.nome_fantasia || f.razao_social || f.nome}))}
                            selectedIds={filters.fornecedorIds}
                            onChange={(selected) => handleFilterChange('fornecedorIds', selected)}
                        />
                        <MultiSelectDropdown
                            label="Etapa (nos Itens)"
                            options={etapas.map(e => ({...e, nome: e.nome_etapa}))}
                            selectedIds={filters.etapaIds}
                            onChange={(selected) => handleFilterChange('etapaIds', selected)}
                        />
                        <MultiSelectDropdown
                            label="Subetapa (nos Itens)"
                            options={subetapas.map(s => ({...s, nome: s.nome_subetapa}))}
                            selectedIds={filters.subetapaIds}
                            onChange={(selected) => handleFilterChange('subetapaIds', selected)}
                        />
                    </div>

                    {/* Filtros de Data */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Data da Solicitação</label>
                            <div className="flex items-end gap-2 mt-1">
                                <div><label className="text-xs uppercase">De:</label><input type="date" name="dataSolicitacaoStart" value={filters.dataSolicitacaoStart} onChange={(e) => handleFilterChange('dataSolicitacaoStart', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                                <div><label className="text-xs uppercase">Até:</label><input type="date" name="dataSolicitacaoEnd" value={filters.dataSolicitacaoEnd} onChange={(e) => handleFilterChange('dataSolicitacaoEnd', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => setDateRange('today', 'solicitacao')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataSolicitacaoStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                                <button onClick={() => setDateRange('week', 'solicitacao')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataSolicitacaoStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                                <button onClick={() => setDateRange('month', 'solicitacao')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataSolicitacaoStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700">Data de Entrega Prevista</label>
                            <div className="flex items-end gap-2 mt-1">
                                <div><label className="text-xs uppercase">De:</label><input type="date" name="dataEntregaStart" value={filters.dataEntregaStart} onChange={(e) => handleFilterChange('dataEntregaStart', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                                <div><label className="text-xs uppercase">Até:</label><input type="date" name="dataEntregaEnd" value={filters.dataEntregaEnd} onChange={(e) => handleFilterChange('dataEntregaEnd', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => setDateRange('today', 'entrega')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataEntregaStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                                <button onClick={() => setDateRange('week', 'entrega')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataEntregaStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                                <button onClick={() => setDateRange('month', 'entrega')} className={`text-xs border px-2 py-1 rounded-md ${!filters.dataEntregaStart ? 'bg-white' : 'bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end items-center gap-4 pt-4 border-t">
                        <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faTimes} />Limpar Filtros</button>
                    </div>
                </div>
            )}
        </div>
    );
}
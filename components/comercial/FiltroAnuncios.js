// components/comercial/FiltroAnuncios.js

"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter, faTimes, faChevronUp, faChevronDown,
    faCalendarDay, faCalendarWeek, faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';

const initialFilterState = {
    searchTerm: '',
    status: [],
    startDate: '',
    endDate: '',
    campaignIds: [],
    adsetIds: [],
};

const statusOptions = [
    { id: 'ACTIVE', nome: 'Ativo' }, { id: 'PAUSED', nome: 'Pausado' },
    { id: 'ARCHIVED', nome: 'Arquivado' }, { id: 'DISAPPROVED', nome: 'Reprovado' },
    { id: 'CAMPAIGN_PAUSED', nome: 'Campanha Pausada' },
    { id: 'ADSET_PAUSED', nome: 'Conjunto Pausado' },
];

export default function FiltroAnuncios({ filters, setFilters, campaigns, adsets, isLoadingOptions }) {
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'startDate' || name === 'endDate') {
            setActivePeriodFilter('');
        }
    };

    // O PORQUÊ DA MUDANÇA:
    // Corrigimos a lógica dos atalhos de data. Agora, ao clicar em "Semana" ou "Mês",
    // a data final do filtro será sempre o dia de HOJE, e não o final do período no futuro.
    // Isso garante que você sempre analise dados do passado até o presente momento.
    const setDateRange = (period) => {
        const today = new Date();
        let startDate;
        
        // A data final para os atalhos é sempre hoje, para não incluir o futuro.
        const endDate = today;

        if (period === 'today') {
            startDate = today;
        } else if (period === 'week') {
            const dayOfWeek = today.getDay();
            const firstDayOfWeek = new Date(today);
            // Ajuste para a semana começar na Segunda-feira (Domingo = 0, Segunda = 1)
            firstDayOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
            startDate = firstDayOfWeek;
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        setFilters(prev => ({
            ...prev,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
        }));
        setActivePeriodFilter(period);
    };

    const clearFilters = () => {
        setFilters(initialFilterState);
        setActivePeriodFilter('');
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setFiltersVisible(!filtersVisible)}>
                <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-700">
                    <FontAwesomeIcon icon={faFilter} /> Filtros
                </h2>
                <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
            </div>

            {filtersVisible && (
                <div className="space-y-4 animate-fade-in pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <label className="text-xs uppercase font-medium text-gray-600">Buscar por Nome</label>
                            <input type="text" name="searchTerm" placeholder="Nome do anúncio..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full mt-1" />
                        </div>
                        <div className="lg:col-span-1">
                            <MultiSelectDropdown
                                label="Campanha"
                                options={campaigns || []}
                                selectedIds={filters.campaignIds}
                                onChange={(selected) => handleFilterChange('campaignIds', selected)}
                                placeholder={isLoadingOptions ? "Carregando..." : "Todas as Campanhas"}
                                disabled={isLoadingOptions}
                            />
                        </div>
                        <div className="lg:col-span-1">
                            <MultiSelectDropdown
                                label="Conjunto de Anúncios"
                                options={adsets || []}
                                selectedIds={filters.adsetIds}
                                onChange={(selected) => handleFilterChange('adsetIds', selected)}
                                placeholder={isLoadingOptions ? "Carregando..." : "Todos os Conjuntos"}
                                disabled={isLoadingOptions}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            <MultiSelectDropdown label="Status do Anúncio" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos os Status" />
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs uppercase font-medium text-gray-600">De:</label>
                                <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-medium text-gray-600">Até:</label>
                                <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setDateRange('today')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                            <button onClick={() => setDateRange('week')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                            <button onClick={() => setDateRange('month')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                        </div>
                        <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase font-semibold">
                            <FontAwesomeIcon icon={faTimes} />Limpar Filtros
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
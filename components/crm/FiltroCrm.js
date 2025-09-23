// components/crm/FiltroCrm.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter, faTimes, faChevronUp, faChevronDown,
    faCalendarDay, faCalendarWeek, faCalendarAlt
} from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';

// O PORQUÊ: Adicionamos `campaignIds` and `adIds` ao estado padrão do filtro.
// Agora, quando o filtro for limpo, esses campos também serão resetados.
const getDefaultFilterState = () => ({
    searchTerm: '',
    corretorIds: [],
    origens: [],
    unidadeIds: [],
    campaignIds: [], // <-- NOVO
    adIds: [],       // <-- NOVO
    startDate: '',
    endDate: new Date().toISOString().split('T')[0],
});

// O PORQUÊ: O componente agora está pronto para receber as listas de `campanhas` e `anuncios`
// da página principal para popular os novos dropdowns.
export default function FiltroCrm({ filters, setFilters, corretores, unidades, origens, campaigns, ads }) {
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'startDate' || name === 'endDate') {
            setActivePeriodFilter('');
        }
    };

    const setDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') { startDate = endDate = today; } 
        else if (period === 'week') {
            const firstDayOfWeek = new Date(today);
            firstDayOfWeek.setDate(today.getDate() - today.getDay());
            startDate = firstDayOfWeek;
            endDate = new Date(firstDayOfWeek);
            endDate.setDate(endDate.getDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        setFilters(prev => ({ ...prev, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] }));
        setActivePeriodFilter(period);
    };
    
    const clearFilters = () => {
        setFilters(getDefaultFilterState());
        setActivePeriodFilter('');
    };

    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm space-y-4 mb-4">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setFiltersVisible(!filtersVisible)}>
                <h2 className="font-semibold text-lg flex items-center gap-2 text-gray-700">
                    <FontAwesomeIcon icon={faFilter} /> Filtros
                </h2>
                <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
            </div>

            {filtersVisible && (
                <div className="space-y-4 animate-fade-in pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs uppercase font-medium text-gray-600">Buscar Contato</label>
                            <input type="text" name="searchTerm" placeholder="Nome, telefone, email..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full mt-1" />
                        </div>
                        <div>
                           <MultiSelectDropdown label="Corretor Responsável" options={corretores || []} selectedIds={filters.corretorIds} onChange={(selected) => handleFilterChange('corretorIds', selected)} placeholder="Todos os Corretores" />
                        </div>
                        <div>
                             <MultiSelectDropdown label="Origem do Lead" options={origens || []} selectedIds={filters.origens} onChange={(selected) => handleFilterChange('origens', selected)} placeholder="Todas as Origens" />
                        </div>
                    </div>

                    {/* O PORQUÊ: Adicionamos uma nova linha dedicada aos filtros de Meta Ads. */}
                    {/* Isso mantém a organização visual e agrupa filtros relacionados. */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <MultiSelectDropdown label="Campanha" options={campaigns || []} selectedIds={filters.campaignIds} onChange={(selected) => handleFilterChange('campaignIds', selected)} placeholder="Todas as Campanhas" />
                        </div>
                        <div>
                           <MultiSelectDropdown label="Anúncio" options={ads || []} selectedIds={filters.adIds} onChange={(selected) => handleFilterChange('adIds', selected)} placeholder="Todos os Anúncios" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1">
                            <MultiSelectDropdown label="Unidade de Interesse" options={unidades || []} selectedIds={filters.unidadeIds} onChange={(selected) => handleFilterChange('unidadeIds', selected)} placeholder="Todas as Unidades" />
                        </div>
                        <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs uppercase font-medium text-gray-600">Criado De:</label>
                                <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label className="text-xs uppercase font-medium text-gray-600">Criado Até:</label>
                                <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm" />
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
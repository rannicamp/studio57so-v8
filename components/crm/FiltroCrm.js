// components/crm/FiltroCrm.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCalendarDay, faCalendarWeek, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';

const getDefaultFilterState = () => ({
    // searchTerm é gerenciado fora agora, mas mantemos a estrutura limpa
    corretorIds: [],
    origens: [],
    unidadeIds: [],
    campaignIds: [],
    adIds: [],
    startDate: '',
    endDate: new Date().toISOString().split('T')[0],
});

export default function FiltroCrm({ 
    filters, setFilters, unidades, origens, campaigns, ads, corretores
}) {
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
        // Mantém o termo de busca atual, limpa apenas os filtros avançados
        setFilters(prev => ({ ...getDefaultFilterState(), searchTerm: prev.searchTerm }));
        setActivePeriodFilter('');
    };

    return (
        <div className="bg-gray-50 border-b border-gray-200 p-4 animate-slide-down shadow-inner">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Corretores */}
                <div>
                   <MultiSelectDropdown 
                        label="Corretor Responsável" 
                        options={corretores || []} 
                        selectedIds={filters.corretorIds} 
                        onChange={(selected) => handleFilterChange('corretorIds', selected)} 
                        placeholder="Todos os Corretores" 
                   />
                </div>

                {/* Origens */}
                <div>
                     <MultiSelectDropdown label="Origem do Lead" options={origens || []} selectedIds={filters.origens} onChange={(selected) => handleFilterChange('origens', selected)} placeholder="Todas as Origens" />
                </div>

                {/* Unidades */}
                <div>
                    <MultiSelectDropdown label="Unidade de Interesse" options={unidades || []} selectedIds={filters.unidadeIds} onChange={(selected) => handleFilterChange('unidadeIds', selected)} placeholder="Todas as Unidades" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {/* Campanhas e Ads */}
                <div>
                   <MultiSelectDropdown label="Campanha" options={campaigns || []} selectedIds={filters.campaignIds} onChange={(selected) => handleFilterChange('campaignIds', selected)} placeholder="Todas as Campanhas" />
                </div>
                <div>
                   <MultiSelectDropdown label="Anúncio" options={ads || []} selectedIds={filters.adIds} onChange={(selected) => handleFilterChange('adIds', selected)} placeholder="Todos os Anúncios" />
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-600">Criado De:</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-600">Criado Até:</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                    <button onClick={() => setDateRange('today')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                    <button onClick={() => setDateRange('week')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                    <button onClick={() => setDateRange('month')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                </div>
                <button onClick={clearFilters} className="text-xs bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 px-4 py-2 rounded-md flex items-center gap-2 font-semibold transition-all shadow-sm">
                    <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
                </button>
            </div>
        </div>
    );
}
// components/crm/FiltroCrm.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCalendarDay, faCalendarWeek, faCalendarAlt, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';

// 1. Função Auxiliar para pegar a data CORRETA no fuso local (Brasil)
// Evita que o lead criado a noite suma por causa do fuso UTC
const getLocalToday = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

// 2. Estado padrão agora deixa a data final VAZIA (Sem limite)
// Isso garante que novos leads sempre apareçam imediatamente
const getDefaultFilterState = () => ({
    corretorIds: [],
    origens: [],
    unidadeIds: [],
    campaignIds: [],
    adIds: [],
    startDate: '',
    endDate: '', // VAZIO = Mostra tudo até o momento atual
    isDynamicEndDate: false, // Desligado por padrão para evitar confusão
});

export default function FiltroCrm({ 
    filters, setFilters, unidades, origens, campaigns, ads, corretores
}) {
    const [activePeriodFilter, setActivePeriodFilter] = useState('');

    // --- 🧠 O CÉREBRO DA DATA DINÂMICA ---
    // Só atualiza se o usuário ATIVAMENTE ligou a opção "Sempre Hoje"
    useEffect(() => {
        if (filters.isDynamicEndDate) {
            const hojeReal = getLocalToday();
            
            if (filters.endDate !== hojeReal) {
                console.log("🔄 Filtro Inteligente: Atualizando 'Até' para a data de hoje:", hojeReal);
                setFilters(prev => ({ ...prev, endDate: hojeReal }));
            }
        }
    }, [filters.isDynamicEndDate, setFilters]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => {
            const newState = { ...prev, [name]: value };
            
            // Se mexer manualmente na data final, desligamos a inteligência
            if (name === 'endDate') {
                newState.isDynamicEndDate = false;
                setActivePeriodFilter('');
            }
            if (name === 'startDate') {
                setActivePeriodFilter('');
            }
            
            return newState;
        });
    };

    // Toggle para a caixinha "Sempre até Hoje"
    const toggleDynamicDate = () => {
        setFilters(prev => {
            const isTurningOn = !prev.isDynamicEndDate;
            const hoje = getLocalToday();
            return {
                ...prev,
                isDynamicEndDate: isTurningOn,
                endDate: isTurningOn ? hoje : prev.endDate 
            };
        });
    };

    const setDateRange = (period) => {
        const today = new Date();
        // Ajuste de fuso para cálculos
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        
        let startDate, endDate;
        let dynamic = false;

        if (period === 'today') { 
            startDate = today;
            endDate = today; 
            dynamic = true; // Botão "Hoje" liga o modo dinâmico
        } else if (period === 'week') {
            const firstDayOfWeek = new Date(today);
            firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
            startDate = firstDayOfWeek;
            
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
            endDate = lastDayOfWeek;
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }

        setFilters(prev => ({ 
            ...prev, 
            startDate: startDate.toISOString().split('T')[0], 
            endDate: endDate.toISOString().split('T')[0],
            isDynamicEndDate: dynamic
        }));
        setActivePeriodFilter(period);
    };
    
    // Agora o Limpar Filtros remove a data final, resolvendo seu problema!
    const clearFilters = () => {
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

                {/* Datas Inteligentes */}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-600">Criado De:</label>
                        <input 
                            type="date" 
                            name="startDate" 
                            value={filters.startDate} 
                            onChange={(e) => handleFilterChange('startDate', e.target.value)} 
                            className="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm" 
                        />
                    </div>
                    
                    <div className="relative">
                        <label className="text-xs uppercase font-medium text-gray-600 flex justify-between items-center">
                            Criado Até:
                            {/* Checkbox Mágico */}
                            <div className="flex items-center gap-1 cursor-pointer group" onClick={toggleDynamicDate} title="Se marcado, a data final será sempre atualizada para o dia atual automaticamente.">
                                <div className={`w-3 h-3 rounded-sm border ${filters.isDynamicEndDate ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white'} flex items-center justify-center transition-colors`}>
                                    {filters.isDynamicEndDate && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <span className={`text-[10px] normal-case ${filters.isDynamicEndDate ? 'text-blue-600 font-bold' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                    Sempre Hoje
                                </span>
                            </div>
                        </label>
                        <div className="relative mt-1">
                            <input 
                                type="date" 
                                name="endDate" 
                                value={filters.endDate} 
                                onChange={(e) => handleFilterChange('endDate', e.target.value)} 
                                disabled={filters.isDynamicEndDate} 
                                className={`w-full p-2 border rounded-md shadow-sm text-sm ${filters.isDynamicEndDate ? 'bg-blue-50 text-blue-800 border-blue-200 cursor-not-allowed font-medium' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`} 
                            />
                            {filters.isDynamicEndDate && (
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-blue-400">
                                    <FontAwesomeIcon icon={faSyncAlt} className="animate-spin-slow text-xs" />
                                </div>
                            )}
                        </div>
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
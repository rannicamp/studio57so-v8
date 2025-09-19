// components/comercial/FiltroAnuncios.js

"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter, faTimes, faSave, faEllipsisV, faChevronUp, faChevronDown,
    faSyncAlt, faTrash, faStar as faStarSolid,
    faCalendarDay, faCalendarWeek, faCalendarAlt // Ícones de data
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { toast } from 'sonner';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';

// Novo estado inicial que a página vai nos passar
const initialFilterState = {
    searchTerm: '',
    status: [],
    startDate: '',
    endDate: '',
};

const statusOptions = [
    { id: 'ACTIVE', nome: 'Ativo' }, { id: 'PAUSED', nome: 'Pausado' },
    { id: 'ARCHIVED', nome: 'Arquivado' }, { id: 'DISAPPROVED', nome: 'Reprovado' },
    { id: 'PENDING_REVIEW', nome: 'Em Análise' }, { id: 'CAMPAIGN_PAUSED', nome: 'Campanha Pausada' },
    { id: 'ADSET_PAUSED', nome: 'Conjunto Pausado' }, { id: 'DELETED', nome: 'Excluído' },
];

export default function FiltroAnuncios({ filters, setFilters }) {
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState(''); // Estado para o botão de data ativo

    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedAdsFilters') || '[]');
        setSavedFilters(loadedFilters);
    }, []);

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
        // Se o usuário mexer nas datas manualmente, desmarca os botões de atalho
        if (name === 'startDate' || name === 'endDate') {
            setActivePeriodFilter('');
        }
    };

    // LÓGICA DE DATAS DO FILTRO FINANCEIRO!
    const setDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') {
            startDate = endDate = today;
        } else if (period === 'week') {
            const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            startDate = firstDayOfWeek;
            endDate = new Date(firstDayOfWeek);
            endDate.setDate(endDate.getDate() + 6);
        } else if (period === 'month') {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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

    // Funções de salvar/carregar filtros (sem alterações)
    const handleSaveFilter = () => { if (!newFilterName.trim()) { toast.warning('Por favor, dê um nome para o filtro.'); return; } const updatedFilters = savedFilters.filter(f => f.name !== newFilterName); const newFilter = { name: newFilterName, settings: filters, isFavorite: false }; const newSavedFilters = [...updatedFilters, newFilter]; setSavedFilters(newSavedFilters); localStorage.setItem('savedAdsFilters', JSON.stringify(newSavedFilters)); setNewFilterName(''); toast.success(`Filtro "${newFilterName}" salvo!`); };
    const handleUpdateFilter = (filterName) => { const updated = savedFilters.map(f => f.name === filterName ? { ...f, settings: filters } : f); setSavedFilters(updated); localStorage.setItem('savedAdsFilters', JSON.stringify(updated)); toast.success(`Filtro "${filterName}" atualizado!`); };
    const handleToggleFavorite = (filterName) => { const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f); setSavedFilters(updated); localStorage.setItem('savedAdsFilters', JSON.stringify(updated)); };
    const handleLoadFilter = (filterSettings) => { setFilters({ ...initialFilterState, ...filterSettings }); setIsFilterMenuOpen(false); setActivePeriodFilter(''); };
    const handleDeleteFilter = (filterName) => { const updated = savedFilters.filter(f => f.name !== filterName); setSavedFilters(updated); localStorage.setItem('savedAdsFilters', JSON.stringify(updated)); toast.error(`Filtro "${filterName}" excluído.`); };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            {/* Cabeçalho do filtro (sem alterações) */}
            <div className="flex justify-between items-center">
                <button onClick={() => setFiltersVisible(!filtersVisible)} className="font-semibold text-lg flex items-center gap-2 uppercase">
                    <FontAwesomeIcon icon={faFilter} /> Filtros
                    <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
                </button>
                <div className="relative" ref={filterMenuRef}>
                    <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="p-2 border rounded-md bg-white hover:bg-gray-100"><FontAwesomeIcon icon={faEllipsisV} /></button>
                    {isFilterMenuOpen && ( <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border"> <div className="p-3 border-b"> <p className="font-semibold text-sm mb-2">Salvar Filtro Atual</p> <div className="flex items-center gap-2"> <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-2 border rounded-md text-sm w-full" /> <button onClick={handleSaveFilter} className="text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-2 rounded-md"><FontAwesomeIcon icon={faSave} /></button> </div> </div> <div className="p-3"> <p className="font-semibold text-sm mb-2">Filtros Salvos</p> <ul className="max-h-40 overflow-y-auto"> {savedFilters.length > 0 ? savedFilters.map((f, i) => ( <li key={i} className="flex justify-between items-center text-sm py-1 group"> <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer hover:underline">{f.name}</span> <div className="flex items-center gap-2"> <button onClick={() => handleUpdateFilter(f.name)} title="Atualizar Filtro" className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"><FontAwesomeIcon icon={faSyncAlt} /></button> <button onClick={() => handleToggleFavorite(f.name)} title="Favoritar" className="text-gray-400 hover:text-yellow-500"><FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} className={f.isFavorite ? 'text-yellow-500' : ''} /></button> <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><FontAwesomeIcon icon={faTrash} /></button> </div> </li> )) : <li className="text-xs text-gray-500">Nenhum filtro salvo.</li>} </ul> </div> </div> )}
                </div>
            </div>

            {filtersVisible && (
                <div className="space-y-4 animate-fade-in pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1">
                            <label className="text-xs uppercase font-medium text-gray-600">Buscar por Nome</label>
                            <input type="text" name="searchTerm" placeholder="Nome do anúncio, campanha..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full mt-1" />
                        </div>
                        <div className="lg:col-span-1">
                            <MultiSelectDropdown label="Status do Anúncio" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos os Status" />
                        </div>
                        <div className="lg:col-span-1 grid grid-cols-2 gap-2">
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
                        <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase">
                            <FontAwesomeIcon icon={faTimes} />Limpar Filtros
                        </button>
                    </div>
                </div>
            )}
            
            {/* Filtros Favoritos (sem alterações) */}
            {savedFilters.filter(f => f.isFavorite).length > 0 && ( <div className="p-4 border rounded-lg bg-white space-y-2 mt-4"> <h4 className="font-semibold flex items-center gap-2 text-sm uppercase text-gray-600"> <FontAwesomeIcon icon={faStarSolid} /> Filtros Favoritos </h4> <div className="flex flex-wrap gap-2"> {savedFilters.filter(f => f.isFavorite).map((f, i) => ( <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors border ${JSON.stringify(filters) === JSON.stringify(f.settings) ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`}> {f.name} </button> ))} </div> </div> )}
        </div>
    );
}
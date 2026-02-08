// components/comercial/FiltroAnuncios.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faStar as faStarSolid, faEllipsisV, faTrash, faSyncAlt, faCalendarDay, faCalendarWeek, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';
import { toast } from 'sonner';

const initialFilterState = {
    // searchTerm é gerenciado pelo componente pai (Page)
    status: [],
    startDate: '',
    endDate: '',
    campaignIds: [],
    adsetIds: [],
};

export default function FiltroAnuncios({ 
    filters, 
    setFilters, 
    campaigns, 
    adsets 
}) {
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');

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
        // Preserva o termo de busca atual
        setFilters(prev => ({ ...initialFilterState, searchTerm: prev.searchTerm }));
        setActivePeriodFilter('');
    };

    const handleSaveFilter = () => {
        if (!newFilterName.trim()) {
            toast.warning('Por favor, dê um nome para o filtro.');
            return;
        }
        const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false;
        const updatedFilters = savedFilters.filter(f => f.name !== newFilterName);
        const newSavedFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited };
        const newFiltersList = [...updatedFilters, newSavedFilter];
        
        setSavedFilters(newFiltersList);
        localStorage.setItem('savedAdsFilters', JSON.stringify(newFiltersList));
        setNewFilterName('');
        toast.success(`Filtro "${newFilterName}" salvo!`);
    };

    const handleLoadFilter = (filterSettings) => {
        setFilters({ ...initialFilterState, ...filterSettings });
        setIsFilterMenuOpen(false);
    };

    const handleDeleteFilter = (filterName) => {
        const updated = savedFilters.filter(f => f.name !== filterName);
        setSavedFilters(updated);
        localStorage.setItem('savedAdsFilters', JSON.stringify(updated));
        toast.success('Filtro excluído.');
    };
    
    const handleToggleFavorite = (filterName) => {
        const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedAdsFilters', JSON.stringify(updated));
    };

    const statusOptions = [
        { id: 'ACTIVE', nome: 'Ativo' },
        { id: 'PAUSED', nome: 'Pausado' },
        { id: 'ARCHIVED', nome: 'Arquivado' },
    ];

    return (
        <div className="bg-gray-50 border-b border-gray-200 p-4 animate-slide-down shadow-inner rounded-lg mb-4">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-2">Filtros Avançados</h3>
                
                {/* Menu de Gerenciamento de Filtros */}
                <div className="relative" ref={filterMenuRef}>
                    <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-md hover:bg-white border border-transparent hover:border-gray-200" title="Gerenciar Filtros Salvos">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                    {isFilterMenuOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border ring-1 ring-black ring-opacity-5">
                            <div className="p-3 border-b bg-gray-50 rounded-t-md">
                                <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Salvar Filtro Atual</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-1.5 border rounded text-xs w-full"/>
                                    <button onClick={handleSaveFilter} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded"><FontAwesomeIcon icon={faSave}/></button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Meus Filtros</p>
                                <ul className="max-h-40 overflow-y-auto space-y-1">
                                    {savedFilters.length > 0 ? savedFilters.map((f, i) => (
                                        <li key={i} className="flex justify-between items-center text-sm p-1 hover:bg-gray-50 rounded group">
                                            <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer text-gray-700 hover:text-blue-600 truncate flex-1">{f.name}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleLoadFilter(f.settings)} title="Carregar" className="text-gray-400 hover:text-blue-500 p-1"><FontAwesomeIcon icon={faSyncAlt} size="xs"/></button>
                                                <button onClick={() => handleToggleFavorite(f.name)} title="Favoritar" className={`p-1 ${f.isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}><FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} size="xs"/></button>
                                                <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faTrash} size="xs"/></button>
                                            </div>
                                        </li>
                                    )) : <li className="text-xs text-gray-400 italic">Nenhum salvo.</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MultiSelectDropdown 
                    label="Status" 
                    options={statusOptions} 
                    selectedIds={filters.status} 
                    onChange={(selected) => handleFilterChange('status', selected)} 
                    placeholder="Todos os Status"
                />
                <MultiSelectDropdown 
                    label="Campanhas" 
                    options={campaigns || []} 
                    selectedIds={filters.campaignIds} 
                    onChange={(selected) => handleFilterChange('campaignIds', selected)} 
                    placeholder="Todas as Campanhas"
                />
                <MultiSelectDropdown 
                    label="Conjuntos de Anúncios" 
                    options={adsets || []} 
                    selectedIds={filters.adsetIds} 
                    onChange={(selected) => handleFilterChange('adsetIds', selected)} 
                    placeholder="Todos os Conjuntos"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 items-end">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">De</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/>
                    </div>
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Até</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/>
                    </div>
                </div>
                
                <div className="flex justify-start lg:justify-end gap-2">
                    <button onClick={() => setDateRange('today')} className={`text-xs font-medium border px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                    <button onClick={() => setDateRange('week')} className={`text-xs font-medium border px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                    <button onClick={() => setDateRange('month')} className={`text-xs font-medium border px-3 py-2 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-200">
                {/* Filtros Favoritos (Atalhos) */}
                <div className="flex flex-wrap gap-2 items-center flex-1">
                    {savedFilters.filter(f => f.isFavorite).length > 0 ? (
                        <>
                            <span className="text-xs font-bold text-gray-400 uppercase mr-2"><FontAwesomeIcon icon={faStarSolid} /> Favoritos:</span>
                            {savedFilters.filter(f => f.isFavorite).map((f, i) => {
                                const isActive = JSON.stringify(filters) === JSON.stringify(f.settings);
                                return (
                                    <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        {f.name}
                                    </button>
                                )
                            })}
                        </>
                    ) : <span className="text-xs text-gray-400 italic">Favoritos aparecem aqui.</span>}
                </div>

                <button onClick={clearFilters} className="text-xs bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 px-4 py-2 rounded-md flex items-center gap-2 font-semibold transition-all shadow-sm">
                    <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
                </button>
            </div>
        </div>
    );
}
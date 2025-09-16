// components/contratos/FiltroContratos.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFilter, faTimes, faChevronUp, faChevronDown, faSave,
    faStar as faStarSolid, faEllipsisV, faSyncAlt, faTrash
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';
import { toast } from 'sonner';

const initialFilterState = {
    searchTerm: '', clienteId: [], corretorId: [], produtoId: [], empreendimentoId: [],
    status: [], startDate: '', endDate: ''
};

export default function FiltroContratos({
    filters,
    setFilters,
    clientes,
    corretores,
    produtos,
    empreendimentos
}) {
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);

    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedContractFilters') || '[]');
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
    };

    const clearFilters = () => setFilters(initialFilterState);

    const handleSaveFilter = () => {
        if (!newFilterName.trim()) {
            toast.warning('Por favor, dê um nome para o filtro.');
            return;
        }
        const updatedFilters = savedFilters.filter(f => f.name !== newFilterName);
        const newSavedFilter = { name: newFilterName, settings: filters, isFavorite: false };
        const newFiltersList = [...updatedFilters, newSavedFilter];
        setSavedFilters(newFiltersList);
        localStorage.setItem('savedContractFilters', JSON.stringify(newFiltersList));
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
        localStorage.setItem('savedContractFilters', JSON.stringify(updated));
        toast.success('Filtro excluído.');
    };
    
    const handleToggleFavorite = (filterName) => {
        const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedContractFilters', JSON.stringify(updated));
    };

    const statusOptions = [
        { id: 'Em assinatura', nome: 'Em assinatura' },
        { id: 'Assinado', nome: 'Assinado' },
        { id: 'Distratado', nome: 'Distratado' },
        { id: 'Finalizado', nome: 'Finalizado' },
    ];
    
    const clientesOptions = clientes.map(c => ({...c, nome: c.nome || c.razao_social }));
    const corretoresOptions = corretores.map(c => ({...c, nome: c.nome || c.razao_social }));
    const produtosOptions = produtos.map(p => ({...p, nome: `${p.tipo || 'Unidade'} ${p.unidade || ''}`.trim() }));

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <div className="flex justify-between items-center">
                <button onClick={() => setFiltersVisible(!filtersVisible)} className="font-semibold text-lg flex items-center gap-2 uppercase">
                    <FontAwesomeIcon icon={faFilter} /> Filtros de Contratos
                    <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" />
                </button>
                <div className="relative" ref={filterMenuRef}>
                    <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="p-2 border rounded-md bg-white hover:bg-gray-100">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                    {isFilterMenuOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border">
                            <div className="p-3 border-b">
                                <p className="font-semibold text-sm mb-2">Salvar Filtro Atual</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-2 border rounded-md text-sm w-full"/>
                                    <button onClick={handleSaveFilter} className="text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-2 rounded-md"><FontAwesomeIcon icon={faSave}/></button>
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="font-semibold text-sm mb-2">Filtros Salvos</p>
                                <ul className="max-h-40 overflow-y-auto">
                                    {savedFilters.length > 0 ? savedFilters.map((f, i) => (
                                        <li key={i} className="flex justify-between items-center text-sm py-1 group">
                                            <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer hover:underline">{f.name}</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleToggleFavorite(f.name)} title="Favoritar" className="text-gray-400 hover:text-yellow-500"><FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} className={f.isFavorite ? 'text-yellow-500' : ''}/></button>
                                                <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"><FontAwesomeIcon icon={faTrash}/></button>
                                            </div>
                                        </li>
                                    )) : <li className="text-xs text-gray-500">Nenhum filtro salvo.</li>}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {filtersVisible && (
                <div className="space-y-4 animate-fade-in">
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-600">Busca Rápida</label>
                        <input
                            type="text"
                            placeholder="Buscar por nº, cliente, produto, empreendimento ou corretor..."
                            value={filters.searchTerm}
                            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MultiSelectDropdown 
                            label="Empreendimento" 
                            options={empreendimentos} 
                            selectedIds={filters.empreendimentoId} 
                            onChange={(selected) => handleFilterChange('empreendimentoId', selected)} 
                        />
                        <MultiSelectDropdown 
                            label="Produto/Unidade" 
                            options={produtosOptions} 
                            selectedIds={filters.produtoId} 
                            onChange={(selected) => handleFilterChange('produtoId', selected)} 
                        />
                        <MultiSelectDropdown 
                            label="Cliente" 
                            options={clientesOptions} 
                            selectedIds={filters.clienteId} 
                            onChange={(selected) => handleFilterChange('clienteId', selected)} 
                        />
                        <MultiSelectDropdown 
                            label="Corretor" 
                            options={corretoresOptions} 
                            selectedIds={filters.corretorId} 
                            onChange={(selected) => handleFilterChange('corretorId', selected)} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="lg:col-span-2">
                             <MultiSelectDropdown 
                                label="Status" 
                                options={statusOptions} 
                                selectedIds={filters.status} 
                                onChange={(selected) => handleFilterChange('status', selected)} 
                            />
                        </div>
                        <div>
                            <label className="text-xs uppercase font-medium text-gray-600">Venda De:</label>
                            <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/>
                        </div>
                        <div>
                            <label className="text-xs uppercase font-medium text-gray-600">Venda Até:</label>
                            <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase">
                            <FontAwesomeIcon icon={faTimes} />Limpar Filtros
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
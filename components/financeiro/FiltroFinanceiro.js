"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFilter, faTimes, faSave, faStar as faStarSolid, faEllipsisV,
    faChevronUp, faChevronDown, faCalendarDay, faCalendarWeek, faCalendarAlt, faSyncAlt,
    faArrowUp, faArrowDown, faTrash, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import MultiSelectDropdown from './MultiSelectDropdown';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const initialFilterState = {
    searchTerm: '', empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
    etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
};

const fetchEtapas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('etapa_obra')
        .select('id, nome_etapa')
        .eq('organizacao_id', organizacaoId)
        .order('nome_etapa');
    if (error) throw new Error("Falha ao buscar etapas.");
    return data || [];
};

export default function FiltroFinanceiro({
    filters,
    setFilters,
    empresas,
    contas,
    categorias,
    empreendimentos,
    allContacts
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [filtersVisible, setFiltersVisible] = useState(true);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const favorecidoInputRef = useRef(null);
    
    const { data: etapas = [] } = useQuery({
        queryKey: ['etapas', organizacaoId],
        queryFn: () => fetchEtapas(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });
    
    useEffect(() => {
        if (favorecidoSearchTerm.length < 2) {
            setFavorecidoSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            if (!organizacaoId) return;
            setIsSearching(true);
            try {
                const { data, error } = await supabase.rpc('buscar_contatos_geral', { 
                    p_search_term: favorecidoSearchTerm,
                    p_organizacao_id: organizacaoId
                });

                if (error) throw error; // Lança o erro para o catch

                setFavorecidoSearchResults(data || []);
            } catch (error) {
                console.error("Erro ao buscar favorecido:", error);
                toast.error("Não foi possível buscar os contatos.");
                setFavorecidoSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);

    }, [favorecidoSearchTerm, supabase, organizacaoId]);

    const handleSelectFavorecido = (contato) => {
        handleFilterChange('favorecidoId', contato.id);
        setFavorecidoSearchTerm(contato.nome || contato.razao_social);
        setFavorecidoSearchResults([]);
    };
    
    const handleClearFavorecido = () => {
        handleFilterChange('favorecidoId', null);
        setFavorecidoSearchTerm('');
        setFavorecidoSearchResults([]);
    };

    const selectedFavorecidoName = useMemo(() => {
        if (!filters.favorecidoId) return '';
        // Prioriza a busca no resultado da pesquisa, depois na lista geral
        const foundInSearch = favorecidoSearchResults.find(c => c.id === filters.favorecidoId);
        if (foundInSearch) return foundInSearch.nome || foundInSearch.razao_social;
        const contato = allContacts.find(c => c.id === filters.favorecidoId);
        return contato ? (contato.nome || contato.razao_social) : favorecidoSearchTerm;
    }, [filters.favorecidoId, allContacts, favorecidoSearchResults, favorecidoSearchTerm]);
    
    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]');
        setSavedFilters(loadedFilters);
    }, []);

    useEffect(() => {
        function handleClickOutside(event) {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) setIsFilterMenuOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef]);

    const categoryTree = useMemo(() => {
        const tree = []; const map = {}; const allCategories = JSON.parse(JSON.stringify(categorias || [])); allCategories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; }); allCategories.forEach(cat => { if (cat.parent_id && map[cat.parent_id]) { map[cat.parent_id].children.push(map[cat.id]); } else { tree.push(map[cat.id]); } }); return tree;
    }, [categorias]);
    
    const handleFilterChange = (name, value) => { setFilters(prev => ({...prev, [name]: value})); if(name !== 'startDate' && name !== 'endDate') setActivePeriodFilter(''); };
    const handleNatureFilterClick = (nature) => { setFilters(prev => { const currentTipo = prev.tipo || []; const newTipo = currentTipo.includes(nature) ? currentTipo.filter(t => t !== nature) : [...currentTipo, nature]; return { ...prev, tipo: newTipo }; }); };
    const setDateRange = (period) => { const today = new Date(); let startDate, endDate; if (period === 'today') { startDate = endDate = today; } else if (period === 'week') { const firstDayOfWeek = today.getDate() - today.getDay(); startDate = new Date(today.setDate(firstDayOfWeek)); endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6); } else if (period === 'month') { startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); } setFilters(prev => ({ ...prev, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], month: '', year: '' })); setActivePeriodFilter(period); };
    
    const clearFilters = () => { setFilters(initialFilterState); setFavorecidoSearchTerm(''); setActivePeriodFilter(''); };

    const handleSaveFilter = () => { if (!newFilterName.trim()) { toast.warning('Por favor, dê um nome para o filtro.'); return; } const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false; const updatedSavedFilters = savedFilters.filter(f => f.name !== newFilterName); const newSavedFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited }; setSavedFilters([...updatedSavedFilters, newSavedFilter]); localStorage.setItem('savedFinancialFilters', JSON.stringify([...updatedSavedFilters, newSavedFilter])); setNewFilterName(''); toast.success(`Filtro "${newFilterName}" salvo!`); };
    const handleUpdateFilter = (filterName) => { const updated = savedFilters.map(f => f.name === filterName ? { ...f, settings: filters } : f); setSavedFilters(updated); localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); toast.success(`Filtro "${filterName}" atualizado com sucesso!`); };
    const handleToggleFavorite = (filterName) => { const updated = savedFilters.map(f => f.name === filterName ? { ...f, isFavorite: !f.isFavorite } : f); setSavedFilters(updated); localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); };
    const handleLoadFilter = (filterSettings) => { setFilters({ ...initialFilterState, ...filterSettings }); setIsFilterMenuOpen(false); setActivePeriodFilter(''); };
    const handleDeleteFilter = (filterNameToDelete) => { 
        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir o filtro "${filterNameToDelete}"?`,
            action: {
                label: "Excluir",
                onClick: () => {
                    const updatedSavedFilters = savedFilters.filter(f => f.name !== filterNameToDelete);
                    setSavedFilters(updatedSavedFilters);
                    localStorage.setItem('savedFinancialFilters', JSON.stringify(updatedSavedFilters));
                    toast.success("Filtro excluído.");
                },
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    const statusOptions = [{ id: 'Pago', text: 'Paga' }, { id: 'Pendente', text: 'A Pagar' }, { id: 'Atrasada', text: 'Atrasada' }].map(s => ({...s, nome: s.text}));
    const months = [ {id: "01", nome: "Janeiro"}, {id: "02", nome: "Fevereiro"}, {id: "03", nome: "Março"}, {id: "04", nome: "Abril"}, {id: "05", nome: "Maio"}, {id: "06", nome: "Junho"}, {id: "07", nome: "Julho"}, {id: "08", nome: "Agosto"}, {id: "09", nome: "Setembro"}, {id: "10", nome: "Outubro"}, {id: "11", nome: "Novembro"}, {id: "12", nome: "Dezembro"} ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => ({ id: (currentYear - 5 + i).toString(), nome: (currentYear - 5 + i).toString() }));

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
            <div className="flex justify-between items-center">
                <button onClick={() => setFiltersVisible(!filtersVisible)} className="font-semibold text-lg flex items-center gap-2 uppercase"> <FontAwesomeIcon icon={faFilter} /> Filtros <FontAwesomeIcon icon={filtersVisible ? faChevronUp : faChevronDown} className="text-sm" /> </button>
                <div className="relative" ref={filterMenuRef}> <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="p-2 border rounded-md bg-white hover:bg-gray-100"> <FontAwesomeIcon icon={faEllipsisV} /> </button> {isFilterMenuOpen && ( <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border"> <div className="p-3 border-b"> <p className="font-semibold text-sm mb-2">Salvar Filtro Atual</p> <div className="flex items-center gap-2"> <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-2 border rounded-md text-sm w-full"/> <button onClick={handleSaveFilter} className="text-sm bg-blue-500 text-white hover:bg-blue-600 px-3 py-2 rounded-md"><FontAwesomeIcon icon={faSave}/></button> </div> </div> <div className="p-3"> <p className="font-semibold text-sm mb-2">Filtros Salvos</p> <ul className="max-h-40 overflow-y-auto"> {savedFilters.length > 0 ? savedFilters.map((f, i) => ( <li key={i} className="flex justify-between items-center text-sm py-1 group"> <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer hover:underline">{f.name}</span> <div className="flex items-center gap-2"> <button onClick={() => handleUpdateFilter(f.name)} title="Atualizar Filtro" className="text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100"> <FontAwesomeIcon icon={faSyncAlt}/> </button> <button onClick={() => handleToggleFavorite(f.name)} title="Favoritar" className="text-gray-400 hover:text-yellow-500"> <FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} className={f.isFavorite ? 'text-yellow-500' : ''}/> </button> <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100"> <FontAwesomeIcon icon={faTrash}/> </button> </div> </li> )) : <li className="text-xs text-gray-500">Nenhum filtro salvo.</li>} </ul> </div> </div> )} </div>
            </div>
            
            {filtersVisible && ( <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-4 pt-2">
                    <span className="text-sm font-semibold text-gray-700">Filtrar por Natureza:</span>
                    <button onClick={() => handleNatureFilterClick('Receita')} className={`text-sm border px-4 py-2 rounded-md flex items-center gap-2 ${filters.tipo?.includes('Receita') ? 'bg-green-600 text-white border-green-700' : 'bg-white hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowUp}/> Receitas </button>
                    <button onClick={() => handleNatureFilterClick('Despesa')} className={`text-sm border px-4 py-2 rounded-md flex items-center gap-2 ${filters.tipo?.includes('Despesa') ? 'bg-red-600 text-white border-red-700' : 'bg-white hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowDown}/> Despesas </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="w-full">
                        <label className="text-xs uppercase font-medium text-gray-600">Descrição</label>
                        <input type="text" name="searchTerm" placeholder="Buscar por descrição..." value={filters.searchTerm} onChange={(e) => handleFilterChange('searchTerm', e.target.value)} className="p-2 border rounded-md shadow-sm w-full mt-1" />
                    </div>
                    
                    <div className="relative" ref={favorecidoInputRef}>
                        <label className="text-xs uppercase font-medium text-gray-600">Favorecido</label>
                        {filters.favorecidoId ? (
                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-200 h-[42px]">
                                <span className="font-semibold text-gray-800">{selectedFavorecidoName}</span>
                                <button type="button" onClick={handleClearFavorecido} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes}/></button>
                            </div>
                        ) : (
                            <>
                                <input type="text" placeholder="Digite para buscar..." value={favorecidoSearchTerm} onChange={(e) => setFavorecidoSearchTerm(e.target.value)} className="mt-1 w-full p-2 border rounded-md shadow-sm h-[42px]" />
                                {(isSearching || favorecidoSearchResults.length > 0) && (
                                    <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                                        {isSearching && <li className="p-2 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</li>}
                                        {!isSearching && favorecidoSearchResults.map(c => ( <li key={c.id} onClick={() => handleSelectFavorecido(c)} className="p-2 hover:bg-gray-100 cursor-pointer text-sm"> <HighlightedText text={c.nome || c.razao_social} highlight={favorecidoSearchTerm} /> </li> ))}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><MultiSelectDropdown label="Empresas" options={empresas} selectedIds={filters.empresaIds} onChange={(selected) => handleFilterChange('empresaIds', selected)} /><MultiSelectDropdown label="Empreendimentos" options={empreendimentos} selectedIds={filters.empreendimentoIds} onChange={(selected) => handleFilterChange('empreendimentoIds', selected)} /><MultiSelectDropdown label="Contas" options={contas} selectedIds={filters.contaIds} onChange={(selected) => handleFilterChange('contaIds', selected)} /><MultiSelectDropdown label="Categorias" options={categoryTree} selectedIds={filters.categoriaIds} onChange={(selected) => handleFilterChange('categoriaIds', selected)} /></div> <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end"> <div><MultiSelectDropdown label="Etapa da Obra" options={etapas.map(e => ({...e, nome: e.nome_etapa}))} selectedIds={filters.etapaIds} onChange={(selected) => handleFilterChange('etapaIds', selected)} /></div> <div><MultiSelectDropdown label="Status" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos os Status" /></div> <div className="lg:col-span-2 flex items-end gap-2"> <div className="flex-1"><label className="text-xs uppercase font-medium text-gray-600">Mês</label><select name="month" value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"><option value="">Todos</option>{months.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></div> <div className="w-28"><label className="text-xs uppercase font-medium text-gray-600">Ano</label><select name="year" value={filters.year} onChange={(e) => handleFilterChange('year', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"><option value="">Todos</option>{years.map(y => <option key={y.id} value={y.id}>{y.nome}</option>)}</select></div> <div><label className="text-xs uppercase">De:</label><input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div> <div><label className="text-xs uppercase">Até:</label><input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full mt-1 p-2 border rounded-md shadow-sm"/></div> </div> </div> <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t"> <div className="flex items-center gap-2"><button onClick={() => setDateRange('today')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button><button onClick={() => setDateRange('week')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button><button onClick={() => setDateRange('month')} className={`text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button></div> <button onClick={clearFilters} className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md flex items-center gap-2 uppercase"><FontAwesomeIcon icon={faTimes} />Limpar Filtros</button> </div> </div> )}
            
             {savedFilters.filter(f => f.isFavorite).length > 0 && ( <div className="p-4 border rounded-lg bg-white space-y-2"> <h4 className="font-semibold flex items-center gap-2 text-sm uppercase text-gray-600"><FontAwesomeIcon icon={faStarSolid} /> Filtros Favoritos</h4> <div className="flex flex-wrap gap-2"> {savedFilters.filter(f => f.isFavorite).map((f, i) => { const isActive = JSON.stringify(filters) === JSON.stringify(f.settings); return ( <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${isActive ? 'bg-blue-600 text-white border-blue-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}> {f.name} </button> ) })} </div> </div> )}
        </div>
    );
}
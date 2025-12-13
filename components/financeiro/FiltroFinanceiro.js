// components/financeiro/FiltroFinanceiro.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes, faSave, faStar as faStarSolid, faEllipsisV,
    faCalendarDay, faCalendarWeek, faCalendarAlt, faSyncAlt,
    faArrowUp, faArrowDown, faTrash, faSpinner
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import MultiSelectDropdown from './MultiSelectDropdown';

const FINANCEIRO_FILTERS_CACHE_KEY = 'financeiroCurrentFilters';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const initialFilterState = {
    // searchTerm é gerenciado pelo pai agora
    empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
    etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', favorecidoId: null,
};

const fetchEtapas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', organizacaoId).order('nome_etapa');
    if (error) throw new Error("Falha ao buscar etapas.");
    return data || [];
};

export default function FiltroFinanceiro({
    filters, setFilters, empresas, contas, categorias, empreendimentos, allContacts
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [debouncedFilters] = useDebounce(filters, 1000);
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
        try { localStorage.setItem(FINANCEIRO_FILTERS_CACHE_KEY, JSON.stringify(debouncedFilters)); } catch (error) { console.error("Falha ao salvar filtros", error); }
    }, [debouncedFilters]);
    
    useEffect(() => {
        if (favorecidoSearchTerm.length < 2) { setFavorecidoSearchResults([]); return; }
        const timer = setTimeout(async () => {
            if (!organizacaoId) return;
            setIsSearching(true);
            try {
                const { data, error } = await supabase.rpc('buscar_contatos_geral', { p_search_term: favorecidoSearchTerm, p_organizacao_id: organizacaoId });
                if (error) throw error;
                setFavorecidoSearchResults(data || []);
            } catch (error) { console.error("Erro busca favorecido:", error); toast.error("Erro ao buscar contatos."); setFavorecidoSearchResults([]); } finally { setIsSearching(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [favorecidoSearchTerm, supabase, organizacaoId]);

    const handleSelectFavorecido = (contato) => { handleFilterChange('favorecidoId', contato.id); setFavorecidoSearchTerm(contato.nome || contato.razao_social); setFavorecidoSearchResults([]); };
    const handleClearFavorecido = () => { handleFilterChange('favorecidoId', null); setFavorecidoSearchTerm(''); setFavorecidoSearchResults([]); };

    const selectedFavorecidoName = useMemo(() => {
        if (!filters.favorecidoId) return '';
        const foundInSearch = favorecidoSearchResults.find(c => c.id === filters.favorecidoId);
        if (foundInSearch) return foundInSearch.nome || foundInSearch.razao_social;
        const contato = allContacts.find(c => c.id === filters.favorecidoId);
        return contato ? (contato.nome || contato.razao_social) : favorecidoSearchTerm;
    }, [filters.favorecidoId, allContacts, favorecidoSearchResults, favorecidoSearchTerm]);
    
    useEffect(() => { setSavedFilters(JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]')); }, []);
    useEffect(() => {
        function handleClickOutside(event) { if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) setIsFilterMenuOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef]);

    const categoryTree = useMemo(() => {
        const tree = []; const map = {}; const allCategories = JSON.parse(JSON.stringify(categorias || [])); 
        allCategories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; }); 
        allCategories.forEach(cat => { if (cat.parent_id && map[cat.parent_id]) { map[cat.parent_id].children.push(map[cat.id]); } else { tree.push(map[cat.id]); } }); 
        return tree;
    }, [categorias]);
    
    const handleFilterChange = (name, value) => { setFilters(prev => ({...prev, [name]: value})); if(name !== 'startDate' && name !== 'endDate') setActivePeriodFilter(''); };
    const handleNatureFilterClick = (nature) => { setFilters(prev => { const currentTipo = prev.tipo || []; const newTipo = currentTipo.includes(nature) ? currentTipo.filter(t => t !== nature) : [...currentTipo, nature]; return { ...prev, tipo: newTipo }; }); };
    const setDateRange = (period) => { const today = new Date(); let startDate, endDate; if (period === 'today') { startDate = endDate = today; } else if (period === 'week') { const firstDayOfWeek = today.getDate() - today.getDay(); startDate = new Date(today.setDate(firstDayOfWeek)); endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6); } else if (period === 'month') { startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); } setFilters(prev => ({ ...prev, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], month: '', year: '' })); setActivePeriodFilter(period); };
    
    const clearFilters = () => { 
        // Mantém o termo de busca (que está no header), limpa o resto
        setFilters(prev => ({ ...initialFilterState, searchTerm: prev.searchTerm })); 
        setFavorecidoSearchTerm(''); 
        setActivePeriodFilter(''); 
    };

    const handleSaveFilter = () => { if (!newFilterName.trim()) { toast.warning('Nomeie o filtro.'); return; } const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false; const updated = savedFilters.filter(f => f.name !== newFilterName); const newFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited }; setSavedFilters([...updated, newFilter]); localStorage.setItem('savedFinancialFilters', JSON.stringify([...updated, newFilter])); setNewFilterName(''); toast.success(`Filtro "${newFilterName}" salvo!`); };
    const handleUpdateFilter = (name) => { const updated = savedFilters.map(f => f.name === name ? { ...f, settings: filters } : f); setSavedFilters(updated); localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); toast.success(`Filtro "${name}" atualizado!`); };
    const handleToggleFavorite = (name) => { const updated = savedFilters.map(f => f.name === name ? { ...f, isFavorite: !f.isFavorite } : f); setSavedFilters(updated); localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); };
    const handleLoadFilter = (settings) => { setFilters({ ...initialFilterState, ...settings }); setIsFilterMenuOpen(false); setActivePeriodFilter(''); };
    const handleDeleteFilter = (name) => { const updated = savedFilters.filter(f => f.name !== name); setSavedFilters(updated); localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); toast.success("Filtro excluído."); };
    
    const statusOptions = [{ id: 'Pago', text: 'Paga' }, { id: 'Pendente', text: 'A Pagar' }, { id: 'Atrasada', text: 'Atrasada' }].map(s => ({...s, nome: s.text}));
    const months = [ {id: "01", nome: "Janeiro"}, {id: "02", nome: "Fevereiro"}, {id: "03", nome: "Março"}, {id: "04", nome: "Abril"}, {id: "05", nome: "Maio"}, {id: "06", nome: "Junho"}, {id: "07", nome: "Julho"}, {id: "08", nome: "Agosto"}, {id: "09", nome: "Setembro"}, {id: "10", nome: "Outubro"}, {id: "11", nome: "Novembro"}, {id: "12", nome: "Dezembro"} ];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => ({ id: (currentYear - 5 + i).toString(), nome: (currentYear - 5 + i).toString() }));

    return (
        <div className="bg-gray-50 border-b border-gray-200 p-4 animate-slide-down shadow-inner">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Natureza:</span>
                    <button onClick={() => handleNatureFilterClick('Receita')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${filters.tipo?.includes('Receita') ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowUp}/> Receitas </button>
                    <button onClick={() => handleNatureFilterClick('Despesa')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${filters.tipo?.includes('Despesa') ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowDown}/> Despesas </button>
                </div>

                <div className="relative" ref={filterMenuRef}>
                    <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="text-gray-500 hover:text-blue-600 transition-colors" title="Gerenciar Filtros Salvos"> <FontAwesomeIcon icon={faEllipsisV} /> </button>
                    {isFilterMenuOpen && ( 
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border ring-1 ring-black ring-opacity-5"> 
                            <div className="p-3 border-b bg-gray-50 rounded-t-md"> 
                                <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Salvar Atual</p> 
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
                                                <button onClick={() => handleUpdateFilter(f.name)} title="Atualizar" className="text-gray-400 hover:text-blue-500 p-1"><FontAwesomeIcon icon={faSyncAlt} size="xs"/></button> 
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative" ref={favorecidoInputRef}>
                    <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Favorecido</label>
                    {filters.favorecidoId ? (
                        <div className="flex items-center justify-between p-2 border border-blue-200 bg-blue-50 rounded-md h-[38px]">
                            <span className="text-sm font-medium text-blue-800 truncate">{selectedFavorecidoName}</span>
                            <button type="button" onClick={handleClearFavorecido} className="text-blue-400 hover:text-red-600"><FontAwesomeIcon icon={faTimes}/></button>
                        </div>
                    ) : (
                        <>
                            <input type="text" placeholder="Buscar favorecido..." value={favorecidoSearchTerm} onChange={(e) => setFavorecidoSearchTerm(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 h-[38px]" />
                            {(isSearching || favorecidoSearchResults.length > 0) && (
                                <ul className="absolute z-20 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {isSearching && <li className="p-2 text-center text-gray-500 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</li>}
                                    {!isSearching && favorecidoSearchResults.map(c => ( <li key={c.id} onClick={() => handleSelectFavorecido(c)} className="p-2 hover:bg-gray-100 cursor-pointer text-xs text-gray-700 border-b last:border-0"> <HighlightedText text={c.nome || c.razao_social} highlight={favorecidoSearchTerm} /> </li> ))}
                                </ul>
                            )}
                        </>
                    )}
                </div>
                <MultiSelectDropdown label="Empresas" options={empresas} selectedIds={filters.empresaIds} onChange={(selected) => handleFilterChange('empresaIds', selected)} />
                <MultiSelectDropdown label="Contas" options={contas} selectedIds={filters.contaIds} onChange={(selected) => handleFilterChange('contaIds', selected)} />
                <MultiSelectDropdown label="Categorias" options={categoryTree} selectedIds={filters.categoriaIds} onChange={(selected) => handleFilterChange('categoriaIds', selected)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <MultiSelectDropdown label="Empreendimentos" options={empreendimentos} selectedIds={filters.empreendimentoIds} onChange={(selected) => handleFilterChange('empreendimentoIds', selected)} />
                <MultiSelectDropdown label="Etapa da Obra" options={etapas.map(e => ({...e, nome: e.nome_etapa}))} selectedIds={filters.etapaIds} onChange={(selected) => handleFilterChange('etapaIds', selected)} />
                <MultiSelectDropdown label="Status" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos" />
                
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
            
            {/* Filtros Favoritos (Atalhos Rápidos) */}
            {savedFilters.filter(f => f.isFavorite).length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase mr-2"><FontAwesomeIcon icon={faStarSolid} /> Favoritos:</span>
                    {savedFilters.filter(f => f.isFavorite).map((f, i) => {
                        const isActive = JSON.stringify(filters) === JSON.stringify(f.settings);
                        return (
                            <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                {f.name}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
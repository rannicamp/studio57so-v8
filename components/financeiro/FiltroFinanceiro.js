"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes, faSave, faStar as faStarSolid, faEllipsisV,
    faCalendarDay, faCalendarWeek, faCalendarAlt, 
    faArrowUp, faArrowDown, faTrash, faSpinner, faBan, faExchangeAlt,
    faFilter, faChevronDown, faChevronUp, faUndo, faExclamationCircle, faSearch
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import MultiSelectDropdown from './MultiSelectDropdown';

const FINANCEIRO_FILTERS_CACHE_KEY = 'financeiroCurrentFilters';
const NULL_ID = 'IS_NULL'; 

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const initialFilterState = {
    empresaIds: [], contaIds: [], categoriaIds: [], empreendimentoIds: [],
    etapaIds: [], status: [], tipo: [], startDate: '', endDate: '', month: '', year: '', 
    favorecidoId: null, 
    ignoreTransfers: false, 
    ignoreChargebacks: false,
    searchTerm: '', 
    useCompetencia: false 
};

const fetchEtapas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase.from('etapa_obra').select('id, nome_etapa').eq('organizacao_id', organizacaoId).order('nome_etapa');
    if (error) throw new Error("Falha ao buscar etapas.");
    return data || [];
};

const fetchListasBasicas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { empresas: [], contas: [], categorias: [], empreendimentos: [] };
    const [empresasRes, contasRes, categoriasRes, empreendimentosRes] = await Promise.all([
        supabase.from('cadastro_empresa').select('id, nome_fantasia, razao_social').eq('organizacao_id', organizacaoId),
        supabase.from('contas_financeiras').select('id, nome').eq('organizacao_id', organizacaoId),
        supabase.from('categorias_financeiras').select('id, nome, parent_id').eq('organizacao_id', organizacaoId),
        supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacaoId)
    ]);
    return {
        empresas: empresasRes.data?.map(e => ({...e, nome: e.nome_fantasia || e.razao_social})) || [],
        contas: contasRes.data || [],
        categorias: categoriasRes.data || [],
        empreendimentos: empreendimentosRes.data || []
    };
};

export default function FiltroFinanceiro({
    filters: propFilters, 
    setFilters: propSetFilters,
    empresas: propEmpresas,
    contas: propContas,
    categorias: propCategorias,
    empreendimentos: propEmpreendimentos,
    allContacts: propAllContacts,
    onFilterChange, 
    filtrosAtuais = {}, 
    compacto = false
}) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [localFilters, setLocalFilters] = useState({ ...initialFilterState, ...filtrosAtuais });
    const filters = propFilters || localFilters;

    const [isExpanded, setIsExpanded] = useState(!compacto);
    const [debouncedFilters] = useDebounce(filters, 800);
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    
    const [favorecidoSearchTerm, setFavorecidoSearchTerm] = useState('');
    const [favorecidoSearchResults, setFavorecidoSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const favorecidoInputRef = useRef(null);

    // Etapas devem ser buscadas independente de termos contas/categorias
    const shouldUseInternalData = !propContas || !propCategorias;

    const { data: listasInternas } = useQuery({
        queryKey: ['filtros_financeiros_listas', organizacaoId],
        queryFn: () => fetchListasBasicas(supabase, organizacaoId),
        enabled: !!organizacaoId && shouldUseInternalData,
        staleTime: 1000 * 60 * 10
    });

    const { data: etapasInternas } = useQuery({
        queryKey: ['etapas', organizacaoId],
        queryFn: () => fetchEtapas(supabase, organizacaoId),
        enabled: !!organizacaoId, 
    });

    const empresas = propEmpresas || listasInternas?.empresas || [];
    const contas = propContas || listasInternas?.contas || [];
    const categorias = propCategorias || listasInternas?.categorias || [];
    const empreendimentos = propEmpreendimentos || listasInternas?.empreendimentos || [];
    const etapas = etapasInternas?.length ? etapasInternas : []; 

    const withNullOption = (list, label = 'Sem Registro') => {
        return [{ id: NULL_ID, nome: `⚠ ${label}` }, ...list];
    };

    const updateFilters = (newFilters) => {
        if (propSetFilters) {
            propSetFilters(newFilters);
        } else {
            setLocalFilters(newFilters);
        }
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    useEffect(() => {
        if (filtrosAtuais && Object.keys(filtrosAtuais).length > 0 && !propFilters) {
             setLocalFilters(prev => ({ ...prev, ...filtrosAtuais }));
        }
    }, [filtrosAtuais, propFilters]);

    useEffect(() => {
        if (!compacto) {
            try { localStorage.setItem(FINANCEIRO_FILTERS_CACHE_KEY, JSON.stringify(debouncedFilters)); } catch (error) { console.error(error); }
        }
    }, [debouncedFilters, compacto]);

    useEffect(() => {
        if (favorecidoSearchTerm.length < 2) { setFavorecidoSearchResults([]); return; }
        const timer = setTimeout(async () => {
            if (!organizacaoId) return;
            setIsSearching(true);
            try {
                const { data, error } = await supabase.from('contatos')
                    .select('id, nome, razao_social')
                    .or(`nome.ilike.%${favorecidoSearchTerm}%,razao_social.ilike.%${favorecidoSearchTerm}%`)
                    .limit(5);
                if (error) throw error;
                setFavorecidoSearchResults(data || []);
            } catch (error) { 
                console.error("Erro busca favorecido:", error); 
                setFavorecidoSearchResults([]); 
            } finally { setIsSearching(false); }
        }, 300);
        return () => clearTimeout(timer);
    }, [favorecidoSearchTerm, supabase, organizacaoId]);

    const selectedFavorecidoName = useMemo(() => {
        if (!filters.favorecidoId) return '';
        if (filters.favorecidoId === NULL_ID) return '⚠ Sem Favorecido';
        const foundInSearch = favorecidoSearchResults.find(c => c.id === filters.favorecidoId);
        if (foundInSearch) return foundInSearch.nome || foundInSearch.razao_social;
        const contato = propAllContacts?.find(c => c.id === filters.favorecidoId);
        return contato ? (contato.nome || contato.razao_social) : favorecidoSearchTerm;
    }, [filters.favorecidoId, propAllContacts, favorecidoSearchResults, favorecidoSearchTerm]);

    useEffect(() => { 
        if (typeof window !== 'undefined') {
            setSavedFilters(JSON.parse(localStorage.getItem('savedFinancialFilters') || '[]')); 
        }
    }, []);

    useEffect(() => {
        function handleClickOutside(event) { if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) setIsFilterMenuOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [filterMenuRef]);

    const handleFilterChange = (name, value) => { 
        const updated = { ...filters, [name]: value };
        updateFilters(updated);
        if(name !== 'startDate' && name !== 'endDate') setActivePeriodFilter(''); 
    };

    const handleSelectFavorecido = (contato) => { 
        handleFilterChange('favorecidoId', contato.id); 
        setFavorecidoSearchTerm(contato.nome || contato.razao_social); 
        setFavorecidoSearchResults([]); 
    };

    const handleSelectNullFavorecido = () => {
        handleFilterChange('favorecidoId', NULL_ID);
        setFavorecidoSearchTerm('');
        setFavorecidoSearchResults([]);
    };
    
    const handleClearFavorecido = () => { 
        handleFilterChange('favorecidoId', null); 
        setFavorecidoSearchTerm(''); 
        setFavorecidoSearchResults([]); 
    };

    const toggleIgnoreTransfers = () => {
        const updated = { ...filters, ignoreTransfers: !filters.ignoreTransfers };
        updateFilters(updated);
    };

    const toggleIgnoreChargebacks = () => {
        const updated = { ...filters, ignoreChargebacks: !filters.ignoreChargebacks };
        updateFilters(updated);
    };

    const handleNatureFilterClick = (nature) => { 
        const currentTipo = Array.isArray(filters.tipo) ? filters.tipo : []; 
        let newTipo;
        
        if (currentTipo.includes(nature)) {
            // Se já está selecionado, remove (desmarca)
            newTipo = currentTipo.filter(t => t !== nature);
        } else {
            // Se não está selecionado, adiciona
            newTipo = [...currentTipo, nature];
        }
        
        updateFilters({ ...filters, tipo: newTipo });
    };

    const setDateRange = (period) => { 
        const today = new Date(); 
        let startDate, endDate; 
        if (period === 'today') { startDate = endDate = today; } 
        else if (period === 'week') { const firstDayOfWeek = today.getDate() - today.getDay(); startDate = new Date(today.setDate(firstDayOfWeek)); endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6); } 
        else if (period === 'month') { startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); } 
        
        updateFilters({ ...filters, startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0], month: '', year: '' });
        setActivePeriodFilter(period); 
    };
    
    const clearFilters = () => { 
        updateFilters({ ...initialFilterState, searchTerm: '' }); 
        setFavorecidoSearchTerm(''); 
        setActivePeriodFilter(''); 
    };

    const handleSaveFilter = () => { 
        if (!newFilterName.trim()) { toast.warning('Nomeie o filtro.'); return; } 
        const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false; 
        const updated = savedFilters.filter(f => f.name !== newFilterName); 
        const newFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited }; 
        setSavedFilters([...updated, newFilter]); 
        localStorage.setItem('savedFinancialFilters', JSON.stringify([...updated, newFilter])); 
        setNewFilterName(''); 
        toast.success(`Filtro "${newFilterName}" salvo!`); 
    };

    const handleLoadFilter = (settings) => { 
        updateFilters({ ...initialFilterState, ...settings });
        setIsFilterMenuOpen(false); 
        setActivePeriodFilter(''); 
    };

    const handleDeleteFilter = (name) => { 
        const updated = savedFilters.filter(f => f.name !== name); 
        setSavedFilters(updated); 
        localStorage.setItem('savedFinancialFilters', JSON.stringify(updated)); 
        toast.success("Filtro excluído."); 
    };

    const categoryTree = useMemo(() => {
        const tree = []; const map = {}; const allCategories = JSON.parse(JSON.stringify(categorias || [])); 
        allCategories.forEach(cat => { map[cat.id] = { ...cat, children: [] }; }); 
        allCategories.forEach(cat => { if (cat.parent_id && map[cat.parent_id]) { map[cat.parent_id].children.push(map[cat.id]); } else { tree.push(map[cat.id]); } }); 
        return [{ id: NULL_ID, nome: '⚠ Sem Categoria' }, ...tree];
    }, [categorias]);

    const statusOptions = [{ id: 'Pago', nome: 'Paga' }, { id: 'Pendente', nome: 'A Pagar' }, { id: 'Atrasada', nome: 'Atrasada' }];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 transition-all duration-300">
            
            {!compacto && (
                <div 
                    className="flex justify-between items-center p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFilter} className="text-blue-500" />
                        Filtros Avançados
                    </h3>
                    <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-gray-400" />
                </div>
            )}

            {(isExpanded || compacto) && (
                <div className="p-4 bg-gray-50 animate-fade-in rounded-b-xl">
                    
                    {/* Campo de Busca por Texto Integrado */}
                    <div className="mb-4">
                        <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Busca por Texto</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={filters.searchTerm || ''}
                                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                placeholder="Buscar por descrição, observação, n° documento..."
                                className="w-full p-2 pl-9 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 h-[38px]"
                            />
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-gray-400 text-sm" />
                            {filters.searchTerm && (
                                <button 
                                    onClick={() => handleFilterChange('searchTerm', '')}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Natureza:</span>
                                <button onClick={() => handleNatureFilterClick('Receita')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${filters.tipo?.includes('Receita') ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowUp}/> Receitas </button>
                                <button onClick={() => handleNatureFilterClick('Despesa')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${filters.tipo?.includes('Despesa') ? 'bg-red-600 text-white border-red-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}> <FontAwesomeIcon icon={faArrowDown}/> Despesas </button>
                            </div>
                            <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
                            <button onClick={toggleIgnoreTransfers} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors shadow-sm ${filters.ignoreTransfers ? 'bg-purple-600 text-white border-purple-700 ring-2 ring-purple-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`} title="Ocultar transferências entre contas"> <FontAwesomeIcon icon={filters.ignoreTransfers ? faBan : faExchangeAlt} className={filters.ignoreTransfers ? "text-white" : "text-gray-400"} /> {filters.ignoreTransfers ? "Transf. Ocultas" : "Ocultar Transf."} </button>
                            <button onClick={toggleIgnoreChargebacks} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors shadow-sm ${filters.ignoreChargebacks ? 'bg-orange-600 text-white border-orange-700 ring-2 ring-orange-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`} title="Ocultar Estornos e Devoluções"> <FontAwesomeIcon icon={filters.ignoreChargebacks ? faBan : faUndo} className={filters.ignoreChargebacks ? "text-white" : "text-gray-400"} /> {filters.ignoreChargebacks ? "Estornos Ocultos" : "Ocultar Estornos"} </button>
                        </div>
                        <div className="relative" ref={filterMenuRef}>
                            <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="text-gray-500 hover:text-blue-600 transition-colors p-2" title="Gerenciar Filtros Salvos"> <FontAwesomeIcon icon={faEllipsisV} /> </button>
                            {isFilterMenuOpen && ( <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border ring-1 ring-black ring-opacity-5"> <div className="p-3 border-b bg-gray-50 rounded-t-md"> <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Salvar Atual</p> <div className="flex items-center gap-2"> <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome do filtro..." className="p-1.5 border rounded text-xs w-full"/> <button onClick={handleSaveFilter} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded"><FontAwesomeIcon icon={faSave}/></button> </div> </div> <div className="p-3"> <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Meus Filtros</p> <ul className="max-h-40 overflow-y-auto space-y-1"> {savedFilters.length > 0 ? savedFilters.map((f, i) => ( <li key={i} className="flex justify-between items-center text-sm p-1 hover:bg-gray-50 rounded group"> <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer text-gray-700 hover:text-blue-600 truncate flex-1">{f.name}</span> <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"> <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="text-gray-400 hover:text-red-500 p-1"><FontAwesomeIcon icon={faTrash} size="xs"/></button> </div> </li> )) : <li className="text-xs text-gray-400 italic">Nenhum salvo.</li>} </ul> </div> </div> )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="relative" ref={favorecidoInputRef}>
                            <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Favorecido</label>
                            {filters.favorecidoId ? (
                                <div className={`flex items-center justify-between p-2 border rounded-md h-[38px] ${filters.favorecidoId === NULL_ID ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-200 text-blue-800'}`}> <span className="text-sm font-medium truncate">{selectedFavorecidoName}</span> <button type="button" onClick={handleClearFavorecido} className="text-opacity-60 hover:text-opacity-100"><FontAwesomeIcon icon={faTimes}/></button> </div>
                            ) : (
                                <> <input type="text" placeholder="Buscar favorecido..." value={favorecidoSearchTerm} onChange={(e) => setFavorecidoSearchTerm(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 h-[38px]" /> <button onClick={handleSelectNullFavorecido} className="absolute right-2 top-8 text-gray-400 hover:text-orange-500" title="Buscar registros sem favorecido"> <FontAwesomeIcon icon={faExclamationCircle} className="text-xs" /> </button> {(isSearching || favorecidoSearchResults.length > 0) && ( <ul className="absolute z-20 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1"> <li onClick={handleSelectNullFavorecido} className="p-2 hover:bg-orange-50 cursor-pointer text-xs text-orange-700 border-b font-semibold"> <FontAwesomeIcon icon={faExclamationCircle} className="mr-2" /> ⚠ Sem Favorecido </li> {isSearching && <li className="p-2 text-center text-gray-500 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</li>} {!isSearching && favorecidoSearchResults.map(c => ( <li key={c.id} onClick={() => handleSelectFavorecido(c)} className="p-2 hover:bg-gray-100 cursor-pointer text-xs text-gray-700 border-b last:border-0"> <HighlightedText text={c.nome || c.razao_social} highlight={favorecidoSearchTerm} /> </li> ))} </ul> )} </>
                            )}
                        </div>
                        <MultiSelectDropdown label="Empresas" options={withNullOption(empresas, 'Sem Empresa')} selectedIds={filters.empresaIds} onChange={(selected) => handleFilterChange('empresaIds', selected)} />
                        <MultiSelectDropdown label="Contas" options={withNullOption(contas, 'Sem Conta')} selectedIds={filters.contaIds} onChange={(selected) => handleFilterChange('contaIds', selected)} />
                        <MultiSelectDropdown label="Categorias" options={categoryTree} selectedIds={filters.categoriaIds} onChange={(selected) => handleFilterChange('categoriaIds', selected)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                        <MultiSelectDropdown label="Empreendimentos" options={withNullOption(empreendimentos, 'Sem Empreendimento')} selectedIds={filters.empreendimentoIds} onChange={(selected) => handleFilterChange('empreendimentoIds', selected)} />
                        <MultiSelectDropdown label="Etapa da Obra" options={withNullOption(etapas.map(e => ({...e, nome: e.nome_etapa})), 'Sem Etapa')} selectedIds={filters.etapaIds} onChange={(selected) => handleFilterChange('etapaIds', selected)} />
                        <MultiSelectDropdown label="Status" options={statusOptions} selectedIds={filters.status} onChange={(selected) => handleFilterChange('status', selected)} placeholder="Todos" />
                        <div className="grid grid-cols-2 gap-2"> <div> <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">De</label> <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/> </div> <div> <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Até</label> <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/> </div> </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2"> <button onClick={() => setDateRange('today')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button> <button onClick={() => setDateRange('week')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button> <button onClick={() => setDateRange('month')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button> </div> <button onClick={clearFilters} className="text-xs bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 px-4 py-2 rounded-md flex items-center gap-2 font-semibold transition-all shadow-sm"> <FontAwesomeIcon icon={faTimes} /> Limpar Filtros </button>
                    </div>
                    {savedFilters.filter(f => f.isFavorite).length > 0 && ( <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-2 items-center"> <span className="text-xs font-bold text-gray-400 uppercase mr-2"><FontAwesomeIcon icon={faStarSolid} /> Favoritos:</span> {savedFilters.filter(f => f.isFavorite).map((f, i) => ( <button key={i} onClick={() => handleLoadFilter(f.settings)} className="px-3 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"> {f.name} </button> ))} </div> )}
                </div>
            )}
        </div>
    );
}
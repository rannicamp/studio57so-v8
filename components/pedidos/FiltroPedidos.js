// components/pedidos/FiltroPedidos.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faSave, faStar as faStarSolid, faEllipsisV, 
    faTrash, faSyncAlt, faCalendarDay, faCalendarWeek, faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';
import { toast } from 'sonner';

export const initialFilterState = {
    // searchTerm é gerenciado pelo componente pai (Page)
    empreendimentoIds: [], solicitanteIds: [], fornecedorIds: [],
    etapaIds: [], subetapaIds: [], status: [], tipoOperacao: [],
    dataSolicitacaoStart: '', dataSolicitacaoEnd: '',
    dataEntregaStart: '', dataEntregaEnd: '',
};

export default function FiltroPedidos({
    filters,
    setFilters,
    solicitantes,
    empreendimentos,
    fornecedores,
    etapas,
    subetapas
}) {
    const [savedFilters, setSavedFilters] = useState([]);
    const [newFilterName, setNewFilterName] = useState('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');

    useEffect(() => {
        const loadedFilters = JSON.parse(localStorage.getItem('savedPurchaseFilters') || '[]');
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
        if (name.includes('data')) {
            setActivePeriodFilter('');
        }
    };

    const setDateRange = (period) => {
        const today = new Date();
        let start, end;
        if (period === 'today') { start = end = today; }
        else if (period === 'week') {
            const first = today.getDate() - today.getDay();
            start = new Date(today.setDate(first));
            end = new Date(today.setDate(first + 6));
        } else if (period === 'month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        }
        setFilters(prev => ({
            ...prev,
            dataSolicitacaoStart: start.toISOString().split('T')[0],
            dataSolicitacaoEnd: end.toISOString().split('T')[0]
        }));
        setActivePeriodFilter(period);
    };

    const clearFilters = () => {
        // Preserva o termo de busca que está no header
        setFilters(prev => ({ ...initialFilterState, searchTerm: prev.searchTerm }));
        setActivePeriodFilter('');
    };

    const handleSaveFilter = () => {
        if (!newFilterName.trim()) { toast.warning('Nomeie o filtro.'); return; }
        const isFavorited = savedFilters.find(f => f.name === newFilterName)?.isFavorite || false;
        const updated = savedFilters.filter(f => f.name !== newFilterName);
        const newFilter = { name: newFilterName, settings: filters, isFavorite: isFavorited };
        const newList = [...updated, newFilter];
        setSavedFilters(newList);
        localStorage.setItem('savedPurchaseFilters', JSON.stringify(newList));
        setNewFilterName('');
        toast.success(`Filtro "${newFilterName}" salvo!`);
    };

    const handleLoadFilter = (settings) => {
        setFilters({ ...initialFilterState, ...settings });
        setIsFilterMenuOpen(false);
    };

    const handleDeleteFilter = (name) => {
        const updated = savedFilters.filter(f => f.name !== name);
        setSavedFilters(updated);
        localStorage.setItem('savedPurchaseFilters', JSON.stringify(updated));
        toast.success('Filtro excluído.');
    };

    const handleToggleFavorite = (name) => {
        const updated = savedFilters.map(f => f.name === name ? { ...f, isFavorite: !f.isFavorite } : f);
        setSavedFilters(updated);
        localStorage.setItem('savedPurchaseFilters', JSON.stringify(updated));
    };

    const statusOptions = [
        { id: 'Solicitação', nome: 'Solicitação' },
        { id: 'Em Cotação', nome: 'Em Cotação' },
        { id: 'Aprovação', nome: 'Aprovação' },
        { id: 'Aprovado', nome: 'Aprovado' },
        { id: 'Em Trânsito', nome: 'Em Trânsito' },
        { id: 'Entregue', nome: 'Entregue' },
        { id: 'Cancelado', nome: 'Cancelado' },
    ];

    const tipoOperacaoOptions = [
        { id: 'Compra', nome: 'Compra' },
        { id: 'Serviço', nome: 'Serviço' },
        { id: 'Locação', nome: 'Locação' }
    ];

    return (
        <div className="bg-gray-50 border-b border-gray-200 p-4 animate-slide-down shadow-inner rounded-lg mb-4">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Solicitado em:</span>
                    <button onClick={() => setDateRange('today')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarDay}/> Hoje</button>
                    <button onClick={() => setDateRange('week')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarWeek}/> Semana</button>
                    <button onClick={() => setDateRange('month')} className={`text-xs font-medium border px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}><FontAwesomeIcon icon={faCalendarAlt}/> Mês</button>
                </div>
                
                <div className="relative" ref={filterMenuRef}>
                    <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-md hover:bg-white border border-transparent hover:border-gray-200" title="Gerenciar Filtros Salvos">
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                    {isFilterMenuOpen && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg z-20 border ring-1 ring-black ring-opacity-5">
                            <div className="p-3 border-b bg-gray-50 rounded-t-md">
                                <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Salvar Filtro Atual</p>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Nome..." className="p-1.5 border rounded text-xs w-full"/>
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
                <MultiSelectDropdown label="Empreendimento" options={empreendimentos} selectedIds={filters.empreendimentoIds} onChange={(s) => handleFilterChange('empreendimentoIds', s)} />
                <MultiSelectDropdown label="Solicitante" options={solicitantes?.map(s => ({...s, nome: `${s.nome} ${s.sobrenome || ''}`}))} selectedIds={filters.solicitanteIds} onChange={(s) => handleFilterChange('solicitanteIds', s)} />
                <MultiSelectDropdown label="Fornecedor" options={fornecedores?.map(f => ({...f, nome: f.nome || f.razao_social}))} selectedIds={filters.fornecedorIds} onChange={(s) => handleFilterChange('fornecedorIds', s)} />
                <MultiSelectDropdown label="Status" options={statusOptions} selectedIds={filters.status} onChange={(s) => handleFilterChange('status', s)} placeholder="Todos" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 items-end">
                <MultiSelectDropdown label="Etapa" options={etapas?.map(e => ({...e, nome: e.nome_etapa}))} selectedIds={filters.etapaIds} onChange={(s) => handleFilterChange('etapaIds', s)} />
                <MultiSelectDropdown label="Tipo Operação" options={tipoOperacaoOptions} selectedIds={filters.tipoOperacao} onChange={(s) => handleFilterChange('tipoOperacao', s)} />
                
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Solic. De</label>
                        <input type="date" value={filters.dataSolicitacaoStart} onChange={(e) => handleFilterChange('dataSolicitacaoStart', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/>
                    </div>
                    <div>
                        <label className="text-xs uppercase font-medium text-gray-500 mb-1 block">Até</label>
                        <input type="date" value={filters.dataSolicitacaoEnd} onChange={(e) => handleFilterChange('dataSolicitacaoEnd', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm h-[38px]"/>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={clearFilters} className="w-full lg:w-auto text-xs bg-white border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 hover:bg-red-50 px-4 py-2.5 rounded-md flex items-center justify-center gap-2 font-semibold transition-all shadow-sm h-[38px]">
                        <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
                    </button>
                </div>
            </div>

            {savedFilters.filter(f => f.isFavorite).length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase mr-2"><FontAwesomeIcon icon={faStarSolid} /> Favoritos:</span>
                    {savedFilters.filter(f => f.isFavorite).map((f, i) => (
                        <button key={i} onClick={() => handleLoadFilter(f.settings)} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                            {f.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
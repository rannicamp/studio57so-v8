// components/contratos/FiltroContratos.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faTimes, faSave, faStar as faStarSolid, faEllipsisV, faTrash, faSyncAlt, faFilter
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import MultiSelectDropdown from '../financeiro/MultiSelectDropdown';
import { toast } from 'sonner';

const initialFilterState = {
 // searchTerm é gerenciado pelo componente pai (Page)
 clienteId: [], corretorId: [], produtoId: [], empreendimentoId: [],
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

 const clearFilters = () => {
 // Preserva o termo de busca que está no header
 setFilters(prev => ({ ...initialFilterState, searchTerm: prev.searchTerm }));
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

 const handleUpdateFilter = (filterName) => {
 const updated = savedFilters.map(f => f.name === filterName ? { ...f, settings: filters } : f);
 setSavedFilters(updated);
 localStorage.setItem('savedContractFilters', JSON.stringify(updated));
 toast.success(`Filtro "${filterName}" atualizado!`);
 };

 const statusOptions = [
 { id: 'Rascunho', nome: 'Rascunho' },
 { id: 'Em negociação', nome: 'Em negociação' },
 { id: 'Em assinatura', nome: 'Em assinatura' },
 { id: 'Assinado', nome: 'Assinado' },
 { id: 'Distratado', nome: 'Distratado' },
 { id: 'Finalizado', nome: 'Finalizado' },
 { id: 'Cancelado', nome: 'Cancelado' },
 ];

 const clientesOptions = clientes.map(c => ({ ...c, nome: c.nome || c.razao_social }));
 const corretoresOptions = corretores.map(c => ({ ...c, nome: c.nome || c.razao_social }));
 const produtosOptions = produtos.map(p => ({ ...p, nome: `${p.tipo || 'Unidade'} ${p.unidade || ''}`.trim() }));

 return (
 <div className="bg-white border border-gray-200 p-6 rounded-lg mb-6 flex flex-col gap-6 relative">

 {/* Header do Filtro */}
 <div className="flex justify-between items-center border-b border-gray-100 pb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
 <FontAwesomeIcon icon={faFilter} />
 </div>
 <div>
 <h3 className="text-base font-bold text-gray-800">Filtros Avançados</h3>
 <p className="text-xs font-medium text-gray-500">Refine a localização de documentos e contratos.</p>
 </div>
 </div>

 {/* Menu de Gerenciamento de Filtros */}
 <div className="relative" ref={filterMenuRef}>
 <button onClick={() => setIsFilterMenuOpen(prev => !prev)} className="text-gray-400 hover:text-blue-600 transition-colors p-2 rounded-md hover:bg-gray-50" title="Gerenciar Filtros Salvos">
 <FontAwesomeIcon icon={faEllipsisV} />
 </button>
 {isFilterMenuOpen && (
 <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-30 border border-gray-200 overflow-hidden">
 <div className="p-4 bg-gray-50 border-b border-gray-100">
 <p className="font-bold text-xs text-gray-500 uppercase mb-2">Salvar Filtro Atual</p>
 <div className="flex items-center gap-2">
 <input type="text" value={newFilterName} onChange={(e) => setNewFilterName(e.target.value)} placeholder="Ex: Vendas Terreno Sul" className="p-2 border border-gray-300 rounded-md text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
 <button onClick={handleSaveFilter} className="bg-blue-600 text-white hover:bg-blue-700 p-2 rounded-md transition-colors"><FontAwesomeIcon icon={faSave} /></button>
 </div>
 </div>
 <div className="p-4">
 <p className="font-bold text-xs text-gray-500 uppercase mb-3">Filtros Salvos</p>
 <ul className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
 {savedFilters.length > 0 ? savedFilters.map((f, i) => (
 <li key={i} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded-md group border border-transparent transition-all">
 <span onClick={() => handleLoadFilter(f.settings)} className="cursor-pointer font-bold text-gray-700 hover:text-blue-600 truncate flex-1">{f.name}</span>
 <div className="flex items-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => handleUpdateFilter(f.name)} title="Atualizar" className="w-7 h-7 rounded bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center"><FontAwesomeIcon icon={faSyncAlt} size="xs" /></button>
 <button onClick={() => handleToggleFavorite(f.name)} title="Atalho" className={`w-7 h-7 rounded bg-white border border-gray-200 transition-colors flex items-center justify-center ${f.isFavorite ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}><FontAwesomeIcon icon={f.isFavorite ? faStarSolid : faStarRegular} size="xs" /></button>
 <button onClick={() => handleDeleteFilter(f.name)} title="Excluir" className="w-7 h-7 rounded bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"><FontAwesomeIcon icon={faTrash} size="xs" /></button>
 </div>
 </li>
 )) : <li className="text-xs font-medium text-gray-400 py-4 text-center">Nenhum filtro salvo.</li>}
 </ul>
 </div>
 </div>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <MultiSelectDropdown
 label="Obra/Ativo"
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
 label="Corretor Associado"
 options={corretoresOptions}
 selectedIds={filters.corretorId}
 onChange={(selected) => handleFilterChange('corretorId', selected)}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-2 items-end">
 <div className="lg:col-span-2">
 <MultiSelectDropdown
 label="Status da Negociação"
 options={statusOptions}
 selectedIds={filters.status}
 onChange={(selected) => handleFilterChange('status', selected)}
 placeholder="Nenhum Status Aplicado"
 />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Início</label>
 <input type="date" name="startDate" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
 </div>
 <div>
 <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Fim</label>
 <input type="date" name="endDate" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
 </div>
 </div>
 </div>

 <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-gray-50">
 {/* Atalhos */}
 <div className="flex flex-wrap gap-2 items-center flex-1 w-full justify-start">
 {savedFilters.filter(f => f.isFavorite).length > 0 ? (
 <>
 <span className="text-[10px] font-bold text-gray-400 uppercase mr-1.5 flex items-center gap-1">Atalhos:</span>
 {savedFilters.filter(f => f.isFavorite).map((f, i) => {
 const isActive = JSON.stringify(filters) === JSON.stringify(f.settings);
 return (
 <button key={i} onClick={() => handleLoadFilter(f.settings)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}>
 {f.name}
 </button>
 )
 })}
 </>
 ) : (
 <span className="text-[10px] font-bold text-gray-400 uppercase">Dica: Fixe filtros como atalhos para agilizar o dia a dia.</span>
 )}
 </div>

 <button onClick={clearFilters} className="text-xs font-bold bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 px-4 py-2 rounded-md transition-all w-full md:w-auto flex justify-center items-center gap-2">
 <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
 </button>
 </div>
 </div>
 );
}
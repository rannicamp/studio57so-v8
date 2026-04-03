// components/empresas/EmpresaManager.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBuilding, faPlus } from '@fortawesome/free-solid-svg-icons';
import EmpresaFormModal from './EmpresaFormModal';
import EmpresaDetailWrapper from './EmpresaDetailWrapper';

export default function EmpresaManager({ initialEmpresas }) {
 const { user, hasPermission } = useAuth();
 const organizacaoId = user?.organizacao_id;
 const canCreate = hasPermission('empresas', 'pode_criar');

 const [empresas, setEmpresas] = useState(initialEmpresas || []);
 const [selectedEmpresaId, setSelectedEmpresaId] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 // Controle do Modal de Edição/Criação (que manteve a responsabilidade no Manager)
 const [isFormModalOpen, setIsFormModalOpen] = useState(false);
 const [empresaToEdit, setEmpresaToEdit] = useState(null);

 // Escuta o evento CustomEvent disparado pelo EmpresaDetails.js para abrir a edição
 useEffect(() => {
 const handleEditEvent = (e) => {
 setEmpresaToEdit(e.detail);
 setIsFormModalOpen(true);
 };
 window.addEventListener('edit-empresa', handleEditEvent);
 return () => window.removeEventListener('edit-empresa', handleEditEvent);
 }, []);

 const filteredEmpresas = useMemo(() => {
 if (!searchTerm) return empresas;
 const lowerTerm = searchTerm.toLowerCase();
 return empresas.filter(e =>
 e.nome_fantasia?.toLowerCase().includes(lowerTerm) ||
 e.razao_social?.toLowerCase().includes(lowerTerm) ||
 e.cnpj?.includes(searchTerm)
 );
 }, [empresas, searchTerm]);

 const handleOpenCreate = () => {
 setEmpresaToEdit(null);
 setIsFormModalOpen(true);
 };

 const handleFormSuccess = (empresaSalva) => {
 setIsFormModalOpen(false);
 // Atualiza a lista na memória
 setEmpresas(prev => {
 if (empresaToEdit) {
 return prev.map(e => e.id === empresaSalva.id ? empresaSalva : e).sort((a,b) => (a.nome_fantasia || a.razao_social).localeCompare(b.nome_fantasia || b.razao_social));
 } else {
 return [...prev, empresaSalva].sort((a,b) => (a.nome_fantasia || a.razao_social).localeCompare(b.nome_fantasia || b.razao_social));
 }
 });
 // Seleciona a empresa caso seja nova
 if (!empresaToEdit) {
 setSelectedEmpresaId(empresaSalva.id);
 }
 };

 return (
 <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50 rounded-xl shadow-inner border border-gray-200 animate-fade-in">
 {/* PAINEL ESQUERDO: LISTA (MASTER) */}
 <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-gray-200 bg-white flex flex-col h-full shadow-sm z-10">
 {/* Cabeçalho */}
 <div className="p-5 border-b border-gray-100 space-y-4 shrink-0 bg-white">
 <div className="flex justify-between items-center">
 <h2 className="text-xl font-bold tracking-tight text-gray-900">Empresas</h2>
 {canCreate && (
 <button
 onClick={handleOpenCreate}
 className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95"
 >
 <FontAwesomeIcon icon={faPlus} /> Nova
 </button>
 )}
 </div>
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
 </div>
 <input
 type="text"
 placeholder="Buscar por nome, razão ou CNPJ..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 block w-full rounded-xl border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white text-sm py-2.5 transition-colors shadow-sm"
 />
 </div>
 </div>

 {/* Lista Scrollável */}
 <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
 {filteredEmpresas.length === 0 ? (
 <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-3">
 <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-50" />
 <p className="text-sm font-medium">Nenhuma empresa encontrada.</p>
 </div>
 ) : (
 <ul className="divide-y divide-gray-100 p-2 space-y-1">
 {filteredEmpresas.map(empresa => {
 const isSelected = selectedEmpresaId === empresa.id;
 const initials = (empresa.nome_fantasia || empresa.razao_social || 'E').substring(0, 2).toUpperCase();
 return (
 <li key={empresa.id}>
 <button
 onClick={() => setSelectedEmpresaId(empresa.id)}
 className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex gap-3 items-center
 ${isSelected
 ? 'bg-blue-50 border border-blue-200 shadow-sm ring-1 ring-blue-500/50'
 : 'bg-white border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
 }`}
 >
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors bg-cover bg-center
 ${isSelected ? 'shadow-inner' : 'group-hover:shadow-sm'}`} style={{ backgroundImage: empresa.logo_url ? `url(${empresa.logo_url})` : empresa.imagem_url ? `url(${empresa.imagem_url})` : 'none', backgroundColor: !(empresa.logo_url || empresa.imagem_url) ? (isSelected ? '#2563EB' : '#F3F4F6') : undefined, color: !(empresa.logo_url || empresa.imagem_url) ? (isSelected ? 'white' : '#6B7280') : undefined }}>
 {!(empresa.logo_url || empresa.imagem_url) && initials}
 </div>
 <div className="min-w-0 flex-1">
 <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
 {empresa.nome_fantasia || empresa.razao_social}
 </p>
 <p className="text-xs text-gray-500 truncate mt-0.5">
 CNPJ: {empresa.cnpj || 'Não informado'}
 </p>
 </div>
 </button>
 </li>
 );
 })}
 </ul>
 )}
 </div>
 </div>

 {/* PAINEL DIREITO: DETALHES (DETAIL) */}
 <div className="flex-1 bg-white overflow-y-auto custom-scrollbar relative">
 {!selectedEmpresaId ? (
 <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 space-y-4">
 <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center shadow-inner mb-2">
 <FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-300" />
 </div>
 <h3 className="text-xl font-medium text-gray-600">Nenhuma empresa selecionada</h3>
 <p className="text-sm max-w-sm text-center">
 Selecione uma empresa na lista ao lado para visualizar e editar sua ficha cadastral completa e informações legais.
 </p>
 </div>
 ) : (
 <EmpresaDetailWrapper empresaId={selectedEmpresaId} organizacaoId={organizacaoId} />
 )}
 </div>

 {/* Modal de Criação / Edição mantido no Manager */}
 {isFormModalOpen && (
 <EmpresaFormModal
 isOpen={isFormModalOpen}
 onClose={() => setIsFormModalOpen(false)}
 empresa={empresaToEdit}
 onSuccess={handleFormSuccess}
 />
 )}
 </div>
 );
}

"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBuilding, faPlus, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import EmpreendimentoDetailWrapper from './EmpreendimentoDetailWrapper';
import EmpreendimentoFormModal from './EmpreendimentoFormModal';
import { faCity, faHouse } from '@fortawesome/free-solid-svg-icons';

export default function EmpreendimentoManager({ initialEmpreendimentos }) {
 const { user, hasPermission } = useAuth();
 const organizacaoId = user?.organizacao_id;
 const canCreate = hasPermission('empreendimentos', 'pode_criar');

 const empreendimentos = initialEmpreendimentos || [];
 const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [isModalOpen, setIsModalOpen] = useState(false);

 const filteredEmpreendimentos = useMemo(() => {
 if (!searchTerm) return empreendimentos;
 const lowerTerm = searchTerm.toLowerCase();
 return empreendimentos.filter(e =>
 e.nome?.toLowerCase().includes(lowerTerm) ||
 e.status?.toLowerCase().includes(lowerTerm)
 );
 }, [empreendimentos, searchTerm]);

 const statusColors = {
 'Breve Lançamento': 'bg-purple-100 text-purple-800',
 'Lançamento': 'bg-green-100 text-green-800',
 'Em Obras': 'bg-blue-100 text-blue-800',
 'Pronto para Morar': 'bg-indigo-100 text-indigo-800'
 };

 return (
 <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50/50 rounded-xl shadow-inner border border-gray-200 animate-fade-in">

 {/* PAINEL ESQUERDO: LISTA (MASTER) */}
 <div className={`border-r border-gray-200 bg-white flex flex-col h-full shadow-sm z-10 ${selectedEmpreendimentoId ? 'hidden md:flex md:w-1/3 md:min-w-[320px] md:max-w-[400px]' : 'w-full md:w-1/3 md:min-w-[320px] md:max-w-[400px]'}`}>

 {/* Cabeçalho da Lista */}
 <div className="p-5 border-b border-gray-100 space-y-4 shrink-0 bg-white">
 <div className="flex justify-between items-center">
 <h2 className="text-xl font-bold tracking-tight text-gray-900">Empreendimentos</h2>
 {canCreate && (
 <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 hover:shadow-md active:scale-95">
 <FontAwesomeIcon icon={faPlus} /> Novo
 </button>
 )}
 </div>

 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
 </div>
 <input
 type="text"
 placeholder="Buscar obras..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10 block w-full rounded-xl border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500 focus:bg-white text-sm py-2.5 transition-colors shadow-sm"
 />
 </div>
 </div>

 {/* Lista Scrollável */}
 <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/30">
 {filteredEmpreendimentos.length === 0 ? (
 <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-3">
 <FontAwesomeIcon icon={faBuilding} className="text-4xl opacity-50" />
 <p className="text-sm font-medium">Nenhum empreendimento encontrado.</p>
 </div>
 ) : (
 <ul className="divide-y divide-gray-100 p-2 space-y-1">
 {filteredEmpreendimentos.map(empreendimento => {
 const isSelected = selectedEmpreendimentoId === empreendimento.id;
 const initials = (empreendimento.nome || 'E').substring(0, 2).toUpperCase();
 return (
 <li key={empreendimento.id}>
 <button
 onClick={() => setSelectedEmpreendimentoId(empreendimento.id)}
 className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex gap-3 items-center
 ${isSelected
 ? 'bg-blue-50 border border-blue-200 shadow-sm ring-1 ring-blue-500/50'
 : 'bg-white border border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
 }`}
 >
 <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors bg-cover bg-center
 ${isSelected ? 'shadow-inner' : 'group-hover:shadow-sm'}`} style={{ backgroundImage: empreendimento.imagem_capa_url ? `url(${empreendimento.imagem_capa_url})` : 'none', backgroundColor: !empreendimento.imagem_capa_url ? (isSelected ? '#2563EB' : '#F3F4F6') : undefined, color: !empreendimento.imagem_capa_url ? (isSelected ? 'white' : '#6B7280') : undefined }}>
 {!empreendimento.imagem_capa_url && initials}
 </div>
 <div className="min-w-0 flex-1">
 <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
 {empreendimento.nome}
 </p>
 <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
 <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-1 bg-gray-100 text-gray-700`}>
 <FontAwesomeIcon icon={empreendimento.categoria === 'Horizontal' ? faHouse : faCity} />
 {empreendimento.categoria || 'Vertical'}
 </span>
 <span className={`px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded ${statusColors[empreendimento.status] || 'bg-gray-100 text-gray-800'}`}>
 {empreendimento.status || 'Sem status'}
 </span>
 </div>
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
 <div className={`bg-white overflow-y-auto custom-scrollbar relative ${selectedEmpreendimentoId ? 'flex-1 w-full flex flex-col' : 'hidden md:flex flex-1 flex-col'}`}>
 {!selectedEmpreendimentoId ? (
 <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 space-y-4">
 <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center shadow-inner mb-2">
 <FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-300" />
 </div>
 <h3 className="text-xl font-medium text-gray-600">Nenhum empreendimento selecionado</h3>
 <p className="text-sm max-w-sm text-center">
 Selecione um empreendimento na lista ao lado para gerenciar arquivos, ficha completas, tabela de vendas e modelos de contrato.
 </p>
 </div>
 ) : (
 <>
 {/* Cabeçalho Mobile de Voltar */}
 <div className="md:hidden bg-white p-3 border-b border-gray-200 flex items-center gap-3 shadow-sm sticky top-0 z-20">
 <button onClick={() => setSelectedEmpreendimentoId(null)} className="text-gray-600 px-3 py-2 hover:bg-gray-100 rounded-lg flex items-center gap-2 font-bold text-sm transition-colors">
 <FontAwesomeIcon icon={faArrowLeft} /> Voltar
 </button>
 <h2 className="font-bold text-gray-800 flex-1 truncate text-sm">
 {empreendimentos.find(e => e.id === selectedEmpreendimentoId)?.nome || 'Empreendimento'}
 </h2>
 </div>
 <EmpreendimentoDetailWrapper empreendimentoId={selectedEmpreendimentoId} organizacaoId={organizacaoId} />
 </>
 )}
 </div>

 <EmpreendimentoFormModal
 isOpen={isModalOpen}
 onClose={() => setIsModalOpen(false)}
 />
 </div>
 );
}

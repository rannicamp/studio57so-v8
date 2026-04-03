"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faUpload, faUserCheck, faUserSlash, faUserTie, faUserCircle, faBriefcase, faSearch, faChevronDown, faPlus
} from '@fortawesome/free-solid-svg-icons';
import ColaboradorDetailPanel from './ColaboradorDetailPanel';
import PontoImporter from './PontoImporter'; import FuncionarioModal from './FuncionarioModal';

export default function RHManager() {
 const supabase = createClient();
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const [employees, setEmployees] = useState([]);
 const [candidates, setCandidates] = useState([]);
 const [loading, setLoading] = useState(true);

 const [searchQuery, setSearchQuery] = useState("");
 // Controle das Pastas "Sanfona" no Menu Esquerdo
 const [expandedGroups, setExpandedGroups] = useState({
 ativos: true,
 candidatos: false,
 demitidos: false
 });
 // Painel 3/4 Direita (Master-Detail Ficha Completa)
 const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
 const [isCandidateSelected, setIsCandidateSelected] = useState(false);

 // Modal Global de Importação de Ponto e Novo Colaborador
 const [isPontoModalOpen, setIsPontoModalOpen] = useState(false);
 const [isFuncionarioModalOpen, setIsFuncionarioModalOpen] = useState(false);

 const fetchAllData = useCallback(async () => {
 if (!organizacaoId) return;
 setLoading(true);

 const [funcionariosRes, contatosRes] = await Promise.all([
 supabase
 .from('funcionarios')
 .select(`
 id, full_name, foto_url, status, cpf,
 cargos (id, nome), cadastro_empresa(id, razao_social)
 `)
 .eq('organizacao_id', organizacaoId)
 .order('full_name', { ascending: true }),

 supabase
 .from('contatos')
 .select('id, nome, razao_social, foto_url, cargo')
 .eq('organizacao_id', organizacaoId)
 .eq('tipo_contato', 'Candidato')
 .eq('lixeira', false)
 ]);

 if (funcionariosRes.data) {
 const mappedEmployees = funcionariosRes.data.map(e => {
 let finalUrl = e.foto_url;
 if (finalUrl && !finalUrl.startsWith('http')) {
 finalUrl = supabase.storage.from('funcionarios-documentos').getPublicUrl(finalUrl).data?.publicUrl;
 }
 return { ...e, foto_url: finalUrl };
 });
 setEmployees(mappedEmployees);
 } else {
 console.error("Erro ao carregar funcionários:", funcionariosRes.error);
 }

 if (contatosRes.data) {
 const mappedCandidates = contatosRes.data.map(c => {
 let finalUrl = c.foto_url;
 if (finalUrl && !finalUrl.startsWith('http')) {
 finalUrl = supabase.storage.from('avatars').getPublicUrl(finalUrl).data?.publicUrl;
 }
 return {
 id: c.id,
 full_name: c.nome || c.razao_social,
 foto_url: finalUrl,
 contract_role: c.cargo || 'Candidato',
 status: 'Candidato'
 }
 });
 setCandidates(mappedCandidates);
 }

 setLoading(false);
 }, [supabase, organizacaoId]);

 useEffect(() => {
 fetchAllData();
 }, [fetchAllData]);

 const handleSelectEmployee = (employee) => {
 setSelectedEmployeeId(employee.id);
 setIsCandidateSelected(employee.status === 'Candidato');
 };

 const toggleGroup = (id) => {
 setExpandedGroups(prev => ({
 ...prev,
 [id]: !prev[id]
 }));
 };

 // Agrupamentos Básicos
 const ativos = employees.filter(e => e.status !== 'Demitido');
 const demitidos = employees.filter(e => e.status === 'Demitido');

 // Mapeamento Guias
  const tabs = [
 { id: 'ativos', title: 'Funcionários Ativos', list: ativos, icon: faUserCheck, color: 'text-green-700', bg: 'bg-green-50', border: 'border-l-green-500', bgHover: 'hover:bg-green-50' },
 { id: 'candidatos', title: 'Banco De Talentos', list: candidates, icon: faUserTie, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-l-purple-500', bgHover: 'hover:bg-purple-50' },
 { id: 'demitidos', title: 'Demitidos', list: demitidos, icon: faUserSlash, color: 'text-red-700', bg: 'bg-red-50', border: 'border-l-red-500', bgHover: 'hover:bg-red-50' },
 ];

 const getFilteredList = (list) => {
 if (!searchQuery) return list;
 const q = searchQuery.toLowerCase();
 return list.filter(e => e.full_name?.toLowerCase().includes(q) || e.cpf?.includes(q) || e.cargos?.nome?.toLowerCase().includes(q) ||
 e.contract_role?.toLowerCase().includes(q)
 );
 };

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
 <FontAwesomeIcon icon={faSpinner} spin size="4x" className="text-blue-600 mb-6" />
 <h2 className="text-xl font-bold text-gray-800">Sincronizando Departamento Pessoal...</h2>
 <p className="text-gray-500">Montando quadro geral de colaboradores</p>
 </div>
 );
 }

 return (
 <div className="space-y-6 animate-fadeIn pb-12 w-full max-w-[1920px] mx-auto">
 {/* CABEÇALHO UNIFICADO */}
 <div className="bg-white p-4 lg:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
 <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:flex items-center justify-center shrink-0 w-12 h-12">
 <FontAwesomeIcon icon={faUsers} size="lg" />
 </div>
 <div className="flex-1 w-full space-y-1">
 <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Módulo Estratégico</label>
 <div className="relative w-full xl:w-2/3">
 <div className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 flex flex-col justify-center shadow-sm">
 <span className="font-bold text-sm lg:text-base text-gray-900">Recursos Humanos & Departamento Pessoal</span>
 <span className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
 Equipe Total: <span className="text-gray-700">{employees.length + candidates.length} Cadastros</span>
 </span>
 </div>
 </div>
 </div>

 <div className="text-right flex flex-col md:flex-row items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
 <button
 onClick={() => setIsFuncionarioModalOpen(true)}
 className="bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-transform hover:-translate-y-0.5 w-full justify-center md:w-auto"
 >
 <FontAwesomeIcon icon={faPlus} /> Novo Colaborador
 </button>
 <button
 onClick={() => setIsPontoModalOpen(true)}
 className="bg-purple-600 hover:bg-purple-700 text-white text-xs md:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 transition-transform hover:-translate-y-0.5 w-full justify-center md:w-auto"
 >
 <FontAwesomeIcon icon={faUpload} /> Importar Ponto (REP)
 </button>
 </div>
 </div>

 {/* MASTER-DETAIL (A LISTA AQUI NA ESQUERDA, E A FICHA CADASTRADA NA DIREITA) */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
 {/* LADO ESQUERDO (1/4): PAINEL DE VISUALIZAÇÃO COM LISTAS COLAPSÁVEIS (TREEVIEW) */}
 <div className="lg:col-span-1 space-y-3">
 <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pl-1 mb-2">Painel de Visualização</h3>
 {/* Barra de Pesquisa */}
 <div className="relative mb-3 shadow-sm rounded-lg">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
 </div>
 <input
 type="text"
 placeholder="Buscar nome, cargo..."
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 if (e.target.value.length > 0) {
 setExpandedGroups({ ativos: true, candidatos: true, demitidos: true });
 } else {
 setExpandedGroups({ ativos: true, candidatos: false, demitidos: false });
 }
 }}
 className="block w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium transition-shadow"
 />
 </div>

 {/* Sanfona Das Categorias e Funcionários (A Lista Aqui) */}
 <div className="bg-white border text-sm rounded-lg flex flex-col shadow-sm overflow-hidden custom-scrollbar">
 {tabs.map((tab) => {
 const isExpanded = expandedGroups[tab.id];
 const filteredList = getFilteredList(tab.list);

 return (
 <div key={tab.id} className="border-b last:border-0 border-gray-100 flex flex-col transition-colors">
 {/* CABEÇALHO DO GRUPO (PASTA) */}
 <button
 onClick={() => toggleGroup(tab.id)}
 className={`w-full flex items-center justify-between p-4 transition-all duration-200 border-l-4 ${tab.bgHover} ${isExpanded ? `${tab.bg} ${tab.border}` : 'bg-white border-transparent'}`}
 >
 <div className="flex items-center gap-3">
 <FontAwesomeIcon icon={tab.icon} className={tab.color} />
 <div className={`font-bold capitalize text-left text-[13px] ${isExpanded ? tab.color : 'text-gray-700'}`}>
 {tab.title}
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm border ${isExpanded ? 'bg-white text-gray-800' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
 {filteredList.length}
 </div>
 <FontAwesomeIcon icon={faChevronDown} className={`text-[10px] text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
 </div>
 </button>

 {/* LISTA DE NOMES AQUI (FILHOS DA PASTA) */}
 {isExpanded && (
 <div className="bg-slate-50 border-t border-gray-100 flex flex-col max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-gray-100 shadow-inner">
 {filteredList.length === 0 ? (
 <div className="p-4 text-center text-[11px] text-gray-400 font-medium">Lista vazia.</div>
 ) : (
 filteredList.map(emp => {
 const isSelected = selectedEmployeeId === emp.id;
 return (
 <button
 key={emp.id}
 onClick={() => handleSelectEmployee(emp)}
 className={`w-full text-left p-3 flex items-center gap-3 hover:bg-white transition-all duration-150 border-l-[3px]
 ${isSelected ? 'bg-white border-blue-500 shadow-sm' : 'border-transparent'}`
 }
 >
 {/* Mini Avatar Fixo na Arvore */}
 <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 ${isSelected ? 'ring-2 ring-blue-100' : ''} bg-gray-100`}>
 {emp.foto_url ? (
 <img src={emp.foto_url} alt={emp.full_name} className="w-full h-full object-cover" />
 ) : (
 <FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-lg" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
 {emp.full_name}
 </p>
 <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate mt-0.5 flex items-center gap-1.5">
 <FontAwesomeIcon icon={faBriefcase} className="text-gray-400" />
 {emp.cargos?.nome || emp.contract_role || 'S/ Cargo'}
 </p>
 </div>
 </button>
 );
 })
 )}
 </div>
 )}

 </div>
 );
 })}
 </div>
 </div>

 {/* LADO DIREITO (3/4): PAINEL FIXO DA FICHA FUNCIONAL COMPLETA (SEM MODAL DESCENDO) */}
 <div className="lg:col-span-3 h-full">
 <ColaboradorDetailPanel selectedId={selectedEmployeeId} isCandidateSelected={isCandidateSelected}
 onEmployeeUpdate={fetchAllData}
 />
 </div>
 </div>

 {/* Modal Global de Importação Ponto continua sendo modal por ser funcionalidade Externa/Global */}
 {isPontoModalOpen && (
 <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
 <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden relative transform transition-all scale-100">
 <div className="px-6 py-5 border-b flex justify-between items-center bg-gray-50/80 sticky top-0 z-10">
 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
 <FontAwesomeIcon icon={faUpload} className="text-purple-600" />
 Importador Cérebro de Ponto (REP)
 </h2>
 <button
 onClick={() => setIsPontoModalOpen(false)}
 className="text-gray-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50"
 >
 ✕
 </button>
 </div>
 <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
 <PontoImporter onImportSuccess={() => {}} />
 </div>
 </div>
 </div>
 )}

 {/* Modal de Criação de Novo Funcionário / Candidato */}
 {isFuncionarioModalOpen && (
 <FuncionarioModal
 isOpen={isFuncionarioModalOpen}
 onClose={() => setIsFuncionarioModalOpen(false)}
 initialData={null} // null significa que é uma criação nova
 onSaveSuccess={fetchAllData}
 />
 )}
 </div>
 );
}

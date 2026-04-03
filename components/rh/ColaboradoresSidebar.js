"use client";

import { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faSearch,
 faUserCheck,
 faUserSlash,
 faBuilding,
 faUserTie,
 faChevronDown,
 faChevronRight,
 faUserCircle
} from '@fortawesome/free-solid-svg-icons';

export default function ColaboradoresSidebar({
 employees,
 candidates,
 selectedId,
 onSelectEmployee,
 searchQuery,
 setSearchQuery
}) {
 // Accordions State
 const [expandedSections, setExpandedSections] = useState({
 ativos: true,
 demitidos: false,
 terceirizados: false,
 candidatos: false
 });

 const toggleSection = (section) => {
 setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
 };

 // Filter Logic
 const filteredEmployees = useMemo(() => {
 if (!searchQuery) return employees;
 const query = searchQuery.toLowerCase();
 return employees.filter(emp =>
 emp.full_name?.toLowerCase().includes(query) ||
 emp.cpf?.includes(query) ||
 emp.contract_role?.toLowerCase().includes(query)
 );
 }, [employees, searchQuery]);

 const filteredCandidates = useMemo(() => {
 if (!searchQuery) return candidates;
 const query = searchQuery.toLowerCase();
 return candidates.filter(cand =>
 cand.full_name?.toLowerCase().includes(query) ||
 cand.contract_role?.toLowerCase().includes(query)
 );
 }, [candidates, searchQuery]);

 // Grouping
 const ativos = filteredEmployees.filter(e => e.status !== 'Demitido' && e.tipo !== 'Terceirizado');
 const terceirizados = filteredEmployees.filter(e => e.status !== 'Demitido' && e.tipo === 'Terceirizado');
 const demitidos = filteredEmployees.filter(e => e.status === 'Demitido');

 // Componente de Item da Lista
 const EmployeeItem = ({ employee, isCandidate }) => {
 const isSelected = selectedId === employee.id;
 return (
 <button
 onClick={() => onSelectEmployee(employee)}
 className={`w-full text-left p-3 flex items-center gap-3 transition-colors border-b last:border-b-0
 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}
 `}
 >
 <div className="flex-shrink-0 h-10 w-10">
 {employee.foto_url ? (
 <img className="h-10 w-10 rounded-full object-cover shadow-sm border border-gray-200" src={employee.foto_url} alt={employee.full_name} />
 ) : (
 <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
 <FontAwesomeIcon icon={faUserCircle} className="text-gray-400 text-xl" />
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
 {employee.full_name}
 </p>
 <p className="text-xs text-gray-500 truncate mt-0.5">
 {employee.contract_role || 'Sem cargo definido'}
 </p>
 </div>
 {isCandidate && (
 <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
 Candidato
 </span>
 )}
 </button>
 );
 };

 // Componente de Seção (Accordion)
 const SectionHeader = ({ id, title, count, icon, colorClass, iconColorClass }) => (
 <button
 onClick={() => toggleSection(id)}
 className={`w-full flex items-center justify-between p-3 bg-gray-50/80 border-y border-gray-200 hover:bg-gray-100 transition-colors sticky top-0 z-10`}
 >
 <div className="flex items-center gap-2">
 <FontAwesomeIcon icon={icon} className={`${iconColorClass} w-4 h-4`} />
 <span className={`text-sm font-bold ${colorClass}`}>{title}</span>
 <span className="bg-white text-gray-600 text-xs px-2 py-0.5 rounded-full border shadow-sm font-medium">
 {count}
 </span>
 </div>
 <FontAwesomeIcon
 icon={expandedSections[id] ? faChevronDown : faChevronRight}
 className="text-gray-400 text-xs transition-transform"
 />
 </button>
 );

 return (
 <div className="flex flex-col h-full bg-white border-r">
 {/* Campo de Busca Fixo */}
 <div className="p-4 border-b bg-white sticky top-0 z-20 shadow-sm">
 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400 text-sm" />
 </div>
 <input
 type="text"
 placeholder="Buscar por nome, cargo ou CPF..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
 />
 </div>
 </div>

 {/* Container Colapsável da Lista */}
 <div className="flex-1 overflow-y-auto">
 {/* Seção: Ativos */}
 <SectionHeader id="ativos" title="Ativos" count={ativos.length} icon={faUserCheck} colorClass="text-green-800" iconColorClass="text-green-500" />
 {expandedSections.ativos && (
 <div className="divide-y divide-gray-100">
 {ativos.length > 0 ? (
 ativos.map(emp => <EmployeeItem key={emp.id} employee={emp} />)
 ) : (
 <div className="p-4 text-center text-xs text-gray-500">Nenhum funcionário ativo.</div>
 )}
 </div>
 )}

 {/* Seção: Terceirizados */}
 <SectionHeader id="terceirizados" title="Terceirizados" count={terceirizados.length} icon={faBuilding} colorClass="text-blue-800" iconColorClass="text-blue-500" />
 {expandedSections.terceirizados && (
 <div className="divide-y divide-gray-100">
 {terceirizados.length > 0 ? (
 terceirizados.map(emp => <EmployeeItem key={emp.id} employee={emp} />)
 ) : (
 <div className="p-4 text-center text-xs text-gray-500">Nenhum terceirizado parceiro.</div>
 )}
 </div>
 )}

 {/* Seção: Banco de Talentos */}
 <SectionHeader id="candidatos" title="Candidatos" count={filteredCandidates.length} icon={faUserTie} colorClass="text-purple-800" iconColorClass="text-purple-500" />
 {expandedSections.candidatos && (
 <div className="divide-y divide-gray-100">
 {filteredCandidates.length > 0 ? (
 filteredCandidates.map(cand => <EmployeeItem key={cand.id} employee={cand} isCandidate={true} />)
 ) : (
 <div className="p-4 text-center text-xs text-gray-500">Sem currículos na base.</div>
 )}
 </div>
 )}

 {/* Seção: Demitidos */}
 <SectionHeader id="demitidos" title="Demitidos" count={demitidos.length} icon={faUserSlash} colorClass="text-red-800" iconColorClass="text-red-500" />
 {expandedSections.demitidos && (
 <div className="divide-y divide-gray-100">
 {demitidos.length > 0 ? (
 demitidos.map(emp => <EmployeeItem key={emp.id} employee={emp} />)
 ) : (
 <div className="p-4 text-center text-xs text-gray-500">Nenhum registro.</div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}

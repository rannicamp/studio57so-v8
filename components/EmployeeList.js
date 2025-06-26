"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSort, faSortUp, faSortDown, faExclamationTriangle, faUsers, faUserCheck, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard'; // Importando o novo componente

// Documentos obrigatórios
const requiredDocuments = ['Identidade com Foto', 'CTPS', 'Comprovante de Residência', 'ASO'];

// Função para verificar pendências de um funcionário
const hasPendingIssues = (employee) => {
  const requiredFields = ['full_name', 'cpf', 'empresa_id', 'contract_role', 'admission_date'];
  const missingFields = requiredFields.some(field => !employee[field]);
  if (missingFields) return true;
  const uploadedDocNames = (employee.documentos_funcionarios || []).map(doc => doc.nome_documento);
  const missingDocuments = requiredDocuments.some(docType => !uploadedDocNames.includes(docType));
  if (missingDocuments) return true;
  return false;
};

// --- Componente da Tabela ---
const EmployeeTable = ({ employees, onDismissClick, requestSort, sortConfig }) => {
  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
    if (sortConfig.direction === 'ascending') return <FontAwesomeIcon icon={faSortUp} className="ml-2" />;
    return <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
  };

  const SortableHeader = ({ sortKey, children, className }) => (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}>
      <button onClick={() => requestSort(sortKey)} className="flex items-center">
        <span>{children}</span>
        {getSortIcon(sortKey)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">!</th>
            <SortableHeader sortKey="full_name">Nome</SortableHeader>
            <SortableHeader sortKey="contract_role">Cargo</SortableHeader>
            <SortableHeader sortKey="cadastro_empresa">Empresa</SortableHeader>
            <SortableHeader sortKey="empreendimentos">Empreendimento</SortableHeader>
            <SortableHeader sortKey="phone">Telefone</SortableHeader>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {hasPendingIssues(employee) && (
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="text-yellow-500"
                    title="Funcionário com pendências (dados ou documentos faltando)"
                  />
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900" title={employee.full_name}>{employee.full_name}</td>
              <td className="px-6 py-4 whitespace-nowrap" title={employee.contract_role}>{employee.contract_role}</td>
              <td className="px-6 py-4 whitespace-nowrap" title={employee.cadastro_empresa?.razao_social || 'N/A'}>{employee.cadastro_empresa?.razao_social || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap" title={employee.empreendimentos?.nome || 'N/A'}>{employee.empreendimentos?.nome || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap" title={employee.phone || 'N/A'}>{employee.phone || 'N/A'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link href={`/funcionarios/editar/${employee.id}`} className="text-blue-600 hover:text-blue-800">Editar</Link>
                {employee.status !== 'Demitido' && (
                  <button onClick={() => onDismissClick(employee)} className="text-red-600 hover:text-red-800 ml-4">Demitir</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Componente Principal ---
export default function EmployeeList({ initialEmployees }) {
  const supabase = createClient();
  const [employees, setEmployees] = useState(initialEmployees);
  const [message, setMessage] = useState('');
  const [isActivesVisible, setIsActivesVisible] = useState(true);
  const [isDismissedVisible, setIsDismissedVisible] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [dateFilterType, setDateFilterType] = useState('admission_date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEmpreendimentos, setSelectedEmpreendimentos] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'ascending' });

  const roleFilterRef = useRef(null);
  const dateFilterRef = useRef(null);
  const empreendimentoFilterRef = useRef(null);

  const allRoles = useMemo(() => [...new Set(initialEmployees.map(e => e.contract_role).filter(Boolean).sort())], [initialEmployees]);
  const allEmpreendimentos = useMemo(() => {
    const map = new Map();
    initialEmployees.forEach(e => { if (e.empreendimentos) map.set(e.empreendimentos.id, e.empreendimentos.nome) });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [initialEmployees]);

  const kpiData = useMemo(() => {
    const total = initialEmployees.length;
    const ativos = initialEmployees.filter(e => e.status === 'Ativo').length;
    const pendencias = initialEmployees.filter(e => hasPendingIssues(e)).length;
    const demitidos = initialEmployees.filter(e => e.status === 'Demitido').length;
    return { total, ativos, pendencias, demitidos };
  }, [initialEmployees]);
  
  const handleRoleSelect = (role) => setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  const handleEmpreendimentoSelect = (id) => setSelectedEmpreendimentos(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const nameMatch = searchTerm ? employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      const roleMatch = selectedRoles.length > 0 ? selectedRoles.includes(employee.contract_role) : true;
      const empreendimentoMatch = selectedEmpreendimentos.length > 0 ? selectedEmpreendimentos.includes(employee.empreendimento_atual_id) : true;
      let dateMatch = true;
      if (startDate || endDate) {
        const employeeDateStr = employee[dateFilterType];
        if (!employeeDateStr) { dateMatch = false; }
        else {
          const employeeDate = new Date(employeeDateStr + "T00:00:00");
          const start = startDate ? new Date(startDate + "T00:00:00") : null;
          const end = endDate ? new Date(endDate + "T00:00:00") : null;
          if (start && end) dateMatch = employeeDate >= start && employeeDate <= end;
          else if (start) dateMatch = employeeDate >= start;
          else if (end) dateMatch = employeeDate <= end;
        }
      }
      return nameMatch && roleMatch && empreendimentoMatch && dateMatch;
    });
  }, [employees, searchTerm, selectedRoles, selectedEmpreendimentos, dateFilterType, startDate, endDate]);

  const sortedEmployees = useMemo(() => {
    let sortableItems = [...filteredEmployees];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const getSortableValue = (item, key) => {
          if (key === 'cadastro_empresa') return item.cadastro_empresa?.razao_social || '';
          if (key === 'empreendimentos') return item.empreendimentos?.nome || '';
          return item[key] || '';
        };
        const valA = getSortableValue(a, sortConfig.key);
        const valB = getSortableValue(b, sortConfig.key);
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredEmployees, sortConfig]);

  const activeEmployees = useMemo(() => sortedEmployees.filter(emp => emp.status !== 'Demitido'), [sortedEmployees]);
  const dismissedEmployees = useMemo(() => sortedEmployees.filter(emp => emp.status === 'Demitido'), [sortedEmployees]);
  
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (roleFilterRef.current && !roleFilterRef.current.contains(event.target) &&
          dateFilterRef.current && !dateFilterRef.current.contains(event.target) &&
          empreendimentoFilterRef.current && !empreendimentoFilterRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const clearFilters = () => {
    setSearchTerm(''); setSelectedRoles([]); setDateFilterType('admission_date');
    setStartDate(''); setEndDate(''); setSelectedEmpreendimentos([]);
  };

  const handleDismissClick = async (employee) => {
    if (!confirm(`Tem certeza que deseja demitir ${employee.full_name}?`)) return;
    setMessage('Demitindo funcionário...');
    const { error } = await supabase.from('funcionarios').update({ status: 'Demitido', demission_date: new Date().toISOString().split('T')[0] }).eq('id', employee.id);
    if (error) {
      setMessage(`Erro ao demitir: ${error.message}`);
    } else {
      setMessage('Funcionário demitido com sucesso!');
      const { data: updatedEmployees, error: fetchError } = await supabase
        .from('funcionarios')
        .select(`*, cadastro_empresa ( razao_social ), empreendimentos ( id, nome ), documentos_funcionarios ( id, nome_documento, caminho_arquivo )`)
        .order('full_name');
      if (fetchError) console.error('Erro ao recarregar funcionários:', fetchError);
      else setEmployees(updatedEmployees || []);
    }
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div>
      {/* Seção de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KpiCard title="Total de Funcionários" value={kpiData.total} icon={faUsers} color="blue" />
        <KpiCard title="Funcionários Ativos" value={kpiData.ativos} icon={faUserCheck} color="green" />
        <KpiCard title="Com Pendências" value={kpiData.pendencias} icon={faExclamationTriangle} color="yellow" />
        <KpiCard title="Demitidos" value={kpiData.demitidos} icon={faUserSlash} color="red" />
      </div>

      {/* Seção de Filtros */}
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 border rounded-md shadow-sm flex-grow"
        />
        <div className="relative" ref={roleFilterRef}>
          <button onClick={() => setOpenDropdown(openDropdown === 'role' ? null : 'role')} className="p-2 border rounded-md shadow-sm flex items-center gap-2">
            Cargo ({selectedRoles.length}) <FontAwesomeIcon icon={faChevronDown} className={`${openDropdown === 'role' ? 'rotate-180' : ''} transition-transform`} />
          </button>
          {openDropdown === 'role' && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
              {allRoles.map(role => (
                <label key={role} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                  <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => handleRoleSelect(role)} className="mr-2"/>
                  {role}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={empreendimentoFilterRef}>
          <button onClick={() => setOpenDropdown(openDropdown === 'empreendimento' ? null : 'empreendimento')} className="p-2 border rounded-md shadow-sm flex items-center gap-2">
            Empreendimento ({selectedEmpreendimentos.length}) <FontAwesomeIcon icon={faChevronDown} className={`${openDropdown === 'empreendimento' ? 'rotate-180' : ''} transition-transform`} />
          </button>
          {openDropdown === 'empreendimento' && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
              {allEmpreendimentos.map(emp => (
                <label key={emp.id} className="flex items-center p-2 hover:bg-gray-100 cursor-pointer">
                  <input type="checkbox" checked={selectedEmpreendimentos.includes(emp.id)} onChange={() => handleEmpreendimentoSelect(emp.id)} className="mr-2"/>
                  {emp.nome}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={dateFilterRef}>
          <button onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')} className="p-2 border rounded-md shadow-sm flex items-center gap-2">
            Data ({dateFilterType === 'admission_date' ? 'Admissão' : 'Demissão'}) <FontAwesomeIcon icon={faChevronDown} className={`${openDropdown === 'date' ? 'rotate-180' : ''} transition-transform`} />
          </button>
          {openDropdown === 'date' && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg p-3 space-y-2 z-10">
              <select value={dateFilterType} onChange={(e) => setDateFilterType(e.target.value)} className="w-full p-2 border rounded-md">
                <option value="admission_date">Data de Admissão</option>
                <option value="demission_date">Data de Demissão</option>
              </select>
              <label className="block text-sm font-medium">Início:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded-md" />
              <label className="block text-sm font-medium">Fim:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
          )}
        </div>
        <button onClick={clearFilters} className="p-2 border rounded-md shadow-sm bg-gray-200 hover:bg-gray-300">Limpar Filtros</button>
      </div>

      {message && <div className={`p-3 rounded-md text-sm ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

      {/* Seção da Tabela de Ativos */}
      <div className="border-b border-gray-200">
        <button onClick={() => setIsActivesVisible(!isActivesVisible)} className="w-full flex justify-between items-center p-4 bg-white hover:bg-gray-50">
          <span className="font-bold text-lg text-gray-800">Funcionários Ativos ({activeEmployees.length})</span>
          <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isActivesVisible ? 'rotate-180' : ''}`} />
        </button>
        {isActivesVisible && (
          <div className="overflow-x-auto">
            {activeEmployees.length > 0 ? <EmployeeTable employees={activeEmployees} onDismissClick={handleDismissClick} requestSort={requestSort} sortConfig={sortConfig} /> : <p className="p-4 text-gray-500">Nenhum funcionário ativo corresponde aos filtros.</p>}
          </div>
        )}
      </div>

      {/* Seção da Tabela de Demitidos */}
      <div>
        <button onClick={() => setIsDismissedVisible(!isDismissedVisible)} className="w-full flex justify-between items-center p-4 bg-white hover:bg-gray-50">
          <span className="font-bold text-lg text-gray-800">Funcionários Demitidos ({dismissedEmployees.length})</span>
          <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 ${isDismissedVisible ? 'rotate-180' : ''}`} />
        </button>
        {isDismissedVisible && (
          <div className="overflow-x-auto">
            {dismissedEmployees.length > 0 ? <EmployeeTable employees={dismissedEmployees} onDismissClick={() => {}} requestSort={requestSort} sortConfig={sortConfig} /> : <p className="p-4 text-gray-500">Nenhum funcionário demitido corresponde aos filtros.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
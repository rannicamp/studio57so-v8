"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSort, faSortUp, faSortDown } from '@fortawesome/free-solid-svg-icons';

// --- Componente da Tabela (com cabeçalhos classificáveis) ---
const EmployeeTable = ({ employees, onDismissClick, requestSort, sortConfig }) => {
  
  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
    if (sortConfig.direction === 'ascending') return <FontAwesomeIcon icon={faSortUp} className="ml-2" />;
    return <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
  };

  const SortableHeader = ({ sortKey, children, className }) => (
    <div className={className}>
      <button onClick={() => requestSort(sortKey)} className="flex items-center font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900">
        <span>{children}</span>
        {getSortIcon(sortKey)}
      </button>
    </div>
  );

  return (
    <div className="min-w-full">
      <div className="grid grid-cols-12 gap-4 bg-gray-50 p-3 text-left text-xs">
        <SortableHeader sortKey="full_name" className="col-span-3">Nome</SortableHeader>
        <SortableHeader sortKey="contract_role" className="col-span-2">Cargo</SortableHeader>
        <SortableHeader sortKey="cadastro_empresa" className="col-span-2">Empresa</SortableHeader>
        <SortableHeader sortKey="empreendimentos" className="col-span-2">Empreendimento</SortableHeader>
        <SortableHeader sortKey="phone" className="col-span-1">Telefone</SortableHeader>
        <div className="col-span-2 text-center font-semibold text-gray-600 uppercase tracking-wider">Ações</div>
      </div>
      <div className="bg-white divide-y divide-gray-200">
        {employees.map((employee) => (
          <div key={employee.id} className="grid grid-cols-12 gap-4 p-3 items-center text-sm">
            <div className="col-span-3 font-medium text-gray-900">{employee.full_name}</div>
            <div className="col-span-2 text-gray-700">{employee.contract_role}</div>
            <div className="col-span-2 text-gray-700">{employee.cadastro_empresa?.razao_social || 'N/A'}</div>
            <div className="col-span-2 text-gray-700">{employee.empreendimentos?.nome || 'N/A'}</div>
            <div className="col-span-1 text-gray-700">{employee.phone || 'N/A'}</div>
            <div className="col-span-2 text-center space-x-2">
              <Link href={`/funcionarios/editar/${employee.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</Link>
              {employee.status !== 'Demitido' && (
                <button onClick={() => onDismissClick(employee)} className="text-red-600 hover:text-red-800 text-xs font-medium">Demitir</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Componente Principal ---
export default function EmployeeList({ initialEmployees }) {
  const supabase = createClient();
  const [employees, setEmployees] = useState(initialEmployees);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
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

  const handleDismissClick = (employee) => { setSelectedEmployee(employee); setShowModal(true); };
  const confirmDismissal = async () => { /* ...lógica de demissão... */ };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4">
        {/* ... Filtros aqui ... */}
      </div>

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
      {/* ... Modal e Mensagens ... */}
    </div>
  );
}
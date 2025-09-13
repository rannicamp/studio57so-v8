// components/EmployeeList.js

"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faSort, faSortUp, faSortDown, faUsers, faUserCheck, faUserSlash, faExclamationTriangle, faEye, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';

const ProgressCircle = ({ score }) => {
    const percentage = Math.min(Math.max(score, 0), 100);
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (percentage / 100) * circumference;
    let colorClass = 'text-red-500';
    if (percentage >= 85) colorClass = 'text-green-500';
    else if (percentage >= 50) colorClass = 'text-yellow-500';
    return (
        <div className="relative flex items-center justify-center w-12 h-12" title={`Qualidade do cadastro: ${Math.round(percentage)}%`}>
            <svg className="w-full h-full" viewBox="0 0 40 40">
                <circle className="text-gray-200" strokeWidth="4" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" />
                <circle className={`${colorClass} transition-all duration-500`} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r="18" cx="20" cy="20" transform="rotate(-90 20 20)" />
            </svg>
            <span className={`absolute text-xs font-bold ${colorClass}`}>{Math.round(percentage)}%</span>
        </div>
    );
};

// ##### INÍCIO DA LÓGICA CORRIGIDA E MELHORADA #####

// 1. Lista de documentos obrigatórios atualizada e com nomes mais simples para verificação.
const identityDocsKeywords = ['identidade', 'rg', 'cnh'];
const otherRequiredDocsKeywords = ['ctps', 'residencia', 'aso', 'contrato', 'uniforme', 'epi', 'vt', 'vale transporte'];

// 2. A função de cálculo foi reescrita para ser mais completa e flexível.
const calculateScore = (employee) => {
    if (!employee) return 0;
    
    let score = 0;
    const weights = {
        fields: {
            full_name: 10,
            cpf: 10,
            empresa_id: 5,
            contract_role: 5,
            admission_date: 5,
            phone: 5,
            email: 3,
            birth_date: 3,
            cep: 2,
            address_street: 2,
        },
        document: 10, // Peso individual para cada tipo de documento
    };

    // Soma pontos pelos campos preenchidos
    for (const field in weights.fields) {
        if (employee[field]) {
            score += weights.fields[field];
        }
    }
    
    // Soma pontos pelos documentos enviados
    const uploadedDocNames = (employee.documentos_funcionarios || []).map(doc => (doc.nome_documento || '').toLowerCase());
    
    // Verificação especial para documentos de identidade
    if (uploadedDocNames.some(uploadedDoc => identityDocsKeywords.some(idKeyword => uploadedDoc.includes(idKeyword)))) {
        score += weights.document;
    }
    
    // Verificação para os outros documentos
    otherRequiredDocsKeywords.forEach(docKeyword => {
        if (uploadedDocNames.some(uploadedDoc => uploadedDoc.includes(docKeyword))) {
            score += weights.document;
        }
    });

    // Calcula o total de pontos possíveis
    const totalPossibleFieldScore = Object.values(weights.fields).reduce((a, b) => a + b, 0);
    const totalPossibleDocScore = (otherRequiredDocsKeywords.length + 1) * weights.document; // +1 para o doc de identidade
    const totalPossibleScore = totalPossibleFieldScore + totalPossibleDocScore;

    return (score / totalPossibleScore) * 100;
};
// ##### FIM DA LÓGICA CORRIGIDA E MELHORADA #####


const EmployeeTable = ({ employees, onDismissClick, requestSort, sortConfig }) => {
  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
    return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} className="ml-2" /> : <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
  };

  const SortableHeader = ({ sortKey, children }) => (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
            <SortableHeader sortKey="qualidade">Qualidade</SortableHeader>
            <SortableHeader sortKey="full_name">Nome</SortableHeader>
            <SortableHeader sortKey="contract_role">Cargo</SortableHeader>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="px-6 py-4 whitespace-nowrap"><ProgressCircle score={calculateScore(employee)} /></td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    {employee.foto_url ? (
                      <img className="h-10 w-10 rounded-full object-cover" src={employee.foto_url} alt="" />
                    ) : (
                      <FontAwesomeIcon icon={faUserCircle} className="h-10 w-10 text-gray-300" />
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{employee.full_name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.contract_role}</td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                <Link href={`/funcionarios/visualizar/${employee.id}`} className="text-gray-500 hover:text-blue-600 font-semibold flex items-center gap-1 inline-flex">
                    <FontAwesomeIcon icon={faEye} /> Visualizar
                </Link>
                <Link href={`/funcionarios/editar/${employee.id}`} className="text-blue-600 hover:text-blue-800 font-semibold">Editar</Link>
                {employee.status !== 'Demitido' && (
                  <button onClick={() => onDismissClick(employee)} className="text-red-600 hover:text-red-800 font-semibold">Demitir</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function EmployeeList({ initialEmployees }) {
  const supabase = createClient();
  const [employees, setEmployees] = useState(initialEmployees);
  const [message, setMessage] = useState('');
  const [isActivesVisible, setIsActivesVisible] = useState(true);
  const [isDismissedVisible, setIsDismissedVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'ascending' });

  const kpiData = useMemo(() => {
      const ativos = initialEmployees.filter(e => e.status === 'Ativo');
      const pendencias = ativos.filter(e => calculateScore(e) < 100).length;
      return {
          total: initialEmployees.length,
          ativos: ativos.length,
          pendencias: pendencias,
          demitidos: initialEmployees.filter(e => e.status === 'Demitido').length
      };
  }, [initialEmployees]);
  
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => 
        searchTerm ? employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );
  }, [employees, searchTerm]);

  const sortedEmployees = useMemo(() => {
    let sortableItems = [...filteredEmployees];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA = (sortConfig.key === 'qualidade') ? calculateScore(a) : (a[sortConfig.key] || '');
        let valB = (sortConfig.key === 'qualidade') ? calculateScore(b) : (b[sortConfig.key] || '');
        if (typeof valA === 'number') return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
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
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };
  
  const handleDismissClick = async (employee) => {
    if (!confirm(`Tem certeza que deseja demitir ${employee.full_name}?`)) return;
    setMessage('Demitindo funcionário...');
    const { error } = await supabase.from('funcionarios').update({ status: 'Demitido', demission_date: new Date().toISOString().split('T')[0] }).eq('id', employee.id);
    if (error) {
      setMessage(`Erro ao demitir: ${error.message}`);
    } else {
      setMessage('Funcionário demitido com sucesso!');
      const { data: updatedEmployees } = await supabase.from('funcionarios').select(`*, cadastro_empresa(razao_social), empreendimentos(id, nome), documentos_funcionarios(id, nome_documento, caminho_arquivo)`).order('full_name');
      setEmployees(updatedEmployees || []);
    }
  };
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 p-4">
        <KpiCard title="Total de Funcionários" value={kpiData.total} icon={faUsers} color="blue" />
        <KpiCard title="Funcionários Ativos" value={kpiData.ativos} icon={faUserCheck} color="green" />
        <KpiCard title="Ativos com Pendências" value={kpiData.pendencias} icon={faExclamationTriangle} color="yellow" />
        <KpiCard title="Demitidos" value={kpiData.demitidos} icon={faUserSlash} color="red" />
      </div>

      <div className="p-4 bg-gray-50 border-y border-gray-200">
        <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border rounded-md shadow-sm w-full"/>
      </div>

      {message && <div className={`p-3 rounded-md text-sm text-center font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

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
            {dismissedEmployees.length > 0 ? <EmployeeTable employees={dismissedEmployees} onDismissClick={() => {}} requestSort={requestSort} sortConfig={sortConfig} /> : <p className="p-4 text-gray-500">Nenhum funcionário demitido.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------
// COMENTÁRIO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente é a interface principal para gerenciar a lista de funcionários.
// Ele exibe KPIs (indicadores) sobre os funcionários, um campo de busca, e duas
// seções sanfonadas (accordion) que separam os funcionários ativos dos demitidos.
// A tabela de funcionários em si é renderizada por um sub-componente (EmployeeTable).
// A principal ação de modificação de dados aqui é a demissão de um funcionário.
// --------------------------------------------------------------------------------
// components/rh/EmployeeList.js

"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client'; // Ajuste de caminho para sair de components/rh
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronDown, faSort, faSortUp, faSortDown, 
    faUsers, faUserCheck, faUserSlash, faExclamationTriangle, 
    faEye, faUserCircle, faBuilding, faMapMarkedAlt, faPen
} from '@fortawesome/free-solid-svg-icons';
import KpiCard from '../KpiCard'; // Ajuste de caminho (KpiCard está em components/)

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

const identityDocsKeywords = ['identidade', 'rg', 'cnh'];
const otherRequiredDocsKeywords = ['ctps', 'residencia', 'aso', 'contrato', 'uniforme', 'epi', 'vt', 'vale transporte'];

const calculateScore = (employee) => {
    if (!employee) return 0;
    let score = 0;
    const weights = {
        fields: { full_name: 10, cpf: 10, empresa_id: 5, contract_role: 5, admission_date: 5, phone: 5, email: 3, birth_date: 3, cep: 2, address_street: 2 },
        document: 10,
    };
    for (const field in weights.fields) if (employee[field]) score += weights.fields[field];
    const uploadedDocNames = (employee.documentos_funcionarios || []).map(doc => (doc.nome_documento || '').toLowerCase());
    if (uploadedDocNames.some(uploadedDoc => identityDocsKeywords.some(idKeyword => uploadedDoc.includes(idKeyword)))) score += weights.document;
    otherRequiredDocsKeywords.forEach(docKeyword => { if (uploadedDocNames.some(uploadedDoc => uploadedDoc.includes(docKeyword))) score += weights.document; });
    
    const totalPossible = Object.values(weights.fields).reduce((a, b) => a + b, 0) + ((otherRequiredDocsKeywords.length + 1) * weights.document);
    return (score / totalPossible) * 100;
};

const EmployeeTable = ({ employees, onDismissClick, onEditClick, requestSort, sortConfig }) => {
  const getSortIcon = (key) => {
    if (!sortConfig || sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="text-gray-400 ml-2" />;
    return sortConfig.direction === 'ascending' ? <FontAwesomeIcon icon={faSortUp} className="ml-2" /> : <FontAwesomeIcon icon={faSortDown} className="ml-2" />;
  };

  const SortableHeader = ({ sortKey, children }) => (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => requestSort(sortKey)}>
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {getSortIcon(sortKey)}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <SortableHeader sortKey="qualidade">Qualidade</SortableHeader>
            <SortableHeader sortKey="full_name">Nome / Cargo</SortableHeader>
            <SortableHeader sortKey="cadastro_empresa.razao_social">Empresa</SortableHeader>
            <SortableHeader sortKey="empreendimentos.nome">Empreendimento</SortableHeader>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-blue-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap"><ProgressCircle score={calculateScore(employee)} /></td>
              
              {/* Coluna Nome e Cargo Agrupados */}
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
                    <div className="text-xs text-gray-500">{employee.contract_role || 'Sem cargo definido'}</div>
                  </div>
                </div>
              </td>
              
              {/* Coluna Empresa */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FontAwesomeIcon icon={faBuilding} className="text-gray-400 text-xs" />
                    {employee.cadastro_empresa?.razao_social || <span className="text-gray-400 italic">Não vinculado</span>}
                </div>
              </td>

              {/* Coluna Empreendimento */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FontAwesomeIcon icon={faMapMarkedAlt} className="text-gray-400 text-xs" />
                    {employee.empreendimentos?.nome || <span className="text-gray-400 italic">Não alocado</span>}
                </div>
              </td>

              {/* Ações */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <Link href={`/funcionarios/visualizar/${employee.id}`} className="text-gray-500 hover:text-blue-600 inline-flex items-center gap-1" title="Ver Ficha Completa">
                    <FontAwesomeIcon icon={faEye} />
                </Link>
                
                {/* BOTÃO EDITAR AGORA ABRE MODAL */}
                <button 
                    onClick={() => onEditClick(employee)} 
                    className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                >
                    <FontAwesomeIcon icon={faPen} /> Editar
                </button>

                {employee.status !== 'Demitido' && (
                  <button onClick={() => onDismissClick(employee)} className="text-red-600 hover:text-red-800 font-semibold ml-2">Demitir</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function EmployeeList({ initialEmployees, onEditFuncionario }) { 
  const supabase = createClient();
  const [employees, setEmployees] = useState(initialEmployees);
  
  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  const [message, setMessage] = useState('');
  const [isActivesVisible, setIsActivesVisible] = useState(true);
  const [isDismissedVisible, setIsDismissedVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'ascending' });

  const kpiData = useMemo(() => {
      const ativos = employees.filter(e => e.status !== 'Demitido');
      const pendencias = ativos.filter(e => calculateScore(e) < 100).length;
      return {
          total: employees.length,
          ativos: ativos.length,
          pendencias: pendencias,
          demitidos: employees.filter(e => e.status === 'Demitido').length
      };
  }, [employees]);
  
  const sortedEmployees = useMemo(() => {
    let sortableItems = [...employees];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        // Lógica para acessar propriedades aninhadas (ex: cadastro_empresa.razao_social)
        const getValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

        let valA = (sortConfig.key === 'qualidade') ? calculateScore(a) : (getValue(a, sortConfig.key) || '');
        let valB = (sortConfig.key === 'qualidade') ? calculateScore(b) : (getValue(b, sortConfig.key) || '');
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (typeof valA === 'number') return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [employees, sortConfig]);

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
      setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, status: 'Demitido' } : e));
      setTimeout(() => setMessage(''), 3000);
    }
  };
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 px-1">
        <KpiCard title="Total na Lista" value={kpiData.total} icon={faUsers} color="blue" />
        <KpiCard title="Ativos Encontrados" value={kpiData.ativos} icon={faUserCheck} color="green" />
        <KpiCard title="Cadastros Pendentes" value={kpiData.pendencias} icon={faExclamationTriangle} color="yellow" />
        <KpiCard title="Demitidos" value={kpiData.demitidos} icon={faUserSlash} color="red" />
      </div>

      {message && <div className={`mb-4 p-3 rounded-md text-sm text-center font-semibold animate-pulse ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <button onClick={() => setIsActivesVisible(!isActivesVisible)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200">
          <span className="font-bold text-lg text-gray-800 flex items-center gap-2">
             <FontAwesomeIcon icon={faUserCheck} className="text-green-500" /> 
             Funcionários Ativos ({activeEmployees.length})
          </span>
          <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 text-gray-400 ${isActivesVisible ? 'rotate-180' : ''}`} />
        </button>
        
        {isActivesVisible && (
          <div className="overflow-x-auto transition-all duration-300">
            {activeEmployees.length > 0 ? (
                <EmployeeTable 
                    employees={activeEmployees} 
                    onDismissClick={handleDismissClick} 
                    onEditClick={onEditFuncionario} // Passa a função para a tabela
                    requestSort={requestSort} 
                    sortConfig={sortConfig} 
                />
            ) : (
                <div className="p-8 text-center text-gray-500 bg-white">
                    <p>Nenhum funcionário ativo corresponde aos filtros.</p>
                </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <button onClick={() => setIsDismissedVisible(!isDismissedVisible)} className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200">
          <span className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faUserSlash} className="text-red-500" />
            Funcionários Demitidos ({dismissedEmployees.length})
          </span>
          <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 text-gray-400 ${isDismissedVisible ? 'rotate-180' : ''}`} />
        </button>
        
        {isDismissedVisible && (
          <div className="overflow-x-auto transition-all duration-300">
            {dismissedEmployees.length > 0 ? (
                <EmployeeTable 
                    employees={dismissedEmployees} 
                    onDismissClick={() => {}} 
                    onEditClick={onEditFuncionario} // Passa a função aqui também
                    requestSort={requestSort} 
                    sortConfig={sortConfig} 
                />
            ) : (
                <div className="p-8 text-center text-gray-500 bg-white">
                    <p>Nenhum funcionário demitido.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
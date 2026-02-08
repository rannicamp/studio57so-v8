"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faChevronDown, faSort, faSortUp, faSortDown, 
    faUsers, faUserCheck, faUserSlash, faExclamationTriangle, 
    faEye, faUserCircle, faBuilding, faMapMarkedAlt, faPen, faBriefcase,
    faUserTie, 
    faUserPlus 
} from '@fortawesome/free-solid-svg-icons';
import KpiCard from '@/components/shared/KpiCard';

const EmployeeTable = ({ employees, onDismissClick, onEditClick, requestSort, sortConfig, isCandidateList = false }) => {
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
            <SortableHeader sortKey="full_name">Nome</SortableHeader>
            <SortableHeader sortKey="cargos.nome">{isCandidateList ? 'Cargo Pretendido' : 'Cargo'}</SortableHeader> 
            <SortableHeader sortKey="cadastro_empresa.razao_social">Empresa</SortableHeader>
            <SortableHeader sortKey="empreendimentos.nome">Empreendimento</SortableHeader>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {employees.map((employee) => (
            <tr key={employee.id} className="hover:bg-blue-50 transition-colors">
              
              {/* Coluna Nome */}
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
                    {isCandidateList && <span className="text-xs text-blue-500 font-semibold bg-blue-50 px-1 rounded">Candidato</span>}
                  </div>
                </div>
              </td>

              {/* Coluna Cargo */}
              <td className="px-6 py-4 whitespace-nowrap">
                 <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FontAwesomeIcon icon={faBriefcase} className="text-gray-400 text-xs" />
                    <span className="font-medium">
                        {employee.cargos?.nome || employee.contract_role || <span className="text-gray-400 italic">--</span>}
                    </span>
                 </div>
              </td>
              
              {/* Coluna Empresa */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FontAwesomeIcon icon={faBuilding} className="text-gray-400 text-xs" />
                    {employee.cadastro_empresa?.razao_social || <span className="text-gray-400 italic">--</span>}
                </div>
              </td>

              {/* Coluna Empreendimento */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FontAwesomeIcon icon={faMapMarkedAlt} className="text-gray-400 text-xs" />
                    {employee.empreendimentos?.nome || <span className="text-gray-400 italic">--</span>}
                </div>
              </td>

              {/* Ações */}
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                {isCandidateList ? (
                    // AÇÕES PARA CANDIDATO
                    <>
                        <Link 
                            // Redireciona para o cadastro de funcionário passando o ID do contato para pré-popular
                            href={`/funcionarios/cadastro?candidate_id=${employee.original_id || employee.id}`} 
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded shadow-sm inline-flex items-center gap-1 transition-colors"
                            title="Transformar em Funcionário"
                        >
                            <FontAwesomeIcon icon={faUserPlus} /> Contratar
                        </Link>
                        <Link 
                            href={`/contatos/editar/${employee.original_id || employee.id}`} 
                            className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                        >
                            <FontAwesomeIcon icon={faPen} /> Editar
                        </Link>
                    </>
                ) : (
                    // AÇÕES PARA FUNCIONÁRIO
                    <>
                        <Link href={`/funcionarios/visualizar/${employee.id}`} className="text-gray-500 hover:text-blue-600 inline-flex items-center gap-1" title="Ver Ficha Completa">
                            <FontAwesomeIcon icon={faEye} />
                        </Link>
                        
                        <button 
                            onClick={() => onEditClick(employee)} 
                            className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                        >
                            <FontAwesomeIcon icon={faPen} /> Editar
                        </button>

                        {employee.status !== 'Demitido' && (
                        <button onClick={() => onDismissClick(employee)} className="text-red-600 hover:text-red-800 font-semibold ml-2">Demitir</button>
                        )}
                    </>
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
  const [candidates, setCandidates] = useState([]);
  
  // States de Visibilidade das Abas
  const [isActivesVisible, setIsActivesVisible] = useState(true);
  const [isCandidatesVisible, setIsCandidatesVisible] = useState(false);
  const [isDismissedVisible, setIsDismissedVisible] = useState(false);
  
  const [message, setMessage] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'full_name', direction: 'ascending' });

  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  // Busca Candidatos na montagem do componente
  useEffect(() => {
      const fetchCandidates = async () => {
          const { data, error } = await supabase
            .from('contatos')
            .select('*')
            .eq('tipo_contato', 'Candidato')
            .eq('lixeira', false);

          if (!error && data) {
              const mappedCandidates = data.map(c => ({
                  id: c.id,
                  original_id: c.id,
                  full_name: c.nome || c.razao_social,
                  foto_url: c.foto_url,
                  contract_role: c.cargo,
                  status: 'Candidato',
                  cadastro_empresa: null, 
                  empreendimentos: null
              }));
              setCandidates(mappedCandidates);
          }
      };
      fetchCandidates();
  }, []);

  const kpiData = useMemo(() => {
      const ativos = employees.filter(e => e.status !== 'Demitido');
      return {
          total: employees.length + candidates.length,
          ativos: ativos.length,
          candidatos: candidates.length,
          demitidos: employees.filter(e => e.status === 'Demitido').length
      };
  }, [employees, candidates]);
  
  // Função genérica de ordenação
  const sortData = (data) => {
    let sortableItems = [...data];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const getValue = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
        let valA, valB;

        if (sortConfig.key === 'cargos.nome') {
            valA = a.cargos?.nome || a.contract_role || '';
            valB = b.cargos?.nome || b.contract_role || '';
        } else {
            valA = getValue(a, sortConfig.key) || '';
            valB = getValue(b, sortConfig.key) || '';
        }
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (typeof valA === 'number') return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  };

  const sortedEmployees = useMemo(() => sortData(employees), [employees, sortConfig]);
  const sortedCandidates = useMemo(() => sortData(candidates), [candidates, sortConfig]);

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
      {/* KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 px-1">
        <KpiCard title="Ativos" value={kpiData.ativos} icon={faUserCheck} color="green" />
        <KpiCard title="Banco de Talentos" value={kpiData.candidatos} icon={faUserTie} color="purple" />
        <KpiCard title="Total Cadastros" value={kpiData.total} icon={faUsers} color="blue" />
        <KpiCard title="Demitidos" value={kpiData.demitidos} icon={faUserSlash} color="red" />
      </div>

      {message && <div className={`mb-4 p-3 rounded-md text-sm text-center font-semibold animate-pulse ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>}

      {/* 1. SEÇÃO CANDIDATOS (NOVO) */}
      <div className="bg-white rounded-lg border border-purple-200 shadow-sm mb-6 overflow-hidden">
        <button onClick={() => setIsCandidatesVisible(!isCandidatesVisible)} className="w-full flex justify-between items-center p-4 bg-purple-50 hover:bg-purple-100 transition-colors border-b border-purple-100">
          <span className="font-bold text-lg text-purple-800 flex items-center gap-2">
             <FontAwesomeIcon icon={faUserTie} className="text-purple-600" /> 
             Banco de Talentos / Candidatos ({sortedCandidates.length})
          </span>
          <FontAwesomeIcon icon={faChevronDown} className={`transform transition-transform duration-200 text-purple-400 ${isCandidatesVisible ? 'rotate-180' : ''}`} />
        </button>
        
        {isCandidatesVisible && (
          <div className="overflow-x-auto transition-all duration-300">
            {sortedCandidates.length > 0 ? (
                <EmployeeTable 
                    employees={sortedCandidates} 
                    onDismissClick={() => {}} 
                    onEditClick={() => {}} 
                    requestSort={requestSort} 
                    sortConfig={sortConfig} 
                    isCandidateList={true} 
                />
            ) : (
                <div className="p-8 text-center text-gray-500 bg-white">
                    {/* AQUI ESTAVA O ERRO - SUBSTITUÍDOS > POR &gt; */}
                    <p>Nenhum candidato encontrado. Cadastre em Contatos &gt; Novo &gt; Tipo: Candidato.</p>
                </div>
            )}
          </div>
        )}
      </div>

      {/* 2. SEÇÃO ATIVOS */}
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
                    onEditClick={onEditFuncionario} 
                    requestSort={requestSort} 
                    sortConfig={sortConfig} 
                />
            ) : (
                <div className="p-8 text-center text-gray-500 bg-white">
                    <p>Nenhum funcionário ativo encontrado.</p>
                </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SEÇÃO DEMITIDOS */}
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
                    onEditClick={onEditFuncionario} 
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
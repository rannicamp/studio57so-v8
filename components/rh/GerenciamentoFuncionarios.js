"use client";

import { useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import EmployeeList from './EmployeeList'; 
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faInbox, faBuilding, faBriefcase, faMapMarkedAlt, faTimesCircle } from '@fortawesome/free-solid-svg-icons';

const fetchEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    
    const supabase = createClient();
    
    // QUERY CORRIGIDA E OTIMIZADA
    const { data: employeesData, error } = await supabase
        .from('funcionarios')
        .select(`
            *,
            cadastro_empresa ( id, razao_social ),
            empreendimentos ( id, nome ),
            cargos ( id, nome ), 
            documentos_funcionarios ( id, nome_documento, caminho_arquivo, tipo:tipo_documento_id(sigla) )
        `)
        .eq('organizacao_id', organizacao_id)
        .order('full_name');

    if (error) {
        console.error('Erro ao buscar funcionários:', error);
        throw new Error(error.message);
    }

    // Processamento de URLs de fotos (mantido)
    const employeesWithPhotoUrl = await Promise.all(
        (employeesData || []).map(async (employee) => {
            if (employee.foto_url) {
                const { data, error: urlError } = await supabase.storage
                    .from('funcionarios-documentos')
                    .createSignedUrl(employee.foto_url, 3600);
                
                if (!urlError) {
                    employee.foto_url = data.signedUrl;
                } else {
                    employee.foto_url = null;
                }
            }
            return employee;
        })
    );
    return employeesWithPhotoUrl;
};

export default function GerenciamentoFuncionarios({ 
    searchTerm = '', 
    showFilters = false, 
    filters = {}, 
    onFilterChange,
    onEditFuncionario
}) {
    const { organizacao_id } = useAuth();

    const { data: employees = [], isLoading: loadingData, isError, error } = useQuery({
        queryKey: ['funcionarios', organizacao_id],
        queryFn: () => fetchEmployees(organizacao_id),
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5, 
    });
    
    // Extração de Opções para Filtros
    const options = useMemo(() => {
        const empresasSet = new Set();
        const cargosSet = new Set();
        const empreendimentosSet = new Set();

        employees.forEach(emp => {
            if (emp.cadastro_empresa?.razao_social) empresasSet.add(emp.cadastro_empresa.razao_social);
            
            // LÓGICA DE CARGO: Prioriza a tabela 'cargos', fallback para 'contract_role' (legado)
            const nomeCargo = emp.cargos?.nome || emp.contract_role;
            if (nomeCargo) cargosSet.add(nomeCargo);
            
            if (emp.empreendimentos?.nome) empreendimentosSet.add(emp.empreendimentos.nome);
        });

        return {
            empresas: Array.from(empresasSet).sort(),
            cargos: Array.from(cargosSet).sort(),
            empreendimentos: Array.from(empreendimentosSet).sort(),
        };
    }, [employees]);

    // Filtragem Lógica
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const nomeCargo = emp.cargos?.nome || emp.contract_role || ''; // Normalização

            // 1. Filtro de Texto
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                const matchesSearch = 
                    emp.full_name?.toLowerCase().includes(lowerTerm) ||
                    nomeCargo.toLowerCase().includes(lowerTerm) || 
                    emp.cpf?.includes(lowerTerm);
                if (!matchesSearch) return false;
            }

            // 2. Filtros Específicos
            if (filters.cargo && nomeCargo !== filters.cargo) return false;
            if (filters.empresa && emp.cadastro_empresa?.razao_social !== filters.empresa) return false;
            if (filters.empreendimento && emp.empreendimentos?.nome !== filters.empreendimento) return false;

            return true;
        });
    }, [employees, searchTerm, filters]);

    const clearFilters = () => {
        if(onFilterChange) {
            onFilterChange('empresa', '');
            onFilterChange('cargo', '');
            onFilterChange('empreendimento', '');
        }
    };

    if (loadingData) return <div className="text-center p-10 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" /><p>Carregando equipe...</p></div>;
    if (isError) return <div className="text-center p-4 text-red-500 bg-red-50 rounded-lg">Erro ao carregar funcionários: {error.message}</div>;

    return (
        <div className="space-y-6">
            {showFilters && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-inner animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Filtros Avançados</h3>
                        {(filters.empresa || filters.cargo || filters.empreendimento) && (
                            <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium">
                                <FontAwesomeIcon icon={faTimesCircle} /> Limpar Filtros
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><FontAwesomeIcon icon={faBuilding} /> Empresa</label>
                            <select value={filters.empresa || ''} onChange={(e) => onFilterChange('empresa', e.target.value)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2">
                                <option value="">Todas as Empresas</option>
                                {options.empresas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><FontAwesomeIcon icon={faBriefcase} /> Cargo</label>
                            <select value={filters.cargo || ''} onChange={(e) => onFilterChange('cargo', e.target.value)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2">
                                <option value="">Todos os Cargos</option>
                                {options.cargos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><FontAwesomeIcon icon={faMapMarkedAlt} /> Empreendimento</label>
                            <select value={filters.empreendimento || ''} onChange={(e) => onFilterChange('empreendimento', e.target.value)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2">
                                <option value="">Todos os Empreendimentos</option>
                                {options.empreendimentos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {(filteredEmployees.length === 0 && employees.length > 0) ? (
                <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-gray-100">
                    <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-4xl mb-3" />
                    <p className="text-gray-500">Nenhum funcionário encontrado com os filtros atuais.</p>
                    <button onClick={clearFilters} className="mt-2 text-blue-600 hover:underline text-sm">Limpar todos os filtros</button>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                    <EmployeeList initialEmployees={filteredEmployees} onEditFuncionario={onEditFuncionario} />
                </div>
            )}
            
            <div className="text-right text-xs text-gray-400 px-2">
                Exibindo {filteredEmployees.length} de {employees.length} colaboradores
            </div>
        </div>
    );
}
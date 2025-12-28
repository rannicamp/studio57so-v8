// components/rh/GerenciamentoFuncionarios.js
"use client";

import { useMemo } from 'react';
import { createClient } from '../../utils/supabase/client'; // Ajuste de caminho
import EmployeeList from './EmployeeList'; 
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faInbox, faBuilding, faBriefcase, faMapMarkedAlt, faTimesCircle } from '@fortawesome/free-solid-svg-icons';

const fetchEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    
    const supabase = createClient();
    const { data: employeesData, error } = await supabase
        .from('funcionarios')
        .select(`
            *,
            cadastro_empresa ( id, razao_social ),
            empreendimentos ( id, nome ),
            documentos_funcionarios ( id, nome_documento, caminho_arquivo, tipo:tipo_documento_id(sigla) )
        `)
        .eq('organizacao_id', organizacao_id)
        .order('full_name');

    if (error) {
        console.error('Erro ao buscar funcionários:', error);
        throw new Error(error.message);
    }

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

// Agora recebe as props de filtro e controle da Page
export default function GerenciamentoFuncionarios({ 
    searchTerm = '', 
    showFilters = false, 
    filters = {}, 
    onFilterChange,
    onEditFuncionario // NOVA PROP: Recebe a função para abrir o modal
}) {
    const { organizacao_id } = useAuth();

    const { data: employees = [], isLoading: loadingData, isError, error } = useQuery({
        queryKey: ['funcionarios', organizacao_id],
        queryFn: () => fetchEmployees(organizacao_id),
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5, 
    });
    
    // --- Extração de Opções Únicas para os Dropdowns ---
    const options = useMemo(() => {
        const empresasSet = new Set();
        const cargosSet = new Set();
        const empreendimentosSet = new Set();

        employees.forEach(emp => {
            if (emp.cadastro_empresa?.razao_social) empresasSet.add(emp.cadastro_empresa.razao_social);
            if (emp.contract_role) cargosSet.add(emp.contract_role);
            if (emp.empreendimentos?.nome) empreendimentosSet.add(emp.empreendimentos.nome);
        });

        return {
            empresas: Array.from(empresasSet).sort(),
            cargos: Array.from(cargosSet).sort(),
            empreendimentos: Array.from(empreendimentosSet).sort(),
        };
    }, [employees]);

    // --- Lógica de Filtragem Poderosa ---
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            // 1. Filtro de Texto (Busca)
            if (searchTerm) {
                const lowerTerm = searchTerm.toLowerCase();
                const matchesSearch = 
                    emp.full_name?.toLowerCase().includes(lowerTerm) ||
                    emp.contract_role?.toLowerCase().includes(lowerTerm) ||
                    emp.cpf?.includes(lowerTerm);
                if (!matchesSearch) return false;
            }

            // 2. Filtro de Empresa
            if (filters.empresa && emp.cadastro_empresa?.razao_social !== filters.empresa) {
                return false;
            }

            // 3. Filtro de Cargo
            if (filters.cargo && emp.contract_role !== filters.cargo) {
                return false;
            }

            // 4. Filtro de Empreendimento
            if (filters.empreendimento && emp.empreendimentos?.nome !== filters.empreendimento) {
                return false;
            }

            return true;
        });
    }, [employees, searchTerm, filters]);

    // Função para limpar todos os filtros
    const clearFilters = () => {
        if(onFilterChange) {
            onFilterChange('empresa', '');
            onFilterChange('cargo', '');
            onFilterChange('empreendimento', '');
        }
    };

    if (loadingData) {
        return (
            <div className="text-center p-10 text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" />
                <p>Carregando equipe...</p>
            </div>
        );
    }

    if (isError) {
        return <div className="text-center p-4 text-red-500 bg-red-50 rounded-lg">Erro ao carregar funcionários: {error.message}</div>
    }

    return (
        <div className="space-y-6">
            
            {/* --- ÁREA DE FILTROS AVANÇADOS --- */}
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
                        
                        {/* Filtro Empresa */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <FontAwesomeIcon icon={faBuilding} /> Empresa
                            </label>
                            <select 
                                value={filters.empresa || ''}
                                onChange={(e) => onFilterChange('empresa', e.target.value)}
                                className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
                            >
                                <option value="">Todas as Empresas</option>
                                {options.empresas.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {/* Filtro Cargo */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <FontAwesomeIcon icon={faBriefcase} /> Cargo
                            </label>
                            <select 
                                value={filters.cargo || ''}
                                onChange={(e) => onFilterChange('cargo', e.target.value)}
                                className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
                            >
                                <option value="">Todos os Cargos</option>
                                {options.cargos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {/* Filtro Empreendimento */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                                <FontAwesomeIcon icon={faMapMarkedAlt} /> Empreendimento
                            </label>
                            <select 
                                value={filters.empreendimento || ''}
                                onChange={(e) => onFilterChange('empreendimento', e.target.value)}
                                className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
                            >
                                <option value="">Todos os Empreendimentos</option>
                                {options.empreendimentos.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* LISTA DE FUNCIONÁRIOS (Filtrada) */}
            {(filteredEmployees.length === 0 && employees.length > 0) ? (
                <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-gray-100">
                    <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-4xl mb-3" />
                    <p className="text-gray-500">Nenhum funcionário encontrado com os filtros atuais.</p>
                    <button onClick={clearFilters} className="mt-2 text-blue-600 hover:underline text-sm">Limpar todos os filtros</button>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                    <EmployeeList 
                        initialEmployees={filteredEmployees} 
                        onEditFuncionario={onEditFuncionario} // Passa a função para a lista
                    />
                </div>
            )}
            
            <div className="text-right text-xs text-gray-400 px-2">
                Exibindo {filteredEmployees.length} de {employees.length} colaboradores
            </div>
        </div>
    );
}
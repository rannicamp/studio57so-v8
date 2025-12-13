"use client";

import { useMemo } from 'react'; // Importante para performance
import { createClient } from '../../utils/supabase/client';
import EmployeeList from '../EmployeeList';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faInbox } from '@fortawesome/free-solid-svg-icons';

const fetchEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    
    const supabase = createClient();
    const { data: employeesData, error } = await supabase
        .from('funcionarios')
        .select(`
            *,
            cadastro_empresa ( razao_social ),
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

// Recebendo a prop searchTerm
export default function GerenciamentoFuncionarios({ searchTerm = '' }) {
    const { organizacao_id } = useAuth();

    const { data: employees = [], isLoading: loadingData, isError, error } = useQuery({
        queryKey: ['funcionarios', organizacao_id],
        queryFn: () => fetchEmployees(organizacao_id),
        enabled: !!organizacao_id,
        staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    });
    
    // FILTRAGEM AUTOMÁTICA (PADRÃO OURO)
    const filteredEmployees = useMemo(() => {
        if (!searchTerm) return employees;
        const lowerTerm = searchTerm.toLowerCase();
        
        return employees.filter(emp => 
            emp.full_name?.toLowerCase().includes(lowerTerm) ||
            emp.contract_role?.toLowerCase().includes(lowerTerm) ||
            emp.cpf?.includes(lowerTerm)
        );
    }, [employees, searchTerm]);

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

    if (filteredEmployees.length === 0 && employees.length > 0) {
        return (
            <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-gray-100">
                <FontAwesomeIcon icon={faInbox} className="text-gray-300 text-4xl mb-3" />
                <p className="text-gray-500">Nenhum funcionário encontrado para "{searchTerm}".</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                <EmployeeList initialEmployees={filteredEmployees} />
            </div>
            <div className="text-right text-xs text-gray-400 px-2">
                Total: {filteredEmployees.length} colaboradores
            </div>
        </div>
    );
}
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';
import EmployeeList from '../EmployeeList';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// O PORQUÊ: A função de busca agora é isolada e segura, recebendo a organizacao_id.
const fetchEmployees = async (organizacao_id) => {
    if (!organizacao_id) return [];
    
    const supabase = createClient();
    // BLINDADO: Adicionado o filtro .eq('organizacao_id', organizacao_id)
    const { data: employeesData, error } = await supabase
        .from('funcionarios')
        .select(`
            *,
            cadastro_empresa ( razao_social ),
            empreendimentos ( id, nome ),
            documentos_funcionarios ( id, nome_documento, caminho_arquivo, tipo:tipo_documento_id(sigla) )
        `)
        .eq('organizacao_id', organizacao_id) // <-- Filtro de segurança
        .order('full_name');

    if (error) {
        console.error('Erro ao buscar funcionários:', error);
        throw new Error(error.message);
    }

    // A lógica para obter URLs assinadas para as fotos permanece a mesma
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

export default function GerenciamentoFuncionarios() {
    const { hasPermission, organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const canCreate = hasPermission('funcionarios', 'pode_criar');
    
    // PADRÃO OURO: Substituímos o useEffect e useState por um único useQuery.
    const { data: employees = [], isLoading: loadingData, isError, error } = useQuery({
        // O PORQUÊ: A chave da query agora inclui a 'organizacao_id' para cachear
        // os dados de forma segura para cada organização.
        queryKey: ['funcionarios', organizacao_id],
        queryFn: () => fetchEmployees(organizacao_id),
        enabled: !!organizacao_id, // A query só é executada se a organização existir.
    });
    
    if (loadingData) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
    }

    if (isError) {
        return <div className="text-center p-4 text-red-500">Erro ao carregar funcionários: {error.message}</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <p className="text-gray-600">Gerencie os dados, documentos e o histórico de todos os funcionários.</p>
                {canCreate && (
                    <Link href="/funcionarios/cadastro" className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600">
                        + Novo Funcionário
                    </Link>
                )}
            </div>
        
            <div className="bg-white rounded-lg shadow">
                <EmployeeList initialEmployees={employees} />
            </div>
        </div>
    );
}
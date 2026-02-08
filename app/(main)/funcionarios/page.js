// app/(main)/funcionarios/page.js
"use client";

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import EmployeeList from '../../../components/rh/EmployeeList';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

export default function GerenciamentoFuncionariosPage() {
    // CORREÇÃO: createClient SÍNCRONO (Correto para Client Component)
    const supabase = createClient();
    const router = useRouter();
    
    const { hasPermission, loading: authLoading } = useAuth();
    
    const [employees, setEmployees] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    const canView = hasPermission('funcionarios', 'pode_ver');
    const canCreate = hasPermission('funcionarios', 'pode_criar');
    
    // Função de busca extraída para evitar problemas de dependência no useEffect
    const fetchEmployees = useCallback(async () => {
        if (!canView) return;
        
        setLoadingData(true);
        const { data: employeesData, error } = await supabase
            .from('funcionarios')
            .select(`
                *,
                cadastro_empresa ( razao_social ),
                empreendimentos ( id, nome ),
                documentos_funcionarios ( id, nome_documento, caminho_arquivo, tipo:tipo_documento_id(sigla) )
            `)
            .order('full_name');

        if (error) {
            console.error('Erro ao buscar funcionários:', error);
            setEmployees([]);
        } else {
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
            setEmployees(employeesWithPhotoUrl);
        }
        setLoadingData(false);
    }, [canView, supabase]);

    useEffect(() => {
        if (authLoading) return;

        if (!canView) {
            router.push('/');
            return;
        }

        fetchEmployees();

    }, [canView, authLoading, router, fetchEmployees]);
    
    if (authLoading || (canView && loadingData)) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p className="mt-2">Carregando...</p>
            </div>
        );
    }
    
    if (!canView) {
         return (
             <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
                <FontAwesomeIcon icon={faLock} size="3x" className="text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-red-700">Acesso Negado</h2>
                <p className="mt-2 text-red-600">Você não tem permissão para visualizar esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Funcionários</h1>
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
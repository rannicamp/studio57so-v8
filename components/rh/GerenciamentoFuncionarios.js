// components/rh/GerenciamentoFuncionarios.js
"use client";

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';
import EmployeeList from '../EmployeeList';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function GerenciamentoFuncionarios() {
    const supabase = createClient();
    const { hasPermission } = useAuth();
    
    const [employees, setEmployees] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    const canCreate = hasPermission('funcionarios', 'pode_criar');
    
    const fetchEmployees = useCallback(async () => {
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
    }, [supabase]);
    
    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);
    
    if (loadingData) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
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
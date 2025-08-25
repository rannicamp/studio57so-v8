"use client"; // Necessário para usar hooks

import { useEffect, useState } from 'react';
import { createClient } from '../../../utils/supabase/client';
import Link from 'next/link';
import EmployeeList from '../../../components/EmployeeList';
import { useAuth } from '../../../contexts/AuthContext'; // Importa o hook de autenticação
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLock } from '@fortawesome/free-solid-svg-icons';

export default function GerenciamentoFuncionariosPage() {
    const supabase = createClient();
    const router = useRouter();
    
    // Usa o hook central para obter permissões e estado de carregamento
    const { hasPermission, loading: authLoading } = useAuth();
    
    const [employees, setEmployees] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Permissões agora são lidas diretamente do contexto
    const canView = hasPermission('funcionarios', 'pode_ver');
    const canCreate = hasPermission('funcionarios', 'pode_criar');
    
    useEffect(() => {
        // Se o contexto de autenticação ainda está carregando, não faz nada
        if (authLoading) {
            return;
        }

        // Se o usuário não pode ver a página, redireciona
        if (!canView) {
            router.push('/');
            return;
        }

        // Se pode ver, busca os dados dos funcionários
        const fetchEmployees = async () => {
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
                // Gera as URLs assinadas para as fotos
                const employeesWithPhotoUrl = await Promise.all(
                    (employeesData || []).map(async (employee) => {
                        if (employee.foto_url) {
                            const { data, error: urlError } = await supabase.storage
                                .from('funcionarios-documentos')
                                .createSignedUrl(employee.foto_url, 3600); // URL válida por 1 hora
                            
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
        };

        fetchEmployees();

    }, [canView, authLoading, router, supabase]);
    
    // Tela de carregamento
    if (authLoading || loadingData) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                <p className="mt-2">Carregando...</p>
            </div>
        );
    }
    
    // Tela de acesso negado
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
                {/* O botão de "Novo Funcionário" só aparece se o usuário tiver permissão para criar */}
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
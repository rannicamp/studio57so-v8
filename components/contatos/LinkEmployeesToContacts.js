//components/contatos/LinkEmployeesToContacts.js
"use client";

import { useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLink, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// 1. Lógica de busca de dados isolada em uma função async
const fetchUnlinkedData = async (supabase, organizacaoId) => {
    if (!organizacaoId) return { employees: [], matches: {} };

    // Busca funcionários sem contato_id na organização correta
    const { data: employees, error: empError } = await supabase
        .from('funcionarios')
        .select('id, full_name, cpf, phone')
        .eq('organizacao_id', organizacaoId)
        .is('contato_id', null);

    if (empError) throw new Error(empError.message);

    const validEmployees = employees.filter(e => e.cpf || e.full_name || e.phone);
    
    // Busca as sugestões para cada funcionário
    const matches = {};
    for (const emp of validEmployees) {
        const { data, error } = await supabase.rpc('sugerir_vinculo_funcionario_contato', {
            p_cpf: emp.cpf,
            p_nome: emp.full_name,
            p_telefone: emp.phone,
            p_organizacao_id: organizacaoId
        });

        if (!error && data) {
            // Ordena para priorizar match por CPF
            data.sort((a, b) => {
                if (a.motivo.includes('CPF')) return -1;
                if (b.motivo.includes('CPF')) return 1;
                return 0;
            });
            matches[emp.id] = data;
        }
    }

    return { employees: validEmployees, matches };
};

// 2. Lógica da mutação (vincular) isolada
const linkEmployeeToContact = async (supabase, { employeeId, contactId }) => {
    const { error } = await supabase
        .from('funcionarios')
        .update({ contato_id: contactId })
        .eq('id', employeeId)
        .throwOnError();
    
    return { employeeId, contactId };
};


export default function LinkEmployeesToContacts() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // 3. useQuery para buscar e gerenciar os dados
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['unlinkedEmployees', organizacaoId],
        queryFn: () => fetchUnlinkedData(supabase, organizacaoId),
        enabled: !!organizacaoId, // A query só roda se o organizacaoId existir
    });

    const unlinkedEmployees = useMemo(() => data?.employees || [], [data]);
    const potentialMatches = useMemo(() => data?.matches || {}, [data]);

    // 4. useMutation para executar a ação de vincular
    const linkMutation = useMutation({
        mutationFn: (variables) => linkEmployeeToContact(supabase, variables),
        onSuccess: () => {
            toast.success('Funcionário vinculado com sucesso!');
            // Invalida a query para forçar a re-busca e atualizar a lista automaticamente
            queryClient.invalidateQueries({ queryKey: ['unlinkedEmployees', organizacaoId] });
        },
        onError: (err) => {
            toast.error(`Erro ao vincular: ${err.message}`);
        },
    });

    const handleLink = (employeeId, contactId) => {
        linkMutation.mutate({ employeeId, contactId });
    };

    if (isLoading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
                <p className="mt-4 text-lg">Buscando funcionários sem vínculo...</p>
            </div>
        );
    }
    
    if (isError) {
        return <div className="text-center p-10 bg-red-100 text-red-700 rounded-lg">Erro ao buscar dados: {error.message}</div>
    }

    return (
        <div className="space-y-6">
            <p className="text-sm text-gray-600 bg-gray-50 p-4 border rounded-lg">
                Esta ferramenta busca por funcionários que ainda não estão conectados a um registro de &quot;Contato&quot; no sistema. A correspondência é sugerida por <strong>CPF</strong>, <strong>Nome</strong> ou <strong>Telefone</strong>. Clique em &quot;Vincular&quot; para criar a ponte entre os dois cadastros.
            </p>

            {unlinkedEmployees.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-lg shadow">
                    <h2 className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faCheckCircle} />
                        Nenhum funcionário sem vínculo encontrado!
                    </h2>
                    <p className="mt-2 text-gray-600">Todos os seus funcionários já estão conectados a um contato.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {unlinkedEmployees.map(employee => (
                        <div key={employee.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            {/* Coluna do Funcionário */}
                            <div className="w-full md:w-1/3">
                                <h3 className="font-bold text-gray-800">{employee.full_name}</h3>
                                {employee.cpf && <p className="text-sm text-gray-500">CPF: {employee.cpf}</p>}
                                {employee.phone && <p className="text-sm text-gray-500">Tel: {employee.phone}</p>}
                            </div>

                            {/* Coluna das Sugestões */}
                            <div className="w-full md:w-2/3">
                                {potentialMatches[employee.id] && potentialMatches[employee.id].length > 0 ? (
                                    <div className="space-y-2">
                                        {potentialMatches[employee.id].map(match => (
                                            <div key={match.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border">
                                                <div>
                                                    <p className="font-semibold text-gray-800">{match.nome_exibicao}</p>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${match.motivo.includes('CPF') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        Match por {match.motivo}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleLink(employee.id, match.id)}
                                                    disabled={linkMutation.isPending && linkMutation.variables?.employeeId === employee.id}
                                                    className="bg-blue-600 text-white px-4 py-1 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                                                >
                                                    {(linkMutation.isPending && linkMutation.variables?.employeeId === employee.id) ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
                                                    Vincular
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-red-50 p-3 rounded-md border border-red-200 text-center">
                                        <p className="font-semibold text-red-800">
                                            <FontAwesomeIcon icon={faTimesCircle} className="mr-2" />
                                            Nenhum contato correspondente encontrado.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
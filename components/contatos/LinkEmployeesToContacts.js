//components\contatos\LinkEmployeesToContacts.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLink, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function LinkEmployeesToContacts() {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    const [unlinkedEmployees, setUnlinkedEmployees] = useState([]);
    const [potentialMatches, setPotentialMatches] = useState({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    
    const fetchData = useCallback(async () => {
        if (!organizacaoId) { // Só executa se tiver a organização
            setLoading(false);
            return;
        }
        setLoading(true);

        // =================================================================================
        // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
        // O PORQUÊ: A busca por funcionários agora é filtrada pela `organizacao_id`,
        // garantindo que estamos trabalhando apenas com os funcionários da empresa correta.
        // =================================================================================
        const { data: employees, error: empError } = await supabase
            .from('funcionarios')
            .select('id, full_name, cpf, phone')
            .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
            .is('contato_id', null);

        if (empError) {
            toast.error(`Erro ao buscar funcionários: ${empError.message}`);
            setLoading(false);
            return;
        }

        const validEmployees = employees.filter(e => e.cpf || e.full_name || e.phone);
        setUnlinkedEmployees(validEmployees);
        
        if (validEmployees.length > 0) {
            const matches = {};
            for (const emp of validEmployees) {
                // =================================================================================
                // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
                // O PORQUÊ: Passamos o `organizacaoId` para a função do banco de dados.
                // Isso garante que a busca por contatos correspondentes também seja
                // restrita à organização correta.
                // =================================================================================
                const { data, error } = await supabase.rpc('sugerir_vinculo_funcionario_contato', {
                    p_cpf: emp.cpf,
                    p_nome: emp.full_name,
                    p_telefone: emp.phone,
                    p_organizacao_id: organizacaoId // <-- "Chave mestra" de segurança
                });

                if (!error && data) {
                    data.sort((a, b) => {
                        if (a.motivo.includes('CPF')) return -1;
                        if (b.motivo.includes('CPF')) return 1;
                        return 0;
                    });
                    matches[emp.id] = data;
                }
            }
            setPotentialMatches(matches);
        }
        
        setLoading(false);
    }, [supabase, organizacaoId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // =================================================================================
    // ATUALIZAÇÃO DE UX (toast.promise)
    // O PORQUÊ: A lógica de vincular agora usa `toast.promise` para um feedback
    // claro e automático de "carregando", "sucesso" e "erro".
    // =================================================================================
    const handleLink = async (employeeId, contactId) => {
        setProcessingId(employeeId);

        const promise = supabase
            .from('funcionarios')
            .update({ contato_id: contactId })
            .eq('id', employeeId)
            .throwOnError();

        toast.promise(promise, {
            loading: `Vinculando funcionário ID ${employeeId}...`,
            success: () => {
                fetchData(); // Recarrega os dados para atualizar a lista
                return 'Funcionário vinculado com sucesso!';
            },
            error: (err) => `Erro ao vincular: ${err.message}`,
            finally: () => setProcessingId(null),
        });
    };

    if (loading) {
        return (
            <div className="text-center p-10">
                <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-gray-400" />
                <p className="mt-4 text-lg">Buscando funcionários sem vínculo...</p>
            </div>
        );
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
                                                    disabled={processingId === employee.id}
                                                    className="bg-blue-600 text-white px-4 py-1 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                                                >
                                                    {processingId === employee.id ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faLink} />}
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
"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLink, faCheckCircle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';

export default function LinkEmployeesToContacts() {
    const supabase = createClient();
    const [unlinkedEmployees, setUnlinkedEmployees] = useState([]);
    const [potentialMatches, setPotentialMatches] = useState({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [message, setMessage] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setMessage('');

        // 1. Busca funcionários que ainda não têm um `contato_id`
        const { data: employees, error: empError } = await supabase
            .from('funcionarios')
            .select('id, full_name, cpf, phone')
            .is('contato_id', null);

        if (empError) {
            setMessage(`Erro ao buscar funcionários: ${empError.message}`);
            setLoading(false);
            return;
        }

        const validEmployees = employees.filter(e => e.cpf || e.full_name || e.phone);
        setUnlinkedEmployees(validEmployees);
        
        // 2. Para cada funcionário, chama a função inteligente que criamos no banco de dados
        if (validEmployees.length > 0) {
            const matches = {};
            for (const emp of validEmployees) {
                const { data, error } = await supabase.rpc('sugerir_vinculo_funcionario_contato', {
                    p_cpf: emp.cpf,
                    p_nome: emp.full_name,
                    p_telefone: emp.phone
                });

                if (!error && data) {
                    // Ordena os resultados para dar prioridade ao CPF
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
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleLink = async (employeeId, contactId) => {
        setProcessingId(employeeId);
        setMessage(`Vinculando funcionário ID ${employeeId}...`);

        const { error } = await supabase
            .from('funcionarios')
            .update({ contato_id: contactId })
            .eq('id', employeeId);

        if (error) {
            setMessage(`Erro ao vincular: ${error.message}`);
        } else {
            setMessage('Funcionário vinculado com sucesso!');
            fetchData(); // Recarrega os dados para atualizar a lista
        }
        setProcessingId(null);
        setTimeout(() => setMessage(''), 4000);
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
                Esta ferramenta busca por funcionários que ainda não estão conectados a um registro de "Contato" no sistema. A correspondência é sugerida por <strong>CPF</strong>, <strong>Nome</strong> ou <strong>Telefone</strong>. Clique em "Vincular" para criar a ponte entre os dois cadastros.
            </p>
            {message && <div className={`p-3 text-center rounded-md font-semibold ${message.includes('Erro') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</div>}

            {unlinkedEmployees.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-lg shadow">
                    <h2 className="text-2xl font-bold text-green-600">Nenhum funcionário sem vínculo encontrado!</h2>
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
// components/FeedbackList.js

"use client";

import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function FeedbackList() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { userData } = useAuth();

    const statusOptions = ['Aberto', 'Em Análise', 'Resolvido', 'Ignorado'];
    const statusColors = {
        'Aberto': 'bg-blue-100 text-blue-800',
        'Em Análise': 'bg-yellow-100 text-yellow-800',
        'Resolvido': 'bg-green-100 text-green-800',
        'Ignorado': 'bg-gray-100 text-gray-800'
    };

    const { data: feedbacks = [], isLoading, isError } = useQuery({
        queryKey: ['feedbacks', userData?.organizacao_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('feedback')
                .select('*, usuario:usuarios(nome)')
                .eq('organizacao_id', userData.organizacao_id)
                .order('created_at', { ascending: false });
            if (error) throw new Error(error.message);
            return data;
        },
        enabled: !!userData?.organizacao_id,
    });

    const { mutate: updateStatus, isPending: isUpdating, variables: updateVariables } = useMutation({
        mutationFn: async ({ id, newStatus }) => {
            const { error } = await supabase
                .from('feedback')
                .update({ status: newStatus })
                .eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            toast.success('Status atualizado!');
            queryClient.invalidateQueries({ queryKey: ['feedbacks'] });
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleStatusChange = (id, newStatus) => {
        updateStatus({ id, newStatus });
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-4 text-lg text-gray-600">Carregando feedbacks...</span>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex justify-center items-center p-8 bg-red-50 border border-red-200 rounded-md">
                <FontAwesomeIcon icon={faExclamationTriangle} size="2x" className="text-red-500" />
                <span className="ml-4 text-lg text-red-700">Ocorreu um erro ao buscar os feedbacks.</span>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Página</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">Descrição</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {feedbacks.map(item => (
                        <tr key={item.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{formatDate(item.created_at)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{item.usuario?.nome || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{item.pagina || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-800" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.descricao}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {isUpdating && updateVariables?.id === item.id ? (
                                    <FontAwesomeIcon icon={faSpinner} spin />
                                ) : (
                                    <select
                                        value={item.status}
                                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                        className={`p-1.5 border-0 rounded-md text-xs focus:ring-2 focus:ring-blue-500 ${statusColors[item.status] || ''}`}
                                    >
                                        {statusOptions.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                )}
                            </td>
                        </tr>
                    ))}
                     {feedbacks.length === 0 && (
                        <tr>
                            <td colSpan="5" className="text-center py-10 text-gray-500">Nenhum feedback recebido ainda.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// --------------------------------------------------------------------------------
// RESUMO DO ARQUIVO
// --------------------------------------------------------------------------------
// Este componente exibe uma lista de feedbacks enviados pelos usuários da
// organização. Ele foi refatorado para buscar os dados dinamicamente com `useQuery`,
// garantindo que a lista esteja sempre atualizada. A funcionalidade de alterar
// o status de um feedback agora utiliza `useMutation`, o que simplifica o código,
// melhora a experiência do usuário com feedback visual e atualiza a UI
// automaticamente após a alteração ser concluída no banco de dados.
// --------------------------------------------------------------------------------
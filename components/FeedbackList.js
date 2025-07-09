"use client";

import { useState } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function FeedbackList({ initialFeedbacks }) {
    const supabase = createClient();
    const [feedbacks, setFeedbacks] = useState(initialFeedbacks);
    const [loadingId, setLoadingId] = useState(null);

    const statusOptions = ['Aberto', 'Em Análise', 'Resolvido', 'Ignorado'];
    const statusColors = {
        'Aberto': 'bg-blue-100 text-blue-800',
        'Em Análise': 'bg-yellow-100 text-yellow-800',
        'Resolvido': 'bg-green-100 text-green-800',
        'Ignorado': 'bg-gray-100 text-gray-800'
    };

    const handleStatusChange = async (id, newStatus) => {
        setLoadingId(id);
        const { data, error } = await supabase
            .from('feedback')
            .update({ status: newStatus })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            alert('Erro ao atualizar o status: ' + error.message);
        } else {
            setFeedbacks(prev => prev.map(f => (f.id === id ? { ...f, status: newStatus } : f)));
        }
        setLoadingId(null);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

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
                                {loadingId === item.id ? (
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
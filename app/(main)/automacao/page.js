// app/(main)/automacao/page.js
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faToggleOn, faToggleOff, faTrash, faPen, faRobot } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função para buscar as automações existentes
const fetchAutomations = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('automacoes')
        .select('*')
        .eq('organizacao_id', organizacaoId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
};

export default function AutomacaoPage() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAutomation, setSelectedAutomation] = useState(null);

    const { data: automations = [], isLoading, isError, error } = useQuery({
        queryKey: ['automations', organizacaoId],
        queryFn: () => fetchAutomations(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });

    // Lógica para deletar e ativar/desativar (será usada pelo modal que criaremos depois)
    const mutationOptions = {
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
            toast.success("Operação realizada com sucesso!");
        },
        onError: (err) => toast.error(err.message),
    };

    const deleteAutomationMutation = useMutation({
        mutationFn: async (id) => { /* Lógica de exclusão virá aqui */ },
        ...mutationOptions
    });

    const toggleAutomationMutation = useMutation({
        mutationFn: async ({ id, newStatus }) => { /* Lógica de ativar/desativar virá aqui */ },
        ...mutationOptions
    });

    const handleOpenModal = (automation = null) => {
        setSelectedAutomation(automation);
        setIsModalOpen(true);
        toast.info("A tela para criar/editar automações será implementada no próximo passo!");
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (isError) {
        return <div className="p-4 text-red-500">Erro ao carregar automações: {error.message}</div>;
    }

    return (
        <div className="p-6 bg-gray-100 h-full">
            {/* Modal (será criado no próximo passo) */}
            {/* {isModalOpen && <AutomacaoModal onClose={() => setIsModalOpen(false)} automation={selectedAutomation} />} */}

            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <FontAwesomeIcon icon={faRobot} />
                    Central de Automação
                </h1>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Criar Nova Automação
                </button>
            </header>

            <div className="bg-white rounded-lg shadow-md">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome da Automação</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {automations.length === 0 ? (
                                <tr>
                                    {/* ##### CORREÇÃO APLICADA AQUI ##### */}
                                    {/* As aspas duplas internas foram trocadas por aspas simples */}
                                    <td colSpan="3" className="px-6 py-12 text-center text-sm text-gray-500">
                                        Nenhuma automação criada ainda. Clique em 'Criar Nova Automação' para começar.
                                    </td>
                                </tr>
                            ) : (
                                automations.map((automation) => (
                                    <tr key={automation.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{automation.nome}</div>
                                            <div className="text-xs text-gray-500">Gatilho: {automation.gatilho_tipo}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={() => { /* Lógica de toggle virá aqui */ }}>
                                                <FontAwesomeIcon
                                                    icon={automation.ativo ? faToggleOn : faToggleOff}
                                                    className={`text-2xl ${automation.ativo ? 'text-green-500' : 'text-gray-400'}`}
                                                />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => handleOpenModal(automation)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                                <FontAwesomeIcon icon={faPen} className="mr-1"/> Editar
                                            </button>
                                            <button onClick={() => { /* Lógica de exclusão virá aqui */ }} className="text-red-600 hover:text-red-900">
                                                <FontAwesomeIcon icon={faTrash} className="mr-1"/> Excluir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
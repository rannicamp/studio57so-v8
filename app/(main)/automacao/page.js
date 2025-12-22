// app/(main)/automacao/page.js
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faToggleOn, faToggleOff, faTrash, faPen, faRobot } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import AutomacaoModal from '@/components/crm/AutomacaoModal';

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
    // CORREÇÃO: Removido 'await' (Componente de Cliente)
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

    const mutationOptions = {
        onSuccess: (message) => {
            queryClient.invalidateQueries({ queryKey: ['automations', organizacaoId] });
            toast.success(message || "Operação realizada com sucesso!");
            setIsModalOpen(false);
        },
        onError: (err) => toast.error(err.message),
    };

    const saveAutomationMutation = useMutation({
        mutationFn: async (automationData) => {
            const { error } = await supabase.from('automacoes').upsert(automationData).select();
            if (error) throw error;
            return automationData.id ? "Automação atualizada!" : "Automação criada!";
        },
        ...mutationOptions
    });

    const deleteAutomationMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('automacoes').delete().eq('id', id);
            if (error) throw error;
            return "Automação excluída!";
        },
        ...mutationOptions
    });

    const toggleAutomationMutation = useMutation({
        mutationFn: async ({ id, newStatus }) => {
            const { error } = await supabase.from('automacoes').update({ ativo: newStatus }).eq('id', id);
            if (error) throw error;
            return `Automação ${newStatus ? 'ativada' : 'desativada'}!`;
        },
        ...mutationOptions
    });

    const handleOpenModal = (automation = null) => {
        setSelectedAutomation(automation);
        setIsModalOpen(true);
    };

    const handleDelete = (automation) => {
        toast("Confirmar Exclusão", {
            description: `Tem certeza que deseja excluir a automação "${automation.nome}"?`,
            action: {
                label: "Excluir",
                onClick: () => deleteAutomationMutation.mutate(automation.id),
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (isError) {
        return <div className="p-4 text-red-500">Erro ao carregar automações: {error.message}</div>;
    }

    return (
        <div className="p-6 bg-gray-100 h-full">
            {isModalOpen && (
                <AutomacaoModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={(data) => saveAutomationMutation.mutate(data)}
                    automation={selectedAutomation}
                    supabase={supabase}
                    organizacaoId={organizacaoId}
                />
            )}

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
                                    <td colSpan="3" className="px-6 py-12 text-center text-sm text-gray-500">
                                        {"Nenhuma automação criada ainda. Clique em 'Criar Nova Automação' para começar."}
                                    </td>
                                </tr>
                            ) : (
                                automations.map((automation) => (
                                    <tr key={automation.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{automation.nome}</div>
                                            <div className="text-xs text-gray-500">Gatilho: Mover para coluna</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button onClick={() => toggleAutomationMutation.mutate({ id: automation.id, newStatus: !automation.ativo })}>
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
                                            <button onClick={() => handleDelete(automation)} className="text-red-600 hover:text-red-900">
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
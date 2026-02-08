// components/painel/ConstrutorKpiManager.js
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import ConstrutorKpiForm from './ConstrutorKpiForm';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEdit, faTrash, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const fetchKpis = async (organizacao_id) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
};

const ConstrutorKpiManager = () => {
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingKpi, setEditingKpi] = useState(null);

    const { data: kpis, isLoading, isError, error } = useQuery({
        queryKey: ['kpisPersonalizados', organizacao_id],
        queryFn: () => fetchKpis(organizacao_id),
        enabled: !!organizacao_id,
    });

    const deleteKpiMutation = useMutation({
        mutationFn: async (kpiId) => {
            const supabase = createClient();
            const { error } = await supabase
                .from('kpis_personalizados')
                .delete()
                .eq('id', kpiId)
                .eq('organizacao_id', organizacao_id);

            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['kpisPersonalizados', organizacao_id] });
            // =================================================================================
            // INÍCIO DA CORREÇÃO
            // O PORQUÊ: Assim como ao salvar, ao DELETAR um KPI, também precisamos
            // invalidar o cache dos valores para que o painel seja atualizado.
            // =================================================================================
            queryClient.invalidateQueries({ queryKey: ['customKpiValue'] });
            // =================================================================================
            // FIM DA CORREÇÃO
            // =================================================================================
        },
    });

    const handleDelete = (kpi) => {
        toast.warning(`Tem certeza que deseja excluir o KPI "${kpi.titulo}"?`, {
            action: {
                label: 'Excluir',
                onClick: () => {
                    toast.promise(deleteKpiMutation.mutateAsync(kpi.id), {
                        loading: 'Excluindo KPI...',
                        success: 'KPI excluído com sucesso!',
                        error: (err) => `Erro ao excluir: ${err.message}`,
                    });
                },
            },
            cancel: {
                label: 'Cancelar',
            },
        });
    };

    const handleEdit = (kpi) => {
        setEditingKpi(kpi);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingKpi(null);
        setIsModalOpen(true);
    };

    if (isLoading) return <div className="text-center p-4"><FontAwesomeIcon icon={faSpinner} spin /> Carregando KPIs...</div>;
    if (isError) return <div className="text-center p-4 bg-red-100 text-red-700 rounded"><FontAwesomeIcon icon={faExclamationTriangle} /> Erro ao carregar KPIs: {error.message}</div>;

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            {isModalOpen && (
                <ConstrutorKpiForm 
                    kpiToEdit={editingKpi} 
                    onDone={() => {
                        setIsModalOpen(false);
                        // O onDone do formulário já invalida as queries necessárias,
                        // então não precisamos duplicar a invalidação aqui.
                    }} 
                />
            )}

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Gerenciar KPIs Personalizados</h2>
                <button onClick={handleAddNew} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPlus} /> Adicionar Novo KPI
                </button>
            </div>
            
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Título</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Módulo</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Tipo de Cálculo</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {kpis && kpis.length > 0 ? (
                            kpis.map(kpi => (
                                <tr key={kpi.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap font-semibold">{kpi.titulo}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{kpi.modulo}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{kpi.tipo_calculo}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                        <button onClick={() => handleEdit(kpi)} className="text-blue-600 hover:text-blue-800 mr-4" title="Editar">
                                            <FontAwesomeIcon icon={faEdit} />
                                        </button>
                                        <button onClick={() => handleDelete(kpi)} className="text-red-500 hover:text-red-700" title="Excluir">
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className="text-center py-10 text-gray-500">
                                    Nenhum KPI personalizado encontrado.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ConstrutorKpiManager;
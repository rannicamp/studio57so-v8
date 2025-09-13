"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faChartPie, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import ConstrutorKpiForm from './ConstrutorKpiForm';

// O PORQUÊ: A função agora busca os KPIs pela 'organizacao_id',
// garantindo que todos os membros da equipe vejam os mesmos indicadores.
const fetchKpis = async (organizacao_id) => {
    if (!organizacao_id) return [];
    const supabase = createClient();
    const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', organizacao_id)
        .order('grupo')
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
};

const ToggleSwitch = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
);

export default function ConstrutorKpiManager() {
    const [activeTab, setActiveTab] = useState('list');
    const [kpiToEdit, setKpiToEdit] = useState(null);
    const queryClient = useQueryClient();
    const { user, organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const { data: kpis, isLoading, isError, error } = useQuery({
        // O PORQUÊ: Adicionamos 'organizacao_id' para garantir que os dados sejam
        // buscados e cacheados por organização.
        queryKey: ['kpisPersonalizados', organizacao_id],
        queryFn: () => fetchKpis(organizacao_id),
        enabled: !!organizacao_id,
    });

    const mutationOptions = {
        onSuccess: (message) => {
            toast.success(message);
            queryClient.invalidateQueries({ queryKey: ['kpisPersonalizados', organizacao_id] });
            queryClient.invalidateQueries({ queryKey: ['customKpiDefinitions', organizacao_id] }); // Também invalidamos por organização
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    };

    const deleteMutation = useMutation({
        mutationFn: async (kpiId) => {
            if (!organizacao_id) throw new Error("Organização não encontrada.");
            const supabase = createClient();
            // BLINDADO: Adicionamos a verificação de 'organizacao_id' na exclusão.
            const { error } = await supabase.from('kpis_personalizados').delete()
                .eq('id', kpiId)
                .eq('organizacao_id', organizacao_id);
            if (error) throw new Error(error.message);
            return 'KPI excluído com sucesso!';
        },
        ...mutationOptions
    });

    const toggleVisibilityMutation = useMutation({
        mutationFn: async ({ kpiId, newValue }) => {
            if (!organizacao_id) throw new Error("Organização não encontrada.");
            const supabase = createClient();
            // BLINDADO: Adicionamos a verificação de 'organizacao_id' na atualização.
            const { error } = await supabase.from('kpis_personalizados').update({ exibir_no_painel: newValue })
                .eq('id', kpiId)
                .eq('organizacao_id', organizacao_id);
            if (error) throw new Error(error.message);
            return `Visibilidade do KPI atualizada!`;
        },
        ...mutationOptions
    });

    const handleAddNew = () => { setKpiToEdit(null); setActiveTab('form'); };
    const handleEdit = (kpi) => { setKpiToEdit(kpi); setActiveTab('form'); };
    
    // UX MELHORADA: Trocamos o window.confirm por um toast.
    const handleDelete = (kpiId) => {
        toast("Confirmar exclusão", {
            description: "Tem certeza que deseja excluir este KPI permanentemente?",
            action: {
                label: "Excluir",
                onClick: () => deleteMutation.mutate(kpiId)
            },
            cancel: { label: "Cancelar" },
            classNames: { actionButton: 'bg-red-600' }
        });
    };

    if (isLoading) return <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    if (isError) return <div className="text-center p-8 bg-red-50 text-red-700 rounded-lg"><FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />Erro ao carregar KPIs: {error.message}</div>;

    return (
        <div>
            <div className="mb-4 border-b">
                <nav className="flex space-x-4">
                    <button onClick={() => { setActiveTab('list'); setKpiToEdit(null); }} className={`py-2 px-4 font-semibold ${activeTab === 'list' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Meus KPIs</button>
                    <button onClick={handleAddNew} className={`py-2 px-4 font-semibold ${activeTab === 'form' && !kpiToEdit ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Construtor</button>
                </nav>
            </div>

            {activeTab === 'list' && (
                <div className="mt-4 bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-bold text-gray-700 mb-4">Meus KPIs Criados</h2>
                    {kpis && kpis.length > 0 ? (
                        <div className="space-y-4">
                            {kpis.map(kpi => (
                                <div key={kpi.id} className="p-4 border rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-800">{kpi.titulo}</h3>
                                        {kpi.grupo && <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full mr-2">{kpi.grupo}</span>}
                                        <p className="text-sm text-gray-500 mt-1">{kpi.descricao}</p>
                                    </div>
                                    <div className="flex items-center gap-4 self-end md:self-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-medium text-gray-600 mb-1">Exibir no Painel</span>
                                            <ToggleSwitch checked={kpi.exibir_no_painel} onChange={() => toggleVisibilityMutation.mutate({ kpiId: kpi.id, newValue: !kpi.exibir_no_painel })} />
                                        </div>
                                        <button onClick={() => handleEdit(kpi)} className="text-blue-600 hover:text-blue-800" title="Editar KPI"><FontAwesomeIcon icon={faPenToSquare} size="lg" /></button>
                                        <button onClick={() => handleDelete(kpi.id)} className="text-red-600 hover:text-red-800" title="Excluir KPI"><FontAwesomeIcon icon={faTrash} size="lg" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <FontAwesomeIcon icon={faChartPie} size="3x" className="text-gray-300 mb-4" />
                            <p className="text-gray-500">Você ainda não criou nenhum KPI personalizado.</p>
                            <p className="text-gray-400 text-sm">{`Vá para a aba "Construtor" para começar.`}</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'form' && (
                <ConstrutorKpiForm 
                    kpiToEdit={kpiToEdit} 
                    onDone={() => setActiveTab('list')}
                />
            )}
        </div>
    );
}
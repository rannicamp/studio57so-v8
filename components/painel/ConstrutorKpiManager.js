"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faExclamationTriangle, faChartPie } from '@fortawesome/free-solid-svg-icons';
import ConstrutorKpiForm from './ConstrutorKpiForm'; // Vamos criar este arquivo a seguir

// Função para buscar os KPIs do usuário logado
const fetchKpis = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
};

export default function ConstrutorKpiManager() {
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [editingKpi, setEditingKpi] = useState(null); // Para edição no futuro

    const queryClient = useQueryClient();

    const { data: kpis, isLoading, isError, error } = useQuery({
        queryKey: ['kpisPersonalizados'],
        queryFn: fetchKpis
    });

    const handleAddNew = () => {
        setEditingKpi(null);
        setIsFormVisible(true);
    };

    const handleCloseForm = () => {
        setIsFormVisible(false);
        setEditingKpi(null);
    };

    if (isLoading) {
        return <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;
    }

    if (isError) {
        return (
            <div className="text-center p-8 bg-red-50 text-red-700 rounded-lg">
                <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                Erro ao carregar KPIs: {error.message}
            </div>
        );
    }

    return (
        <div>
            {!isFormVisible && (
                <div className="mb-6">
                    <button
                        onClick={handleAddNew}
                        className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 flex items-center"
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Criar Novo KPI
                    </button>
                </div>
            )}

            {isFormVisible && (
                <ConstrutorKpiForm 
                    kpi={editingKpi} 
                    onClose={handleCloseForm} 
                />
            )}

            <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-700 mb-4">Meus KPIs Criados</h2>
                {kpis && kpis.length > 0 ? (
                    <div className="space-y-4">
                        {kpis.map(kpi => (
                            <div key={kpi.id} className="p-4 border rounded-lg flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-gray-800">{kpi.titulo}</h3>
                                    <p className="text-sm text-gray-500">{kpi.descricao}</p>
                                </div>
                                {/* Botões de Editar e Excluir virão aqui no futuro */}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <FontAwesomeIcon icon={faChartPie} size="3x" className="text-gray-300 mb-4" />
                        <p className="text-gray-500">Você ainda não criou nenhum KPI personalizado.</p>
                        <p className="text-gray-400 text-sm">Clique em "Criar Novo KPI" para começar.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
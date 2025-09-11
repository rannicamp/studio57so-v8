"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import CustomKpiCard from './CustomKpiCard';

// Função para buscar as DEFINIÇÕES de KPIs do usuário
const fetchKpiDefinitions = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
};

export default function CustomKpiSection() {
    const { data: kpis, isLoading, isError, error } = useQuery({
        queryKey: ['customKpiDefinitions'],
        queryFn: fetchKpiDefinitions,
    });

    if (isLoading) {
        return (
             <div className="text-center p-4"><FontAwesomeIcon icon={faSpinner} spin /> Carregando seus KPIs...</div>
        );
    }

    if (isError) {
        return <div className="text-red-500">Erro ao carregar KPIs: {error.message}</div>;
    }

    if (!kpis || kpis.length === 0) {
        return null; // Se não tiver KPIs, não mostra nada
    }

    return (
        <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">Meus Indicadores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <CustomKpiCard key={kpi.id} kpi={kpi} />
                ))}
            </div>
        </section>
    );
}
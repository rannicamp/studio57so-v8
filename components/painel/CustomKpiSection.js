"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import CustomKpiCard from './CustomKpiCard';
import { useMemo } from 'react';

// O PORQUÊ: A função agora busca os KPIs pela 'organizacao_id',
// garantindo que todos na mesma equipe vejam e compartilhem os mesmos KPIs.
const fetchVisibleKpiDefinitions = async (organizacao_id) => {
    if (!organizacao_id) return [];

    const supabase = createClient();
    
    const { data, error } = await supabase
        .from('kpis_personalizados')
        .select('*')
        .eq('organizacao_id', organizacao_id) // BLINDADO: Filtro de segurança principal
        .eq('exibir_no_painel', true)
        .order('grupo')
        .order('created_at', { ascending: true });
    
    if (error) throw new Error(error.message);
    return data;
};

export default function CustomKpiSection() {
    const { organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const { data: kpis, isLoading, isError, error } = useQuery({
        // O PORQUÊ: Adicionamos 'organizacao_id' à chave para cachear os dados por organização.
        queryKey: ['customKpiDefinitions', organizacao_id],
        queryFn: () => fetchVisibleKpiDefinitions(organizacao_id),
        enabled: !!organizacao_id, // A query só roda quando a organização está disponível.
    });

    const groupedKpis = useMemo(() => {
        if (!kpis) return {};
        return kpis.reduce((acc, kpi) => {
            const groupName = kpi.grupo || 'Geral';
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(kpi);
            return acc;
        }, {});
    }, [kpis]);

    if (isLoading) {
        return <div className="text-center p-4"><FontAwesomeIcon icon={faSpinner} spin /> Carregando seus KPIs...</div>;
    }
    if (isError) {
        return <div className="text-red-500">Erro ao carregar KPIs: {error.message}</div>;
    }
    if (!kpis || kpis.length === 0) {
        return null; // Não renderiza nada se não houver KPIs para mostrar.
    }

    return (
        <>
            {Object.entries(groupedKpis).map(([groupName, kpisInGroup]) => (
                <section key={groupName} className="mb-8">
                    <h2 className="text-2xl font-bold mb-4 text-gray-700">{groupName}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpisInGroup.map(kpi => (
                            <CustomKpiCard key={kpi.id} kpi={kpi} />
                        ))}
                    </div>
                </section>
            ))}
        </>
    );
}
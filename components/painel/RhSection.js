"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import KpiCard from '@/components/KpiCard';
import { faUsers, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

// Esta é a função que busca os dados no Supabase.
const fetchRhData = async () => {
    const supabase = createClient();

    // 1. Busca o número total de funcionários ativos
    const { count: totalAtivos, error: errorAtivos } = await supabase
        .from('funcionarios')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');

    if (errorAtivos) {
        throw new Error('Não foi possível buscar o total de funcionários.');
    }

    // 2. Busca os funcionários com pendências de ponto
    const { data: pendencias, error: errorPendencias } = await supabase.rpc('get_funcionarios_com_pendencias_ponto');

    if (errorPendencias) {
        throw new Error('Não foi possível buscar as pendências de ponto.');
    }

    // Retorna os dois resultados juntos
    return { totalAtivos: totalAtivos ?? 0, pendencias: pendencias ?? [] };
};

export default function RhSection() {
    const router = useRouter();

    // Aqui usamos o useQuery para buscar e gerenciar os dados
    const { data, isLoading, isError, error } = useQuery({
        // A MUDANÇA ESTÁ AQUI: de 'dashboard-rh-kpis' para 'painel-rh-kpis'
        queryKey: ['painel-rh-kpis'], 
        queryFn: fetchRhData,
    });

    const handlePendenciasClick = () => {
        router.push('/ponto');
    };
    
    // Se estiver carregando, mostramos uma mensagem simples.
    if (isLoading) {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Recursos Humanos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <p>Carregando KPIs de RH...</p>
                </div>
            </div>
        );
    }
    
    // Se der erro, mostramos o erro.
    if (isError) {
        return (
            <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Recursos Humanos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <p>Erro ao carregar dados: {error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">Recursos Humanos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Funcionários Ativos"
                    value={data?.totalAtivos}
                    icon={faUsers}
                    color="text-blue-500"
                />
                <KpiCard
                    title="Pendências de Ponto"
                    value={data?.pendencias.length}
                    icon={faExclamationTriangle}
                    color={data?.pendencias.length > 0 ? "text-yellow-500" : "text-green-500"}
                    onClick={handlePendenciasClick}
                    clickable={true}
                />
            </div>
        </section>
    );
}
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import KpiCard from '../KpiCard';
import { faUsers, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';

// O PORQUÊ: A função agora recebe 'organizacao_id' para garantir que os KPIs
// de RH sejam calculados apenas com os dados da organização correta.
const fetchRhData = async (organizacao_id) => {
    if (!organizacao_id) return { totalAtivos: 0, pendencias: [] };

    const supabase = createClient();

    // 1. BLINDADO: Busca o número total de funcionários ativos da organização.
    const { count: totalAtivos, error: errorAtivos } = await supabase
        .from('funcionarios')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('organizacao_id', organizacao_id); // <-- Filtro de segurança

    if (errorAtivos) {
        throw new Error('Não foi possível buscar o total de funcionários.');
    }

    // 2. BLINDADO: Busca os funcionários com pendências de ponto da organização.
    const { data: pendencias, error: errorPendencias } = await supabase.rpc('get_funcionarios_com_pendencias_ponto', {
        p_organizacao_id: organizacao_id // <-- Parâmetro de segurança
    });

    if (errorPendencias) {
        throw new Error('Não foi possível buscar as pendências de ponto.');
    }

    return { totalAtivos: totalAtivos ?? 0, pendencias: pendencias ?? [] };
};

export default function RhSection() {
    const router = useRouter();
    const { organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const { data, isLoading, isError, error } = useQuery({
        // O PORQUÊ: A chave da query agora inclui a 'organizacao_id' para cachear
        // os dados de forma segura para cada organização.
        queryKey: ['painel-rh-kpis', organizacao_id], 
        queryFn: () => fetchRhData(organizacao_id),
        enabled: !!organizacao_id, // A query só roda se a organização existir.
    });

    const handlePendenciasClick = () => {
        router.push('/ponto');
    };
    
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
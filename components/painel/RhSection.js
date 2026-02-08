// components/painel/RhSection.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import KpiCard from '@/components/shared/KpiCard';
import { 
    faUsers, 
    faExclamationTriangle, 
    faClock, 
    faHourglassHalf, 
    faCalendarCheck,
    faPlusCircle,
    faMinusCircle
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import { startOfMonth, endOfMonth } from 'date-fns';

// =================================================================================
// FUNÇÃO PARA BUSCAR DADOS GERAIS DE RH (COMPORTAMENTO ANTIGO)
// =================================================================================
const fetchGeneralRhData = async (organizacao_id) => {
    if (!organizacao_id) return { totalAtivos: 0, pendencias: [] };
    const supabase = createClient();

    const { count: totalAtivos, error: errorAtivos } = await supabase
        .from('funcionarios')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('organizacao_id', organizacao_id);
    if (errorAtivos) throw new Error('Não foi possível buscar o total de funcionários.');

    const { data: pendencias, error: errorPendencias } = await supabase.rpc('get_funcionarios_com_pendencias', { p_organizacao_id: organizacao_id });
    if (errorPendencias) throw new Error('Não foi possível buscar pendências de ponto.');
    
    return { totalAtivos, pendencias: pendencias || [] };
};

// =================================================================================
// FUNÇÃO PARA BUSCAR DADOS PESSOAIS DE PONTO (NOVO COMPORTAMENTO - ATUALIZADA)
// O PORQUÊ: Agora extraímos mais campos da resposta da função do Supabase
// para exibir um resumo mais completo, igual ao da Folha de Ponto.
// =================================================================================
const fetchPersonalRhData = async (employeeId) => {
    if (!employeeId) return null;
    const supabase = createClient();
    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);

    const { data, error } = await supabase.rpc('calculate_folha_ponto_mes', {
        p_employee_id: employeeId,
        p_start_date: inicioMes.toISOString().split('T')[0],
        p_end_date: fimMes.toISOString().split('T')[0]
    });

    if (error) {
        console.error("Erro ao buscar dados pessoais de RH:", error);
        throw new Error('Não foi possível calcular os dados de ponto.');
    }
    
    const result = data[0]; // Pegamos o primeiro (e único) resultado
    
    // Retornamos todos os KPIs que a Folha de Ponto também usa
    return {
        totalHorasTrabalhadas: result?.total_horas_trabalhadas || '00:00',
        saldoBancoHoras: result?.saldo_banco_horas_mes || '00:00',
        diasTrabalhados: result?.dias_trabalhados || 0,
        totalHorasExtras: result?.total_horas_extras_mes || '00:00', // NOVO KPI
        totalHorasDebito: result?.total_horas_debito_mes || '00:00'  // NOVO KPI
    };
};

export default function RhSection({ employeeId = null }) {
    const { organizacao_id } = useAuth();
    const router = useRouter();

    const { data: generalData, isLoading: isLoadingGeneral, isError: isErrorGeneral } = useQuery({
        queryKey: ['generalRhData', organizacao_id],
        queryFn: () => fetchGeneralRhData(organizacao_id),
        enabled: !employeeId && !!organizacao_id,
    });

    const { data: personalData, isLoading: isLoadingPersonal, isError: isErrorPersonal } = useQuery({
        queryKey: ['personalRhData', employeeId],
        queryFn: () => fetchPersonalRhData(employeeId),
        enabled: !!employeeId,
    });

    // MODO PESSOAL
    if (employeeId) {
        if (isLoadingPersonal) {
            return (
                <div className="bg-white p-6 rounded-lg shadow-md animate-pulse h-full">
                    <div className="h-6 bg-gray-300 rounded w-3/4 mb-4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="h-24 bg-gray-300 rounded-lg"></div>
                        <div className="h-24 bg-gray-300 rounded-lg"></div>
                        <div className="h-24 bg-gray-300 rounded-lg"></div>
                    </div>
                </div>
            );
        }

        if (isErrorPersonal) return <p>Erro ao carregar seus dados de ponto.</p>;

        // O PORQUÊ DA MUDANÇA: O layout agora tem mais cards e está mais espaçado,
        // mostrando todos os KPIs relevantes que vêm da Folha de Ponto.
        return (
            <section className="bg-white p-6 rounded-lg shadow-md h-full">
                <h2 className="text-xl font-bold mb-4 text-gray-700">Meu Resumo do Mês</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <KpiCard title="Dias Trabalhados" value={personalData?.diasTrabalhados} icon={faCalendarCheck} color="text-emerald-500" />
                    <KpiCard title="Horas Trabalhadas" value={personalData?.totalHorasTrabalhadas} icon={faClock} color="text-sky-500" />
                    <KpiCard title="Saldo de Horas" value={personalData?.saldoBancoHoras} icon={faHourglassHalf} color="text-indigo-500" />
                    <KpiCard title="Horas Extras" value={personalData?.totalHorasExtras} icon={faPlusCircle} color="text-green-500" />
                    <KpiCard title="Horas de Débito" value={personalData?.totalHorasDebito} icon={faMinusCircle} color="text-red-500" />
                </div>
            </section>
        );
    }

    // MODO GERAL (como era antes)
    if (isLoadingGeneral) {
        return <p>Carregando KPIs de RH...</p>;
    }
    
    if (isErrorGeneral) {
        return <p>Erro ao carregar dados de RH.</p>;
    }

    return (
        <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-700">Recursos Humanos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Funcionários Ativos"
                    value={generalData?.totalAtivos}
                    icon={faUsers}
                    color="text-blue-500"
                />
                <KpiCard
                    title="Pendências de Ponto"
                    value={generalData?.pendencias.length}
                    icon={faExclamationTriangle}
                    color={generalData?.pendencias.length > 0 ? "text-red-500" : "text-green-500"}
                    onClick={() => router.push('/recursos-humanos')}
                    clickable={true}
                />
            </div>
        </section>
    );
}
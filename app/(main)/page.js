// app/(main)/page.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import UserInfoCard from '@/components/painel/UserInfoCard';
import RhSection from '@/components/painel/RhSection';
import CustomKpiSection from '@/components/painel/CustomKpiSection';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

// O PORQUÊ: Esta função é necessária. Ela age como uma "ponte", pegando o ID do
// usuário logado (da tabela 'usuarios') e usando-o para encontrar o perfil
// correspondente na tabela 'funcionarios', que contém os dados para os KPIs de RH.
const fetchEmployeeProfile = async (userId) => {
    if (!userId) return null;

    const supabase = createClient();
    const { data: employeeData, error } = await supabase
        .from('funcionarios')
        .select('*, roles(name)')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error("Erro ao buscar perfil de funcionário:", error);
        // Retorna null em vez de dar erro para não quebrar a página.
        // O usuário verá os cards em estado de "carregando" se seu perfil não for encontrado.
        return null;
    }

    return {
        ...employeeData,
        role: employeeData.roles?.name || 'Não definido',
        full_name: employeeData.nome_completo,
        avatar_url: employeeData.avatar_url,
    };
};

export default function PainelPage() {
    // Pegamos os dados do AuthContext, assim como as outras páginas fazem.
    const { user, loading: authLoading } = useAuth();

    // Usamos o ID do usuário do contexto para buscar o perfil de funcionário.
    const { data: employeeProfile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['employeeProfileForPanel', user?.id],
        queryFn: () => fetchEmployeeProfile(user?.id),
        // A busca só roda quando a autenticação terminar e tivermos um user.id
        enabled: !authLoading && !!user?.id,
    });
    
    // O PORQUÊ DA MUDANÇA: Este é o padrão de loading seguro, usado em outras páginas.
    // Ele mostra o "Carregando..." se a autenticação estiver acontecendo OU se o
    // nosso perfil de funcionário estiver sendo buscado. Ele não trava mais a tela.
    if (authLoading || (isProfileLoading && !employeeProfile)) {
        return (
            <div className="flex justify-center items-center h-full">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-500" />
                <span className="ml-3 text-lg text-gray-600">Carregando painel...</span>
            </div>
        );
    }

    // Usamos o nome do perfil do funcionário, que é mais completo.
    const nameToDisplay = employeeProfile?.full_name || user?.nome_completo || 'Usuário';

    return (
        <div className="flex-1 p-4 md:p-6">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">
                Painel de Controle
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                Olá, <span className="font-semibold">{nameToDisplay}</span>! Bem-vindo(a) de volta.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-1">
                    {/* Passamos o perfil do funcionário para o Card de Usuário */}
                    <UserInfoCard user={employeeProfile} />
                </div>
                <div className="lg:col-span-2">
                    {/* Passamos o ID do funcionário (da tabela funcionarios) para o RhSection */}
                    <RhSection employeeId={employeeProfile?.id} />
                </div>
            </div>

            <CustomKpiSection />
        </div>
    );
}
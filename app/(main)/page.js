// V8 APP E COMPONENTS/app/(main)/page.js
// IMPORTANTE: APAGUE TUDO QUE ESTIVER NESTE ARQUIVO E COLE ESTE NOVO CÓDIGO.

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import Header from '@/components/Header';
import KpiCard from '@/components/KpiCard'; // Mantemos para outros KPIs, se houver
import { redirect } from 'next/navigation';
import { 
    FontAwesomeIcon 
} from '@fortawesome/react-fontawesome';
import { 
    faUserCircle, 
    faBriefcase, 
    faEnvelope, 
    faPhone, 
    faIdCard, 
    faCalendarDays, 
    faClock,
    faBusinessTime // <<<< CORREÇÃO AQUI: Ícone faBusinessTime importado
} from '@fortawesome/free-solid-svg-icons'; 

export default function DashboardPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const supabase = createClient();

    const [employeeData, setEmployeeData] = useState(null);
    const [monthlyHoursSummary, setMonthlyHoursSummary] = useState({ totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' });
    const [dashboardLoading, setDashboardLoading] = useState(true);

    // Log para depuração do estado de autenticação e redirecionamento
    useEffect(() => {
        console.log("DEBUG: AuthContext - Estado inicial. authLoading:", authLoading, "user ID:", user?.id || "NULO", "userData ID:", userData?.id || "NULO", "userData.funcionario_id:", userData?.funcionario_id || "NULO");
        if (!authLoading && !user) {
            console.log("DEBUG: Usuário não autenticado, redirecionando para /login");
            redirect('/login');
        }
    }, [user, userData, authLoading]);

    // Função para buscar os dados do FUNCIONÁRIO através do usuário
    const fetchEmployeeAndUserData = useCallback(async (authUserId) => {
        console.log("DEBUG: fetchEmployeeAndUserData - Tentando buscar dados para authUserId (do Supabase Auth):", authUserId);
        if (!authUserId) {
            console.log("DEBUG: fetchEmployeeAndUserData - authUserId é nulo, retornando.");
            return { employee: null, userProfile: null };
        }

        // Primeiro, busca os dados do perfil do USUÁRIO na tabela 'usuarios'
        // Garante que 'funcionario_id', 'nome', 'sobrenome', 'avatar_url' e 'funcoes' são selecionados
        const { data: userProfile, error: userError } = await supabase
            .from('usuarios')
            .select(`
                *,
                funcoes ( id, nome_funcao )
            `)
            .eq('id', authUserId)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') { // 'no rows found'
                console.warn('DEBUG: fetchEmployeeAndUserData - Nenhum perfil de usuário encontrado na tabela "usuarios" para o ID:', authUserId);
            } else {
                console.error('DEBUG: fetchEmployeeAndUserData - Erro ao buscar perfil do usuário na tabela "usuarios":', userError.message, userError.details);
            }
            return { employee: null, userProfile: null };
        }
        console.log("DEBUG: fetchEmployeeAndUserData - Perfil de usuário encontrado na tabela 'usuarios':", userProfile);
        console.log("DEBUG: fetchEmployeeAndUserData - userProfile.funcionario_id:", userProfile.funcionario_id);


        let employee = null;
        if (userProfile && userProfile.funcionario_id) {
            // Se encontrou um funcionario_id no perfil do usuário, busca os dados do FUNCIONÁRIO
            console.log("DEBUG: fetchEmployeeAndUserData - Encontrado funcionario_id no perfil do usuário:", userProfile.funcionario_id, ". Buscando dados na tabela 'funcionarios'.");
            const { data: empData, error: empError } = await supabase
                .from('funcionarios')
                .select('*')
                .eq('id', userProfile.funcionario_id)
                .single();

            if (empError) {
                if (empError.code === 'PGRST116') {
                    console.warn('DEBUG: fetchEmployeeAndUserData - Nenhum funcionário encontrado na tabela "funcionarios" para o ID:', userProfile.funcionario_id);
                } else {
                    console.error('DEBUG: fetchEmployeeAndUserData - Erro ao buscar dados do funcionário na tabela "funcionarios":', empError.message, empError.details);
                }
            } else {
                employee = empData;
                console.log("DEBUG: fetchEmployeeAndUserData - Dados do funcionário associado encontrados:", employee);
            }
        } else {
            console.log("DEBUG: fetchEmployeeAndUserData - Usuário não tem um funcionario_id associado na tabela 'usuarios'.");
        }

        return { employee, userProfile };
    }, [supabase]);

    // Lógica para calcular o total de horas de um dia (copiado do FolhaPonto.js)
    const parseTime = useCallback((timeString, baseDate) => {
        if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        const date = new Date(baseDate);
        date.setUTCHours(hours, minutes, 0, 0);
        return date;
    }, []);

    const calculateTotalHoursForDay = useCallback((dayData) => {
        const dateBase = new Date(dayData.dateString + 'T00:00:00Z');
        const entrada = parseTime(dayData.entrada, dateBase);
        const saida = parseTime(dayData.saida, dateBase);
        const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase);
        const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);

        if (!entrada || !saida) return 0;
        let totalMillis = saida.getTime() - entrada.getTime();
        if (inicio_intervalo && fim_intervalo && fim_intervalo.getTime() > inicio_intervalo.getTime()) {
            totalMillis -= (fim_intervalo.getTime() - inicio_intervalo.getTime());
        }
        if (totalMillis < 0) totalMillis = 0;
        return Math.floor(totalMillis / (1000 * 60));
    }, [parseTime]);

    // Função para buscar e calcular o resumo mensal das horas trabalhadas
    const fetchMonthlyHoursSummary = useCallback(async (employeeId, year, month) => {
        console.log("DEBUG: fetchMonthlyHoursSummary - Tentando buscar dados de ponto para employeeId:", employeeId, "Mês:", month, "Ano:", year);
        if (!employeeId) {
            console.log("DEBUG: fetchMonthlyHoursSummary - employeeId é nulo, retornando resumo padrão.");
            return { totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' };
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: pontosData, error: pontosError } = await supabase
            .from('pontos')
            .select('*')
            .eq('funcionario_id', employeeId)
            .gte('data_hora', `${startDate}T00:00:00`)
            .lte('data_hora', `${endDate}T23:59:59`);

        if (pontosError) {
            console.error("DEBUG: fetchMonthlyHoursSummary - Erro ao carregar dados do ponto:", pontosError.message, pontosError.details);
            return { totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' };
        }
        console.log("DEBUG: fetchMonthlyHoursSummary - Dados de ponto brutos recebidos:", pontosData);

        const processedData = {};
        pontosData.forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const localDateStringForGrouping = utcDate.toLocaleDateString('sv-SE');

            if (!processedData[localDateStringForGrouping]) {
                processedData[localDateStringForGrouping] = { dateString: localDateStringForGrouping };
            }

            const fieldMap = {
                'Entrada': 'entrada',
                'Inicio_Intervalo': 'inicio_intervalo',
                'Fim_Intervalo': 'fim_intervalo',
                'Saida': 'saida'
            };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedData[localDateStringForGrouping][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        });
        console.log("DEBUG: fetchMonthlyHoursSummary - Dados de ponto processados:", processedData);

        let totalDays = 0;
        let totalMinutesMonth = 0;
        // Você precisará de uma lógica para calcular horas extras. Por exemplo, se a jornada for 8h/dia, tudo acima disso é extra.
        // Para simplificar, vou deixar como "A calcular", mas você pode implementar aqui.
        let totalOvertimeMinutes = 0; 
        const dailyStandardHours = 8; // Exemplo: 8 horas por dia
        const dailyStandardMinutes = dailyStandardHours * 60;


        Object.values(processedData).forEach(dayData => {
            if (dayData.entrada && dayData.saida) {
                totalDays++;
                const dayMinutes = calculateTotalHoursForDay(dayData);
                totalMinutesMonth += dayMinutes;
                if (dayMinutes > dailyStandardMinutes) {
                    totalOvertimeMinutes += (dayMinutes - dailyStandardMinutes);
                }
            }
        });

        const totalHours = Math.floor(totalMinutesMonth / 60);
        const remainingMinutes = totalMinutesMonth % 60;
        const formattedTotalHours = `${String(totalHours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;

        const overtimeHours = Math.floor(totalOvertimeMinutes / 60);
        const overtimeRemainingMinutes = totalOvertimeMinutes % 60;
        const formattedOvertimeHours = `${String(overtimeHours).padStart(2, '0')}:${String(overtimeRemainingMinutes).padStart(2, '0')}`;


        console.log("DEBUG: fetchMonthlyHoursSummary - Resumo mensal calculado:", { totalDays, formattedTotalHours, hoursOvertime: formattedOvertimeHours });
        return { totalDays, formattedTotalHours, hoursOvertime: formattedOvertimeHours };
    }, [supabase, calculateTotalHoursForDay]);

    // Efeito principal para buscar todos os dados do dashboard
    useEffect(() => {
        const loadDashboardData = async () => {
            console.log("DEBUG: loadDashboardData - acionado. authLoading:", authLoading, "user:", user?.id || "NULO", "userData:", userData?.id || "NULO");

            if (authLoading) {
                return; // Aguarda o AuthContext carregar completamente
            }

            if (!user) {
                console.log("DEBUG: loadDashboardData - Usuário não autenticado. Redirecionamento já acionado.");
                setDashboardLoading(false);
                return;
            }
            
            console.log("DEBUG: loadDashboardData - Auth carregado, usuário Supabase Auth ID:", user.id, ". Iniciando busca de dados do dashboard.");
            setDashboardLoading(true); // Inicia o carregamento do dashboard

            const { employee, userProfile } = await fetchEmployeeAndUserData(user.id);
            setEmployeeData(employee); // Pode ser null se não houver funcionário

            if (employee) {
                console.log("DEBUG: loadDashboardData - Funcionário encontrado (ID:", employee.id, "). Buscando horas.");
                const today = new Date();
                const summary = await fetchMonthlyHoursSummary(employee.id, today.getFullYear(), today.getMonth() + 1);
                setMonthlyHoursSummary(summary);
            } else {
                console.log("DEBUG: loadDashboardData - Nenhum funcionário associado ao usuário. Não buscando horas de ponto.");
                setMonthlyHoursSummary({ totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' }); // Reseta se não houver funcionário
            }
            
            setDashboardLoading(false); // Finaliza o carregamento após todas as buscas
            console.log("DEBUG: loadDashboardData - Carregamento do dashboard concluído.");
        };

        loadDashboardData();
    }, [user, userData, authLoading, fetchEmployeeAndUserData, fetchMonthlyHoursSummary]);


    // Renderiza o estado de carregamento
    if (authLoading || dashboardLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-100">
                <p className="text-gray-700 text-lg">Carregando dashboard...</p>
            </div>
        );
    }

    // Determina quais dados de perfil usar para exibir
    const nameToDisplay = employeeData?.full_name || userData?.nome_completo || `${userData?.nome || ''} ${userData?.sobrenome || ''}`.trim() || user?.email || 'Usuário';
    const cargoToDisplay = employeeData?.contract_role || userData?.funcoes?.nome_funcao || 'Não associado a funcionário';
    const phoneToDisplay = employeeData?.phone || 'N/A';
    const emailToDisplay = user?.email || 'N/A';
    
    // Lógica para o avatar: user?.user_metadata?.avatar_url (do Auth) ou userData?.avatar_url (do seu perfil 'usuarios')
    const avatarUrlToUse = user?.user_metadata?.avatar_url || userData?.avatar_url || '/default-avatar.png';


    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Header /> {/* Seu componente de cabeçalho */}
            <main className="flex-1 p-6 md:p-8 lg:p-10">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard de {nameToDisplay}</h1>

                {/* Seção de Informações do Usuário/Funcionário - Estilo Crachá Aprimorado */}
                {/* Removido mx-auto para justificar à esquerda, e adicionado max-w-full para ocupar mais espaço */}
                <section className="bg-white p-4 sm:p-6 rounded-lg shadow-xl mb-8 border border-gray-200 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 max-w-full md:max-w-xl lg:max-w-2xl">
                    {/* Contêiner da Foto de Perfil */}
                    <div className="w-24 h-24 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-blue-300 shadow-md">
                        {avatarUrlToUse && avatarUrlToUse !== '/default-avatar.png' ? (
                            <img src={avatarUrlToUse} alt="Avatar do Usuário" className="w-full h-full object-cover" />
                        ) : (
                            <FontAwesomeIcon icon={faUserCircle} className="text-blue-500 text-6xl" />
                        )}
                    </div>
                    
                    {/* Informações do Crachá */}
                    <div className="flex-1 text-center sm:text-left">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 leading-tight">{nameToDisplay}</h2>
                        <p className="text-sm sm:text-base text-blue-600 mb-2 font-semibold">
                            <FontAwesomeIcon icon={faBriefcase} className="mr-2" />
                            {cargoToDisplay}
                        </p>

                        <div className="text-gray-700 text-sm space-y-1">
                            <p className="flex items-center justify-center sm:justify-start">
                                <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-base text-gray-500" />
                                {/* Adicionado truncate para o email, e classes para quebrar palavras se necessário */}
                                <span className="truncate block max-w-[calc(100%-2rem)] md:max-w-full">{emailToDisplay}</span>
                            </p>
                            <p className="flex items-center justify-center sm:justify-start">
                                <FontAwesomeIcon icon={faPhone} className="mr-2 text-base text-gray-500" />
                                <span>{phoneToDisplay}</span>
                            </p>
                            {/* Mais informações se houver dados do funcionário */}
                            {employeeData && (
                                <>
                                    {employeeData.cpf && (
                                        <p className="flex items-center justify-center sm:justify-start">
                                            <FontAwesomeIcon icon={faIdCard} className="mr-2 text-base text-gray-500" />
                                            <span>CPF: {employeeData.cpf}</span>
                                        </p>
                                    )}
                                    {employeeData.admission_date && (
                                        <p className="flex items-center justify-center sm:justify-start">
                                            <FontAwesomeIcon icon={faUserCircle} className="mr-2 text-base text-gray-500" />
                                            <span>Admissão: {employeeData.admission_date}</span>
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </section>

                {/* Seção de Desempenho e Ponto (apenas se houver dados de funcionário) */}
                {employeeData && (
                    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Meu Ponto (Mês Atual)</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Card para Dias Trabalhados */}
                            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center text-center">
                                <FontAwesomeIcon icon={faCalendarDays} className="text-4xl text-blue-500 mb-4" />
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Dias Trabalhados</h3>
                                <p className="text-3xl font-extrabold text-blue-700">
                                    {monthlyHoursSummary.totalDays}
                                    <span className="text-xl font-normal text-gray-600 ml-1">dias</span>
                                </p>
                                <p className="text-sm text-gray-600 mt-2">Dias com registro de entrada e saída.</p>
                            </div>

                            {/* Card para Total de Horas */}
                            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center text-center">
                                <FontAwesomeIcon icon={faClock} className="text-4xl text-blue-500 mb-4" />
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Total de Horas</h3>
                                <p className="text-3xl font-extrabold text-blue-700">
                                    {monthlyHoursSummary.formattedTotalHours}
                                    <span className="text-xl font-normal text-gray-600 ml-1">h</span>
                                </p>
                                <p className="text-sm text-gray-600 mt-2">Horas líquidas do mês.</p>
                            </div>

                            {/* Card para Horas Extras */}
                            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center text-center">
                                <FontAwesomeIcon icon={faBusinessTime} className="text-4xl text-blue-500 mb-4" />
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Horas Extras</h3>
                                <p className="text-3xl font-extrabold text-blue-700">
                                    {monthlyHoursSummary.hoursOvertime}
                                    <span className="text-xl font-normal text-gray-600 ml-1">h</span>
                                </p>
                                <p className="text-sm text-gray-600 mt-2">Horas excedentes à jornada padrão.</p>
                            </div>
                        </div>
                    </section>
                )}
                
                {/* Você pode adicionar mais seções aqui com outros KPIs ou informações: */}
                {/* <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-gray-700">Projetos Atuais</h2>
                    <p className="text-gray-600">Lista dos projetos em que o funcionário está envolvido.</p>
                </section> */}

            </main>
        </div>
    );
}
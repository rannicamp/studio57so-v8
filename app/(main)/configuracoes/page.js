// V8 APP E COMPONENTS/app/(main)/page.js
// IMPORTANTE: APAGUE TUDO QUE ESTIVER NESTE ARQUIVO E COLE ESTE NOVO CÓDIGO.

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import Header from '@/components/Header';
import { redirect } from 'next/navigation';
import { 
    FontAwesomeIcon 
} from '@fortawesome/react-fontawesome';
import { 
    faUserCircle, faBriefcase, faEnvelope, faPhone, faIdCard, 
    faCalendarDays, faClock, faBusinessTime, faDollarSign, faTasks 
} from '@fortawesome/free-solid-svg-icons';

// Importa a biblioteca de grid
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Posição inicial dos cards na grade (com o novo card adicionado)
const initialLayout = [
    { i: 'profile-card', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'dollar-card', x: 2, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'days-card', x: 3, y: 0, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'hours-card', x: 2, y: 1, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'overtime-card', x: 3, y: 1, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'my-tasks-card', x: 0, y: 2, w: 4, h: 1, minW: 2, minH: 1 }, // Novo card em uma nova linha
];

export default function DashboardPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const supabase = createClient();

    const [employeeData, setEmployeeData] = useState(null);
    const [monthlyHoursSummary, setMonthlyHoursSummary] = useState({ totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' });
    const [dollarRate, setDollarRate] = useState(null);
    const [myTasksCount, setMyTasksCount] = useState(0); // Novo estado para as tarefas
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [layout, setLayout] = useState([]);

    // Efeito para carregar o layout salvo do navegador de forma inteligente
    useEffect(() => {
        const savedLayoutJSON = localStorage.getItem('dashboard-layout');
        let savedLayout = null;
        if (savedLayoutJSON) {
            try {
                savedLayout = JSON.parse(savedLayoutJSON);
            } catch (e) {
                console.error("Error parsing saved layout from localStorage", e);
                savedLayout = null;
            }
        }

        // Verifica se o layout salvo contém todos os cards definidos no código
        const initialKeys = new Set(initialLayout.map(item => item.i));
        const savedKeys = savedLayout ? new Set(savedLayout.map(item => item.i)) : new Set();
        const allKeysPresent = [...initialKeys].every(key => savedKeys.has(key));

        if (savedLayout && allKeysPresent) {
            setLayout(savedLayout);
        } else {
            // Se o layout estiver faltando algum card (como o novo de tarefas), ele redefine para o padrão
            setLayout(initialLayout);
            localStorage.setItem('dashboard-layout', JSON.stringify(initialLayout));
        }
    }, []);

    // Função para salvar o layout quando ele muda
    const handleLayoutChange = (newLayout) => {
        setLayout(newLayout);
        localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
    };

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
        const { data: userProfile, error: userError } = await supabase
            .from('usuarios')
            .select(`
                *,
                funcoes ( id, nome_funcao )
            `)
            .eq('id', authUserId)
            .single();

        if (userError) {
            if (userError.code === 'PGRST116') {
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
                'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo',
                'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida'
            };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedData[localDateStringForGrouping][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        });
        console.log("DEBUG: fetchMonthlyHoursSummary - Dados de ponto processados:", processedData);
        let totalDays = 0;
        let totalMinutesMonth = 0;
        let totalOvertimeMinutes = 0;
        const dailyStandardHours = 8;
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

    const fetchDollarRate = useCallback(async () => {
        console.log("DEBUG: fetchDollarRate - Buscando cotação do dólar...");
        try {
            const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const usdBrl = data['USDBRL'];
            if (usdBrl && usdBrl.bid) {
                setDollarRate(parseFloat(usdBrl.bid).toFixed(2));
                console.log("DEBUG: fetchDollarRate - Cotação do dólar atualizada:", parseFloat(usdBrl.bid).toFixed(2));
            } else {
                console.warn("DEBUG: fetchDollarRate - Dados de cotação inválidos recebidos:", data);
                setDollarRate('N/A');
            }
        } catch (error) {
            console.error("DEBUG: fetchDollarRate - Erro ao buscar cotação do dólar:", error.message);
            setDollarRate('Erro');
        }
    }, []);

    useEffect(() => {
        const loadDashboardData = async () => {
            console.log("DEBUG: loadDashboardData - acionado. authLoading:", authLoading, "user:", user?.id || "NULO", "userData:", userData?.id || "NULO");
            if (authLoading) { return; }
            if (!user) {
                console.log("DEBUG: loadDashboardData - Usuário não autenticado. Redirecionamento já acionado.");
                setDashboardLoading(false);
                return;
            }
            console.log("DEBUG: loadDashboardData - Auth carregado, usuário Supabase Auth ID:", user.id, ". Iniciando busca de dados do painel.");
            setDashboardLoading(true);

            const { employee, userProfile } = await fetchEmployeeAndUserData(user.id);
            setEmployeeData(employee);

            if (userProfile && userProfile.funcionario_id) {
                console.log("DEBUG: Buscando contagem de tarefas para funcionario_id:", userProfile.funcionario_id);
                const { count, error: tasksError } = await supabase
                    .from('activities')
                    .select('*', { count: 'exact', head: true })
                    .eq('funcionario_id', userProfile.funcionario_id)
                    .in('status', ['Não Iniciado', 'Em Andamento', 'Pausado', 'Aguardando Material']);
                
                if (tasksError) {
                    console.error("DEBUG: Erro ao buscar contagem de tarefas:", tasksError.message);
                    setMyTasksCount(0);
                } else {
                    setMyTasksCount(count || 0);
                    console.log("DEBUG: Contagem de tarefas encontrada:", count);
                }
            } else {
                console.log("DEBUG: Usuário não é um funcionário, contagem de tarefas é 0.");
                setMyTasksCount(0);
            }


            if (employee) {
                console.log("DEBUG: loadDashboardData - Funcionário encontrado (ID:", employee.id, "). Buscando horas.");
                const today = new Date();
                const summary = await fetchMonthlyHoursSummary(employee.id, today.getFullYear(), today.getMonth() + 1);
                setMonthlyHoursSummary(summary);
            } else {
                console.log("DEBUG: loadDashboardData - Nenhum funcionário associado ao usuário. Não buscando horas de ponto.");
                setMonthlyHoursSummary({ totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' });
            }

            await fetchDollarRate();
            setDashboardLoading(false);
            console.log("DEBUG: loadDashboardData - Carregamento do painel concluído.");
        };

        loadDashboardData();
    }, [user, userData, authLoading, fetchEmployeeAndUserData, fetchMonthlyHoursSummary, fetchDollarRate, supabase]);

    if (authLoading || dashboardLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-100">
                <p className="text-gray-700 text-lg">Carregando painel...</p>
            </div>
        );
    }

    const nameToDisplay = employeeData?.full_name || userData?.nome_completo || `${userData?.nome || ''} ${userData?.sobrenome || ''}`.trim() || user?.email || 'Usuário';
    const cargoToDisplay = employeeData?.contract_role || userData?.funcoes?.nome_funcao || 'Não associado a funcionário';
    const phoneToDisplay = employeeData?.phone || 'N/A';
    const emailToDisplay = user?.email || 'N/A';
    const avatarUrlToUse = user?.user_metadata?.avatar_url || userData?.avatar_url || '/default-avatar.png';


    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <Header />
            <main className="flex-1 p-6 md:p-8 lg:p-10">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Painel de {nameToDisplay}</h1>
                
                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: layout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 }}
                    rowHeight={120} // Altura padrão das linhas para melhor controle
                    onLayoutChange={(newLayout) => handleLayoutChange(newLayout)}
                    isBounded={true}
                >
                    {/* Crachá do Usuário/Funcionário */}
                    <div key="profile-card" className="panel-card bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                        <div className="p-4 sm:p-6 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 h-full w-full">
                            <div className="w-24 h-24 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-blue-300 shadow-md">
                                {avatarUrlToUse && avatarUrlToUse !== '/default-avatar.png' ? (
                                    <img src={avatarUrlToUse} alt="Avatar do Usuário" className="w-full h-full object-cover" />
                                ) : (
                                    <FontAwesomeIcon icon={faUserCircle} className="text-blue-500 text-6xl" />
                                )}
                            </div>
                            <div className="flex-1 text-center sm:text-left overflow-hidden">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1 leading-tight">{nameToDisplay}</h2>
                                <p className="text-sm sm:text-base text-blue-600 mb-2 font-semibold">
                                    <FontAwesomeIcon icon={faBriefcase} className="mr-2" />
                                    {cargoToDisplay}
                                </p>
                                <div className="text-gray-700 text-sm space-y-1">
                                    <p className="flex items-center justify-center sm:justify-start">
                                        <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-base text-gray-500" />
                                        <span className="truncate flex-1 min-w-0">{emailToDisplay}</span>
                                    </p>
                                    <p className="flex items-center justify-center sm:justify-start">
                                        <FontAwesomeIcon icon={faPhone} className="mr-2 text-base text-gray-500" />
                                        <span>{phoneToDisplay}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card para Cotação do Dólar */}
                    <div key="dollar-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faDollarSign} className="text-4xl text-green-600 mb-2" />
                        <h3 className="text-xl font-bold text-gray-800 mb-1">Dólar (USD)</h3>
                        <p className="text-3xl font-extrabold text-green-700">
                            R$ {dollarRate || '...'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Cotação de Venda</p>
                    </div>
                    
                    {/* Card para Dias Trabalhados */}
                    <div key="days-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faCalendarDays} className="text-3xl text-blue-500 mb-2" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Dias Trab.</h3>
                        <p className="text-2xl font-extrabold text-blue-700">
                            {monthlyHoursSummary.totalDays}
                            <span className="text-base font-normal text-gray-600 ml-1">dias</span>
                        </p>
                    </div>

                    {/* Card para Total de Horas */}
                    <div key="hours-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faClock} className="text-3xl text-blue-500 mb-2" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Total Horas</h3>
                        <p className="text-2xl font-extrabold text-blue-700">
                            {monthlyHoursSummary.formattedTotalHours}
                            <span className="text-base font-normal text-gray-600 ml-1">h</span>
                        </p>
                    </div>

                    {/* Card para Horas Extras */}
                    <div key="overtime-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faBusinessTime} className="text-3xl text-blue-500 mb-2" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Horas Extras</h3>
                        <p className="text-2xl font-extrabold text-blue-700">
                            {monthlyHoursSummary.hoursOvertime}
                            <span className="text-base font-normal text-gray-600 ml-1">h</span>
                        </p>
                    </div>

                    {/* ***** NOVO CARD DE ATIVIDADES ***** */}
                    <div key="my-tasks-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                        <FontAwesomeIcon icon={faTasks} className="text-3xl text-purple-500 mb-2" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Minhas Atividades</h3>
                        <p className="text-2xl font-extrabold text-purple-700">
                            {myTasksCount}
                            <span className="text-base font-normal text-gray-600 ml-1">pendente(s)</span>
                        </p>
                    </div>

                </ResponsiveGridLayout>
                
            </main>
        </div>
    );
}
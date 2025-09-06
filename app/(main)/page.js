"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
// A importação do Header foi REMOVIDA daqui
import { redirect, useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUserCircle, faBriefcase, faEnvelope, faPhone, 
    faCalendarDays, faClock, faBusinessTime, faDollarSign,
    faExclamationTriangle, faSpinner 
} from '@fortawesome/free-solid-svg-icons';

import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const initialLayout = [
    { i: 'profile-card', x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'pending-clock-ins-card', x: 2, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: 'dollar-card', x: 0, y: 2, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'days-card', x: 1, y: 2, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'hours-card', x: 2, y: 2, w: 1, h: 1, minW: 1, minH: 1 },
    { i: 'overtime-card', x: 3, y: 2, w: 1, h: 1, minW: 1, minH: 1 },
];

export default function DashboardPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const supabase = createClient();
    const router = useRouter();

    const [employeeData, setEmployeeData] = useState(null);
    const [monthlyHoursSummary, setMonthlyHoursSummary] = useState({ totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' });
    const [dollarRate, setDollarRate] = useState(null);
    const [dashboardLoading, setDashboardLoading] = useState(true);
    const [layout, setLayout] = useState([]);
    
    const [pendingEmployees, setPendingEmployees] = useState([]);
    const [checkingPendencies, setCheckingPendencies] = useState(true);

    useEffect(() => {
        const savedLayoutJSON = localStorage.getItem('dashboard-layout-v3');
        let savedLayout = null;
        if (savedLayoutJSON) {
            try { savedLayout = JSON.parse(savedLayoutJSON); } catch (e) { savedLayout = null; }
        }
        const initialKeys = new Set(initialLayout.map(item => item.i));
        const savedKeys = savedLayout ? new Set(savedLayout.map(item => item.i)) : new Set();
        const allKeysPresent = [...initialKeys].every(key => savedKeys.has(key));

        if (savedLayout && allKeysPresent) {
            setLayout(savedLayout);
        } else {
            setLayout(initialLayout);
            localStorage.setItem('dashboard-layout-v3', JSON.stringify(initialLayout));
        }
    }, []);

    const handleLayoutChange = (newLayout) => {
        setLayout(newLayout);
        localStorage.setItem('dashboard-layout-v3', JSON.stringify(newLayout));
    };

    useEffect(() => {
        if (!authLoading && !user) {
            redirect('/login');
        }
    }, [user, authLoading]);

    const fetchEmployeeAndUserData = useCallback(async (authUserId) => {
        if (!authUserId) return { employee: null, userProfile: null };
        const { data: userProfile } = await supabase.from('usuarios').select(`*, funcoes ( id, nome_funcao )`).eq('id', authUserId).single();
        let employee = null;
        if (userProfile && userProfile.funcionario_id) {
            const { data: empData } = await supabase.from('funcionarios').select('*').eq('id', userProfile.funcionario_id).single();
            employee = empData;
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
        if (!employeeId) return { totalDays: 0, formattedTotalHours: '00:00', hoursOvertime: '00:00' };
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        const { data: pontosData } = await supabase.from('pontos').select('*').eq('funcionario_id', employeeId).gte('data_hora', `${startDate}T00:00:00`).lte('data_hora', `${endDate}T23:59:59`);
        const processedData = {};
        (pontosData || []).forEach(ponto => {
            if (!ponto.data_hora) return;
            const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
            const localDateStringForGrouping = utcDate.toLocaleDateString('sv-SE');
            if (!processedData[localDateStringForGrouping]) {
                processedData[localDateStringForGrouping] = { dateString: localDateStringForGrouping };
            }
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedData[localDateStringForGrouping][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
        });
        let totalDays = 0, totalMinutesMonth = 0, totalOvertimeMinutes = 0;
        const dailyStandardMinutes = 8 * 60;
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
        return { totalDays, formattedTotalHours, hoursOvertime: formattedOvertimeHours };
    }, [supabase, calculateTotalHoursForDay]);

    const fetchDollarRate = useCallback(async () => {
        try {
            const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const usdBrl = data['USDBRL'];
            if (usdBrl && usdBrl.bid) {
                setDollarRate(parseFloat(usdBrl.bid).toFixed(2));
            } else {
                setDollarRate('N/A');
            }
        } catch (error) {
            setDollarRate('Erro');
        }
    }, []);

    useEffect(() => {
        const loadDashboardData = async () => {
            if (authLoading || !user) {
                setDashboardLoading(false);
                return;
            }
            setDashboardLoading(true);
            setCheckingPendencies(true);

            const { employee } = await fetchEmployeeAndUserData(user.id);
            setEmployeeData(employee);

            if (employee) {
                const today = new Date();
                const summary = await fetchMonthlyHoursSummary(employee.id, today.getFullYear(), today.getMonth() + 1);
                setMonthlyHoursSummary(summary);
            }
            
            await fetchDollarRate();
            
            const { data: pendingData, error: pendingError } = await supabase.rpc('get_funcionarios_com_pendencias_ponto');
            if (pendingError) {
                console.error("Erro ao buscar pendências de ponto:", pendingError);
                setPendingEmployees([]);
            } else {
                setPendingEmployees(pendingData || []);
            }

            setCheckingPendencies(false);
            setDashboardLoading(false);
        };
        loadDashboardData();
    }, [user, userData, authLoading, fetchEmployeeAndUserData, fetchMonthlyHoursSummary, fetchDollarRate, supabase]);

    const goToPonto = (employeeId) => {
        localStorage.setItem('selectedEmployeeIdForPonto', employeeId);
        router.push('/ponto');
    };

    if (authLoading || dashboardLoading) {
        return ( <div className="flex justify-center items-center h-full"><p className="text-gray-700 text-lg">Carregando painel...</p></div> );
    }

    const nameToDisplay = employeeData?.full_name || userData?.nome_completo || `${userData?.nome || ''} ${userData?.sobrenome || ''}`.trim() || user?.email || 'Usuário';
    const cargoToDisplay = employeeData?.contract_role || userData?.funcoes?.nome_funcao || 'Não associado a funcionário';
    const phoneToDisplay = employeeData?.phone || 'N/A';
    const emailToDisplay = user?.email || 'N/A';
    const avatarUrlToUse = user?.user_metadata?.avatar_url || userData?.avatar_url || '/default-avatar.png';

    return (
        // O Header foi REMOVIDO daqui. O layout principal já o fornece.
        <div className="flex-1">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Painel de {nameToDisplay}</h1>
            <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 4, md: 4, sm: 2, xs: 1, xxs: 1 }}
                rowHeight={120}
                onLayoutChange={(newLayout) => handleLayoutChange(newLayout)}
                isBounded={true}
            >
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
                            <p className="text-sm sm:text-base text-blue-600 mb-2 font-semibold"> <FontAwesomeIcon icon={faBriefcase} className="mr-2" /> {cargoToDisplay} </p>
                            <div className="text-gray-700 text-sm space-y-1">
                                <p className="flex items-center justify-center sm:justify-start"> <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-base text-gray-500" /> <span className="truncate flex-1 min-w-0">{emailToDisplay}</span> </p>
                                <p className="flex items-center justify-center sm:justify-start"> <FontAwesomeIcon icon={faPhone} className="mr-2 text-base text-gray-500" /> <span>{phoneToDisplay}</span> </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div key="pending-clock-ins-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-yellow-500" />
                        <h3 className="text-lg font-bold text-gray-800">Pendências de Ponto</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 text-center">
                        {checkingPendencies ? (
                            <div className="flex items-center justify-center h-full"><FontAwesomeIcon icon={faSpinner} spin /></div>
                        ) : pendingEmployees.length > 0 ? (
                            <ul className="space-y-2">
                                {pendingEmployees.map(emp => (
                                    <li key={emp.id}>
                                        <button onClick={() => goToPonto(emp.id)} className="w-full text-left text-sm font-medium text-gray-700 hover:text-blue-600 p-2 bg-yellow-50 rounded-md hover:bg-yellow-100">
                                            {emp.full_name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex items-center justify-center h-full text-sm text-gray-500">Nenhuma pendência encontrada.</div>
                        )}
                    </div>
                </div>

                <div key="dollar-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                    <FontAwesomeIcon icon={faDollarSign} className="text-4xl text-green-600 mb-2" />
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Dólar (USD)</h3>
                    <p className="text-3xl font-extrabold text-green-700"> R$ {dollarRate || '...'} </p>
                    <p className="text-xs text-gray-500 mt-1">Cotação de Venda</p>
                </div>

                <div key="days-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                    <FontAwesomeIcon icon={faCalendarDays} className="text-3xl text-blue-500 mb-2" />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Dias Trab.</h3>
                    <p className="text-2xl font-extrabold text-blue-700"> {monthlyHoursSummary.totalDays} <span className="text-base font-normal text-gray-600 ml-1">dias</span> </p>
                </div>

                <div key="hours-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                    <FontAwesomeIcon icon={faClock} className="text-3xl text-blue-500 mb-2" />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Total Horas</h3>
                    <p className="text-2xl font-extrabold text-blue-700"> {monthlyHoursSummary.formattedTotalHours} <span className="text-base font-normal text-gray-600 ml-1">h</span> </p>
                </div>

                <div key="overtime-card" className="panel-card bg-white p-4 rounded-lg shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col items-center justify-center text-center">
                    <FontAwesomeIcon icon={faBusinessTime} className="text-3xl text-blue-500 mb-2" />
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Horas Extras</h3>
                    <p className="text-2xl font-extrabold text-blue-700"> {monthlyHoursSummary.hoursOvertime} <span className="text-base font-normal text-gray-600 ml-1">h</span> </p>
                </div>
            </ResponsiveGridLayout>
        </div>
    );
}
// components/FolhaPonto.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheckCircle, faExclamationCircle, faInfoCircle, faUserEdit,
    faCalendarCheck, faBusinessTime, faCalendarXmark, faPrint,
    faSpinner, faUserCircle, faExclamationTriangle, faDollarSign,
    faHistory, faCalculator, faBoxArchive, faHandHoldingDollar,
    faHourglassHalf, faUmbrellaBeach
} from '@fortawesome/free-solid-svg-icons';
import KpiCard from './KpiCard';
import AjusteSaldoModal from './rh/AjusteSaldoModal';
import { toast } from 'sonner';

const supabase = createClient();

const Toast = ({ message, type, onclose }) => {
    useEffect(() => { const timer = setTimeout(onclose, 4000); return () => clearTimeout(timer); }, [onclose]);
    const styles = { success: { bg: 'bg-green-500', icon: faCheckCircle }, error: { bg: 'bg-red-500', icon: faExclamationCircle }, info: { bg: 'bg-blue-500', icon: faInfoCircle } };
    const currentStyle = styles[type] || styles.info;
    return ( <div className={`fixed bottom-5 right-5 flex items-center p-4 rounded-lg shadow-lg text-white ${currentStyle.bg} animate-fade-in-up z-50 no-print`}> <FontAwesomeIcon icon={currentStyle.icon} className="mr-3 text-xl" /> <span>{message}</span> </div> );
};

const formatMinutesToHours = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '--:--';
    const sign = totalMinutes < 0 ? '-' : '+';
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60);
    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseTime = (timeString, baseDate) => {
    if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const date = new Date(baseDate); date.setUTCHours(hours, minutes, 0, 0); return date;
};

const calculateTotalHoursForEmployee = (dayData, employee) => {
    if (!employee) return '--:--';
    const dateBase = new Date(dayData.dateString + 'T00:00:00Z');
    const dayOfWeek = dateBase.getUTCDay();
    const jornadaDoDia = employee.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeek);
    const tolerancia = employee.jornada?.tolerancia_minutos || 0;
    const adjustTime = (actualTimeStr, scheduledTimeStr) => {
        if (!actualTimeStr || !scheduledTimeStr || tolerancia === 0) { return actualTimeStr; }
        const baseDate = '1970-01-01T';
        const actualDate = new Date(`${baseDate}${actualTimeStr}:00Z`);
        const scheduledDate = new Date(`${baseDate}${scheduledTimeStr}Z`);
        if (isNaN(actualDate.getTime()) || isNaN(scheduledDate.getTime())) { return actualTimeStr; }
        const diffMinutes = (actualDate.getTime() - scheduledDate.getTime()) / 60000;
        if (Math.abs(diffMinutes) <= tolerancia) { return scheduledTimeStr; }
        return actualTimeStr;
    };
    const entradaAjustada = adjustTime(dayData.entrada, jornadaDoDia?.horario_entrada);
    const inicioIntervaloAjustado = adjustTime(dayData.inicio_intervalo, jornadaDoDia?.horario_saida_intervalo);
    const fimIntervaloAjustado = adjustTime(dayData.fim_intervalo, jornadaDoDia?.horario_volta_intervalo);
    const saidaAjustada = adjustTime(dayData.saida, jornadaDoDia?.horario_saida);
    const entrada = parseTime(entradaAjustada, dateBase);
    const saida = parseTime(saidaAjustada, dateBase);
    const inicio_intervalo = parseTime(inicioIntervaloAjustado, dateBase);
    const fim_intervalo = parseTime(fimIntervaloAjustado, dateBase);
    let manhaMillis = 0; let tardeMillis = 0;
    if (entrada && inicio_intervalo) { manhaMillis = inicio_intervalo.getTime() - entrada.getTime(); }
    if (fim_intervalo && saida) { tardeMillis = saida.getTime() - fim_intervalo.getTime(); }
    let totalMillis = manhaMillis + tardeMillis;
    if (totalMillis <= 0 && entrada && saida) { totalMillis = saida.getTime() - entrada.getTime(); }
    if (totalMillis <= 0) { return '--:--'; }
    if (totalMillis < 0) totalMillis = 0;
    const totalHours = Math.floor(totalMillis / (1000 * 60 * 60));
    const totalMinutes = Math.floor((totalMillis % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}`;
};

export default function FolhaPonto({ employeeId, month, canEdit }) {
    const { user, userData } = useAuth();
    const [employee, setEmployee] = useState(null);
    const [timesheetData, setTimesheetData] = useState({});
    const [holidays, setHolidays] = useState([]);
    const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
    const [isProcessing, setIsProcessing] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [abonoTypes, setAbonoTypes] = useState([]);
    const [abonosData, setAbonosData] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [pendingDays, setPendingDays] = useState([]);
    const [proprietarios, setProprietarios] = useState([]);
    const [selectedSignatoryId, setSelectedSignatoryId] = useState('');
    const [geradoPor, setGeradoPor] = useState('');
    const isUserProprietario = userData?.funcoes?.nome_funcao === 'Proprietário';
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
    const [historicoSalarial, setHistoricoSalarial] = useState([]);
    const [isMonthClosed, setIsMonthClosed] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [saldoBancoHoras, setSaldoBancoHoras] = useState(0);
    const [feriasGozadas, setFeriasGozadas] = useState(0);

    const selectedSignatory = useMemo(() => {
        if (!selectedSignatoryId || proprietarios.length === 0) return { name: 'N/A', cpf: 'N/A' };
        const signatory = proprietarios.find(p => p.id === selectedSignatoryId);
        return signatory 
            ? { name: `${signatory.nome || ''} ${signatory.sobrenome || ''}`.trim(), cpf: signatory.funcionario?.cpf || 'N/A' }
            : { name: 'N/A', cpf: 'N/A' };
    }, [selectedSignatoryId, proprietarios]);

    const showToast = (message, type = 'info') => setToast({ show: true, message, type });

    const calculateTotalHours = useCallback((dayData) => {
        return calculateTotalHoursForEmployee(dayData, employee);
    }, [employee]);

    const loadTimesheetData = useCallback(async () => {
        if (!employeeId || !month) { setIsProcessing(false); return; }
        setIsProcessing(true);
        try {
            const [year, monthNum] = month.split('-');
            const firstDayOfMonth = `${year}-${monthNum}-01`;
            const lastDayOfMonth = new Date(year, monthNum, 0).toISOString().split('T')[0];
            
            const { data: allHolidays, error: holidayError } = await supabase.from('feriados').select('data_feriado, tipo');
            if (holidayError) throw new Error(`Erro ao buscar feriados: ${holidayError.message}`);
            setHolidays(allHolidays || []);

            const [
                { data: employeeData, error: empError },
                { data: pontosData },
                { data: abonosDoMes },
                { data: historicoData },
                { data: fechamentoData },
                { data: saldoBancoData, error: saldoError },
                { data: feriasData, error: feriasError }
            ] = await Promise.all([
                supabase.from('funcionarios').select('*, admission_date, demission_date, cpf, foto_url, jornada:jornadas(*, detalhes:jornada_detalhes(*))').eq('id', employeeId).single(),
                supabase.from('pontos').select('*, editado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_hora', `${firstDayOfMonth}T00:00:00`).lte('data_hora', `${lastDayOfMonth}T23:59:59`),
                supabase.from('abonos').select('*, criado_por_usuario_id:usuarios(nome, sobrenome)').eq('funcionario_id', employeeId).gte('data_abono', firstDayOfMonth).lte('data_abono', lastDayOfMonth),
                supabase.from('historico_salarial').select('*').eq('funcionario_id', employeeId).order('data_inicio_vigencia', { ascending: true }),
                supabase.from('banco_de_horas').select('*').eq('funcionario_id', employeeId).eq('mes_referencia', firstDayOfMonth).maybeSingle(),
                supabase.rpc('get_saldo_banco_horas', { p_funcionario_id: employeeId }),
                supabase.rpc('get_dias_ferias_gozados_ano', { p_funcionario_id: employeeId, p_ano: parseInt(year) })
            ]);

            if (empError) throw new Error(`Erro ao buscar dados do funcionário: ${empError.message}`);
            if (saldoError) throw new Error(`Erro ao buscar saldo do banco de horas: ${saldoError.message}`);
            if (feriasError) throw new Error(`Erro ao buscar saldo de férias: ${feriasError.message}`);
            
            setSaldoBancoHoras(saldoBancoData || 0);
            setFeriasGozadas(feriasData || 0);
            setEmployee(employeeData);
            setHistoricoSalarial(historicoData || []);
            setIsMonthClosed(!!fechamentoData);

            if (employeeData.foto_url) {
                const { data: urlData } = await supabase.storage.from('funcionarios-documentos').createSignedUrl(employeeData.foto_url, 3600);
                employeeData.foto_url = urlData?.signedUrl;
            }
            
            const processedAbonos = {}; (abonosDoMes || []).forEach(abono => { processedAbonos[abono.data_abono] = abono; }); setAbonosData(processedAbonos);
            const processedData = {};
            (pontosData || []).forEach(ponto => {
                if (!ponto.data_hora) return;
                const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
                const dateStr = [utcDate.getUTCFullYear(), String(utcDate.getUTCMonth() + 1).padStart(2, '0'), String(utcDate.getUTCDate()).padStart(2, '0')].join('-');
                if (!processedData[dateStr]) { processedData[dateStr] = { dateString: dateStr, observacoes: [] }; }
                const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
                const field = fieldMap[ponto.tipo_registro];
                if (field) {
                    processedData[dateStr][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    if (ponto.editado_manualmente && ponto.editado_por_usuario_id) {
                        processedData[dateStr][`${field}_manual`] = true;
                        const editorNome = `${ponto.editado_por_usuario_id.nome || ''} ${ponto.editado_por_usuario_id.sobrenome || ''}`.trim();
                        const obsText = `Campo "${ponto.tipo_registro}" editado por ${editorNome}.`;
                        if (!processedData[dateStr].observacoes.includes(obsText)) processedData[dateStr].observacoes.push(obsText);
                    }
                }
                if (ponto.observacao && !processedData[dateStr].observacoes.includes(ponto.observacao)) processedData[dateStr].observacoes.push(ponto.observacao);
            });
            Object.keys(processedData).forEach(date => { processedData[date].observacao_final = processedData[date].observacoes.join(' | '); });
            setTimesheetData(processedData);

        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
        }
    }, [employeeId, month, supabase]);

    useEffect(() => {
        loadTimesheetData();
    }, [employeeId, month, loadTimesheetData]);
    
    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: abonoTypesData } = await supabase.from('abono_tipos').select('id, descricao');
            setAbonoTypes(abonoTypesData || []);
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: userDataFromDb } = await supabase.from('usuarios').select('id, nome, sobrenome').eq('id', authUser.id).single();
                if (userDataFromDb) setCurrentUser({ id: userDataFromDb.id, nome: `${userDataFromDb.nome} ${userDataFromDb.sobrenome}`.trim() });
            }
            const { data: proprietariosData } = await supabase.from('usuarios').select('id, nome, sobrenome, funcionario:funcionarios(cpf), funcoes!inner(nome_funcao)').eq('funcoes.nome_funcao', 'Proprietário');
            setProprietarios(proprietariosData || []);
            if (isUserProprietario && user) { setSelectedSignatoryId(user.id); } 
            else if (proprietariosData?.length > 0) { setSelectedSignatoryId(proprietariosData[0].id); }
            if (userData) { setGeradoPor(`${userData.nome} ${userData.sobrenome}`); }
        };
        fetchInitialData();
    }, [supabase, user, userData, isUserProprietario]);

    const monthlyBalance = useMemo(() => {
        const dailyBalances = {};
        let total = 0;
        if (!month || !employee || isProcessing) return { dailyBalances, total };
        const [year, monthNum] = month.split('-').map(Number);
        const today = new Date();
        today.setHours(0,0,0,0);
        const lastDayOfMonth = new Date(Date.UTC(year, monthNum, 0));
        const firstDayOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
        const admissionDate = employee.admission_date ? new Date(employee.admission_date + 'T00:00:00Z') : null;
        const demissionDate = employee.demission_date ? new Date(employee.demission_date + 'T00:00:00Z') : null;

        for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            let saldoFinalDoDia = 0;
            if ((admissionDate && d < admissionDate) || (demissionDate && d > demissionDate)) {
                dailyBalances[dateString] = 0;
                continue;
            }
            const dayOfWeek = d.getUTCDay();
            const abonoDoDia = abonosData[dateString];
            const feriadoDoDia = holidays.find(h => h.data_feriado === dateString);
            const dayData = timesheetData[dateString] || { dateString };
            const totalWorkedStr = calculateTotalHours(dayData);
            const [h, m] = totalWorkedStr.split(':').map(Number);
            const totalWorkedMinutes = isNaN(h) ? 0 : (h * 60) + m;
            
            if (d > today) {
                saldoFinalDoDia = 0;
            } else if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (totalWorkedMinutes > 0) {
                    saldoFinalDoDia = totalWorkedMinutes * 1.5;
                }
            } else {
                const jornadaDoDia = employee.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeek);
                const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida;
                let minutosPrevistos = 0;
                if (isWorkday) {
                    const entradaPrev = jornadaDoDia.horario_entrada.split(':').map(Number);
                    const saidaPrev = jornadaDoDia.horario_saida.split(':').map(Number);
                    const inicioIntPrev = jornadaDoDia.horario_saida_intervalo ? jornadaDoDia.horario_saida_intervalo.split(':').map(Number) : [0,0];
                    const fimIntPrev = jornadaDoDia.horario_volta_intervalo ? jornadaDoDia.horario_volta_intervalo.split(':').map(Number) : [0,0];
                    const minutosTrabalhoPrev = (saidaPrev[0]*60 + saidaPrev[1]) - (entradaPrev[0]*60 + entradaPrev[1]);
                    const minutosIntervaloPrev = (fimIntPrev[0]*60 + fimIntPrev[1]) - (inicioIntPrev[0]*60 + inicioIntPrev[1]);
                    minutosPrevistos = minutosTrabalhoPrev - (minutosIntervaloPrev > 0 ? minutosIntervaloPrev : 0);
                }

                if (abonoDoDia) {
                    saldoFinalDoDia = 0;
                } else if (feriadoDoDia) {
                    const minutosEsperadosNoFeriado = feriadoDoDia.tipo === 'Meio Período' ? minutosPrevistos / 2 : 0;
                    saldoFinalDoDia = totalWorkedMinutes - minutosEsperadosNoFeriado;
                } else if (totalWorkedMinutes > 0) {
                    saldoFinalDoDia = totalWorkedMinutes - minutosPrevistos;
                } else {
                    saldoFinalDoDia = -minutosPrevistos;
                }
            }
            dailyBalances[dateString] = Math.round(saldoFinalDoDia);
            total += Math.round(saldoFinalDoDia);
        }
        return { dailyBalances, total };
    }, [month, employee, timesheetData, holidays, abonosData, calculateTotalHours, isProcessing]);

    const getDiariaParaData = useCallback((dateString, historico) => {
        if (!historico || historico.length === 0) return 0;
        const targetDate = new Date(dateString + 'T00:00:00Z');
        let diariaVigente = 0;
        for (const registro of historico) {
            const vigenciaDate = new Date(registro.data_inicio_vigencia + 'T00:00:00Z');
            if (vigenciaDate <= targetDate) {
                diariaVigente = parseFloat(registro.valor_diaria) || 0;
            } else {
                break; 
            }
        }
        return diariaVigente;
    }, []);

    const kpiData = useMemo(() => {
        if (!month || !employee || isProcessing || !historicoSalarial) return { dias: '0 / 0', horas: '00:00h / 00:00h', faltas: 0, valorAPagar: 'R$ 0,00' };

        const [year, monthNum] = month.split('-').map(Number);
        const today = new Date(); today.setHours(0,0,0,0);
        const firstDayOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, monthNum, 0));
        const admissionDate = employee.admission_date ? new Date(employee.admission_date + 'T00:00:00Z') : null;
        const demissionDate = employee.demission_date ? new Date(employee.demission_date + 'T00:00:00Z') : null;
        
        let diasUteisNoPeriodo = 0;
        let cargaHorariaEsperadaMinutos = 0;
        const diasPagaveis = new Set();
        const diasComBatida = new Set(Object.keys(timesheetData));
        let totalMinutosTrabalhados = 0;

        for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            if ((admissionDate && d < admissionDate) || (demissionDate && d > demissionDate)) continue;

            const dayOfWeek = d.getUTCDay();
            const isHoliday = holidays.some(h => h.data_feriado === dateString);
            const jornadaDoDia = employee.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeek);
            const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida && !isHoliday && dayOfWeek !== 0 && dayOfWeek !== 6;

            if (isWorkday) {
                diasUteisNoPeriodo++;
                const entradaPrev = jornadaDoDia.horario_entrada.split(':').map(Number);
                const saidaPrev = jornadaDoDia.horario_saida.split(':').map(Number);
                const inicioIntPrev = jornadaDoDia.horario_saida_intervalo ? jornadaDoDia.horario_saida_intervalo.split(':').map(Number) : [0,0];
                const fimIntPrev = jornadaDoDia.horario_volta_intervalo ? jornadaDoDia.horario_volta_intervalo.split(':').map(Number) : [0,0];
                const minutosTrabalhoPrev = (saidaPrev[0]*60 + saidaPrev[1]) - (entradaPrev[0]*60 + entradaPrev[1]);
                const minutosIntervaloPrev = (fimIntPrev[0]*60 + fimIntPrev[1]) - (inicioIntPrev[0]*60 + inicioIntPrev[1]);
                cargaHorariaEsperadaMinutos += minutosTrabalhoPrev - (minutosIntervaloPrev > 0 ? minutosIntervaloPrev : 0);
            }

            const abonoDoDia = abonosData[dateString];
            const temBatida = diasComBatida.has(dateString);

            if (temBatida) {
                diasPagaveis.add(dateString);
                const totalDayStr = calculateTotalHours(timesheetData[dateString]);
                if (totalDayStr !== '--:--') {
                    const [hours, minutes] = totalDayStr.split(':').map(Number);
                    totalMinutosTrabalhados += (hours * 60) + minutes;
                }
            } else if (abonoDoDia && isWorkday) {
                diasPagaveis.add(dateString);
            }
        }
        
        const totalDiasTrabalhados = diasPagaveis.size;
        
        let valorAPagar = 0;
        diasPagaveis.forEach(dateString => {
            valorAPagar += getDiariaParaData(dateString, historicoSalarial);
        });

        const horasTrabalhadasFormatada = `${Math.floor(totalMinutosTrabalhados / 60)}:${String(Math.round(totalMinutosTrabalhados % 60)).padStart(2, '0')}h`;
        const cargaHorariaEsperadaFormatada = `${Math.floor(cargaHorariaEsperadaMinutos / 60)}:${String(cargaHorariaEsperadaMinutos % 60).padStart(2, '0')}h`;
        const faltas = Math.max(0, diasUteisNoPeriodo - totalDiasTrabalhados);
        
        return { 
            dias: `${totalDiasTrabalhados} / ${diasUteisNoPeriodo}`, 
            horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`, 
            faltas,
            valorAPagar: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorAPagar)
        };
    }, [timesheetData, month, employee, holidays, abonosData, calculateTotalHours, isProcessing, historicoSalarial, getDiariaParaData]);

    useEffect(() => {
        if (!employee?.jornada?.detalhes || isProcessing) return;
        const [year, monthNum] = month.split('-').map(Number);
        const today = new Date();
        today.setHours(0,0,0,0);
        const lastDayToCheck = new Date() < new Date(year, monthNum, 0) ? today : new Date(year, monthNum, 0);
        const firstDayOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
        const pending = [];
        const admissionDate = employee.admission_date ? new Date(employee.admission_date + 'T00:00:00Z') : null;
        const demissionDate = employee.demission_date ? new Date(employee.demission_date + 'T00:00:00Z') : null;
        
        for (let d = new Date(firstDayOfMonth); d <= lastDayToCheck; d.setUTCDate(d.getUTCDate() + 1)) {
            if (admissionDate && d < admissionDate) continue;
            if (demissionDate && d > demissionDate) continue;
            const dateString = d.toISOString().split('T')[0];
            const dayOfWeek = d.getUTCDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const jornadaDoDia = employee.jornada.detalhes.find(j => j.dia_semana === dayOfWeek);
            const isWorkdayCheck = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_entrada.trim() !== '' && jornadaDoDia.horario_saida && jornadaDoDia.horario_saida.trim() !== '';
            
            const isHoliday = holidays.some(h => h.data_feriado === dateString);

            if (isWorkdayCheck && !isHoliday) {
                const dayData = timesheetData[dateString];
                const abonoDoDia = abonosData[dateString];
                const breakIsRequired = jornadaDoDia.horario_saida_intervalo && jornadaDoDia.horario_saida_intervalo.trim() !== '' && jornadaDoDia.horario_volta_intervalo && jornadaDoDia.horario_volta_intervalo.trim() !== '';
                const hasRequiredPunches = dayData && dayData.entrada && dayData.saida && (!breakIsRequired || (dayData.inicio_intervalo && dayData.fim_intervalo));
                if (!abonoDoDia && !hasRequiredPunches) {
                    pending.push(dateString);
                }
            }
        }
        setPendingDays(pending);
    }, [timesheetData, employee, holidays, month, isProcessing, abonosData]);

    const handleCellEdit = (date, field) => { if (isProcessing || !canEdit || isMonthClosed) return; setEditingCell({ date, field }); };
    const handleSaveEdit = async (e, date, field) => { 
        e.preventDefault();
        if (!currentUser) { showToast("Não foi possível identificar o usuário.", "error"); return; }
        let newValue = e.target.elements[0].value; setEditingCell(null); setIsProcessing(true);
        if (field === 'abono') {
            const abonoRecord = { funcionario_id: employeeId, data_abono: date, tipo_abono_id: newValue ? parseInt(newValue) : null, criado_por_usuario_id: currentUser.id, horas_abonadas: 8, };
            const existingAbono = abonosData[date]; let error;
            if (existingAbono && !newValue) { ({ error } = await supabase.from('abonos').delete().eq('id', existingAbono.id)); } 
            else if (newValue) { ({ error } = await supabase.from('abonos').upsert(abonoRecord, { onConflict: 'funcionario_id, data_abono', ignoreDuplicates: false })); }
            showToast(error ? `Erro: ${error.message}` : 'Abono salvo!', error ? 'error' : 'success');
        } else if (field === 'observacao') {
            const { data: pontoEntrada } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', 'Entrada').like('data_hora', `${date}%`).limit(1).single();
            if (pontoEntrada) { const { error } = await supabase.from('pontos').update({ observacao: newValue }).eq('id', pontoEntrada.id); showToast(error ? `Erro: ${error.message}` : 'Observação salva!', error ? 'error' : 'success'); } 
            else { showToast('Não há registro de entrada para adicionar observação.', 'info'); }
        } else {
            const tipo_registro = { 'entrada': 'Entrada', 'inicio_intervalo': 'Inicio_Intervalo', 'fim_intervalo': 'Fim_Intervalo', 'saida': 'Saida' }[field];
            const startOfDay = `${date}T00:00:00`; const endOfDay = `${date}T23:59:59.999`; let error;
            const { data: existingRecord } = await supabase.from('pontos').select('id').eq('funcionario_id', employeeId).eq('tipo_registro', tipo_registro).gte('data_hora', startOfDay).lte('data_hora', endOfDay).maybeSingle();
            if (!newValue) { if (existingRecord) { ({ error } = await supabase.from('pontos').delete().eq('id', existingRecord.id)); showToast(error ? `Erro: ${error.message}` : 'Registro removido.', error ? 'error' : 'success'); } } 
            else {
                const localDate = new Date(`${date}T${newValue}`);
                const recordData = { funcionario_id: employeeId, tipo_registro, data_hora: localDate.toISOString(), editado_manualmente: true, editado_por_usuario_id: currentUser.id };
                if (existingRecord) { ({ error } = await supabase.from('pontos').update(recordData).eq('id', existingRecord.id)); } 
                else { ({ error } = await supabase.from('pontos').insert(recordData)); }
                showToast(error ? `Erro: ${error.message}` : 'Alteração salva!', error ? 'error' : 'success');
            }
        }
        await loadTimesheetData(); setIsProcessing(false);
    };

    const handleCloseMonth = async () => {
        setActionLoading(true);
        
        const promise = new Promise(async (resolve, reject) => {
            const [year, monthNum] = month.split('-');
            const mes_referencia = `${year}-${monthNum}-01`;

            const { error } = await supabase.from('banco_de_horas').insert({
                funcionario_id: employeeId,
                mes_referencia: mes_referencia,
                saldo_minutos: monthlyBalance.total,
                status: 'Fechado'
            });

            if (error) {
                if (error.code === '23505') {
                    return reject(new Error('O saldo para este mês já foi fechado anteriormente.'));
                }
                return reject(error);
            }
            resolve('Saldo do mês arquivado com sucesso no banco de horas!');
        });

        toast.promise(promise, {
            loading: 'Fechando e arquivando saldo do mês...',
            success: (message) => {
                loadTimesheetData();
                return message;
            },
            error: (err) => `Erro ao fechar o mês: ${err.message}`,
            finally: () => setActionLoading(false)
        });
    };
    
    const handlePayOrDeduct = async () => {
        const valorFinal = kpiData.valorAPagar.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        const valorFinalNumerico = parseFloat(valorFinal);
    
        if (isNaN(valorFinalNumerico)) {
            toast.error("Não foi possível calcular o valor final do pagamento.");
            return;
        }
        
        const actionText = `ajustar o pagamento para ${kpiData.valorAPagar} e fechar o saldo do banco de horas`;
        if (!window.confirm(`Tem certeza que deseja ${actionText}? Esta ação irá atualizar o lançamento financeiro provisionado.`)) {
            return;
        }
        
        setActionLoading(true);
        
        const promise = new Promise(async (resolve, reject) => {
            const [year, monthNum] = month.split('-');
            const mes_competencia = `${year}-${monthNum}-01`;
    
            const { data: lancamento, error: findError } = await supabase
                .from('lancamentos')
                .select('id')
                .eq('funcionario_id', employeeId)
                .eq('mes_competencia', mes_competencia)
                .maybeSingle();
    
            if (findError) return reject(new Error(`Erro ao buscar lançamento provisionado: ${findError.message}`));
            if (!lancamento) return reject(new Error('Nenhum lançamento de salário provisionado foi encontrado para este mês. Verifique se o provisionamento foi executado.'));
            
            const { error: updateError } = await supabase
                .from('lancamentos')
                .update({ 
                    valor: valorFinalNumerico,
                    status: 'Pago',
                    data_pagamento: new Date().toISOString()
                })
                .eq('id', lancamento.id);
    
            if (updateError) return reject(new Error(`Erro ao atualizar lançamento financeiro: ${updateError.message}`));
    
            const { error: bancoError } = await supabase.from('banco_de_horas').insert({
                funcionario_id: employeeId,
                mes_referencia: mes_competencia,
                saldo_minutos: monthlyBalance.total,
                status: 'Pago'
            });
            
            if (bancoError && bancoError.code !== '23505') { 
               return reject(new Error(`Erro ao fechar banco de horas: ${bancoError.message}`));
            }
    
            resolve('Lançamento financeiro atualizado e saldo do mês fechado com sucesso!');
        });
    
        toast.promise(promise, {
            loading: 'Processando fechamento do mês...',
            success: (message) => {
                loadTimesheetData();
                return message;
            },
            error: (err) => `Erro na operação: ${err.message}`,
            finally: () => setActionLoading(false)
        });
    };
    
    if (isProcessing) { return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando dados...</div>; }
    if (!employee) return null;

    return (
        <div className="printable-area space-y-4">
            <style jsx global>{`@media print { @page { size: A4 portrait; margin: 0.8cm; } body * { visibility: hidden; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } .printable-area, .printable-area * { visibility: visible; } .printable-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; border: none !important; box-shadow: none !important; } .no-print { display: none !important; } .print-header { display: block !important; } .print-header-info h3 { font-size: 1.1rem !important; } .kpi-container-on-print { display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-top: 0.5rem; font-size: 8pt; border: 1px solid #eee; padding: 4px; border-radius: 6px; } table { font-size: 7.5pt !important; width: 100%; border-collapse: collapse !important; margin-top: 0.5rem; } th, td { border: 1px solid #ccc !important; padding: 2px !important; text-align: center; } .signature-section { margin-top: 1.5cm !important; page-break-inside: avoid; } }`}</style>
            
            {toast.show && <Toast message={toast.message} type={toast.type} onclose={() => setToast({ ...toast, show: false })} />}
            
            {pendingDays.length > 0 && (
                <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md no-print">
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 mr-3" />
                        <div>
                            <p className="font-bold">Atenção</p>
                            <p className="text-sm">Existem {pendingDays.length} dias com marcações de ponto incompletas neste mês. Por favor, verifique as linhas destacadas.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="print-header hidden">
                <div className="flex flex-row gap-4 items-center border-b pb-2 mb-2">
                    {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto" className="w-16 h-16 rounded-full object-cover" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-16 h-16 text-gray-300" /> )}
                    <div className="flex-grow text-left print-header-info">
                        <h3 className="font-bold">{employee.full_name}</h3>
                        <p className="text-sm">{employee.contract_role}</p>
                        <p className="text-xs text-gray-600">Mês de Referência: {new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
                <div className="kpi-container-on-print">
                    <div><p className="font-semibold">Dias (Trab. / Úteis):</p><p>{kpiData.dias}</p></div>
                    <div><p className="font-semibold">Horas (Trab. / Prev.):</p><p>{kpiData.horas}</p></div>
                    <div><p className="font-semibold">Faltas (período):</p><p>{kpiData.faltas}</p></div>
                </div>
            </div>
            
            <div className="flex justify-between items-start no-print">
                <div className="flex items-center gap-6">
                    {employee.foto_url ? ( <img src={employee.foto_url} alt="Foto" className="w-24 h-24 rounded-full object-cover" /> ) : ( <FontAwesomeIcon icon={faUserCircle} className="w-24 h-24 text-gray-300" /> )}
                    <div>
                        <h3 className="text-3xl font-bold">{employee.full_name}</h3>
                        <p className="text-gray-600">{employee.contract_role}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <select value={selectedSignatoryId} onChange={(e) => setSelectedSignatoryId(e.target.value)} className="p-2 border rounded-md text-sm">
                        <option value="">Assinatura do Responsável</option>
                        {proprietarios.map(p => <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>)}
                    </select>
                    <button onClick={() => window.print()} className="mt-2 bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800"><FontAwesomeIcon icon={faPrint} /> Imprimir</button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 no-print">
                <KpiCard title="Férias Gozadas (Ano)" value={`${feriasGozadas} / 30`} icon={faUmbrellaBeach} color="yellow" />
                <KpiCard title="Saldo Banco de Horas (Total)" value={formatMinutesToHours(saldoBancoHoras)} icon={faHistory} color="purple" />
                <KpiCard title="Valor a Pagar (Mês)" value={kpiData.valorAPagar} icon={faDollarSign} color="blue" />
                <KpiCard title="Dias (Trab. / Úteis)" value={kpiData.dias} icon={faCalendarCheck} color="green" />
                <KpiCard title="Faltas (no período)" value={kpiData.faltas} icon={faCalendarXmark} color="red" />
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="border p-2">Data</th><th className="border p-2">Dia</th><th className="border p-2">Entrada</th><th className="border p-2">Início Int.</th>
                            <th className="border p-2">Fim Int.</th><th className="border p-2">Saída</th><th className="border p-2">Total Horas</th>
                            <th className="border p-2">Saldo Dia</th>
                            <th className="border p-2">Abono</th><th className="border p-2">Observações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Array.from({ length: new Date(month.split('-')[0], month.split('-')[1], 0).getDate() }, (_, i) => {
                            const dayOfMonth = i + 1;
                            const dateInMonth = new Date(Date.UTC(month.split('-')[0], month.split('-')[1] - 1, dayOfMonth));
                            const dateString = dateInMonth.toISOString().split('T')[0];
                            const dayData = timesheetData[dateString] || { dateString };
                            const abonoDoDia = abonosData[dateString];
                            const feriadoDoDia = holidays.find(h => h.data_feriado === dateString);
                            
                            const totalWorkedStr = calculateTotalHours(dayData);
                            const [h, m] = totalWorkedStr.split(':').map(Number);
                            const totalWorkedMinutes = isNaN(h) ? 0 : (h * 60) + m;

                            const saldoFinalDoDia = monthlyBalance.dailyBalances[dateString];
                            
                            const isPending = pendingDays.includes(dateString);
                            let rowClass = feriadoDoDia ? 'bg-yellow-50' : (dateInMonth.getUTCDay() === 0 || dateInMonth.getUTCDay() === 6 ? 'bg-gray-50' : '');
                            if (isPending) rowClass = 'bg-yellow-100';

                            return (
                                <tr key={dateString} className={rowClass}>
                                    <td className="border p-2 text-center">{new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                    <td className="border p-2 text-center">{weekDays[dateInMonth.getUTCDay()]} {feriadoDoDia && '(Feriado)'}</td>
                                    {['entrada', 'inicio_intervalo', 'fim_intervalo', 'saida'].map(field => {
                                        const jornadaDoDia = employee.jornada?.detalhes.find(j => j.dia_semana === dateInMonth.getUTCDay());
                                        const isWorkdayCheck = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_entrada.trim() !== '' && jornadaDoDia.horario_saida && jornadaDoDia.horario_saida.trim() !== '';
                                        let isMissing = false;
                                        if (isPending && isWorkdayCheck) {
                                            const punchExists = dayData[field] && dayData[field].trim() !== '';
                                            if (field === 'entrada' || field === 'saida') { isMissing = !punchExists; } 
                                            else if (field === 'inicio_intervalo' || field === 'fim_intervalo') {
                                                const breakIsRequired = jornadaDoDia.horario_saida_intervalo && jornadaDoDia.horario_saida_intervalo.trim() !== '' && jornadaDoDia.horario_volta_intervalo && jornadaDoDia.horario_volta_intervalo.trim() !== '';
                                                isMissing = breakIsRequired && !punchExists;
                                            }
                                        }
                                        const cellClass = `border p-2 text-center ${canEdit && !isMonthClosed ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'} ${isMissing ? 'bg-red-100 border-2 border-red-400' : ''}`;
                                        
                                        return (
                                            <td key={field} onClick={() => handleCellEdit(dateString, field)} className={cellClass}>
                                                {editingCell?.date === dateString && editingCell?.field === field ? (
                                                    <form onSubmit={(e) => handleSaveEdit(e, dateString, field)}><input type="time" name="time_input" defaultValue={dayData[field] || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100"/></form>
                                                ) : (<span className="flex items-center justify-center">{dayData[`${field}_manual`] && <FontAwesomeIcon icon={faUserEdit} title="Editado manualmente" className="text-blue-500 mr-2 h-3" />}{dayData[field] || '--:--'}</span>)}
                                            </td>
                                        )
                                    })}
                                    <td className="border p-2 text-center font-semibold">{totalWorkedStr}</td>
                                    <td className={`border p-2 text-center font-bold ${abonoDoDia && totalWorkedMinutes === 0 ? 'text-gray-600' : saldoFinalDoDia > 0 ? 'text-green-600' : (saldoFinalDoDia < 0 ? 'text-red-600' : 'text-gray-600')}`}>
                                        {abonoDoDia && totalWorkedMinutes === 0 ? 'Abonado' : formatMinutesToHours(saldoFinalDoDia)}
                                    </td>
                                    <td onClick={() => handleCellEdit(dateString, 'abono')} className={`border p-2 text-center min-w-[150px] ${canEdit && !isMonthClosed ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                        {editingCell?.date === dateString && editingCell?.field === 'abono' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'abono')}><select name="abono_select" defaultValue={abonoDoDia?.tipo_abono_id || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-center bg-blue-100 p-1"><option value="">Sem Abono</option>{abonoTypes.map(type => (<option key={type.id} value={type.id}>{type.descricao}</option>))}</select></form>
                                        ) : (abonoTypes.find(t => t.id === abonoDoDia?.tipo_abono_id)?.descricao || '--')}
                                    </td>
                                    <td onClick={() => handleCellEdit(dateString, 'observacao')} className={`border p-2 text-left min-w-[200px] text-xs ${canEdit && !isMonthClosed ? 'cursor-pointer hover:bg-blue-50' : 'cursor-default'}`}>
                                         {editingCell?.date === dateString && editingCell?.field === 'observacao' ? (
                                            <form onSubmit={(e) => handleSaveEdit(e, dateString, 'observacao')}><input type="text" name="obs_input" defaultValue={dayData.observacao_final || ''} autoFocus onBlur={(e) => e.target.form.requestSubmit()} className="w-full text-left bg-blue-100 p-1"/></form>
                                        ) : (dayData.observacao_final || '--')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-200 font-bold">
                            <td colSpan="7" className="text-right px-4 py-2 uppercase text-sm">Total Saldo do Mês:</td>
                            <td colSpan="3" className={`text-center px-4 py-2 text-lg ${monthlyBalance.total > 0 ? 'text-green-700' : (monthlyBalance.total < 0 ? 'text-red-700' : 'text-gray-800')}`}>
                                {formatMinutesToHours(monthlyBalance.total)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
                 {isMonthClosed ? (
                    <div className="p-4 bg-green-100 text-green-800 text-center font-semibold no-print">
                        <FontAwesomeIcon icon={faCheckCircle} /> Este mês já foi fechado e o pagamento ajustado.
                    </div>
                ) : (
                    <div className="p-4 bg-gray-100 flex justify-end items-center gap-4 no-print">
                        <button 
                            onClick={handleCloseMonth}
                            disabled={actionLoading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                        >
                           <FontAwesomeIcon icon={actionLoading ? faSpinner : faBoxArchive} spin={actionLoading} />
                           {actionLoading ? 'Fechando...' : 'Fechar Mês (Apenas Banco de Horas)'}
                        </button>
                        <button 
                            onClick={handlePayOrDeduct}
                            disabled={actionLoading}
                            className="bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={actionLoading ? faSpinner : faHandHoldingDollar} spin={actionLoading} />
                            Fechar Mês e Ajustar Pagamento
                        </button>
                    </div>
                )}
            </div>
            
            <section className="hidden print:block signature-section text-center">
                <div className="flex justify-around items-start">
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{employee.full_name}</p>
                        <p className="text-xs">CPF: {employee.cpf || 'N/A'}</p>
                    </div>
                    <div className="w-2/5">
                        <div className="border-t border-black w-full mx-auto"></div>
                        <p className="mt-2 text-sm font-semibold">{selectedSignatory?.name}</p>
                        <p className="text-xs">CPF: {selectedSignatory?.cpf || 'N/A'}</p>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-8">Documento gerado por: {geradoPor} em {new Date().toLocaleString('pt-BR')}</p>
            </section>
        </div>
    );
}
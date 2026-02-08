// components/painel/widgets/MeuRhWidget.js
// CÓDIGO CORRIGIDO - Removidos comentários inválidos de dentro do JSX

"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faClock, faHourglassHalf, faCalendarCheck,
    faCalendarXmark, faUmbrellaBeach, faHistory
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import RhKpiItem from './RhKpiItem'; // Importa o componente de lista
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getISODay,
    differenceInMinutes, parseISO, isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Funções Auxiliares (Sem alteração) ---

const formatMinutesToHours = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '--:--';
    const sign = totalMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60);
    return `${sign}${String(hours)}h ${String(minutes).padStart(2, '0')}m`;
};

const parseTime = (timeString, baseDate) => {
    if (!timeString || typeof timeString !== 'string' || !/^\d{2}:\d{2}$/.test(timeString)) return null;
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) return null;
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        if (!isValid(date)) return null;
        return date;
    } catch {
        return null;
    }
};

const calculateTotalHoursForEmployee = (dayData, employee) => {
    if (!employee || !dayData?.dateString) return '--:--';
    const dateBase = new Date(dayData.dateString + 'T00:00:00');
    if (!isValid(dateBase)) return '--:--';
    const entrada = parseTime(dayData.entrada, dateBase);
    const saida = parseTime(dayData.saida, dateBase);
    const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase);
    const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);
    let totalMillis = 0;
    let manhaMillis = 0;
    let tardeMillis = 0;
    if (entrada && inicio_intervalo && entrada < inicio_intervalo) {
        manhaMillis = inicio_intervalo.getTime() - entrada.getTime();
    }
    if (fim_intervalo && saida && fim_intervalo < saida) {
        tardeMillis = saida.getTime() - fim_intervalo.getTime();
    }
    if (manhaMillis > 0 || tardeMillis > 0) {
        totalMillis = (manhaMillis > 0 ? manhaMillis : 0) + (tardeMillis > 0 ? tardeMillis : 0);
    } else if (entrada && saida && entrada < saida) {
        totalMillis = saida.getTime() - entrada.getTime();
    }
    if (totalMillis <= 0) return '--:--';
    const totalMinutesWorked = Math.round(totalMillis / (1000 * 60));
    if (isNaN(totalMinutesWorked) || totalMinutesWorked < 0) return '--:--';
    const totalHours = Math.floor(totalMinutesWorked / 60);
    const totalMinutesPart = totalMinutesWorked % 60;
    return `${String(totalHours).padStart(2, '0')}:${String(totalMinutesPart).padStart(2, '0')}`;
};

// --- Função Principal de Busca de Dados (Sem alteração) ---
async function fetchWidgetRhData(funcionario_id) {
    if (!funcionario_id) return null;
    const supabase = createClient();
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const primeiroDiaDoMes = format(inicioMes, 'yyyy-MM-dd');
    const ultimoDiaDoMes = format(fimMes, 'yyyy-MM-dd');
    const { data: employeeData, error: empError } = await supabase
        .from('funcionarios')
        .select('*, admission_date, demission_date, organizacao_id, jornada:jornadas(*, detalhes:jornada_detalhes(*))')
        .eq('id', funcionario_id)
        .maybeSingle();
    if (empError) throw new Error(`Erro Supabase (Funcionário): ${empError.message}`);
    if (!employeeData) return null;
    if (!employeeData.organizacao_id) throw new Error(`Funcionário ${funcionario_id} sem organização.`);
    const organizacaoId = employeeData.organizacao_id;
    const results = await Promise.allSettled([
        supabase.from('pontos').select('*').eq('funcionario_id', funcionario_id).gte('data_hora', `${primeiroDiaDoMes}T00:00:00`).lte('data_hora', `${ultimoDiaDoMes}T23:59:59`),
        supabase.from('abonos').select('*').eq('funcionario_id', funcionario_id).gte('data_abono', primeiroDiaDoMes).lte('data_abono', ultimoDiaDoMes),
        supabase.from('feriados').select('data_feriado, tipo').eq('organizacao_id', organizacaoId),
        supabase.rpc('get_saldo_banco_horas', { p_funcionario_id: funcionario_id }),
        supabase.rpc('get_dias_ferias_gozados_ano', { p_funcionario_id: funcionario_id, p_ano: anoAtual })
    ]);
    const processResult = (result, name) => {
        if (result.status === 'rejected') {
            console.error(`Falha ao buscar ${name}:`, result.reason);
            if (name === 'pontos' || name === 'abonos' || name === 'feriados') return [];
            if (name === 'saldo BH' || name === 'férias') return 0;
            throw new Error(`Falha crítica ao buscar ${name}`);
        }
        return result.value?.data ?? (Array.isArray(result.value?.data) ? [] : 0);
    };
    const pontosData = processResult(results[0], 'pontos');
    const abonosDoMes = processResult(results[1], 'abonos');
    const feriadosData = processResult(results[2], 'feriados');
    const saldoBancoData = processResult(results[3], 'saldo BH');
    const feriasData = processResult(results[4], 'férias');
    const processedPontos = {};
    (pontosData || []).forEach(ponto => {
        if (!ponto.data_hora) return;
        try {
            let dateToUse;
            const dateTimeString = ponto.data_hora.includes('T') ? ponto.data_hora : ponto.data_hora.replace(' ', 'T');
            let localDate = new Date(dateTimeString);
            if(isValid(localDate)) {
                dateToUse = localDate;
            } else {
                let utcDate = new Date(dateTimeString + 'Z');
                if(isValid(utcDate)) {
                    dateToUse = utcDate;
                } else {
                     throw new Error('Formato de data/hora inválido recebido do banco.');
                }
            }
            const dateStr = format(dateToUse, 'yyyy-MM-dd');
            if (!processedPontos[dateStr]) { processedPontos[dateStr] = { dateString: dateStr }; }
            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedPontos[dateStr][field] = format(dateToUse, 'HH:mm');
            }
        } catch (e) {
            console.error(`Erro processando ponto ID ${ponto.id} (${ponto.data_hora}): ${e.message}`);
        }
    });
    const processedAbonos = {};
    (abonosDoMes || []).forEach(abono => { processedAbonos[abono.data_abono] = abono; });
    return {
        employee: employeeData,
        timesheetData: processedPontos,
        abonosData: processedAbonos,
        holidays: feriadosData || [],
        saldoBancoHoras: saldoBancoData ?? 0,
        feriasGozadas: feriasData ?? 0,
    };
}


// --- Componente Principal ---
export default function MeuRhWidget({ funcionario_id }) {
    // Busca de dados (Sem alteração)
    const { data: rhData, isLoading, error, isError } = useQuery({
        queryKey: ['meuRhWidgetData', funcionario_id],
        queryFn: () => fetchWidgetRhData(funcionario_id),
        enabled: !!funcionario_id,
        staleTime: 1000 * 60 * 15,
        refetchOnWindowFocus: true,
    });

    // Cálculo de KPIs (Sem alteração)
    const kpisCalculados = useMemo(() => {
        if (!isLoading && !isError && rhData && rhData.employee) {
            const { employee, timesheetData, abonosData, holidays } = rhData;
            if (!employee.jornada?.detalhes) {
                return { status: 'sem_jornada' };
            }
            const hoje = new Date();
            const inicioMes = startOfMonth(hoje);
            const fimMes = endOfMonth(hoje);
            const admissionDate = employee.admission_date ? parseISO(employee.admission_date) : null;
            const demissionDate = employee.demission_date ? parseISO(employee.demission_date) : null;
            let diasUteisNoPeriodo = 0;
            let cargaHorariaEsperadaMinutos = 0;
            const diasConsideradosTrabalhados = new Set();
            const diasComBatida = new Set(Object.keys(timesheetData));
            let totalMinutosTrabalhados = 0;
            const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });
            diasDoMes.forEach(d => {
                const dateString = format(d, 'yyyy-MM-dd');
                const beforeAdmission = admissionDate && d < admissionDate;
                const afterDemission = demissionDate && d > demissionDate;
                if (beforeAdmission || afterDemission) return;
                const dayOfWeekISO = getISODay(d);
                const isHoliday = holidays.some(h => h.data_feriado === dateString);
                const dayOfWeekJornada = dayOfWeekISO === 7 ? 0 : dayOfWeekISO;
                const jornadaDoDia = employee.jornada.detalhes.find(j => j.dia_semana === dayOfWeekJornada);
                const isWeekend = dayOfWeekISO === 6 || dayOfWeekISO === 7;
                const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida && !isHoliday && !isWeekend;
                if (isWorkday) {
                    diasUteisNoPeriodo++;
                    const entradaPrev = parseTime(jornadaDoDia.horario_entrada, d);
                    const saidaPrev = parseTime(jornadaDoDia.horario_saida, d);
                    const inicioIntPrev = parseTime(jornadaDoDia.horario_saida_intervalo, d);
                    const fimIntPrev = parseTime(jornadaDoDia.horario_volta_intervalo, d);
                    let minutosTrabalhoPrevDia = 0;
                    if (entradaPrev && saidaPrev && entradaPrev < saidaPrev) {
                        minutosTrabalhoPrevDia = differenceInMinutes(saidaPrev, entradaPrev);
                    }
                    let minutosIntervaloPrevDia = 0;
                    if (inicioIntPrev && fimIntPrev && inicioIntPrev < fimIntPrev) {
                        minutosIntervaloPrevDia = differenceInMinutes(fimIntPrev, inicioIntPrev);
                    }
                    cargaHorariaEsperadaMinutos += Math.max(0, minutosTrabalhoPrevDia - minutosIntervaloPrevDia);
                }
                const abonoDoDia = abonosData[dateString];
                const temBatida = diasComBatida.has(dateString);
                const dayData = timesheetData[dateString] || { dateString };
                if (temBatida || (abonoDoDia && isWorkday)) {
                    diasConsideradosTrabalhados.add(dateString);
                }
                if (temBatida) {
                    const totalDayStr = calculateTotalHoursForEmployee(dayData, employee);
                    if (totalDayStr !== '--:--') {
                        const [hours, minutes] = totalDayStr.split(':').map(Number);
                        if (!isNaN(hours) && !isNaN(minutes)) {
                            totalMinutosTrabalhados += (hours * 60) + minutes;
                        }
                    }
                }
            });
            const totalDiasTrabalhados = diasConsideradosTrabalhados.size;
            const horasTrabalhadasFormatada = formatMinutesToHours(totalMinutosTrabalhados);
            const cargaHorariaEsperadaFormatada = formatMinutesToHours(Math.max(0, cargaHorariaEsperadaMinutos));
            const faltas = Math.max(0, diasUteisNoPeriodo - totalDiasTrabalhados);
            return {
                status: 'ok',
                dias: `${totalDiasTrabalhados} / ${diasUteisNoPeriodo}`,
                horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
                faltas,
            };
        }
        return { status: 'loading_error_nodata' };
    }, [rhData, isLoading, isError]);


    // ---- Renderização ----
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-full min-h-[150px]">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
                    <span className="ml-2 text-gray-500">Carregando...</span>
                </div>
            );
        }
        if (isError) {
             return (
                <div className="text-center text-red-500">Erro: {error?.message || 'Falha ao carregar dados.'}</div>
             );
        }
        if (!rhData) {
             return (
                 <p className="text-center text-gray-500">Dados do funcionário não encontrados.</p>
             );
        }
        if (kpisCalculados.status === 'sem_jornada') {
             return (
                 <p className="text-center text-yellow-600">Funcionário sem jornada definida. KPIs indisponíveis.</p>
             );
        }
        if (kpisCalculados.status !== 'ok') {
             return (
                 <p className="text-center text-gray-500">Não foi possível calcular os KPIs.</p>
             );
        }

        // Se chegou aqui, temos dados e cálculos OK
        const { saldoBancoHoras, feriasGozadas } = rhData;
        const { dias, horas, faltas } = kpisCalculados;

        // Renderiza a lista de KPIs (agora sem os comentários errados)
        return (
            <div className="flex flex-col space-y-2">
                <RhKpiItem
                    icon={faHistory}
                    label="Saldo Banco Horas"
                    value={formatMinutesToHours(saldoBancoHoras)}
                    colorClass={saldoBancoHoras < 0 ? 'text-red-500' : 'text-purple-500'}
                />
                <RhKpiItem
                    icon={faHourglassHalf}
                    label="Horas Mês (Trab/Prev)"
                    value={horas}
                    colorClass="text-blue-500"
                />
                <RhKpiItem
                    icon={faCalendarCheck}
                    label="Dias Mês (Trab/Úteis)"
                    value={dias}
                    colorClass="text-green-500"
                />
                <RhKpiItem
                    icon={faCalendarXmark}
                    label="Faltas (Mês)"
                    value={faltas.toString()}
                    colorClass="text-red-500"
                />
                <RhKpiItem
                    icon={faUmbrellaBeach}
                    label="Férias Gozadas (Ano)"
                    value={`${feriasGozadas} / 30`}
                    colorClass="text-yellow-500"
                />
            </div>
        );
    };

    // Renderiza o widget principal (agora sem os comentários errados)
    return (
        <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Meu Resumo RH</h3>
                {/* Link só aparece se os dados foram carregados */}
                {!isLoading && !isError && rhData && (
                     <Link href="/recursos-humanos">
                        <span className="text-sm text-blue-600 hover:underline">Ver Folha Completa</span>
                    </Link>
                )}
            </div>
            {renderContent()}
        </div>
    );
}
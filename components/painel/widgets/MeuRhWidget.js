// components/painel/widgets/MeuRhWidget.js
// CÓDIGO CORRIGIDO - Usando o Supabase Client correto e com o caminho de import correto

"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// =================================================================
// INÍCIO DA CORREÇÃO
// O PORQUÊ: Trocamos o import do cliente antigo ('@supabase/auth-helpers-nextjs')
// pelo import do cliente novo (ssr), o mesmo usado pelo FolhaPonto.js.
import { createClient } from '../../../utils/supabase/client'; // Caminho corrigido
// =================================================================
// FIM DA CORREÇÃO
// =================================================================
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faClock, faHourglassHalf, faCalendarCheck,
    faCalendarXmark, faUmbrellaBeach, faHistory
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import KpiCard from '@/components/KpiCard'; // Assumindo que @/components aponta para a pasta 'components'
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getISODay,
    differenceInMinutes, parseISO, isValid
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Funções Auxiliares (Copiadas/Adaptadas de FolhaPonto.js) ---

const formatMinutesToHours = (totalMinutes) => {
    // Mantém a formatação consistente: "Xh YYm" ou "-Xh YYm"
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '--:--';
    const sign = totalMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60); // Arredonda os minutos
    return `${sign}${String(hours)}h ${String(minutes).padStart(2, '0')}m`;
};

const parseTime = (timeString, baseDate) => {
    // Validação mais rigorosa do formato HH:MM
    if (!timeString || typeof timeString !== 'string' || !/^\d{2}:\d{2}$/.test(timeString)) return null;
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        // Valida limites de horas e minutos
        if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

        // Cria a data no fuso local do navegador
        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);

        if (!isValid(date)) return null; // Checa validade final
        return date;
    } catch {
        return null; // Captura qualquer erro inesperado no parsing
    }
};


const calculateTotalHoursForEmployee = (dayData, employee) => {
    // Função crucial para calcular horas trabalhadas no dia
    if (!employee || !dayData?.dateString) return '--:--';

    // Interpreta a data do dia no fuso local
    const dateBase = new Date(dayData.dateString + 'T00:00:00');
    if (!isValid(dateBase)) return '--:--';

    // Parse dos horários registrados, baseados na data local
    const entrada = parseTime(dayData.entrada, dateBase);
    const saida = parseTime(dayData.saida, dateBase);
    const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase);
    const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);

    let totalMillis = 0;
    let manhaMillis = 0;
    let tardeMillis = 0;

    // Calcula período da manhã (somente se entrada < inicio_intervalo)
    if (entrada && inicio_intervalo && entrada < inicio_intervalo) {
        manhaMillis = inicio_intervalo.getTime() - entrada.getTime();
    }
    // Calcula período da tarde (somente se fim_intervalo < saida)
    if (fim_intervalo && saida && fim_intervalo < saida) {
        tardeMillis = saida.getTime() - fim_intervalo.getTime();
    }

    // Soma os períodos válidos ou calcula direto se não houve intervalo
    if (manhaMillis > 0 || tardeMillis > 0) {
        totalMillis = (manhaMillis > 0 ? manhaMillis : 0) + (tardeMillis > 0 ? tardeMillis : 0);
    } else if (entrada && saida && entrada < saida) { // Sem intervalo, mas com entrada/saída válidas
        totalMillis = saida.getTime() - entrada.getTime();
    }

    // Se o total for zero ou negativo, retorna '--:--'
    if (totalMillis <= 0) return '--:--';

    // Converte milissegundos para minutos totais
    const totalMinutesWorked = Math.round(totalMillis / (1000 * 60));

    if (isNaN(totalMinutesWorked) || totalMinutesWorked < 0) return '--:--'; // Validação final

    // Formata para HH:MM
    const totalHours = Math.floor(totalMinutesWorked / 60);
    const totalMinutesPart = totalMinutesWorked % 60;
    return `${String(totalHours).padStart(2, '0')}:${String(totalMinutesPart).padStart(2, '0')}`;
};


// --- Função Principal de Busca de Dados ---
async function fetchWidgetRhData(funcionario_id) {
    if (!funcionario_id) return null; // Retorna cedo se ID for inválido

    // =================================================================
    // INÍCIO DA CORREÇÃO
    // O PORQUÊ: Trocamos o cliente para o mesmo do FolhaPonto.js
    const supabase = createClient();
    // =================================================================
    // FIM DA CORREÇÃO
    // =================================================================

    const hoje = new Date(); // Data local para referência do mês/ano
    const anoAtual = hoje.getFullYear();
    const inicioMes = startOfMonth(hoje); // Primeira data local do mês
    const fimMes = endOfMonth(hoje);     // Última data local do mês
    const primeiroDiaDoMes = format(inicioMes, 'yyyy-MM-dd'); // Formato YYYY-MM-DD
    const ultimoDiaDoMes = format(fimMes, 'yyyy-MM-dd');   // Formato YYYY-MM-DD
    const mesReferenciaRpc = format(inicioMes, 'yyyy-MM-01'); // Para RPCs que esperam o 1º dia

    // 1. Busca Funcionário e Jornada (essencial)
    const { data: employeeData, error: empError } = await supabase
        .from('funcionarios')
        .select('*, admission_date, demission_date, organizacao_id, jornada:jornadas(*, detalhes:jornada_detalhes(*))')
        .eq('id', funcionario_id)
        .maybeSingle(); // Permite não encontrar sem dar erro

    if (empError) throw new Error(`Erro Supabase (Funcionário): ${empError.message}`);
    if (!employeeData) return null; // Se não achou, não há dados de RH
    if (!employeeData.organizacao_id) throw new Error(`Funcionário ${funcionario_id} sem organização.`); // Organização é necessária

    const organizacaoId = employeeData.organizacao_id;

    // 2. Buscas Paralelas (Pontos, Abonos, Feriados, Saldos)
    const results = await Promise.allSettled([
        supabase.from('pontos').select('*').eq('funcionario_id', funcionario_id).gte('data_hora', `${primeiroDiaDoMes}T00:00:00`).lte('data_hora', `${ultimoDiaDoMes}T23:59:59`),
        supabase.from('abonos').select('*').eq('funcionario_id', funcionario_id).gte('data_abono', primeiroDiaDoMes).lte('data_abono', ultimoDiaDoMes),
        supabase.from('feriados').select('data_feriado, tipo').eq('organizacao_id', organizacaoId),
        supabase.rpc('get_saldo_banco_horas', { p_funcionario_id: funcionario_id }),
        supabase.rpc('get_dias_ferias_gozados_ano', { p_funcionario_id: funcionario_id, p_ano: anoAtual })
    ]);

    // Helper para processar resultados do Promise.allSettled
    const processResult = (result, name) => {
        if (result.status === 'rejected') {
            console.error(`Falha ao buscar ${name}:`, result.reason);
            // Decide se lança erro ou retorna valor padrão
            if (name === 'pontos' || name === 'abonos' || name === 'feriados') return []; // Listas podem ser vazias
            if (name === 'saldo BH' || name === 'férias') return 0; // Saldos podem ser 0
            throw new Error(`Falha crítica ao buscar ${name}`);
        }
        // Para RPCs, o Supabase retorna { data: valor }, para selects { data: [...] }
        return result.value?.data ?? (Array.isArray(result.value?.data) ? [] : 0); // Garante 0 para RPCs nulas
    };

    const pontosData = processResult(results[0], 'pontos');
    const abonosDoMes = processResult(results[1], 'abonos');
    const feriadosData = processResult(results[2], 'feriados');
    const saldoBancoData = processResult(results[3], 'saldo BH');
    const feriasData = processResult(results[4], 'férias');

    // 3. Processa Pontos (agrupa por dia)
    const processedPontos = {};
    (pontosData || []).forEach(ponto => {
        if (!ponto.data_hora) return;
        try {
            // Tenta interpretar a data/hora vinda do banco
            // IMPORTANTE: Testar se o Supabase retorna 'YYYY-MM-DD HH:MM:SS' ou ISO
            // Assumindo formato que `new Date()` entenda localmente ou com 'Z'
            let dateToUse;
            const dateTimeString = ponto.data_hora.includes('T') ? ponto.data_hora : ponto.data_hora.replace(' ', 'T');
            
            // Tenta interpretar como local primeiro
            let localDate = new Date(dateTimeString);
            if(isValid(localDate)) {
                dateToUse = localDate;
            } else {
                // Se falhar, tenta como UTC
                let utcDate = new Date(dateTimeString + 'Z');
                if(isValid(utcDate)) {
                    dateToUse = utcDate; // Se UTC for válido, usa ele
                } else {
                     throw new Error('Formato de data/hora inválido recebido do banco.');
                }
            }


            const dateStr = format(dateToUse, 'yyyy-MM-dd'); // Chave YYYY-MM-DD
            if (!processedPontos[dateStr]) { processedPontos[dateStr] = { dateString: dateStr }; }

            const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
            const field = fieldMap[ponto.tipo_registro];
            if (field) {
                processedPontos[dateStr][field] = format(dateToUse, 'HH:mm'); // Hora formatada HH:MM
            }
        } catch (e) {
            console.error(`Erro processando ponto ID ${ponto.id} (${ponto.data_hora}): ${e.message}`);
        }
    });

    // 4. Processa Abonos (mapeia por data)
    const processedAbonos = {};
    (abonosDoMes || []).forEach(abono => { processedAbonos[abono.data_abono] = abono; });

    // 5. Retorna o objeto completo para o useQuery
    return {
        employee: employeeData,
        timesheetData: processedPontos,
        abonosData: processedAbonos,
        holidays: feriadosData || [],
        saldoBancoHoras: saldoBancoData ?? 0, // Garante que é número
        feriasGozadas: feriasData ?? 0,     // Garante que é número
    };
}


// --- Componente Principal ---
export default function MeuRhWidget({ funcionario_id }) {
    // Busca os dados usando a função dedicada
    const { data: rhData, isLoading, error, isError } = useQuery({
        queryKey: ['meuRhWidgetData', funcionario_id], // Chave específica para o widget
        queryFn: () => fetchWidgetRhData(funcionario_id),
        enabled: !!funcionario_id, // Só executa se funcionario_id for válido
        staleTime: 1000 * 60 * 15, // Cache de 15 minutos
        refetchOnWindowFocus: true, // Atualiza ao focar na janela
    });

    // Calcula os KPIs usando useMemo, espelhando a lógica de FolhaPonto.js
    const kpisCalculados = useMemo(() => {
        // Se não está carregando, não deu erro e os dados existem...
        if (!isLoading && !isError && rhData && rhData.employee) {
            const { employee, timesheetData, abonosData, holidays } = rhData;

            // ...mas o funcionário não tem jornada definida...
            if (!employee.jornada?.detalhes) {
                return { status: 'sem_jornada' }; // Estado especial para tratar na renderização
            }

            // ...continua com os cálculos normais
            const hoje = new Date();
            const inicioMes = startOfMonth(hoje);
            const fimMes = endOfMonth(hoje);
            const admissionDate = employee.admission_date ? parseISO(employee.admission_date) : null;
            const demissionDate = employee.demission_date ? parseISO(employee.demission_date) : null;

            let diasUteisNoPeriodo = 0;
            let cargaHorariaEsperadaMinutos = 0;
            const diasConsideradosTrabalhados = new Set(); // Inclui batidas e abonos
            const diasComBatida = new Set(Object.keys(timesheetData));
            let totalMinutosTrabalhados = 0;

            const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });

            diasDoMes.forEach(d => {
                const dateString = format(d, 'yyyy-MM-dd');
                // Pula dias fora do contrato
                const beforeAdmission = admissionDate && d < admissionDate;
                const afterDemission = demissionDate && d > demissionDate;
                if (beforeAdmission || afterDemission) return;

                const dayOfWeekISO = getISODay(d); // 1=Seg, 7=Dom
                const isHoliday = holidays.some(h => h.data_feriado === dateString);
                // Ajusta dia ISO (1-7) para o formato da jornada (0=Dom, 1=Seg...)
                const dayOfWeekJornada = dayOfWeekISO === 7 ? 0 : dayOfWeekISO;
                const jornadaDoDia = employee.jornada.detalhes.find(j => j.dia_semana === dayOfWeekJornada);
                const isWeekend = dayOfWeekISO === 6 || dayOfWeekISO === 7;

                // Dia útil se tem jornada, não é feriado e não é fim de semana
                const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida && !isHoliday && !isWeekend;

                if (isWorkday) {
                    diasUteisNoPeriodo++;
                    // Calcula carga horária prevista para o dia útil
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
                    // Adiciona apenas se for positivo
                    cargaHorariaEsperadaMinutos += Math.max(0, minutosTrabalhoPrevDia - minutosIntervaloPrevDia);
                }

                const abonoDoDia = abonosData[dateString];
                const temBatida = diasComBatida.has(dateString);
                const dayData = timesheetData[dateString] || { dateString };

                // Conta como dia trabalhado se teve ponto OU se foi abonado em dia útil
                if (temBatida || (abonoDoDia && isWorkday)) {
                    diasConsideradosTrabalhados.add(dateString);
                }

                // Soma horas apenas dos dias que tiveram batida de ponto
                if (temBatida) {
                    const totalDayStr = calculateTotalHoursForEmployee(dayData, employee);
                    if (totalDayStr !== '--:--') {
                        const [hours, minutes] = totalDayStr.split(':').map(Number);
                        if (!isNaN(hours) && !isNaN(minutes)) {
                            totalMinutosTrabalhados += (hours * 60) + minutes;
                        }
                    }
                }
            }); // Fim do loop pelos dias do mês

            const totalDiasTrabalhados = diasConsideradosTrabalhados.size;
            const horasTrabalhadasFormatada = formatMinutesToHours(totalMinutosTrabalhados);
            const cargaHorariaEsperadaFormatada = formatMinutesToHours(Math.max(0, cargaHorariaEsperadaMinutos)); // Evita negativo
            const faltas = Math.max(0, diasUteisNoPeriodo - totalDiasCoo); // Faltas = Dias úteis menos os dias trabalhados/abonados

            return {
                status: 'ok', // Indica que os cálculos foram bem sucedidos
                dias: `${totalDiasTrabalhados} / ${diasUteisNoPeriodo}`,
                horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
                faltas,
            };
        }

        // Se estiver carregando, com erro, ou sem dados/funcionário, retorna estado inicial/inválido
        return { status: 'loading_error_nodata' };

    }, [rhData, isLoading, isError]); // Depende do resultado da query


    // ---- Renderização ----
    const renderContent = () => {
        if (isLoading) {
            return ( /* JSX de Loading */
                <div className="flex justify-center items-center h-full min-h-[150px]">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
                    <span className="ml-2 text-gray-500">Carregando...</span>
                </div>
            );
        }
        if (isError) {
             return ( /* JSX de Erro */
                <div className="text-center text-red-500">Erro: {error?.message || 'Falha ao carregar dados.'}</div>
             );
        }
        if (!rhData) {
             return ( /* JSX Funcionário não encontrado */
                 <p className="text-center text-gray-500">Dados do funcionário não encontrados.</p>
             );
        }
        if (kpisCalculados.status === 'sem_jornada') {
             return ( /* JSX Sem Jornada */
                 <p className="text-center text-yellow-600">Funcionário sem jornada definida. KPIs indisponíveis.</p>
             );
        }
        if (kpisCalculados.status !== 'ok') {
             return ( /* JSX estado inesperado */
                 <p className="text-center text-gray-500">Não foi possível calcular os KPIs.</p>
             );
        }

        // Se chegou aqui, temos dados e cálculos OK
        const { saldoBancoHoras, feriasGozadas } = rhData;
        const { dias, horas, faltas } = kpisCalculados;

        return (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard title="Saldo Banco Horas" value={formatMinutesToHours(saldoBancoHoras)} icon={faHistory} color={saldoBancoHoras < 0 ? 'text-red-500' : 'text-purple-500'} size="small" />
                <KpiCard title="Horas Mês (Trab/Prev)" value={horas} icon={faHourglassHalf} color="text-blue-500" size="small" />
                <KpiCard title="Dias Mês (Trab/Úteis)" value={dias} icon={faCalendarCheck} color="text-green-500" size="small" />
                <KpiCard title="Faltas (Mês)" value={faltas.toString()} icon={faCalendarXmark} color="text-red-500" size="small" />
                <KpiCard title="Férias Gozadas (Ano)" value={`${feriasGozadas} / 30`} icon={faUmbrellaBeach} color="text-yellow-500" size="small" />
            </div>
        );
    };

    return (
        <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full min-h-[200px]">
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
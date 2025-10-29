// components/painel/widgets/MeuRhWidget.js
// CÓDIGO CORRIGIDO - Usa maybeSingle() e trata funcionário não encontrado

"use client";

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'; // Corrigido o import
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faClock, faHourglassHalf, faCalendarCheck,
    faCalendarXmark, faUmbrellaBeach, faHistory
} from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import KpiCard from '@/components/KpiCard';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getISODay,
    differenceInMinutes, parseISO, setHours, setMinutes, setSeconds, setMilliseconds
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

async function fetchResumoRhCompleto(funcionario_id) {
  // Adiciona verificação explícita no início
  if (!funcionario_id) {
      console.warn("fetchResumoRhCompleto chamado sem funcionario_id.");
      return null; // Retorna null cedo se não houver ID
  }
  const supabase = createClientComponentClient(); // Usa o client correto
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtualStr = format(hoje, 'yyyy-MM');
  const primeiroDiaDoMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
  const ultimoDiaDoMes = format(endOfMonth(hoje), 'yyyy-MM-dd');

  // 1. Buscar dados do funcionário usando maybeSingle()
  const { data: employeeData, error: empError } = await supabase
    .from('funcionarios')
    .select('*, admission_date, demission_date, organizacao_id, jornada:jornadas(*, detalhes:jornada_detalhes(*))')
    .eq('id', funcionario_id)
    .maybeSingle(); // <-- MUDANÇA PRINCIPAL: de .single() para .maybeSingle()

  // Trata erro ou resultado nulo
  if (empError) {
      console.error(`Erro ao buscar funcionário ID ${funcionario_id}:`, empError);
      throw new Error(`Erro ao buscar funcionário: ${empError.message}`);
  }
  if (!employeeData) {
      console.warn(`Funcionário com ID ${funcionario_id} não encontrado.`);
      return null; // Retorna null se o funcionário não for encontrado
  }
  if (!employeeData.organizacao_id) {
      console.warn(`Funcionário ID ${funcionario_id} sem organização definida.`);
      // Considerar se isso deve ser um erro ou tratado como null
      return null; // Retornando null por consistência
  }

  const organizacaoId = employeeData.organizacao_id;

  // 2. Buscar pontos, abonos, feriados e saldos (em paralelo)
  const [
    { data: pontosData, error: pontosError },
    { data: abonosDoMes, error: abonosError },
    { data: feriadosData, error: feriadosError },
    { data: saldoBancoData, error: saldoError },
    { data: feriasData, error: feriasError }
  ] = await Promise.all([
    supabase.from('pontos').select('*').eq('funcionario_id', funcionario_id).gte('data_hora', `${primeiroDiaDoMes}T00:00:00`).lte('data_hora', `${ultimoDiaDoMes}T23:59:59`),
    supabase.from('abonos').select('*').eq('funcionario_id', funcionario_id).gte('data_abono', primeiroDiaDoMes).lte('data_abono', ultimoDiaDoMes),
    supabase.from('feriados').select('data_feriado, tipo').eq('organizacao_id', organizacaoId),
    supabase.rpc('get_saldo_banco_horas', { p_funcionario_id: funcionario_id }),
    supabase.rpc('get_dias_ferias_gozados_ano', { p_funcionario_id: funcionario_id, p_ano: anoAtual })
  ]);

  // Checagens de erro para as buscas paralelas
  if (pontosError) throw new Error(`Erro ao buscar pontos: ${pontosError.message}`);
  if (abonosError) throw new Error(`Erro ao buscar abonos: ${abonosError.message}`);
  if (feriadosError) throw new Error(`Erro ao buscar feriados: ${feriadosError.message}`);
  if (saldoError) throw new Error(`Erro ao buscar saldo BH: ${saldoError.message}`);
  if (feriasError) throw new Error(`Erro ao buscar férias: ${feriasError.message}`);

  // 3. Processar pontos para agrupar por dia
  const processedPontos = {};
  (pontosData || []).forEach(ponto => {
    if (!ponto.data_hora) return;
    try {
        const utcDate = parseISO(ponto.data_hora);
        if (isNaN(utcDate)) throw new Error('Data inválida');
        const dateStr = format(utcDate, 'yyyy-MM-dd');
        if (!processedPontos[dateStr]) { processedPontos[dateStr] = { dateString: dateStr }; }
        const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
        const field = fieldMap[ponto.tipo_registro];
        if (field) {
            processedPontos[dateStr][field] = format(utcDate, 'HH:mm');
        }
    } catch (e) {
        console.error(`Erro ao processar ponto ID ${ponto.id} com data_hora ${ponto.data_hora}: ${e.message}`);
    }
  });

  // 4. Processar abonos
  const processedAbonos = {};
  (abonosDoMes || []).forEach(abono => { processedAbonos[abono.data_abono] = abono; });

  // Retorna a estrutura completa apenas se employeeData foi encontrado
  return {
    employee: employeeData,
    timesheetData: processedPontos,
    abonosData: processedAbonos,
    holidays: feriadosData || [],
    saldoBancoHoras: saldoBancoData || 0,
    feriasGozadas: feriasData || 0,
    currentMonth: mesAtualStr,
  };
}

// Funções utilitárias (sem alterações significativas, mas revisadas para consistência)
const formatMinutesToHours = (totalMinutes) => {
    if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return '--:--';
    const sign = totalMinutes < 0 ? '-' : '';
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = Math.round(absMinutes % 60);
    return `${sign}${String(hours)}h ${String(minutes).padStart(2, '0')}m`;
};

const parseTime = (timeString, baseDate) => {
    if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return null;
        let localDate = new Date(baseDate);
        localDate.setHours(hours, minutes, 0, 0);
        return localDate;
    } catch {
        return null;
    }
};

const calculateTotalHoursForEmployee = (dayData, employee) => {
    if (!employee || !dayData?.dateString) return '--:--'; // Adicionado check para dayData
    const dateBase = new Date(dayData.dateString + 'T00:00:00'); // Fuso local
    const entrada = parseTime(dayData.entrada, dateBase);
    const saida = parseTime(dayData.saida, dateBase);
    const inicio_intervalo = parseTime(dayData.inicio_intervalo, dateBase);
    const fim_intervalo = parseTime(dayData.fim_intervalo, dateBase);
    let totalMillis = 0; // Inicializa com 0
    let manhaMillis = 0; let tardeMillis = 0;

    if (entrada && inicio_intervalo) { manhaMillis = inicio_intervalo.getTime() - entrada.getTime(); }
    if (fim_intervalo && saida) { tardeMillis = saida.getTime() - fim_intervalo.getTime(); }

    if (manhaMillis > 0 || tardeMillis > 0) { // Se houve intervalo válido
        totalMillis = (manhaMillis > 0 ? manhaMillis : 0) + (tardeMillis > 0 ? tardeMillis : 0);
    } else if (entrada && saida) { // Se não houve intervalo, calcula direto
        totalMillis = saida.getTime() - entrada.getTime();
    }

    if (totalMillis <= 0) return '--:--';

    // Usar differenceInMinutes para robustez
     const startCalc = new Date(dateBase.getTime()); // Cria uma cópia para não modificar dateBase
     const endCalc = new Date(dateBase.getTime() + totalMillis);
     const totalMinutesWorked = differenceInMinutes(endCalc, startCalc);

    // Evita resultados negativos ou absurdos se algo der errado
    if (isNaN(totalMinutesWorked) || totalMinutesWorked < 0) return '--:--';

    const totalHours = Math.floor(totalMinutesWorked / 60);
    const totalMinutesPart = totalMinutesWorked % 60; // Nome da variável corrigido

    return `${String(totalHours).padStart(2, '0')}:${String(totalMinutesPart).padStart(2, '0')}`;
};


export default function MeuRhWidget({ funcionario_id }) {
  const { data: resumoCompleto, isLoading, error } = useQuery({
    queryKey: ['meuRhResumoCompleto', funcionario_id],
    queryFn: () => fetchResumoRhCompleto(funcionario_id),
    enabled: !!funcionario_id, // Query só roda se funcionario_id for válido
  });

  const kpisCalculados = useMemo(() => {
    // Verifica se resumoCompleto ou employee é nulo/indefinido
    if (!resumoCompleto || !resumoCompleto.employee) {
      return { dias: 'N/A', horas: 'N/A', faltas: 'N/A' }; // Valores padrão
    }

    const { employee, timesheetData, abonosData, holidays, currentMonth } = resumoCompleto;
    const [year, monthNum] = currentMonth.split('-').map(Number);
    const hoje = new Date();
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    // Assegura que datas de admissão/demissão são objetos Date ou null
    const admissionDate = employee.admission_date ? parseISO(employee.admission_date) : null;
    const demissionDate = employee.demission_date ? parseISO(employee.demission_date) : null;

    let diasUteisNoPeriodo = 0;
    let cargaHorariaEsperadaMinutos = 0;
    const diasPagaveis = new Set();
    const diasComBatida = new Set(Object.keys(timesheetData));
    let totalMinutosTrabalhados = 0;

    const diasDoMes = eachDayOfInterval({ start: inicioMes, end: fimMes });

    diasDoMes.forEach(d => {
        const dateString = format(d, 'yyyy-MM-dd');
        // Checa se a data está fora do período de contrato
        const beforeAdmission = admissionDate && d < admissionDate;
        const afterDemission = demissionDate && d > demissionDate;
        if (beforeAdmission || afterDemission) return; // Pula o dia

        const dayOfWeekISO = getISODay(d); // 1 (Seg) a 7 (Dom)
        const isHoliday = holidays.some(h => h.data_feriado === dateString);
        // Ajusta dia ISO (1-7) para o formato da jornada (0=Dom, 1=Seg...)
        const dayOfWeekJornada = dayOfWeekISO === 7 ? 0 : dayOfWeekISO;
        const jornadaDoDia = employee.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeekJornada);

        const isWeekend = dayOfWeekISO === 6 || dayOfWeekISO === 7;
        // Considera dia útil se tem jornada definida, não é feriado e não é fim de semana
        const isWorkday = jornadaDoDia && jornadaDoDia.horario_entrada && jornadaDoDia.horario_saida && !isHoliday && !isWeekend;

        if (isWorkday) {
            diasUteisNoPeriodo++;
            const entradaPrev = parseTime(jornadaDoDia.horario_entrada, d);
            const saidaPrev = parseTime(jornadaDoDia.horario_saida, d);
            const inicioIntPrev = parseTime(jornadaDoDia.horario_saida_intervalo, d);
            const fimIntPrev = parseTime(jornadaDoDia.horario_volta_intervalo, d);

            let minutosTrabalhoPrev = 0;
            if(entradaPrev && saidaPrev) {
                minutosTrabalhoPrev = differenceInMinutes(saidaPrev, entradaPrev);
            }

            let minutosIntervaloPrev = 0;
            if(inicioIntPrev && fimIntPrev) {
                 minutosIntervaloPrev = differenceInMinutes(fimIntPrev, inicioIntPrev);
            }
            // Garante que não subtraia intervalo negativo ou zero
            cargaHorariaEsperadaMinutos += minutosTrabalhoPrev - (minutosIntervaloPrev > 0 ? minutosIntervaloPrev : 0);
        }

        const abonoDoDia = abonosData[dateString];
        const temBatida = diasComBatida.has(dateString);
        const dayData = timesheetData[dateString] || { dateString }; // Garante que dayData exista

        if (temBatida) {
            diasPagaveis.add(dateString);
            const totalDayStr = calculateTotalHoursForEmployee(dayData, employee); // Passa dayData
            if (totalDayStr !== '--:--') {
                const [hours, minutes] = totalDayStr.split(':').map(Number);
                // Valida se horas e minutos são números antes de somar
                if(!isNaN(hours) && !isNaN(minutes)) {
                    totalMinutosTrabalhados += (hours * 60) + minutes;
                }
            }
        } else if (abonoDoDia && isWorkday) {
            diasPagaveis.add(dateString);
        }
    });

    const totalDiasTrabalhados = diasPagaveis.size;
    const horasTrabalhadasFormatada = formatMinutesToHours(totalMinutosTrabalhados);
    const cargaHorariaEsperadaFormatada = formatMinutesToHours(cargaHorariaEsperadaMinutos);
    const faltas = Math.max(0, diasUteisNoPeriodo - totalDiasTrabalhados);

    return {
      dias: `${totalDiasTrabalhados} / ${diasUteisNoPeriodo}`,
      horas: `${horasTrabalhadasFormatada} / ${cargaHorariaEsperadaFormatada}`,
      faltas,
    };
  }, [resumoCompleto]);


  // ---- Renderização ----
  if (isLoading) {
    return (
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full flex justify-center items-center min-h-[150px]"> {/* Adicionado min-h */}
        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-400" />
        <span className="ml-2 text-gray-500">Carregando Resumo RH...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full min-h-[150px]"> {/* Adicionado min-h */}
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Meu Resumo RH</h3>
        <div className="text-center text-red-500">Erro: {error.message}</div>
      </div>
    );
  }

  // Verifica se resumoCompleto é null (caso funcionário não encontrado ou outro erro inicial)
  if (!resumoCompleto) {
     return (
        <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full min-h-[150px]"> {/* Adicionado min-h */}
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Meu Resumo RH</h3>
            <p className="text-center text-gray-500">Dados do funcionário não encontrados ou indisponíveis.</p>
        </div>
     );
  }

  // Se chegou aqui, resumoCompleto existe e tem a propriedade employee
  const { saldoBancoHoras, feriasGozadas } = resumoCompleto;
  // kpisCalculados usará 'N/A' se resumoCompleto for null, mas aqui já garantimos que não é
  const { dias, horas, faltas } = kpisCalculados;

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Meu Resumo RH</h3>
        <Link href="/recursos-humanos">
          <span className="text-sm text-blue-600 hover:underline">Ver Folha Completa</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          title="Saldo Banco Horas (Total)"
          value={formatMinutesToHours(saldoBancoHoras)}
          icon={faHistory}
          color={saldoBancoHoras < 0 ? 'red' : 'purple'}
          size="small"
        />
         <KpiCard
          title="Horas Mês (Trab / Prev)"
          value={horas}
          icon={faHourglassHalf}
          color="blue"
          size="small"
        />
         <KpiCard
          title="Dias Mês (Trab / Úteis)"
          value={dias}
          icon={faCalendarCheck}
          color="green"
          size="small"
        />
        <KpiCard
          title="Faltas (Mês)"
          value={faltas.toString()}
          icon={faCalendarXmark}
          color="red"
          size="small"
        />
        <KpiCard
          title="Férias Gozadas (Ano)"
          value={`${feriasGozadas} / 30`}
          icon={faUmbrellaBeach}
          color="yellow"
          size="small"
        />
      </div>
    </div>
  );
}
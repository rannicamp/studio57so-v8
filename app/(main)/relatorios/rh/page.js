"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUsers, faMoneyBillWave, faCalendarCheck, faBusinessTime } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const KpiCard = ({ title, value, subtext, icon, color, isLoading }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow">
    {isLoading && (
      <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
        <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
      </div>
    )}
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className={`text-2xl font-bold text-gray-800`}>{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600`}>
      <FontAwesomeIcon icon={icon} className="text-xl" />
    </div>
  </div>
);

// Helpers espelhados do FolhaPonto.js para garantir precisão
const parseTime = (timeString, baseDate) => {
  if (!timeString || timeString === '--:--' || typeof timeString !== 'string') return null;
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const date = new Date(baseDate); 
  date.setUTCHours(hours, minutes, 0, 0); 
  return date;
};

const adjustTime = (actualTimeStr, scheduledTimeStr, tolerancia) => {
  if (!actualTimeStr || !scheduledTimeStr || !tolerancia || tolerancia === 0) return actualTimeStr;
  const baseDate = '1970-01-01T';
  const actualDate = new Date(`${baseDate}${actualTimeStr}:00Z`);
  const scheduledDate = new Date(`${baseDate}${scheduledTimeStr}Z`);
  if (isNaN(actualDate.getTime()) || isNaN(scheduledDate.getTime())) return actualTimeStr;
  const diffMinutes = (actualDate.getTime() - scheduledDate.getTime()) / 60000;
  if (Math.abs(diffMinutes) <= tolerancia) return scheduledTimeStr;
  return actualTimeStr;
};

// Nova e Robusta Lógica de Master Sheet
const calculateMasterSheet = (funcionarios, historicos, abonos, feriados, pontos, monthIndexStr) => {
  const [year, monthStr] = monthIndexStr.split('-');
  const monthNum = parseInt(monthStr, 10);
  const now = new Date();
  
  const firstDayOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
  const lastDayOfMonth = new Date(Date.UTC(year, monthNum, 0));
  
  // Limite D-Zero Inteligente (Baseado estritamente no Mês e Ano avaliados)
  const isCurrentMonth = (now.getUTCFullYear() == year && now.getUTCMonth() + 1 == monthNum);
  const lastDayToCountExpected = isCurrentMonth ? new Date(now.getTime()) : lastDayOfMonth;
  
  return funcionarios.map(emp => {
    // 1. Histórico
    const hist = historicos
      .filter(h => h.funcionario_id === emp.id && new Date(h.data_inicio_vigencia + 'T00:00:00Z') <= lastDayOfMonth)
      .sort((a, b) => new Date(b.data_inicio_vigencia) - new Date(a.data_inicio_vigencia))[0];

    const baseSalary = hist ? parseFloat(hist.salario_base || 0) : 0;
    const diaria = hist ? parseFloat(hist.valor_diaria || 0) : 0;
    const isDiarista = diaria > 0; // Se tem diária preenchida, é sempre tratado como diarista no cálculo

    // 2. Processar Dados de Batidas (Igual ao FolhaPonto)
    const empPontos = pontos.filter(p => p.funcionario_id === emp.id);
    const timesheet = {};
    
    empPontos.forEach(ponto => {
        if (!ponto.data_hora) return;
        const utcDate = new Date(ponto.data_hora.replace(' ', 'T') + 'Z');
        const safeDateStr = [utcDate.getUTCFullYear(), String(utcDate.getUTCMonth() + 1).padStart(2, '0'), String(utcDate.getUTCDate()).padStart(2, '0')].join('-');
        
        if (!timesheet[safeDateStr]) timesheet[safeDateStr] = { dateString: safeDateStr };
        const fieldMap = { 'Entrada': 'entrada', 'Inicio_Intervalo': 'inicio_intervalo', 'Fim_Intervalo': 'fim_intervalo', 'Saida': 'saida' };
        const field = fieldMap[ponto.tipo_registro];
        if (field) {
            timesheet[safeDateStr][field] = utcDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
        }
    });

    const abonosMap = {};
    abonos.filter(a => a.funcionario_id === emp.id).forEach(a => {
      abonosMap[a.data_abono.split('T')[0]] = true;
    });

    const tolerancia = emp.jornada?.tolerancia_minutos || 0;

    // 3. Iterador Mensal
    let diasTrabalhados = 0;
    let diasUteisExigidos = 0; 
    let minutosTrabalhados = 0;
    let minutosExigidos = 0;
    let saldoMinutosPuro = 0;
    let faltas = 0;

    const admissionDate = emp.admission_date ? new Date(emp.admission_date + 'T00:00:00Z') : null;
    const demissionDate = emp.demission_date ? new Date(emp.demission_date + 'T00:00:00Z') : null;

    for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setUTCDate(d.getUTCDate() + 1)) {
       const dtStr = d.toISOString().split('T')[0];
       
       if (admissionDate && d < admissionDate) continue;
       if (demissionDate && d > demissionDate) continue;

       const dayOfWeek = d.getUTCDay();
       const isHoliday = feriados.some(f => f.data_feriado === dtStr);
       const jDia = emp.jornada?.detalhes?.find(j => j.dia_semana === dayOfWeek);
       
       let minsPrevistosDia = 0;
       const isWorkday = jDia && jDia.horario_entrada && jDia.horario_saida;
       
       if (isWorkday) {
           const e = jDia.horario_entrada.split(':').map(Number);
           const s = jDia.horario_saida.split(':').map(Number);
           const si = jDia.horario_saida_intervalo ? jDia.horario_saida_intervalo.split(':').map(Number) : [0,0];
           const vi = jDia.horario_volta_intervalo ? jDia.horario_volta_intervalo.split(':').map(Number) : [0,0];
           
           const minsTrab = (s[0]*60 + s[1]) - (e[0]*60 + e[1]);
           const minsInt = (vi[0]*60 + vi[1]) - (si[0]*60 + si[1]);
           minsPrevistosDia = minsTrab - (minsInt > 0 ? minsInt : 0);
       }

       if (d <= lastDayToCountExpected && isWorkday && !isHoliday) {
            diasUteisExigidos++;
            minutosExigidos += minsPrevistosDia;
       }

       const dayData = timesheet[dtStr];
       let workedMinsDay = 0;
       let hasPunch = false;
       
       if (dayData && (dayData.entrada || dayData.saida)) {
          hasPunch = true;
          // Calculo Mimetizado do FolhaPonto (com tolerâncias)
          const baseDate = new Date(dtStr + 'T00:00:00Z');
          const entAdj = adjustTime(dayData.entrada, jDia?.horario_entrada, tolerancia);
          const iIntAdj = adjustTime(dayData.inicio_intervalo, jDia?.horario_saida_intervalo, tolerancia);
          const fIntAdj = adjustTime(dayData.fim_intervalo, jDia?.horario_volta_intervalo, tolerancia);
          const saiAdj = adjustTime(dayData.saida, jDia?.horario_saida, tolerancia);

          const ent = parseTime(entAdj, baseDate);
          const sai = parseTime(saiAdj, baseDate);
          const iInt = parseTime(iIntAdj, baseDate);
          const fInt = parseTime(fIntAdj, baseDate);

          let manha = 0; let tarde = 0;
          if (ent && iInt) manha = iInt.getTime() - ent.getTime();
          if (fInt && sai) tarde = sai.getTime() - fInt.getTime();
          
          let totalMillis = manha + tarde;
          if (totalMillis <= 0 && ent && sai) totalMillis = sai.getTime() - ent.getTime();
          if (totalMillis < 0) totalMillis = 0;

          workedMinsDay = Math.floor(totalMillis / 60000);
       }

       // Abono Override: Ignora faltas/erros de batida e preenche o dia com a carga exata
       if (abonosMap[dtStr] && isWorkday) {
           workedMinsDay = minsPrevistosDia;
           hasPunch = true;
       }

       minutosTrabalhados += workedMinsDay;
       
       if (hasPunch) {
           diasTrabalhados++;
           saldoMinutosPuro += (workedMinsDay - minsPrevistosDia);
       } else if (isWorkday && !isHoliday && d <= lastDayToCountExpected) {
           faltas++;
           saldoMinutosPuro -= minsPrevistosDia;
       } else if (workedMinsDay > 0) {
           // Trabalho em dia não útil / feriado!
           saldoMinutosPuro += workedMinsDay; // Vai pro banco 100% livre
       }
    }

    let custoBruto = 0;
    if (isDiarista) {
        custoBruto = diasTrabalhados * diaria;
    } else {
        const valorPorDia = baseSalary / 30;
        custoBruto = baseSalary - (faltas * valorPorDia);
    }

    return {
       ...emp,
       isDiarista,
       baseSalary,
       diaria,
       diasTrabalhados,
       diasUteisExigidos,
       faltas,
       minutosTrabalhados,
       minutosExigidos,
       saldoMinutosPuro,
       custoBruto
    };
  });
};

const PlanilhaRHPage = () => {
  const { user } = useAuth();
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 7)); // YYYY-MM
  const [filtroVinculo, setFiltroVinculo] = useState('Todos');

  const { data: fechamento, isLoading } = useQuery({
    queryKey: ['planilha-rh-fechamento', user?.organizacao_id, mesRef],
    queryFn: async () => {
      if (!user?.organizacao_id) return [];
      const supabase = createClient();
      
      const { data: funcs } = await supabase.from('funcionarios')
        .select('*, cargos(nome), empreendimentos(nome), cadastro_empresa(razao_social), jornada:jornadas(*, detalhes:jornada_detalhes(*))')
        .in('organizacao_id', [1, user.organizacao_id]);
      
      const { data: hists } = await supabase.from('historico_salarial')
        .select('*').in('organizacao_id', [1, user.organizacao_id]);
        
      const [year, month] = mesRef.split('-');
      // O Supabase precisa de data_hora para não quebrar a formatação da Query.
      // O month é o mês. Dia 1 até 31 (ou 30).
      const firstDay = `${year}-${month}-01`;
      const lastDay = new Date(year, parseInt(month, 10), 0).toISOString().split('T')[0];
        
      // CORREÇÃO: Utilizando a coluna CORRETA real do banco - 'data_hora'
      const { data: pts } = await supabase.from('pontos')
        .select('*')
        .gte('data_hora', `${firstDay}T00:00:00`)
        .lte('data_hora', `${lastDay}T23:59:59`);
      
      const { data: feriados } = await supabase.from('feriados').select('*').in('organizacao_id', [1, user.organizacao_id]);
      const { data: abonos } = await supabase.from('abonos').select('*')
        .gte('data_abono', firstDay).lte('data_abono', lastDay);

      const ativosNoMes = (funcs || []).filter(f => {
         if (!f.demission_date) return true;
         const dDate = new Date(f.demission_date);
         return dDate >= new Date(`${firstDay}T00:00:00Z`);
      });

      return calculateMasterSheet(ativosNoMes, hists || [], abonos || [], feriados || [], pts || [], mesRef);
    },
    enabled: !!user?.organizacao_id
  });

  const linhasFiltro = useMemo(() => {
     if (!fechamento) return [];
     if (filtroVinculo === 'Diaristas') return fechamento.filter(f => f.isDiarista);
     if (filtroVinculo === 'Mensalistas') return fechamento.filter(f => !f.isDiarista);
     return fechamento;
  }, [fechamento, filtroVinculo]);

  const totais = useMemo(() => {
      let tCusto = 0;
      let tPessoas = 0;
      let tSalarioBase = 0;
      let tDiaria = 0;
      linhasFiltro.forEach(l => { 
          tCusto += l.custoBruto; 
          tPessoas++; 
          tSalarioBase += l.baseSalary;
          tDiaria += l.diaria;
      });
      return { custo: tCusto, pessoas: tPessoas, salarioBase: tSalarioBase, diaria: tDiaria };
  }, [linhasFiltro]);

  return (
    <div className="p-6 max-w-full overflow-x-hidden animate-fade-in-up flex flex-col h-[calc(100vh-64px)]">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Planilha Master Mensal</h1>
          <p className="text-sm text-gray-500 mt-1">Fechamento cirúrgico de ponto e estimativa de pagamentos.</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
            <input 
              type="month" 
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              className="mr-4 px-3 py-2 bg-transparent border-r border-gray-100 outline-none text-sm font-medium focus:ring-0"
            />
            {['Todos', 'Diaristas', 'Mensalistas'].map(f => (
                <button
                   key={f}
                   onClick={() => setFiltroVinculo(f)}
                   className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${filtroVinculo === f ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}
                >
                   {f}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
         <KpiCard 
           title="Balanço Financeiro Bruto" 
           value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.custo)} 
           icon={faMoneyBillWave} color="green" isLoading={isLoading} 
         />
         <KpiCard 
           title="Efetivo Apurado" 
           value={`${totais.pessoas} Colaboradores`} 
           icon={faUsers} color="indigo" isLoading={isLoading} 
         />
         <KpiCard 
           title="Vínculo Focado" 
           value={filtroVinculo} 
           icon={faBusinessTime} color="blue" isLoading={isLoading} 
         />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
         {isLoading && (
            <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
               <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-indigo-600" />
            </div>
         )}
         
         <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left whitespace-nowrap">
               <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-0">
                  <tr>
                     <th className="px-4 py-3 font-semibold w-8">St</th>
                     <th className="px-4 py-3 font-semibold min-w-[200px]">Colaborador</th>
                     <th className="px-4 py-3 font-semibold">Cargo/Vínculo</th>
                     <th className="px-4 py-3 font-semibold">Empreendimento</th>
                     <th className="px-4 py-3 font-semibold text-right">Salário Base</th>
                     <th className="px-4 py-3 font-semibold text-right">Diária</th>
                     <th className="px-4 py-3 font-semibold text-center">Assiduidade</th>
                     <th className="px-4 py-3 font-semibold text-center">Faltas</th>
                     <th className="px-4 py-3 font-semibold text-center">Horas Carga</th>
                     <th className="px-4 py-3 font-semibold text-right">Banco</th>
                     <th className="px-4 py-3 font-semibold text-right min-w-[140px]">Fechamento (R$)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {linhasFiltro.map(f => {
                     const isDemitidoMes = f.demission_date && f.demission_date.startsWith(mesRef);
                     const hTotaisFor = `${Math.floor(Math.abs(f.minutosTrabalhados)/60)}:${String(Math.floor(Math.abs(f.minutosTrabalhados)%60)).padStart(2,'0')}`;
                     const hExigFOR = `${Math.floor(f.minutosExigidos/60)}:${String(Math.floor(f.minutosExigidos%60)).padStart(2,'0')}`;

                     let bancoColor = "text-gray-400";
                     let bancoIcon = "";
                     if (f.saldoMinutosPuro > 0) { bancoColor = "text-emerald-600 font-bold"; bancoIcon = "+"; }
                     if (f.saldoMinutosPuro < 0) { bancoColor = "text-red-500 font-bold"; bancoIcon = "-"; }
                     
                     const absBanco = Math.abs(f.saldoMinutosPuro);
                     const bStr = `${bancoIcon}${Math.floor(absBanco/60)}:${String(Math.floor(absBanco%60)).padStart(2,'0')}h`;

                     return (
                        <tr key={f.id} className="hover:bg-gray-50/50 transition-colors">
                           <td className="px-4 py-3 text-center">
                              <div className={`w-3 h-3 rounded-full mx-auto ${f.status === 'Ativo' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-red-500'}`}></div>
                           </td>
                           <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900 truncate max-w-[250px]">{f.full_name}</p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{f.cadastro_empresa?.razao_social || 'Sem Empresa'}</p>
                              {isDemitidoMes && (
                                 <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-bold rounded-full">
                                    Demitido {f.demission_date.split('-').reverse().join('/')}
                                 </span>
                              )}
                           </td>
                           <td className="px-4 py-3">
                              <p className="font-medium text-gray-700">{f.cargos?.nome || 'N/D'}</p>
                              <p className="text-xs text-gray-400 uppercase mt-0.5">{f.isDiarista ? 'Diarista' : 'Mensalista'}</p>
                           </td>
                           <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-700 max-w-[150px] truncate" title={f.empreendimentos?.nome || 'Não Alocado'}>
                                 {f.empreendimentos?.nome || 'Não Alocado'}
                              </p>
                           </td>
                           <td className="px-4 py-3 text-right text-gray-600 font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.baseSalary)}
                           </td>
                           <td className="px-4 py-3 text-right text-gray-600 font-medium">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.diaria)}
                           </td>
                           <td className="px-4 py-3 text-center">
                              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-mono font-medium">
                                 {f.diasTrabalhados} / {f.diasUteisExigidos}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-center">
                              <span className={`font-bold ${f.faltas > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                                 {f.faltas}
                              </span>
                           </td>
                           <td className="px-4 py-3 text-center">
                              <span className="text-gray-600 text-xs font-mono">
                                 {hTotaisFor} / {hExigFOR}
                              </span>
                           </td>
                           <td className={`px-4 py-3 text-right font-mono text-sm ${bancoColor}`}>
                              {f.saldoMinutosPuro === 0 ? <span className="text-gray-300 font-normal">00:00h</span> : bStr}
                           </td>
                           <td className="px-4 py-3 text-right">
                              <span className="font-bold text-gray-900 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                                 {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.custoBruto)}
                              </span>
                           </td>
                        </tr>
                     );
                  })}
                  
                  {linhasFiltro.length === 0 && !isLoading && (
                     <tr>
                        <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                           Nenhum registro encontrado para este filtro e período.
                        </td>
                     </tr>
                  )}
               </tbody>
               <tfoot className="bg-gray-100/80 sticky bottom-0 border-t border-gray-200">
                  <tr>
                     <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-700 uppercase tracking-wider text-xs">
                        Totais Apurados
                     </td>
                     <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.salarioBase)}
                     </td>
                     <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.diaria)}
                     </td>
                     <td colSpan="4" className="px-4 py-3"></td>
                     <td className="px-4 py-3 text-right font-bold text-gray-900 text-base">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.custo)}
                     </td>
                  </tr>
               </tfoot>
            </table>
         </div>
      </div>
    </div>
  );
};

export default PlanilhaRHPage;
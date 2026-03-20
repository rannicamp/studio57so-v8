'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faCalendarAlt,
  faFilter,
  faChartBar,
  faChartLine,
  faFileExport,
  faUsers,
  faClock,
  faComments,
  faReplyAll
} from '@fortawesome/free-solid-svg-icons';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  FunnelChart, Funnel, LabelList, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';

import ConstrutorKpiManager from '@/components/painel/ConstrutorKpiManager';
import { useAuth } from '@/contexts/AuthContext';
import { useRelatorioComercial } from '@/hooks/relatorios/useRelatorioComercial';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function RelatorioComercialPage() {
  const { user } = useAuth();

  // Controle de Datas
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('visao_geral'); // 'visao_geral', 'vendas', 'marketing'

  // Chamada do nosso novo hook (sempre roda atrelado as datas)
  const { data: dadosComercial, isLoading: isCarregandoDados } = useRelatorioComercial(
    user?.organizacao_id,
    dateRange.from,
    dateRange.to
  );

  const isMensal = differenceInDays(dateRange.to, dateRange.from) > 35;
  const tituloBarChart = isMensal ? 'Captação Mensal de Leads' : 'Captação Diária de Leads';

  const handleDateChange = (e, type) => {
    // Adicionamos T12:00:00 para ancorar a data no meio do dia local
    // Evita o bug de Fuso Horário da "Meia noite UTC" que regride -3h pro Brasil
    const newDate = e.target.value ? new Date(`${e.target.value}T12:00:00`) : new Date();
    setDateRange(prev => ({ ...prev, [type]: newDate }));
  };

  const setFiltroSempre = () => {
    setDateRange({ from: new Date('2020-01-01T12:00:00'), to: new Date() });
  };

  const ultimosMeses = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return {
      label: format(d, "MMM - yy", { locale: ptBR }),
      start: startOfMonth(d),
      end: endOfMonth(d)
    };
  });

  // Prepara dados do gráfico de rosca
  const formatarGraficoOrigens = () => {
    if (!dadosComercial?.leads_por_origem) return [];
    return Object.entries(dadosComercial.leads_por_origem)
      .map(([origem, qtd]) => ({ name: origem, value: qtd }))
      .sort((a, b) => b.value - a.value);
  };

  const formataMinutosHours = (minutos) => {
    if (minutos < 1) return 'Rápido (< 1m)';
    if (minutos < 60) return `${Math.floor(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const restosMinutos = Math.floor(minutos % 60);
    return `${horas}h ${restosMinutos}m`;
  };

  const chartData = formatarGraficoOrigens();

  const calcularMediaDiaria = () => {
    if (!dadosComercial?.leads_por_dia?.length) return 0;
    const total = dadosComercial.leads_por_dia.reduce((acc, curr) => acc + curr.qtd, 0);
    
    let diasTranscorridos = 0;
    const hojeStr = format(new Date(), 'yyyy-MM-dd');
    
    for (const item of dadosComercial.leads_por_dia) {
        if (item.data <= hojeStr) {
            diasTranscorridos++;
        }
    }
    
    if (diasTranscorridos === 0) diasTranscorridos = 1;

    return Number((total / diasTranscorridos).toFixed(1));
  };
  const mediaDiaria = calcularMediaDiaria();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FontAwesomeIcon icon={faChartLine} className="text-blue-600" />
            Relatório Comercial
          </h1>
          <p className="text-slate-500 mt-1">
            Análise unificada de Marketing, Contratos e Vendas
          </p>
        </div>

        {/* Filtros e Atalhos de Data */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          
          <button 
            title="Puxar todo o tempo sem limite"
            onClick={setFiltroSempre}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            Sempre
          </button>

          <select 
            onChange={(e) => {
              if (e.target.value !== "") {
                const mes = ultimosMeses[Number(e.target.value)];
                setDateRange({ from: mes.start, to: mes.end });
                e.target.value = ""; // Reseta pro placeholder 'Meses Anteriores'
              }
            }}
            defaultValue=""
            className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 py-2 cursor-pointer shadow-sm capitalize"
          >
            <option value="" disabled>Histórico</option>
            {ultimosMeses.map((m, i) => (
              <option key={i} value={i} className="capitalize">{m.label}</option>
            ))}
          </select>

          {/* Filtro Customizado Contínuo */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-inner">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={format(dateRange.from, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e, 'from')}
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 p-0 outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={format(dateRange.to, 'yyyy-MM-dd')}
              onChange={(e) => handleDateChange(e, 'to')}
              className="bg-transparent border-none text-sm text-slate-700 focus:ring-0 p-0 outline-none"
            />
          </div>
        </div>
        </div>
      </div>

      {/* --- ABAS DE NAVEGAÇÃO --- */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'visao_geral', label: 'Visão Geral', icon: faChartBar },
          { id: 'vendas', label: 'Contratos & Vendas', icon: faBuilding },
          { id: 'marketing', label: 'Marketing (Ads)', icon: faFilter },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'}
            `}
          >
            <FontAwesomeIcon icon={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- CONTEÚDO DINÂMICO --- */}
      <div className="space-y-6">

        {activeTab === 'visao_geral' && (
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faUsers} className="text-blue-500 text-xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total de Leads</p>
                <div className="text-2xl font-bold tracking-tight text-slate-800">
                  {isCarregandoDados ? '...' : (dadosComercial?.total_leads ?? 0)}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faComments} className="text-green-500 text-xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Conversas Iniciadas</p>
                <div className="text-2xl font-bold tracking-tight text-slate-800">
                  {isCarregandoDados ? '...' : (dadosComercial?.total_conversas_ativas ?? 0)}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faReplyAll} className="text-orange-500 text-xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Nosso Tempo</p>
                <div className="text-2xl font-bold tracking-tight text-slate-800">
                  {isCarregandoDados ? '...' : formataMinutosHours(dadosComercial?.nosso_tempo_medio_resposta_minutos ?? 0)}
                </div>
                <p className="text-[10px] text-slate-400">Até o corretor chamar</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
                <FontAwesomeIcon icon={faClock} className="text-purple-500 text-xl" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Tempo do Cliente</p>
                <div className="text-2xl font-bold tracking-tight text-slate-800">
                  {isCarregandoDados ? '...' : formataMinutosHours(dadosComercial?.tempo_medio_resposta_lead_minutos ?? 0)}
                </div>
                <p className="text-[10px] text-slate-400">Para retornar a mensagem</p>
              </div>
            </div>
          </section>
        )}

        {/* SEÇÃO DE CONSTRUTORES LEGADOS (se estiver nas outras abas) */}
        {activeTab !== 'visao_geral' && (
           <section>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-slate-700">Indicadores Chave</h2>
           </div>
           <ConstrutorKpiManager
             modulo={activeTab === 'marketing' ? 'marketing' : 'comercial'}
             organizacaoId={user?.organizacao_id}
           />
         </section>
        )}

        {/* SEÇÃO 2: GRÁFICOS */}
        {activeTab === 'visao_geral' && (
          <section className="flex flex-col gap-6 w-full">

            {/* Gráfico 1: Evolução Diária/Mensal */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[360px] w-full flex flex-col">
              <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">{tituloBarChart}</h3>
              
              {isCarregandoDados ? (
                <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">
                  Carregando gráfico...
                </div>
              ) : dadosComercial?.leads_por_dia?.length > 0 ? (
                <div className="w-full flex-1 mt-4 min-h-[300px] overflow-x-auto pb-2 custom-scrollbar">
                  <div style={{ minWidth: isMensal ? '100%' : `${Math.max(100, dadosComercial.leads_por_dia.length * 45)}px`, height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosComercial.leads_por_dia} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis 
                          dataKey="data" 
                          interval={0}
                          tick={({x, y, payload}) => {
                            try {
                              const dateObj = parseISO(payload.value);
                              
                              if (isMensal) {
                                const mes = format(dateObj, 'MMM', { locale: ptBR });
                                const ano = format(dateObj, 'yy', { locale: ptBR });
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text x={0} y={0} dy={16} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600} style={{ textTransform: 'uppercase' }}>
                                      {mes}
                                    </text>
                                    <text x={0} y={0} dy={28} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                                      {ano}
                                    </text>
                                  </g>
                                );
                              }

                              const diaNum = format(dateObj, 'dd', { locale: ptBR });
                              const diaSemana = format(dateObj, 'EEEE', { locale: ptBR }).substring(0, 3).replace('.', '');
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text x={0} y={0} dy={16} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600}>
                                  {diaNum}
                                </text>
                                <text x={0} y={0} dy={28} textAnchor="middle" fill="#94a3b8" fontSize={9} style={{ textTransform: 'uppercase' }}>
                                  {diaSemana}
                                </text>
                              </g>
                            );
                          } catch {
                            return <text x={x} y={y} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={10}>{payload.value}</text>;
                          }
                        }}
                        tickMargin={10}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <ReferenceLine 
                        y={mediaDiaria} 
                        stroke="#8b5cf6" 
                        strokeDasharray="4 4" 
                        label={{ position: 'insideTopLeft', value: `Média Gerada: ${mediaDiaria} por ${isMensal ? 'mês' : 'dia'}`, fill: '#8b5cf6', fontSize: 11, fontWeight: 500 }} 
                      />
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(label) => {
                          try { 
                            return format(parseISO(label), isMensal ? "MMMM 'de' yyyy" : "dd 'de' MMMM", { locale: ptBR }); 
                          }
                          catch { return label; }
                        }}
                        formatter={(value) => [value, 'Leads']}
                      />
                      <Bar dataKey="qtd" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
                   <div className="bg-slate-50 p-4 rounded-full mb-3">
                     <FontAwesomeIcon icon={faChartBar} className="text-3xl text-slate-300" />
                   </div>
                   Nenhum dado diário encontrado.
                </div>
              )}
            </div>

            {/* ---- INÍCIO GRID DOS GRÁFICOS SECUNDÁRIOS ---- */}
            <div className="flex flex-col lg:flex-row gap-6 w-full">

              {/* Gráfico 2: Ranking de Origens (Gantt-Bar) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col w-full lg:w-1/2">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Ranking de Origens</h3>
                
                {isCarregandoDados ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">
                    Carregando ranking...
                  </div>
                ) : chartData.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 45)}>
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                          width={90}
                        />
                        <RechartsTooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value) => [`${value} Leads`, 'Volume']}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[0, 4, 4, 0]} 
                          barSize={24} 
                          label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <FontAwesomeIcon icon={faFilter} className="text-slate-300" />
                    </div>
                    <span className="text-slate-400 text-sm">Nenhum dado de origem detectado.</span>
                  </div>
                )}
              </div>

              {/* Gráfico 3: Histórico de Passagem (Conversão) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm w-full lg:w-1/2 flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Histórico de Passagem</h3>
                
                {isCarregandoDados ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">
                    Carregando histórico...
                  </div>
                ) : dadosComercial?.conversao_funil?.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, dadosComercial.conversao_funil.length * 45)}>
                      <BarChart data={dadosComercial.conversao_funil} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                          width={110}
                        />
                        <RechartsTooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value) => [`${value} Leads que Transitaram`, 'Volume']}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[0, 4, 4, 0]} 
                          barSize={24} 
                          label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                        >
                          {dadosComercial.conversao_funil.map((entry, index) => (
                            <Cell key={`cell-funil-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <FontAwesomeIcon icon={faFilter} className="text-slate-300" />
                    </div>
                    <span className="text-slate-400 text-sm">Nenhuma etapa percorrida ainda.</span>
                  </div>
                )}
              </div>

            </div>
            {/* ---- FIM GRID DOS GRÁFICOS SECUNDÁRIOS ---- */}
          </section>
        )}

        {/* SEÇÃO 3: TABELA DETALHADA */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Detalhamento Numérico</h3>
            <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
              <FontAwesomeIcon icon={faFileExport} />
              Exportar CSV
            </button>
          </div>
          <div className="p-0">
             {/* Renderizando a tabela simples com os números absolutos apenas para validação */}
             <table className="w-full text-sm text-left text-slate-500">
               <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th scope="col" className="px-6 py-4">Métrica</th>
                    <th scope="col" className="px-6 py-4 text-right">Resultado Consolidado</th>
                  </tr>
               </thead>
               <tbody>
                  <tr className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">Leads Captados</td>
                    <td className="px-6 py-4 text-right">{dadosComercial?.total_leads || 0}</td>
                  </tr>
                  <tr className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">Interações WhatsApp</td>
                    <td className="px-6 py-4 text-right">{dadosComercial?.total_conversas_ativas || 0}</td>
                  </tr>
                  <tr className="bg-white hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">Tempo Retorno Equipe</td>
                    <td className="px-6 py-4 text-right">{formataMinutosHours(dadosComercial?.nosso_tempo_medio_resposta_minutos)}</td>
                  </tr>
               </tbody>
             </table>
          </div>
        </section>

      </div>
    </div>
  );
}
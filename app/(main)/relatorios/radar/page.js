'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getRadarStats, resolveMetaIds, getDicionarioContatos } from './actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMobileAlt, faDesktop, faEye, faGlobe, faSpinner, faExclamationTriangle,
  faFilter, faFunnelDollar, faChartPie, faChartLine, faBullhorn,
  faBuilding, faCalendarAlt, faChartBar, faUsers, faClock, faComments, faReplyAll, faFileExport, faStopwatch,
  faCheckCircle, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ScatterChart, Scatter,
  ZAxis, AreaChart, Area, ReferenceLine, PieChart, Pie, Legend
} from 'recharts';
import AdsManager from '@/components/comercial/AdsManager';

import { format, startOfMonth, endOfMonth, parseISO, subMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useRelatorioComercial } from '@/hooks/relatorios/useRelatorioComercial';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];
const COLORS_COMERCIAL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

function RadarPageContent() {
  const params = useSearchParams();
  const initTab = params.get('tab') || 'radar';
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initTab); // 'radar', 'comercial', 'ads'
  const [somenteMarketing, setSomenteMarketing] = useState(true);

  // Controle de Datas Unificado
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  const [dataInicio, setDataInicio] = useState(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState(endOfMonth(new Date()));
  const [filtroDiaHorario, setFiltroDiaHorario] = useState('todos');

  const ultimosMeses = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return {
      label: format(d, "MMM - yy", { locale: ptBR }),
      start: startOfMonth(d),
      end: endOfMonth(d)
    };
  });

  const handleDateChange = (e, type) => {
    const newDate = e.target.value ? new Date(`${e.target.value}T12:00:00`) : new Date();
    setDateRange(prev => ({ ...prev, [type]: newDate }));
  };

  const setFiltroSempre = () => {
    setDateRange({ from: new Date('2020-01-01T12:00:00'), to: new Date() });
  };

  const isMensal = differenceInDays(dateRange.to, dateRange.from) > 35;
  const radarPeriodoReal = differenceInDays(new Date(), dateRange.from) || 30;

  // Helpers Comercial
  const formataMinutosHours = (minutos) => {
    if (minutos < 1) return 'Rápido (< 1m)';
    if (minutos < 60) return `${Math.floor(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    const restosMinutos = Math.floor(minutos % 60);
    return `${horas}h ${restosMinutos}m`;
  };

  const getSlaClassification = (mins) => {
    if (mins === null || mins === undefined || mins <= 0) return null;
    
    let label = '';
    let bgClass = '';
    let icon = null;
    
    if (mins < 15) {
      label = 'Excelente';
      bgClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      icon = faCheckCircle;
    } else if (mins < 30) {
      label = 'Bom';
      bgClass = 'bg-blue-100 text-blue-800 border-blue-200';
      icon = faCheckCircle;
    } else if (mins < 60) {
      label = 'Risco';
      bgClass = 'bg-orange-100 text-orange-800 border-orange-200';
      icon = faStopwatch;
    } else {
      label = 'Perda';
      bgClass = 'bg-red-100 text-red-800 border-red-200';
      icon = faTimesCircle;
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${bgClass}`} title={`SLA: ${label}`}>
        <FontAwesomeIcon icon={icon} className="w-3 h-3" />
        {label}
      </span>
    );
  };

  // FETCH RADAR
  const fetchDataRadar = async () => {
    const queryData = await getRadarStats(radarPeriodoReal, somenteMarketing);
    try {
      const [resCamp, resAds, dictCrm] = await Promise.all([
        fetch('/api/meta/campaigns'), fetch('/api/meta/ads'), getDicionarioContatos()
      ]);
      const metaCamp = resCamp.ok ? await resCamp.json() : {};
      const metaAds = resAds.ok ? await resAds.json() : {};
      const dictNomes = { ...dictCrm };
      if (metaCamp.campaigns) metaCamp.campaigns.forEach(c => dictNomes[c.id] = c.name);
      if (metaCamp.adsets) metaCamp.adsets.forEach(c => dictNomes[c.id] = c.name);
      if (metaAds.data) {
         metaAds.data.forEach(c => {
            dictNomes[c.id] = c.name;
            if (c.adset_id) dictNomes[c.adset_id] = c.adset_name;
            if (c.campaign_id) dictNomes[c.campaign_id] = c.campaign_name;
         });
      }
      if (queryData?.topCampanhas) {
         const fallbackIds = [];
         queryData.topCampanhas.forEach(camp => {
             const idAnuncio = camp.anuncio_id;
             if (idAnuncio && /^\d{15,}$/.test(idAnuncio) && !dictNomes[idAnuncio]) fallbackIds.push(idAnuncio);
         });
         if (fallbackIds.length > 0) {
             const resolvedDict = await resolveMetaIds(fallbackIds);
             Object.assign(dictNomes, resolvedDict);
         }
         queryData.topCampanhas = queryData.topCampanhas.map(camp => {
            let nomeAnuncio = dictNomes[camp.anuncio_id] || camp.anuncio_id || 'Não especificado';
            if (/^\d{15,}$/.test(nomeAnuncio)) nomeAnuncio = `ID: ${nomeAnuncio} (Excluído / Órfão)`;
            return {
               ...camp,
               nome_campanha: dictNomes[camp.campanha_id] || dictNomes[camp.nome_campanha] || camp.nome_campanha || camp.campanha_id || 'Indefinida',
               nome_anuncio: nomeAnuncio
            };
         });
      }
    } catch (e) {
      console.warn('Erro fetch API Meta internamente', e);
    }
    return queryData;
  };

  const { data: stats, isLoading: loadingRadar, isError: errorRadar } = useQuery({
    queryKey: ['radarStats', radarPeriodoReal, somenteMarketing],
    queryFn: fetchDataRadar,
    refetchOnWindowFocus: false
  });

  // FETCH COMERCIAL
  const { data: dadosComercial, isLoading: loadingComercial, error: errorComercial } = useRelatorioComercial(
    user?.organizacao_id,
    dateRange.from,
    dateRange.to
  );

  const formatarGraficoOrigens = () => {
    if (!dadosComercial?.leads_por_origem) return [];
    return Object.entries(dadosComercial.leads_por_origem)
      .map(([origem, qtd]) => ({ name: origem, value: qtd }))
      .sort((a, b) => b.value - a.value);
  };
  const chartDataOrigens = formatarGraficoOrigens();

  const formatarGraficoObjetivos = () => {
    if (!dadosComercial?.leads_por_objetivo) return [];
    return Object.entries(dadosComercial.leads_por_objetivo)
      .map(([objetivo, qtd]) => ({ name: objetivo, value: qtd }))
      .sort((a, b) => b.value - a.value);
  };
  const chartDataObjetivos = formatarGraficoObjetivos();

  const formatarGraficoRenda = () => {
    if (!dadosComercial?.leads_por_renda) return [];
    const ordemPersonalizada = {
      'Mais de R$ 10.000': 1,
      'R$ 10.000': 2,
      'Menos de R$ 10.000': 3,
      'Não Informado': 4
    };
    return Object.entries(dadosComercial.leads_por_renda)
      .map(([renda, qtd]) => ({ name: renda, value: qtd }))
      .sort((a, b) => (ordemPersonalizada[a.name] || 99) - (ordemPersonalizada[b.name] || 99));
  };
  const chartDataRenda = formatarGraficoRenda();

  const formatarGraficoCorretores = () => {
    if (!dadosComercial?.desempenho_corretores) return [];
    return dadosComercial.desempenho_corretores
      .map(c => ({ name: c.corretor_nome, value: c.total_atendimentos }))
      .sort((a, b) => b.value - a.value);
  };
  const chartDataCorretores = formatarGraficoCorretores();

  const formatarGraficoHoras = () => {
    if (!dadosComercial?.leads_por_hora) return [];
    
    // Create base array for 24 hours
    const horasMap = Array.from({ length: 24 }, (_, i) => ({
      hora: `${String(i).padStart(2, '0')}:00`,
      qtd: 0
    }));

    dadosComercial.leads_por_hora.forEach(item => {
      // Filter by day of week if not 'todos'
      if (filtroDiaHorario !== 'todos' && String(item.dia_semana) !== filtroDiaHorario) {
        return;
      }
      if (item.hora >= 0 && item.hora <= 23) {
        horasMap[item.hora].qtd += item.qtd;
      }
    });

    return horasMap;
  };
  const chartDataHoras = formatarGraficoHoras();

  const calcularMediaDiaria = () => {
    if (!dadosComercial?.leads_por_dia?.length) return 0;
    const total = dadosComercial.leads_por_dia.reduce((acc, curr) => acc + curr.qtd, 0);
    let diasTranscorridos = 0;
    const hojeStr = format(new Date(), 'yyyy-MM-dd');
    for (const item of dadosComercial.leads_por_dia) {
      if (item.data <= hojeStr) diasTranscorridos++;
    }
    if (diasTranscorridos === 0) diasTranscorridos = 1;
    return Number((total / diasTranscorridos).toFixed(1));
  };
  const mediaDiaria = calcularMediaDiaria();

  const maxFunilValue = Math.max(1, ...(dadosComercial?.conversao_funil || []).map(i => Number(i.value) || 0));

  const funilComPercentuais = (dadosComercial?.conversao_funil || []).map((item) => {
    const val = Number(item.value) || 0;
    const porcentagem = val === 0 ? '0.0' : ((val / maxFunilValue) * 100).toFixed(1);
    return { ...item, value: val, pct: porcentagem };
  });

  const chartDiasSemana = (() => {
    if (!dadosComercial?.leads_por_dia?.length) return [];
    const map = { 'Domingo': 0, 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0 };
    dadosComercial.leads_por_dia.forEach(item => {
      try {
        const dStr = format(parseISO(`${item.data}T12:00:00`), 'EEEE', { locale: ptBR });
        const cleanDay = dStr.split('-')[0];
        const capitalizedDay = cleanDay.charAt(0).toUpperCase() + cleanDay.slice(1);
        if (map[capitalizedDay] !== undefined) map[capitalizedDay] += item.qtd;
      } catch (e) {}
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).filter(x => x.value > 0);
  })();

  // Render Loading ou Error (Padrão)
  const isCarregando = activeTab === 'radar' ? loadingRadar : (activeTab === 'comercial' ? loadingComercial : false);

  const Header = () => (
    <div className="mb-8 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
          <FontAwesomeIcon icon={activeTab === 'ads' ? faMeta : faEye} className={`${activeTab === 'ads' ? 'text-blue-600' : 'text-indigo-600'} mr-3 text-3xl`} />
          {activeTab === 'ads' ? 'Hub de Marketing' : 'Radar Studio'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Inteligência de Tráfego, Atribuição e CRM Unificado.</p>
      </div>

      <div className="flex flex-col md:flex-row items-end md:items-center gap-4">
        {/* Seletor de Abas */}
        <div className="bg-gray-100 p-1 rounded-lg flex overflow-x-auto w-full md:w-auto">
          <button onClick={() => setActiveTab('radar')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap ${activeTab === 'radar' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>
            <FontAwesomeIcon icon={faChartLine} /> Radar (Tráfego)
          </button>
          <button onClick={() => setActiveTab('comercial')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap ${activeTab === 'comercial' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>
            <FontAwesomeIcon icon={faBuilding} /> Vendas & CRM
          </button>
          <button onClick={() => setActiveTab('ads')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition whitespace-nowrap ${activeTab === 'ads' ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}>
            <FontAwesomeIcon icon={faBullhorn} /> Gestão Meta Ads
          </button>
        </div>

        {/* Filtros de Data Globais (Ocultos no Ads) */}
        {activeTab !== 'ads' && (
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {activeTab === 'radar' && (
              <button title="Exibir apenas cliques associados a campanhas pagas mapeadas" onClick={() => setSomenteMarketing(!somenteMarketing)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${somenteMarketing ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-600 border border-slate-200'} shadow-sm`}>
                <FontAwesomeIcon icon={faFilter} className={somenteMarketing ? 'text-indigo-500' : ''} />
                {somenteMarketing ? 'Filtro Marketing' : 'Global (Orgânico)'}
              </button>
            )}

            <button title="Sem limite temporal" onClick={setFiltroSempre} className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-sm whitespace-nowrap">
              Sempre
            </button>

            <select onChange={(e) => {
                if (e.target.value !== "") {
                  const mes = ultimosMeses[Number(e.target.value)];
                  setDateRange({ from: mes.start, to: mes.end });
                  e.target.value = "";
                }
              }} defaultValue="" className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 py-2 cursor-pointer shadow-sm capitalize max-w-[120px]">
              <option value="" disabled>Histórico</option>
              {ultimosMeses.map((m, i) => (
                <option key={i} value={i} className="capitalize">{m.label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-inner">
              <FontAwesomeIcon icon={faCalendarAlt} className="text-slate-400" />
              <div className="flex items-center gap-2">
                <input type="date" value={format(dateRange.from, 'yyyy-MM-dd')} onChange={(e) => handleDateChange(e, 'from')} className="bg-transparent border-none text-xs text-slate-700 focus:ring-0 p-0 outline-none w-auto max-w-[110px]" />
                <span className="text-slate-400">-</span>
                <input type="date" value={format(dateRange.to, 'yyyy-MM-dd')} onChange={(e) => handleDateChange(e, 'to')} className="bg-transparent border-none text-xs text-slate-700 focus:ring-0 p-0 outline-none w-auto max-w-[110px]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50/50 flex flex-col w-full animate-fade-in-up pb-10">
      <Header />

      {activeTab === 'ads' && (
        <div className="w-full h-full flex flex-col flex-1"><AdsManager /></div>
      )}

      {/* --- ABA COMERCIAL (Vendas & CRM) --- */}
      {activeTab === 'comercial' && (
        <div className="space-y-6 animate-fade-in-up">
           <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
               <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
                 <FontAwesomeIcon icon={faUsers} className="text-blue-600 text-xl" />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-500">Total de Leads Gerados</p>
                 <div className="text-2xl font-bold tracking-tight text-slate-800">
                   {isCarregando ? '...' : (dadosComercial?.total_leads ?? 0)}
                 </div>
               </div>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
               <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                 <FontAwesomeIcon icon={faComments} className="text-emerald-500 text-xl" />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-500">Conversas Iniciadas</p>
                 <div className="text-2xl font-bold tracking-tight text-slate-800">
                   {isCarregando ? '...' : (dadosComercial?.total_conversas_ativas ?? 0)}
                 </div>
               </div>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
               <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                 <FontAwesomeIcon icon={faReplyAll} className="text-amber-500 text-xl" />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-500">SLA Nossa Equipe</p>
                 <div className="text-2xl font-bold tracking-tight text-slate-800">
                   {isCarregando ? '...' : formataMinutosHours(dadosComercial?.nosso_tempo_medio_resposta_minutos ?? 0)}
                 </div>
                 <p className="text-[10px] text-slate-400">Tempo de primeiro retorno</p>
               </div>
             </div>

             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
               <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
                 <FontAwesomeIcon icon={faClock} className="text-rose-500 text-xl" />
               </div>
               <div>
                 <p className="text-sm font-medium text-slate-500">Ritmo do Cliente</p>
                 <div className="text-2xl font-bold tracking-tight text-slate-800">
                   {isCarregando ? '...' : formataMinutosHours(dadosComercial?.tempo_medio_resposta_lead_minutos ?? 0)}
                 </div>
                 <p className="text-[10px] text-slate-400">Tempo das respostas dele</p>
               </div>
             </div>
           </section>

           <section className="flex flex-col gap-6 w-full">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[360px] w-full flex flex-col">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">{isMensal ? 'Mapeamento Mensal de Captação' : 'Mapeamento Diário de Captação'}</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Atualizando funil...</div>
                ) : dadosComercial?.leads_por_dia?.length > 0 ? (
                  <div className="w-full flex-1 mt-4 min-h-[300px] overflow-x-auto pb-2 custom-scrollbar">
                    <div style={{ minWidth: isMensal ? '100%' : `${Math.max(100, dadosComercial.leads_por_dia.length * 45)}px`, height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosComercial.leads_por_dia} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="data" interval={0} tickLine={false} axisLine={false} tickMargin={10}
                            tick={({x, y, payload}) => {
                              try {
                                const dateObj = parseISO(`${payload.value}T12:00:00`);
                                if (isMensal) {
                                  const mes = format(dateObj, 'MMM', { locale: ptBR });
                                  const ano = format(dateObj, 'yy', { locale: ptBR });
                                  return (
                                    <g transform={`translate(${x},${y})`}>
                                      <text x={0} y={0} dy={16} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600} style={{ textTransform: 'uppercase' }}>{mes}</text>
                                      <text x={0} y={0} dy={28} textAnchor="middle" fill="#94a3b8" fontSize={9}>{ano}</text>
                                    </g>
                                  );
                                }
                                const diaNum = format(dateObj, 'dd', { locale: ptBR });
                                const diaSemana = format(dateObj, 'EEEE', { locale: ptBR }).substring(0, 3).replace('.', '');
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text x={0} y={0} dy={16} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600}>{diaNum}</text>
                                    <text x={0} y={0} dy={28} textAnchor="middle" fill="#94a3b8" fontSize={9} style={{ textTransform: 'uppercase' }}>{diaSemana}</text>
                                  </g>
                                );
                              } catch { return <text x={x} y={y} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={10}>{payload.value}</text>; }
                            }}
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <ReferenceLine y={mediaDiaria} stroke="#8b5cf6" strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: `Média Gerada: ${mediaDiaria}`, fill: '#8b5cf6', fontSize: 11, fontWeight: 500 }} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} labelFormatter={(label) => { try { return format(parseISO(`${label}T12:00:00`), isMensal ? "MMMM 'de' yyyy" : "dd 'de' MMMM", { locale: ptBR }); } catch { return label; } }} formatter={(value) => [value, 'Leads']} />
                          <Bar dataKey="qtd" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
                    <div className="bg-slate-50 p-4 rounded-full mb-3"><FontAwesomeIcon icon={faChartBar} className="text-3xl text-slate-300" /></div>
                    Nenhum dado diário encontrado nesse período.
                  </div>
                )}
              </div>
           </section>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              {/* Novo Gráfico: Leads por Corretor */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Leads por Corretor</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Carregando corretores...</div>
                ) : chartDataCorretores.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartDataCorretores.length * 45)}>
                      <BarChart data={chartDataCorretores} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={110} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads`, 'Atribuição']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}>
                          {chartDataCorretores.map((entry, index) => (<Cell key={`cell-corr-${index}`} fill={COLORS_COMERCIAL[index % COLORS_COMERCIAL.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Sem corretores detectados.</span></div>
                )}
              </div>

              {/* Gráfico 4: Ranking Dia da Semana */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Pico de Calor (Dias da Semana)</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Monitorando atividade...</div>
                ) : chartDiasSemana.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartDiasSemana.length * 45)}>
                      <BarChart data={chartDiasSemana} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={75} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads Totais`, 'Volume']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}>
                          {chartDiasSemana.map((entry, index) => (<Cell key={`cell-dia-${index}`} fill={index === 0 ? '#10b981' : COLORS_COMERCIAL[index % COLORS_COMERCIAL.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Ainda sem histórico temporal.</span></div>
                )}
              </div>

              {/* Novo Gráfico: Radar de Horários (Área) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px] lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <h3 className="text-slate-800 font-semibold w-full text-left">Curva de Fogo (Horário de Entrada)</h3>
                  <select 
                    className="border border-slate-200 text-sm rounded-lg px-3 py-1.5 bg-slate-50 text-slate-600 font-medium outline-none focus:ring-2 focus:ring-orange-500/20"
                    value={filtroDiaHorario}
                    onChange={(e) => setFiltroDiaHorario(e.target.value)}
                  >
                    <option value="todos">Visão Geral</option>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Monitorando horários...</div>
                ) : chartDataHoras.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartDataHoras} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorFogo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} minTickGap={20} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                        <RechartsTooltip cursor={{ fill: 'rgba(234, 88, 12, 0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads`, 'Volume']} labelStyle={{ color: '#475569', fontWeight: 700, marginBottom: '4px' }} />
                        <Area type="monotone" dataKey="qtd" stroke="#ea580c" strokeWidth={3} fillOpacity={1} fill="url(#colorFogo)" activeDot={{ r: 6, fill: '#ea580c', stroke: '#fff', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Ainda sem histórico de horários.</span></div>
                )}
              </div>

              {/* Gráfico 2: Ranking de Origens CRM */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Ranking Base (Cadastro Definitivo CRM)</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Carregando origens...</div>
                ) : chartDataOrigens.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartDataOrigens.length * 45)}>
                      <BarChart data={chartDataOrigens} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={90} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads`, 'Volume CRM']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}>
                          {chartDataOrigens.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS_COMERCIAL[index % COLORS_COMERCIAL.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Sem origens detectadas no CRM.</span></div>
                )}
              </div>

              {/* Gráfico 3: Histórico de Passagem (Conversão CRM) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Funil de Vendas</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Carregando funil...</div>
                ) : funilComPercentuais?.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, funilComPercentuais.length * 45)}>
                      <BarChart data={funilComPercentuais} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={110} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value, name, props) => [`${value} Leads (${props.payload.pct}%)`, 'Volume']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={(props) => {
                          const itemData = funilComPercentuais[props.index];
                          return <text x={props.x + props.width + 10} y={props.y + 16} fill="#64748b" fontSize={11} fontWeight={700}>{props.value} ({itemData?.pct || '0'}%)</text>;
                        }}>
                          {funilComPercentuais.map((entry, index) => (<Cell key={`cell-funil-${index}`} fill={COLORS_COMERCIAL[index % COLORS_COMERCIAL.length]} />))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Nenhuma etapa percorrida ainda.</span></div>
                )}
              </div>

              {/* Gráfico: Intenção de Compra (Objetivo) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Intenção de Compra (Objetivo)</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Carregando objetivos...</div>
                ) : chartDataObjetivos.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartDataObjetivos.length * 45)}>
                      <BarChart data={chartDataObjetivos} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={110} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads`, 'Volume']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}>
                          {chartDataObjetivos.map((entry, index) => {
                            const fill = entry.name === 'Investimento' ? '#10b981' : (entry.name === 'Moradia' ? '#3b82f6' : '#94a3b8');
                            return <Cell key={`cell-obj-${index}`} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Sem objetivos detectados no CRM.</span></div>
                )}
              </div>

              {/* Gráfico: Perfil de Renda Familiar */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Perfil de Renda Familiar</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center h-full text-slate-400 text-sm">Carregando perfil de renda...</div>
                ) : chartDataRenda.length > 0 ? (
                  <div className="w-full flex-1 pr-6 pb-2">
                    <ResponsiveContainer width="100%" height={Math.max(250, chartDataRenda.length * 45)}>
                      <BarChart data={chartDataRenda} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} width={125} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value} Leads`, 'Volume']} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 12, fontWeight: 700 }}>
                          {chartDataRenda.map((entry, index) => {
                            let fill = '#94a3b8';
                            if (entry.name === 'Mais de R$ 10.000') fill = '#10b981';
                            else if (entry.name === 'R$ 10.000') fill = '#3b82f6';
                            else if (entry.name === 'Menos de R$ 10.000') fill = '#f97316';
                            return <Cell key={`cell-renda-${index}`} fill={fill} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faFilter} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Sem dados de renda detectados no CRM.</span></div>
                )}
              </div>
           </div>

           {/* --- DESEMPENHO DOS CORRETORES --- */}
           <section className="flex flex-col gap-6 w-full mt-2">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Ranking de Desempenho (Corretores)</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando desempenho da equipe...</div>
                ) : dadosComercial?.desempenho_corretores?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/50">
                          <th className="p-3 font-semibold rounded-tl-lg">Corretor</th>
                          <th className="p-3 font-semibold text-center">Volume Total</th>
                          <th className="p-3 font-semibold text-center">Nossa Agilidade (SLA)</th>
                          <th className="p-3 font-semibold text-center">Agilidade do Cliente</th>
                          <th className="p-3 font-semibold text-center rounded-tr-lg">Distribuição do Funil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosComercial.desempenho_corretores.map((corretor, idx) => {
                           const isWarning = corretor.tempo_medio_resposta_minutos > 60;
                           const slaText = corretor.tempo_medio_resposta_minutos > 0 ? formataMinutosHours(corretor.tempo_medio_resposta_minutos) : 'Sem interações';
                           const slaLeadText = corretor.tempo_medio_resposta_lead_minutos > 0 ? formataMinutosHours(corretor.tempo_medio_resposta_lead_minutos) : 'Sem interações';
                           const total = corretor.total_atendimentos;
                           
                           return (
                             <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                               <td className="p-3">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                    <div>
                                      <p className="font-semibold text-slate-700">{corretor.corretor_nome}</p>
                                    </div>
                                 </div>
                               </td>
                               <td className="p-3 text-center">
                                 <span className="font-bold text-slate-700 text-lg">{total}</span> <span className="text-xs text-slate-400">leads</span>
                               </td>
                               <td className="p-3 text-center">
                                  {corretor.tempo_medio_resposta_minutos > 0 ? (
                                     <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm" title="Nosso Tempo Médio (Ping-Pong)">
                                          <FontAwesomeIcon icon={faStopwatch} />
                                          {slaText}
                                        </div>
                                        {getSlaClassification(corretor.tempo_medio_resposta_minutos)}
                                     </div>
                                  ) : (
                                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                       <FontAwesomeIcon icon={faStopwatch} />
                                       N/A
                                     </div>
                                  )}
                               </td>
                               <td className="p-3 text-center">
                                  {corretor.tempo_medio_resposta_lead_minutos > 0 ? (
                                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm" title="Tempo Médio do Cliente (Ping-Pong)">
                                       <FontAwesomeIcon icon={faReplyAll} />
                                       {slaLeadText}
                                     </div>
                                  ) : (
                                     <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                       <FontAwesomeIcon icon={faReplyAll} />
                                       N/A
                                     </div>
                                  )}
                               </td>
                               <td className="p-3">
                                 <div className="flex flex-wrap gap-1.5 items-center justify-center max-w-[320px] mx-auto">
                                    {Object.entries(corretor.funil_distribuicao || {}).filter(([k,v]) => v > 0).map(([etapa, qtd]) => (
                                      <span key={etapa} className="text-[10px] font-medium px-2 py-1 rounded-md bg-white text-slate-600 border border-slate-200 shadow-sm whitespace-nowrap" title={etapa}>
                                        <b className="text-slate-800">{qtd}</b> em {etapa.length > 15 ? etapa.substring(0, 15) + '...' : etapa}
                                      </span>
                                    ))}
                                 </div>
                               </td>
                             </tr>
                           );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2"><div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center"><FontAwesomeIcon icon={faUsers} className="text-slate-300" /></div><span className="text-slate-400 text-sm">Nenhum dado de corretor.</span></div>
                )}
              </div>
           </section>

            {/* --- PERFORMANCE DE TEMPLATES (WhatsApp) --- */}
            <section className="flex flex-col gap-6 w-full mt-4 animate-fade-in-up">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
                <h3 className="text-slate-800 font-semibold mb-6 w-full text-left">Desempenho de Modelos de Mensagem (WhatsApp)</h3>
                {isCarregando ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Carregando métricas de templates...</div>
                ) : dadosComercial?.performance_templates?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50/50">
                          <th className="p-3 font-semibold rounded-tl-lg">Modelo</th>
                          <th className="p-3 font-semibold text-center">Disparadas</th>
                          <th className="p-3 font-semibold text-center">Entregues</th>
                          <th className="p-3 font-semibold text-center">Lidas</th>
                          <th className="p-3 font-semibold text-center">Respondidas</th>
                          <th className="p-3 font-semibold text-center">Taxa de Abertura</th>
                          <th className="p-3 font-semibold text-center rounded-tr-lg">Taxa de Resposta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosComercial.performance_templates.map((tpl, tIdx) => {
                          const readRate = Number(tpl.read_rate) || 0;
                          const replyRate = Number(tpl.reply_rate) || 0;
                          
                          return (
                            <tr key={tIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                    <FontAwesomeIcon icon={faComments} />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-700">{tpl.template_name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-700">
                                {tpl.total_sent}
                              </td>
                              <td className="p-3 text-center text-slate-600 font-medium">
                                {tpl.total_delivered}
                              </td>
                              <td className="p-3 text-center text-slate-600 font-medium">
                                {tpl.total_read}
                              </td>
                              <td className="p-3 text-center text-slate-700 font-bold">
                                {tpl.total_replied ?? 0}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                                    <div 
                                      className={`h-full rounded-full ${
                                        readRate >= 50 ? 'bg-emerald-500' :
                                        readRate >= 25 ? 'bg-blue-500' :
                                        readRate > 0 ? 'bg-orange-500' :
                                        'bg-slate-300'
                                      }`}
                                      style={{ width: `${readRate}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    readRate >= 50 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                    readRate >= 25 ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    readRate > 0 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                    'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                    {readRate}%
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                                    <div 
                                      className={`h-full rounded-full ${
                                        replyRate >= 30 ? 'bg-emerald-500' :
                                        replyRate >= 15 ? 'bg-blue-500' :
                                        replyRate > 0 ? 'bg-orange-500' :
                                        'bg-slate-300'
                                      }`}
                                      style={{ width: `${replyRate}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    replyRate >= 30 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                    replyRate >= 15 ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                    replyRate > 0 ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                    'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                    {replyRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 gap-2">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <FontAwesomeIcon icon={faComments} className="text-slate-300" />
                    </div>
                    <span className="text-slate-400 text-sm">Nenhum modelo de mensagem enviado no período.</span>
                  </div>
                )}
              </div>
            </section>
        </div>
      )}

      {/* --- ABA RADAR (Gestão de Tráfego Original) --- */}
      {activeTab === 'radar' && (
        <div className="space-y-6 animate-fade-in-up">
          {loadingRadar ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-indigo-500"/> <p>Calibrando Radar...</p>
            </div>
          ) : errorRadar || !stats ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4"/> <p>Não foi possível carregar os dados.</p>
            </div>
          ) : (
            <>
              {/* KPIs Radar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Acessos Reais</p>
                    <h3 className="text-3xl font-bold text-slate-800">{stats.totalVisitas || 0}</h3>
                    {stats.porDispositivo?.media_retencao_segundos > 0 && (
                      <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                        <FontAwesomeIcon icon={faClock} /> Dwell: {Math.floor(stats.porDispositivo.media_retencao_segundos / 60)}m {Math.floor(stats.porDispositivo.media_retencao_segundos % 60)}s
                      </p>
                    )}
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
                    <FontAwesomeIcon icon={faEye} className="text-xl" />
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Taxa de Cadastro (LP)</p>
                    <h3 className="text-3xl font-bold text-slate-800">
                      {(stats.funil?.length > 0 ? (stats.funil.reduce((acc, f) => acc + (f.visitas_obrigado||0), 0) / stats.funil.reduce((acc, f) => acc + (f.visitas_landing||0), 0) * 100) : 0).toFixed(1)}%
                    </h3>
                    <p className="text-[10px] text-gray-400">Total LP's vs Conversões</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                    <FontAwesomeIcon icon={faFunnelDollar} className="text-xl" />
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center hover:shadow-md transition-shadow">
                  <p className="text-gray-500 text-sm font-medium mb-2">Dispositivos Utilizados</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" title="Mobile">
                      <FontAwesomeIcon icon={faMobileAlt} className="text-emerald-500" />
                      <span className="font-bold text-lg">{stats.porDispositivo?.mobile || 0}</span>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-2" title="Desktop">
                      <FontAwesomeIcon icon={faDesktop} className="text-gray-500" />
                      <span className="font-bold text-lg">{stats.porDispositivo?.desktop || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Melhor Canal URL</p>
                    <h3 className="text-xl font-bold text-slate-800 truncate max-w-[120px]" title={stats.topOrigens?.[0]?.nome || 'N/A'}>
                      {(stats.topOrigens?.[0]?.nome || 'N/A').replace('https://', '').split('/')[0]}
                    </h3>
                    <p className="text-xs text-emerald-600 font-bold">
                      {stats.topOrigens?.[0]?.qtd || 0} visitas
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
                    <FontAwesomeIcon icon={faGlobe} className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Radar Linha 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <FontAwesomeIcon icon={faFunnelDollar} className="text-emerald-500" /> Funil Frio por Produto Lançado
                  </h3>
                  <div className="space-y-4 flex-1">
                    {(stats.funil || []).map((item, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-bold text-slate-700 capitalize">{item.produto.replace('/', '') || 'Geral'}</h4>
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">
                            {item.taxa_conversao}% Conversão
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div><span className="font-semibold text-slate-800">{item.visitas_landing}</span> Visitas Frias (LP)</div>
                          <FontAwesomeIcon icon={faGlobe} className="text-slate-300 mx-1" />
                          <div><span className="font-semibold text-slate-800">{item.visitas_obrigado}</span> Engajados (Obrigado)</div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-3">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${item.taxa_conversao}%` }}></div>
                        </div>
                      </div>
                    ))}
                    {(stats.funil || []).length === 0 && (
                      <div className="h-full flex items-center justify-center text-slate-400">Não há dados suficientes no funil para este limite de tempo.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[350px]">
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faChartPie} className="text-purple-500" /> Identificação do Ecossistema Web
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Meta Ecosystem agrupa Instagram, Facebook e Anúncios Pagos.</p>
                  <div className="h-[250px] w-full flex items-center justify-center">
                    {(stats.ecossistemas || []).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.ecossistemas} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="qtd" nameKey="ecossistema">
                            {stats.ecossistemas.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                          </Pie>
                          <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-slate-400">Sem dados mapeados.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Radar Linha 3 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex justify-between items-center">
                    <span>Performance de Páginas (Volume vs Retenção)</span>
                  </h3>
                  <div className="h-[300px] w-full space-y-5 overflow-y-auto pr-2 custom-scrollbar">
                    {(stats.topPaginas || []).length > 0 ? (
                       stats.topPaginas.map((page, idx) => {
                          const maxQtd = Math.max(...stats.topPaginas.map(p => p.qtd));
                          const widthPct = maxQtd > 0 ? (page.qtd / maxQtd) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-col gap-1 w-full relative group animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                              <div className="flex justify-between items-end">
                                <span className="text-xs font-semibold text-slate-700 truncate max-w-[200px]" title={page.nome}>
                                  {page.nome === '/' ? '/ (Home)' : page.nome}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                   {page.qtd} clicks • <span className="text-emerald-600 font-bold"><FontAwesomeIcon icon={faClock} /> {Math.floor((page.retencao_media_sec || 0) / 60)}m {Math.floor((page.retencao_media_sec || 0) % 60)}s</span>
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{ width: `${widthPct}%` }}></div>
                              </div>
                            </div>
                          )
                       })
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400">Sem dados ainda.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">Pegada de Origem de Tráfego</h3>
                  <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {(stats.topOrigens || []).map((origem, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-slate-400 border border-slate-200 text-xs font-bold flex-shrink-0">{idx + 1}</span>
                          <span className="font-medium text-slate-700 truncate text-sm" title={origem.nome}>{origem.nome.replace('https://', '').replace('http://', '').replace('www.', '')}</span>
                        </div>
                        <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-indigo-600 border border-indigo-100 min-w-[2.5rem] text-center">{origem.qtd}</span>
                      </div>
                    ))}
                    {(stats.topOrigens || []).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                        <FontAwesomeIcon icon={faGlobe} className="text-3xl mb-2" />
                        <p>Sem dados de origem.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Radar Linha 4 Campanhas */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[250px]">
                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <FontAwesomeIcon icon={faBullhorn} className="text-blue-500" /> Desempenho do Meta Ads x Tráfego
                </h3>
                <p className="text-xs text-slate-500 mb-6">Abaixo, a performance unificada das suas campanhas. Os conjuntos ou anúncios associados aparecem agrupados para facilitar a leitura da atração quente de anúncios.</p>
                <div className="space-y-4">
                  {(() => {
                     if (!stats.topCampanhas || stats.topCampanhas.length === 0) {
                        return <div className="py-8 text-center text-slate-400 bg-slate-50 border border-dashed rounded-xl">Nenhuma campanha com rastreio registrada neste período.</div>;
                     }
                     const grupos = {};
                     stats.topCampanhas.forEach(camp => {
                        const cNome = camp.nome_campanha;
                        if (!grupos[cNome]) grupos[cNome] = { nome: cNome, total: 0, itens: [] };
                        grupos[cNome].total += parseInt(camp.qtd || 0);
                        grupos[cNome].itens.push(camp);
                     });
                     
                     const gruposArray = Object.values(grupos).sort((a,b) => b.total - a.total);
                     return gruposArray.map((grupo, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                           <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-100">
                              <div className="flex items-center gap-3">
                                 <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{idx + 1}</span>
                                 <span className="font-bold text-slate-800">{grupo.nome}</span>
                              </div>
                              <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-full text-xs shadow-sm">{grupo.total} cliques totais</span>
                           </div>
                           <div className="bg-white p-0">
                              {grupo.itens.map((item, idxi) => (
                                 <div key={idxi} className="flex justify-between items-center px-6 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-2 pl-6 border-l-2 border-slate-200 ml-4">
                                       <span className="text-slate-400 text-xs">↳</span>
                                       <span className="text-sm font-medium text-slate-600 truncate max-w-[300px]" title={item.nome_anuncio}>{item.nome_anuncio}</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{item.qtd}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     ));
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Iniciando Radar...</div>}>
      <RadarPageContent />
    </Suspense>
  );
}
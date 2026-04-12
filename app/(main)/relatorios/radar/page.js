'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRadarStats, resolveMetaIds, getDicionarioContatos } from './actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMobileAlt, faDesktop, faEye, faGlobe, faSpinner, faExclamationTriangle,
  faFilter, faFunnelDollar, faChartPie, faChartLine, faBullhorn,
  faBuilding, faCalendarAlt, faChartBar, faUsers, faClock, faComments, faReplyAll, faFileExport
} from '@fortawesome/free-solid-svg-icons';
import { faMeta } from '@fortawesome/free-brands-svg-icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid, ReferenceLine } from 'recharts';
import AdsManager from '@/components/comercial/AdsManager';

import { format, startOfMonth, endOfMonth, parseISO, subMonths, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useRelatorioComercial } from '@/hooks/relatorios/useRelatorioComercial';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];
const COLORS_COMERCIAL = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function RadarPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('radar'); // 'radar', 'comercial', 'ads'
  const [somenteMarketing, setSomenteMarketing] = useState(true);

  // Controle de Datas Unificado
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

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
    refetchInterval: 30000
  });

  // FETCH COMERCIAL
  const { data: dadosComercial, isLoading: loadingComercial } = useRelatorioComercial(
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
        const dStr = format(parseISO(item.data), 'EEEE', { locale: ptBR });
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
                                const dateObj = parseISO(payload.value);
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
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} labelFormatter={(label) => { try { return format(parseISO(label), isMensal ? "MMMM 'de' yyyy" : "dd 'de' MMMM", { locale: ptBR }); } catch { return label; } }} formatter={(value) => [value, 'Leads']} />
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

           <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
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
           </div>
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
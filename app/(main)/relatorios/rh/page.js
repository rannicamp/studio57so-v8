"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chart } from "react-google-charts";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers, 
  faBirthdayCake, 
  faUserPlus, 
  faUserMinus, 
  faMoneyBillWave, 
  faSpinner, 
  faCalendarCheck, 
  faClock, 
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// --- IMPORTAÇÃO DOS MÓDULOS ISOLADOS ---
import EvolutionChart from './EvolutionChart';
import PayrollChart from './PayrollChart';
import RankingsBoard from './RankingsBoard';

// --- Componente KpiCard ---
const KpiCard = ({ title, value, subtext, icon, color, isLoading }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow relative overflow-hidden group h-full">
    {isLoading && (
      <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
        <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300" />
      </div>
    )}
    <div className="z-0">
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h3 className={`text-2xl font-bold text-gray-800 ${String(value).length > 10 ? 'text-xl' : ''}`}>{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-lg bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
      <FontAwesomeIcon icon={icon} className="text-xl" />
    </div>
  </div>
);

// --- Fetch dos Dados Mensais ---
async function fetchRhStats(organizacao_id, dateRef) {
  if (!organizacao_id) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_rh_dashboard_stats', { p_organizacao_id: organizacao_id, p_mes_ref: dateRef });
  if (error) { console.error("Erro Dashboard:", error); throw new Error(error.message); }
  return data;
}

export default function RelatorioRhPage() {
  const { user } = useAuth();
  const hoje = new Date();
  
  // Estado do Mês Selecionado
  const [mesRef, setMesRef] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10));

  const { data: stats, isLoading: loadingStats, isError } = useQuery({
    queryKey: ['rhStats', user?.organizacao_id, mesRef],
    queryFn: () => fetchRhStats(user?.organizacao_id, mesRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 5, 
  });

  // --- Formatadores ---
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);
  
  const formatTempoCasa = (meses) => {
    const total = Number(meses) || 0;
    if (total === 0) return '0 meses';
    const anos = Math.floor(total / 12);
    const m = Math.round(total % 12);
    return anos > 0 ? `${anos} ano e ${m} mês` : `${m} meses`;
  };

  const calcularRotatividade = () => {
    const ativos = Number(stats?.total_ativos || 0);
    const admissoes = Number(stats?.admissoes || 0);
    const demissoes = Number(stats?.demissoes || 0);
    if (ativos === 0) return '0%';
    const taxa = ((admissoes + demissoes) / 2) / ativos * 100;
    return taxa.toFixed(1) + '%';
  };

  // --- Gráfico de Pizza ---
  const pieData = [
    ["Cargo", "Funcionários"],
    ...(stats?.distribuicao_cargos?.map(c => [String(c.nome || 'Não definido'), Number(c.valor || 0)]) || [])
  ];

  const pieOptions = {
    title: "Distribuição por Cargo",
    pieHole: 0.4,
    is3D: false,
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    chartArea: { width: '90%', height: '80%' },
    legend: { position: 'right' },
    backgroundColor: 'transparent',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. CABEÇALHO E FILTRO GLOBAL */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-40">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Painel de Gente & Gestão</h2>
          <p className="text-sm text-gray-500">Visão consolidada</p>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-sm">
          <label className="text-sm font-medium text-gray-700">Referência:</label>
          <input 
            type="month" 
            value={mesRef.slice(0, 7)} 
            onChange={(e) => setMesRef(`${e.target.value}-01`)}
            className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700 font-medium"
          />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200 flex gap-2 items-center">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>Erro ao carregar dados.</span>
        </div>
      )}

      {/* 2. GRID DE KPIS + GRÁFICO PIZZA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna da Esquerda: KPIs */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Custo Folha */}
            <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                {loadingStats && <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" /></div>}
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">Custo Folha (Estimado)</p>
                        <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(stats?.custo_folha)}</h3>
                    </div>
                    <div className="p-3 bg-green-50 text-green-600 rounded-lg"><FontAwesomeIcon icon={faMoneyBillWave} className="text-xl" /></div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <span className="px-2 py-1 bg-gray-100 rounded text-gray-600 font-medium">
                      <FontAwesomeIcon icon={faCalendarCheck} className="mr-1" />
                      {stats?.dias_uteis_mes || 0} dias úteis
                    </span>
                    <span>considerados no cálculo de diárias</span>
                </div>
            </div>

            <KpiCard title="Ativos" value={stats?.total_ativos || 0} subtext="Fim do mês" icon={faUsers} color="blue" isLoading={loadingStats} />
            <KpiCard title="Admissões" value={stats?.admissoes || 0} subtext="No mês" icon={faUserPlus} color="indigo" isLoading={loadingStats} />
            <KpiCard title="Demissões" value={stats?.demissoes || 0} subtext="No mês" icon={faUserMinus} color="red" isLoading={loadingStats} />
            <KpiCard title="Aniversariantes" value={stats?.aniversariantes || 0} subtext="Festa no mês" icon={faBirthdayCake} color="orange" isLoading={loadingStats} />
            <KpiCard title="Tempo Médio" value={formatTempoCasa(stats?.tempo_medio_meses)} subtext="Retenção" icon={faClock} color="teal" isLoading={loadingStats} />
            
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 border-dashed flex flex-col items-center justify-center text-center h-full">
                <span className="text-gray-400 font-medium text-sm">Taxa de Rotatividade</span>
                <span className="text-2xl font-bold text-gray-600 mt-1">
                   {calcularRotatividade()}
                </span>
                <span className="text-xs text-gray-400 mt-1">Mensal</span>
            </div>
        </div>

        {/* Coluna da Direita: Pizza */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[400px]">
            <h4 className="text-sm font-semibold text-gray-600 mb-4 border-b pb-2">Distribuição de Cargos</h4>
            <div className="flex-1 flex items-center justify-center">
              {loadingStats ? (
                 <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-gray-300" />
              ) : pieData.length > 1 ? (
                <Chart chartType="PieChart" width="100%" height="300px" data={pieData} options={pieOptions} />
              ) : (
                <div className="text-center text-gray-400 text-sm px-4">
                  Sem dados para este mês.
                </div>
              )}
            </div>
        </div>
      </div>

      {/* 3. RANKINGS DE FUNCIONÁRIOS (AGORA AQUI EM CIMA) */}
      <RankingsBoard mesRef={mesRef} />

      <hr className="border-gray-100 my-4" />
      <h3 className="text-lg font-bold text-gray-700 pl-2 border-l-4 border-blue-500">Indicadores Anuais</h3>

      {/* 4. GRÁFICO DE EVOLUÇÃO (PESSOAS) */}
      <EvolutionChart />

      {/* 5. GRÁFICO DE EVOLUÇÃO (FINANCEIRO) */}
      <PayrollChart />

    </div>
  );
}
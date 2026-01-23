// Caminho: components/radar/RadarDashboard.js
"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarDadosDoRadar } from '@/app/(landingpages)/radar/actions';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEye, faUsers, faTrophy, faSpinner, faExclamationTriangle, faChartLine, faChartPie 
} from '@fortawesome/free-solid-svg-icons';

// Cores da Identidade Visual Studio 57
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function RadarDashboard() {
  
  // Busca os dados (Cache de 1 minuto para não pesar o banco)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['radar_stats'],
    queryFn: () => buscarDadosDoRadar(),
    staleTime: 60 * 1000, 
  });

  // Tela de Erro (elegante)
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 text-red-500 bg-red-50 rounded-2xl border border-red-100">
      <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
      <p>O radar encontrou uma interferência.</p>
      <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
        Recalibrar Radar
      </button>
    </div>
  );

  // Tela de Carregamento
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-96 text-gray-400 animate-pulse">
        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
        <p>Processando dados de satélite...</p>
    </div>
  );

  // Segurança contra dados vazios
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* 1. KPI CARDS (Os Números Grandes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard 
            titulo="Total de Visualizações" 
            valor={data.kpis.totalVisitas} 
            icon={faEye} 
            corIcone="text-blue-500" 
            bgIcone="bg-blue-50" 
        />
        <KpiCard 
            titulo="Visitantes Únicos" 
            valor={data.kpis.visitantesUnicos} 
            icon={faUsers} 
            corIcone="text-green-500" 
            bgIcone="bg-green-50" 
            destaque // Card central destacado
        />
        <KpiCard 
            titulo="Página Mais Acessada" 
            valor={data.topPaginas[0]?.pagina || '-'} 
            subtexto={`${data.topPaginas[0]?.acessos || 0} acessos`}
            icon={faTrophy} 
            corIcone="text-yellow-500" 
            bgIcone="bg-yellow-50" 
            isText
        />
      </div>

      {/* 2. GRÁFICOS LADO A LADO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* A. Gráfico de Evolução (Linha/Área) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faChartLine} className="text-purple-500" />
                Tráfego Diário (30 Dias)
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.graficoLinha}>
                        <defs>
                            <linearGradient id="colorVisitas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} dy={10} minTickGap={30} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                        />
                        <Area type="monotone" dataKey="visitas" stroke="#8884d8" fillOpacity={1} fill="url(#colorVisitas)" strokeWidth={3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* B. Gráfico de Origem (Pizza) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FontAwesomeIcon icon={faChartPie} className="text-orange-500" />
                Origem do Tráfego
            </h3>
            <div className="h-80 flex items-center justify-center">
                {data.graficoPizza.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={data.graficoPizza} 
                                cx="50%" cy="50%" 
                                innerRadius={70} outerRadius={100} 
                                paddingAngle={3} dataKey="value"
                            >
                                {data.graficoPizza.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-gray-400 italic">Ainda sem dados suficientes.</p>
                )}
            </div>
        </div>

      </div>

      {/* 3. TABELA DE RANKING */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Ranking de Páginas</h3>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 rounded-l-lg bg-gray-50">Página</th>
                        <th className="px-6 py-3 rounded-r-lg text-right bg-gray-50">Acessos</th>
                    </tr>
                </thead>
                <tbody>
                    {data.topPaginas.map((pg, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-800">{pg.pagina}</td>
                            <td className="px-6 py-4 text-right font-bold text-blue-600">{pg.acessos}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

    </div>
  );
}

// Sub-componente Card (Reutilizável)
function KpiCard({ titulo, valor, icon, corIcone, bgIcone, destaque = false, subtexto, isText = false }) {
    return (
        <div className={`p-6 rounded-2xl shadow-sm border transition-all ${destaque ? 'bg-white border-purple-200 ring-2 ring-purple-50' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{titulo}</h3>
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${bgIcone} ${corIcone}`}>
              <FontAwesomeIcon icon={icon} className="text-lg" />
            </div>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${destaque ? 'text-purple-600' : 'text-gray-800'} truncate`}>
            {isText ? valor : (valor || 0).toLocaleString('pt-BR')}
          </p>
          {subtexto && <p className="text-xs text-gray-400 mt-1">{subtexto}</p>}
        </div>
    );
}
'use client';

import { useQuery } from '@tanstack/react-query';
import { getRadarStats } from './actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMobileAlt, faDesktop, faEye, faGlobe, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function RadarPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['radarStats'],
    queryFn: () => getRadarStats(),
    refetchInterval: 30000 // Atualiza a cada 30s (quase tempo real!)
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500"><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> Carregando Radar...</div>;
  if (!stats) return <div className="p-8 text-center text-red-500">Erro ao carregar dados.</div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 1. KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Acessos (30d)</p>
            <h3 className="text-3xl font-bold text-slate-800">{stats.totalVisitas}</h3>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
            <FontAwesomeIcon icon={faEye} className="text-xl" />
          </div>
        </div>

        {/* Mobile vs Desktop */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-gray-500 text-sm font-medium mb-2">Dispositivos</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faMobileAlt} className="text-emerald-500" />
              <span className="font-bold text-lg">{stats.porDispositivo.mobile}</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faDesktop} className="text-gray-500" />
              <span className="font-bold text-lg">{stats.porDispositivo.desktop}</span>
            </div>
          </div>
        </div>

        {/* Origem Principal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Melhor Canal</p>
            <h3 className="text-xl font-bold text-slate-800 truncate max-w-[150px]">
              {stats.topOrigens[0]?.nome || 'N/A'}
            </h3>
            <p className="text-xs text-green-600 font-bold">
              {stats.topOrigens[0]?.qtd || 0} visitas
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
            <FontAwesomeIcon icon={faGlobe} className="text-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Gráfico de Páginas Mais Visitadas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Páginas Mais Visitadas</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={stats.topPaginas} margin={{ left: 0, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="nome" type="category" width={100} tick={{fontSize: 12}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="qtd" barSize={20} radius={[0, 4, 4, 0]}>
                  {stats.topPaginas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Lista de Origens */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Origem do Tráfego</h3>
          <div className="space-y-4">
            {stats.topOrigens.map((origem, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 capitalize">
                  {origem.nome.replace('https://', '').replace('www.', '').split('/')[0]}
                </span>
                <span className="bg-white px-3 py-1 rounded-full text-sm font-bold text-gray-600 border border-gray-200">
                  {origem.qtd}
                </span>
              </div>
            ))}
            {stats.topOrigens.length === 0 && <p className="text-gray-400 text-center">Sem dados ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
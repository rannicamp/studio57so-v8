'use client';

import { useQuery } from '@tanstack/react-query';
import { getRadarStats } from './actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMobileAlt, faDesktop, faEye, faGlobe, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function RadarPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['radarStats'],
    queryFn: () => getRadarStats(),
    refetchInterval: 30000 // Atualiza a cada 30s
  });

  // Loading
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
        <FontAwesomeIcon icon={faSpinner} spin className="text-4xl mb-4 text-indigo-500"/> 
        <p>Calibrando Radar...</p>
    </div>
  );
  
  // Erro
  if (isError || !stats) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-red-500">
        <FontAwesomeIcon icon={faExclamationTriangle} className="text-4xl mb-4"/> 
        <p>Não foi possível carregar os dados.</p>
    </div>
  );

  // --- PROTEÇÃO CONTRA CRASH (Valores Padrão) ---
  const total = stats.totalVisitas || 0;
  const mobile = stats.porDispositivo?.mobile || 0;
  const desktop = stats.porDispositivo?.desktop || 0;
  const origens = stats.topOrigens || [];
  const paginas = stats.topPaginas || [];
  
  const melhorCanal = origens.length > 0 ? origens[0] : { nome: 'N/A', qtd: 0 };

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      
      {/* 1. KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Acessos (30d)</p>
            <h3 className="text-3xl font-bold text-slate-800">{total}</h3>
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
              <span className="font-bold text-lg">{mobile}</span>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faDesktop} className="text-gray-500" />
              <span className="font-bold text-lg">{desktop}</span>
            </div>
          </div>
        </div>

        {/* Origem Principal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium">Melhor Canal</p>
            <h3 className="text-xl font-bold text-slate-800 truncate max-w-[150px]" title={melhorCanal.nome}>
              {melhorCanal.nome.replace('https://', '').split('/')[0]}
            </h3>
            <p className="text-xs text-green-600 font-bold">
              {melhorCanal.qtd} visitas
            </p>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
            <FontAwesomeIcon icon={faGlobe} className="text-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Gráfico de Páginas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Páginas Mais Visitadas</h3>
          <div className="h-[350px] w-full">
            {paginas.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={paginas} margin={{ left: 0, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="nome" type="category" width={150} tick={{fontSize: 11}} interval={0} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="qtd" barSize={20} radius={[0, 4, 4, 0]}>
                    {paginas.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : '#94a3b8'} />
                    ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">Sem dados ainda.</div>
            )}
          </div>
        </div>

        {/* 3. Lista de Origens */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[450px]">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Origem do Tráfego</h3>
          
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {origens.map((origem, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3 overflow-hidden">
                    <span className="bg-white w-6 h-6 flex items-center justify-center rounded-full text-gray-400 border border-gray-200 text-xs font-bold flex-shrink-0">
                        {idx + 1}
                    </span>
                    <span className="font-medium text-gray-700 truncate text-sm" title={origem.nome}>
                        {origem.nome.replace('https://', '').replace('http://', '').replace('www.', '')}
                    </span>
                </div>
                <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-indigo-600 border border-indigo-100 min-w-[2.5rem] text-center">
                  {origem.qtd}
                </span>
              </div>
            ))}
            {origens.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                    <FontAwesomeIcon icon={faGlobe} className="text-3xl mb-2" />
                    <p>Sem dados de origem.</p>
                </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
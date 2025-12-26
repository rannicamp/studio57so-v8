"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chart } from "react-google-charts";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Função de busca (mantida igual, pois funciona)
async function fetchRhYearlyStats(organizacao_id, ano) {
  if (!organizacao_id) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_rh_yearly_stats', { 
    p_organizacao_id: organizacao_id, 
    p_ano: ano 
  });
  if (error) throw new Error(error.message);
  return data;
}

export default function EvolutionChart() {
  const { user } = useAuth();
  const [anoRef, setAnoRef] = useState(new Date().getFullYear());

  const { data: yearlyStats, isLoading, isError } = useQuery({
    queryKey: ['rhYearly', user?.organizacao_id, anoRef],
    queryFn: () => fetchRhYearlyStats(user?.organizacao_id, anoRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 10,
  });

  // --- Processamento de Dados BLINDADO ---
  const getChartData = () => {
    // Detecta se veio Array direto ou Objeto com array
    const dadosHistorico = Array.isArray(yearlyStats) ? yearlyStats : yearlyStats?.historico;

    // Se não tiver dados, retorna null
    if (!dadosHistorico || !Array.isArray(dadosHistorico)) return null;

    const header = ['Mês', 'Admissões', 'Demissões', 'Ativos'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const rows = dadosHistorico.map(item => {
      const mesIndex = (item.mes - 1); 
      const nomeMes = meses[mesIndex] || `Mês ${item.mes}`;
      
      // Converte explicitamente para número (Segurança Máxima)
      return [
        String(nomeMes),
        Number(item.admissoes || 0),
        Number(item.demissoes || 0),
        Number(item.ativos || 0)
      ];
    });

    return [header, ...rows];
  };

  const chartData = getChartData();

  // Opções "Vanilla" (Sem enfeites perigosos)
  // Usamos ComboChart fingindo ser barras, pois ele aceita melhor múltiplas séries
  const options = {
    title: `Evolução do Quadro (${anoRef})`,
    seriesType: "bars", // Isso faz ele virar barras
    colors: ['#4f46e5', '#ef4444', '#10b981'], // Cores: Azul, Vermelho, Verde
    legend: { position: 'bottom' },
    backgroundColor: 'transparent',
    chartArea: { width: '90%', height: '70%' },
    // Removemos configurações de eixos duplos complexos para evitar o erro "Do"
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} className="text-blue-500" />
          Evolução Anual
        </h3>
        
        <div className="relative">
          <select 
            value={anoRef} 
            onChange={(e) => setAnoRef(parseInt(e.target.value))}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 outline-none cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1).reverse().map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-h-[400px] relative w-full">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
            <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-2" />
            <p className="text-gray-500">Carregando...</p>
          </div>
        )}

        {isError && (
          <div className="h-full flex flex-col items-center justify-center text-red-500 p-8 border-2 border-dashed border-red-100 rounded-lg">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2" />
            <p>Erro ao gerar gráfico.</p>
          </div>
        )}

        {!isLoading && !isError && chartData && chartData.length > 1 ? (
          <Chart
            chartType="ComboChart" // O "Pai" de todos os gráficos
            width="100%"
            height="400px"
            data={chartData}
            options={options}
          />
        ) : (
          !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 border-2 border-dashed border-gray-100 rounded-lg">
              <p>Sem dados para o ano de {anoRef}.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
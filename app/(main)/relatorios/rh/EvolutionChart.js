"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faSpinner, 
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Função de busca
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

  // --- Processamento de Dados ---
  const processData = () => {
    // Detecta se veio Array direto ou Objeto
    const dados = Array.isArray(yearlyStats) ? yearlyStats : yearlyStats?.historico;
    
    if (!dados || !Array.isArray(dados)) return { dataset: [], maxVal: 10, media: 0 };

    // CÁLCULO MANUAL DA MÉDIA (Soma Ativos / 12)
    const somaAtivos = dados.reduce((acc, item) => acc + Number(item.ativos || 0), 0);
    // Evita divisão por zero e fixa em 1 casa decimal
    const mediaCalculada = Number((somaAtivos / 12).toFixed(1));

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    let maxVal = 0;
    const processed = dados.map(item => {
      const adm = Number(item.admissoes || 0);
      const dem = Number(item.demissoes || 0);
      const atv = Number(item.ativos || 0);
      
      // Define a altura máxima do gráfico baseado no maior valor encontrado
      if (atv > maxVal) maxVal = atv;
      if (adm > maxVal) maxVal = adm;

      return {
        mes: mesesNomes[item.mes - 1] || item.mes,
        admissoes: adm,
        demissoes: dem,
        ativos: atv
      };
    });

    // Se a média for maior que a barra mais alta, ajusta a escala para a linha não sumir
    if (mediaCalculada > maxVal) maxVal = mediaCalculada;

    return { 
      dataset: processed, 
      maxVal: maxVal > 0 ? maxVal : 10, // Escala mínima de 10 para não quebrar visual
      media: mediaCalculada
    };
  };

  const { dataset, maxVal, media } = processData();

  // Função para calcular altura em % (usada nas barras e na linha)
  const getHeight = (val) => `${Math.max((val / maxVal) * 100, 0)}%`;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8 w-full">
      
      {/* 1. Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} className="text-blue-500" />
          Evolução Anual
        </h3>
        
        <div className="relative">
          <select 
            value={anoRef} 
            onChange={(e) => setAnoRef(parseInt(e.target.value))}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1).reverse().map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Área do Gráfico */}
      <div className="min-h-[350px] relative w-full select-none">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20">
            <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-blue-500 mb-2" />
            <p className="text-gray-500">Carregando...</p>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 z-20">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2" />
            <p>Não foi possível carregar os dados.</p>
          </div>
        )}

        {/* 3. O GRÁFICO CSS */}
        {!isLoading && !isError && dataset && dataset.length > 0 ? (
          <div className="w-full h-[320px] flex items-end justify-between gap-2 pt-10 pb-2 px-2 relative border-b border-gray-200">
            
            {/* LINHA DA MÉDIA (Calculada no Front: Soma/12) */}
            {media > 0 && (
              <div 
                className="absolute left-8 right-2 border-t-2 border-red-500 border-dashed z-30 pointer-events-none transition-all duration-1000 flex justify-end"
                style={{ bottom: getHeight(media) }}
              >
                {/* Rótulo Flutuante da Média */}
                <div className="bg-white border border-red-200 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm -mt-3.5 mr-0">
                  Média: {media}
                </div>
              </div>
            )}

            {/* Fundo com Linhas de Grade */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0 pl-8 pr-2 h-full">
              {[100, 75, 50, 25, 0].map((percent) => (
                <div key={percent} className="w-full border-t border-gray-100 h-1/5 relative">
                  <span className="absolute -top-3 -left-8 text-[10px] text-gray-400 w-6 text-right">
                    {Math.round((maxVal * percent) / 100)}
                  </span>
                </div>
              ))}
            </div>

            {/* Colunas dos Meses */}
            {dataset.map((data, idx) => (
              <div key={idx} className="flex flex-col items-center justify-end h-full w-full group relative z-10">
                
                {/* Tooltip ao passar o mouse */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-gray-900 text-white text-xs rounded p-2 shadow-xl w-32 z-50 pointer-events-none">
                  <p className="font-bold border-b border-gray-700 pb-1 mb-1 text-center">{data.mes}</p>
                  <div className="flex justify-between text-emerald-300"><span>Ativos:</span> <span>{data.ativos}</span></div>
                  <div className="flex justify-between text-indigo-300"><span>Entradas:</span> <span>{data.admissoes}</span></div>
                  <div className="flex justify-between text-red-300"><span>Saídas:</span> <span>{data.demissoes}</span></div>
                </div>

                {/* Área das Barras */}
                <div className="w-full max-w-[40px] flex items-end justify-center gap-1 h-full relative">
                  
                  {/* Barra Principal: Ativos (Verde) */}
                  <div 
                    className="w-full bg-emerald-200 border border-emerald-300 rounded-t-sm absolute bottom-0 flex items-end justify-center transition-all duration-500 group-hover:bg-emerald-300"
                    style={{ height: getHeight(data.ativos) }}
                  >
                     {/* Valor no topo da barra (aparece no hover) */}
                     <span className="text-[10px] text-emerald-800 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 bg-white/80 px-1 rounded">
                       {data.ativos}
                     </span>
                  </div>

                  {/* Barra: Admissões (Azul - Esquerda) */}
                  {data.admissoes > 0 && (
                    <div 
                      className="w-1/2 bg-indigo-600 rounded-t-sm z-10 transition-all duration-500 hover:bg-indigo-700 absolute bottom-0 left-0 shadow-sm border-r border-white/20"
                      style={{ height: getHeight(data.admissoes * (maxVal > 20 ? 3 : 1)) }} // *Hack visual para escalas grandes
                    ></div>
                  )}

                  {/* Barra: Demissões (Vermelho - Direita) */}
                  {data.demissoes > 0 && (
                    <div 
                      className="w-1/2 bg-red-500 rounded-t-sm z-10 transition-all duration-500 hover:bg-red-600 absolute bottom-0 right-0 shadow-sm border-l border-white/20"
                      style={{ height: getHeight(data.demissoes * (maxVal > 20 ? 3 : 1)) }}
                    ></div>
                  )}
                </div>

                {/* Nome do Mês */}
                <span className="text-xs text-gray-500 mt-2 font-medium">{data.mes}</span>
              </div>
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
              <p>Nenhum dado disponível para {anoRef}.</p>
            </div>
          )
        )}
      </div>

      {/* Legenda do Gráfico */}
      <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mt-6 border-t border-gray-100 pt-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-200 border border-emerald-300"></div>
          <span>Total Ativos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-indigo-600"></div>
          <span>Admissões</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500"></div>
          <span>Demissões</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-red-500 border-t-2 border-dashed border-red-500"></div>
          <span>Média Anual ({media})</span>
        </div>
      </div>

    </div>
  );
}
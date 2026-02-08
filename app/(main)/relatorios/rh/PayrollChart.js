"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoneyBillWave, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

async function fetchFinancialStats(organizacao_id, ano) {
  if (!organizacao_id) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_rh_financial_evolution', { 
    p_organizacao_id: organizacao_id, 
    p_ano: ano 
  });
  if (error) throw new Error(error.message);
  return data;
}

export default function PayrollChart() {
  const { user } = useAuth();
  const [anoRef, setAnoRef] = useState(new Date().getFullYear());

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['rhFinancial', user?.organizacao_id, anoRef],
    queryFn: () => fetchFinancialStats(user?.organizacao_id, anoRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 10,
  });

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const processData = () => {
    const dados = stats?.historico;
    const media = Number(stats?.media_anual || 0);
    
    if (!dados || !Array.isArray(dados)) return { dataset: [], maxVal: 1000, media: 0 };

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    let maxVal = 0;

    const processed = dados.map(item => {
      const val = Number(item.total || 0);
      if (val > maxVal) maxVal = val;
      return {
        mes: mesesNomes[item.mes - 1] || item.mes,
        valor: val
      };
    });

    if (media > maxVal) maxVal = media;

    return { dataset: processed, maxVal: maxVal > 0 ? maxVal : 1000, media };
  };

  const { dataset, maxVal, media } = processData();
  const getHeight = (val) => `${Math.max((val / maxVal) * 100, 0)}%`;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-8 w-full">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FontAwesomeIcon icon={faMoneyBillWave} className="text-emerald-500" />
          Evolução da Folha Salarial
        </h3>
        <select 
          value={anoRef} 
          onChange={(e) => setAnoRef(parseInt(e.target.value))}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg p-2.5 outline-none cursor-pointer"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1).reverse().map(ano => (
            <option key={ano} value={ano}>{ano}</option>
          ))}
        </select>
      </div>

      {/* Área do Gráfico */}
      <div className="min-h-[350px] relative w-full select-none">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20">
            <FontAwesomeIcon icon={faSpinner} spin className="text-4xl text-emerald-500 mb-2" />
            <p className="text-gray-500">Calculando custos...</p>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 z-20">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2" />
            <p>Erro ao carregar financeiro.</p>
          </div>
        )}

        {!isLoading && !isError && dataset.length > 0 ? (
          <div className="w-full h-[320px] flex items-end justify-between gap-2 pt-10 pb-2 px-2 relative border-b border-gray-200">
            
            {/* LINHA DA MÉDIA (Vermelha) */}
            {media > 0 && (
              <div 
                className="absolute left-8 right-2 border-t-2 border-red-500 border-dashed z-30 pointer-events-none transition-all duration-1000 flex justify-end"
                style={{ bottom: getHeight(media) }}
              >
                <div className="bg-white border border-red-200 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm -mt-3.5">
                  Média: {formatCurrency(media)}
                </div>
              </div>
            )}

            {/* Linhas de Grade */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0 pl-10 pr-2 h-full">
              {[100, 75, 50, 25, 0].map((percent) => (
                <div key={percent} className="w-full border-t border-gray-100 h-1/5 relative">
                  <span className="absolute -top-3 -left-10 text-[10px] text-gray-400 w-8 text-right">
                    {new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(maxVal * percent / 100)}
                  </span>
                </div>
              ))}
            </div>

            {/* Colunas */}
            {dataset.map((data, idx) => (
              <div key={idx} className="flex flex-col items-center justify-end h-full w-full group relative z-10">
                {/* Barra Principal (Verde Dinheiro) */}
                <div 
                  className="w-full max-w-[40px] bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-600 relative"
                  style={{ height: getHeight(data.valor) }}
                >
                   {/* Tooltip Hover */}
                   <span className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap transition-opacity z-50 shadow-lg pointer-events-none">
                     {formatCurrency(data.valor)}
                   </span>
                </div>
                <span className="text-xs text-gray-500 mt-2 font-medium">{data.mes}</span>
              </div>
            ))}
          </div>
        ) : (
          !isLoading && <div className="absolute inset-0 flex items-center justify-center text-gray-400"><p>Sem dados financeiros.</p></div>
        )}
      </div>
    </div>
  );
}
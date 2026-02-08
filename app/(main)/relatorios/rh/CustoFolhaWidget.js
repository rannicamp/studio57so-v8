"use client";

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMoneyBillWave, 
  faSpinner, 
  faCalendarCheck, 
  faExclamationTriangle 
} from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Função que chama a nossa calculadora "especialista" no Banco de Dados
async function fetchCustoFolha(organizacao_id, mesRef) {
  if (!organizacao_id) return { custo_total: 0, dias_uteis: 0 };
  const supabase = createClient();
  
  // Chama a função SQL 'calcular_previsao_folha'
  const { data, error } = await supabase.rpc('calcular_previsao_folha', { 
    p_organizacao_id: organizacao_id, 
    p_mes_ref: mesRef 
  });
  
  if (error) throw new Error(error.message);
  
  // Como a função retorna uma TABLE, o resultado vem como um array [{custo_total: ..., dias_uteis: ...}]
  return data?.[0] || { custo_total: 0, dias_uteis: 0 };
}

export default function CustoFolhaWidget({ mesRef }) {
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rhCustoFolha', user?.organizacao_id, mesRef],
    queryFn: () => fetchCustoFolha(user?.organizacao_id, mesRef),
    enabled: !!user?.organizacao_id,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  return (
    <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden h-full flex flex-col justify-between">
        
        {/* Loading State */}
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
            </div>
        )}

        {/* Error State */}
        {isError && (
            <div className="absolute inset-0 bg-red-50 z-10 flex flex-col items-center justify-center text-red-500 p-4 text-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-xl mb-2" />
                <span className="text-sm">Erro ao calcular folha.</span>
            </div>
        )}

        {/* Header e Valor */}
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-gray-500">Custo Folha (Estimado)</p>
                <h3 className="text-3xl font-bold text-gray-800 mt-1">
                    {formatCurrency(data?.custo_total)}
                </h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                <FontAwesomeIcon icon={faMoneyBillWave} className="text-xl" />
            </div>
        </div>

        {/* Rodapé com Dias Úteis */}
        <div className="mt-4">
            <div className="inline-flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                <span className="font-bold text-gray-700 flex items-center gap-1">
                  <FontAwesomeIcon icon={faCalendarCheck} className="text-blue-500" />
                  {data?.dias_uteis || 0} dias úteis
                </span>
                <span className="hidden sm:inline text-gray-400">|</span>
                <span className="hidden sm:inline">considerados no cálculo de diárias</span>
            </div>
        </div>
    </div>
  );
}
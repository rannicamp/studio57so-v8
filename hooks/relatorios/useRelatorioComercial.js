import { useQuery } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';

export function useRelatorioComercial(organizacaoId, dataInicio, dataFim) {
  const supabase = createClientComponentClient();

  return useQuery({
    queryKey: ['relatorioComercial', organizacaoId, format(dataInicio, 'yyyy-MM-dd'), format(dataFim, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!organizacaoId) return null;

      const { data, error } = await supabase.rpc('fn_relatorio_comercial', {
        p_data_inicio: format(dataInicio, 'yyyy-MM-dd'),
        p_data_fim: format(dataFim, 'yyyy-MM-dd'),
        p_organizacao_id: organizacaoId,
      });

      if (error) {
        console.error('Erro ao buscar o relatório comercial via RPC:', error);
        throw new Error(error.message);
      }

      return data;
    },
    enabled: !!organizacaoId && !!dataInicio && !!dataFim,
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
  });
}

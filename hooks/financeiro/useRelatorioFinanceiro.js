// hooks/financeiro/useRelatorioFinanceiro.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

export function useRelatorioFinanceiro(filtros) {
  const supabase = createClient();
  // Recebemos os filtros explícitos e os unificamos no JSON
  const { startDate, endDate, organizacaoId, contaIds, categoriaIds } = filtros;

  // Montagem do JSON padrão para a Mega Função
  const filtrosJson = {
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      contaIds: contaIds || [],
      categoriaIds: categoriaIds || [],
      status: ['Pago', 'Conciliado'], // Dashboard padrão vê o realizado
      ignoreTransfers: true // Dashboard padrão ignora transferências
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-financeiro-consolidado', organizacaoId, filtrosJson],
    queryFn: async () => {
      if (!organizacaoId) return null;

      const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
        p_organizacao_id: organizacaoId,
        p_filtros: filtrosJson,
        p_escopo: 'DASHBOARD'
      });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, 
    enabled: !!organizacaoId && !!startDate && !!endDate
  });

  // Preenchimento de dias vazios (Lógica visual do Front)
  let graficoFluxoCompleto = [];
  if (data?.graficoFluxo && startDate && endDate) {
    const todosDias = eachDayOfInterval({ start: startDate, end: endDate });
    graficoFluxoCompleto = todosDias.map(dia => {
      const dadosBanco = data.graficoFluxo.find(d => isSameDay(parseISO(d.data_ordem), dia));
      return {
        name: format(dia, 'dd/MM'),
        data_ordem: dia,
        Receita: dadosBanco ? dadosBanco.Receita : 0,
        Despesa: dadosBanco ? dadosBanco.Despesa : 0
      };
    });
  }

  return {
    kpis: data?.kpis || { receita: 0, despesa: 0, saldo: 0 },
    graficoFluxo: graficoFluxoCompleto,
    graficoPizza: data?.graficoPizza || [],
    isLoading,
    error,
    refetch
  };
}
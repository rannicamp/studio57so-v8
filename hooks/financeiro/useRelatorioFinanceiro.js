// hooks/financeiro/useRelatorioFinanceiro.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

export function useRelatorioFinanceiro(filtros) {
  const supabase = createClient();
  
  // Recebemos os filtros vindos da página
  const { 
      startDate, endDate, organizacaoId, 
      contaIds, categoriaIds, empresaIds, empreendimentoIds, 
      status, ignoreTransfers, ignoreChargebacks, useCompetencia 
  } = filtros;

  // Montagem do JSON exatamente como a 'financeiro_montar_where' espera
  const filtrosJson = {
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      
      // Arrays de IDs (Garantindo que sejam arrays)
      contaIds: contaIds || [],
      categoriaIds: categoriaIds || [],
      empresaIds: empresaIds || [],
      empreendimentoIds: empreendimentoIds || [],
      
      // Se não vier status definido no filtro, padronizamos para 'Pago' (Realizado) no dashboard,
      // mas se o usuário filtrou algo específico, respeitamos.
      status: status && status.length > 0 ? status : ['Pago', 'Conciliado'],
      
      // Flags
      ignoreTransfers: ignoreTransfers ?? true, // Padrão: Ignorar transferências no relatório
      ignoreChargebacks: ignoreChargebacks ?? true,
      useCompetencia: useCompetencia ?? false
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['relatorio-financeiro-v2', organizacaoId, filtrosJson],
    queryFn: async () => {
      if (!organizacaoId) return null;

      // Chamamos a NOVA função de relatório
      const { data, error } = await supabase.rpc('get_relatorio_financeiro', {
        p_organizacao_id: organizacaoId,
        p_filtros: filtrosJson
      });

      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // Cache de 5 minutos
    enabled: !!organizacaoId && !!startDate && !!endDate
  });

  // Preenchimento de dias vazios para o gráfico ficar bonito (sem buracos)
  let graficoFluxoCompleto = [];
  if (data?.graficoFluxo && startDate && endDate) {
    try {
        const todosDias = eachDayOfInterval({ start: startDate, end: endDate });
        graficoFluxoCompleto = todosDias.map(dia => {
          const diaStr = format(dia, 'yyyy-MM-dd');
          // Encontra se tem dados naquele dia
          const dadosBanco = data.graficoFluxo.find(d => d.data_ordem === diaStr);
          return {
            name: format(dia, 'dd/MM'),
            data_ordem: diaStr,
            Receita: dadosBanco ? Number(dadosBanco.Receita) : 0,
            Despesa: dadosBanco ? Number(dadosBanco.Despesa) : 0
          };
        });
    } catch (e) {
        console.error("Erro ao processar datas do gráfico", e);
    }
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
// hooks/financeiro/useRelatorioFinanceiro.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, eachDayOfInterval, isValid } from 'date-fns';
import { formatarFiltrosParaBanco } from '@/utils/financeiro/formatarFiltros'; // <--- O Segredo da Consistência!

export function useRelatorioFinanceiro(filtros) {
  const supabase = createClient();
  
  // ============================================================================
  // 🔐 O PORTEIRO ÚNICO (Fonte da Verdade)
  // ============================================================================
  // Agora o relatório usa EXATAMENTE a mesma regra de limpeza que a lista.
  // Se mudarmos a regra lá no 'utils', muda aqui automaticamente.
  const filtrosParaBanco = formatarFiltrosParaBanco(filtros);

  // ============================================================================
  // 📡 CHAMADAS AO BANCO (RPC)
  // ============================================================================

  // 1. KPIs (Somas Totais)
  // Usa a mesma função que alimenta o topo da lista de lançamentos
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['kpis-financeiro-relatorio', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
      
      const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      
      if (error) {
        console.error("Erro KPI Relatório:", error);
        return { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
      }
      return data || { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
    },
    enabled: !!filtros.organizacaoId,
    staleTime: 60000 // Cache de 1 minuto para ficar rapidinho
  });

  // 2. Gráfico de Fluxo (Linha do Tempo)
  const { data: fluxoData, isLoading: fluxoLoading } = useQuery({
    queryKey: ['grafico-fluxo-relatorio', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      const { data, error } = await supabase.rpc('get_dados_grafico_kpi', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      if (error) return [];
      return data || [];
    },
    enabled: !!filtros.organizacaoId,
    staleTime: 60000
  });

  // 3. Gráfico de Pizza (Categorias)
  const { data: pizzaData, isLoading: pizzaLoading } = useQuery({
    queryKey: ['grafico-pizza-relatorio', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      const { data, error } = await supabase.rpc('get_financeiro_grafico_pizza', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      if (error) return [];
      return data || [];
    },
    enabled: !!filtros.organizacaoId,
    staleTime: 60000
  });

  // ============================================================================
  // 🎨 TRATAMENTO VISUAL (Preencher dias vazios no gráfico)
  // ============================================================================
  // Essa parte é puramente estética para o gráfico não ficar "buraco",
  // mas os dados brutos já vieram consistentes do banco.
  let graficoFluxoCompleto = [];
  if (fluxoData && filtrosParaBanco.startDate && filtrosParaBanco.endDate) {
    try {
        const start = new Date(filtrosParaBanco.startDate + 'T00:00:00');
        const end = new Date(filtrosParaBanco.endDate + 'T00:00:00');
        
        if (isValid(start) && isValid(end)) {
            const todosDias = eachDayOfInterval({ start, end });
            graficoFluxoCompleto = todosDias.map(dia => {
              const diaStr = format(dia, 'yyyy-MM-dd');
              const dadosDoDia = fluxoData.find(d => d.data_ref === diaStr);
              return {
                name: format(dia, 'dd/MM'),
                data_ref: diaStr,
                Receita: dadosDoDia ? Number(dadosDoDia.receita) : 0,
                Despesa: dadosDoDia ? Number(dadosDoDia.despesa) : 0
              };
            });
        }
    } catch (e) {
        console.error("Erro datas gráfico", e);
        // Fallback: se der erro na data, mostra só o que veio do banco
        graficoFluxoCompleto = fluxoData.map(d => ({
            name: d.data_ref, 
            data_ref: d.data_ref,
            Receita: Number(d.receita),
            Despesa: Number(d.despesa)
        }));
    }
  } else {
      // Se não tiver filtro de data específico (ex: ver tudo), usa os dados brutos
      graficoFluxoCompleto = (fluxoData || []).map(d => ({
          name: d.data_ref, // Pode formatar se quiser
          data_ref: d.data_ref,
          Receita: Number(d.receita),
          Despesa: Number(d.despesa)
      }));
  }

  return {
    kpis: {
        receita: Number(kpis?.totalReceitas || 0),
        despesa: Number(kpis?.totalDespesas || 0),
        saldo: Number(kpis?.resultado || 0)
    },
    graficoFluxo: graficoFluxoCompleto,
    graficoPizza: pizzaData || [],
    isLoading: kpiLoading || fluxoLoading || pizzaLoading,
    refetch: () => { refetchKpis(); }
  };
}
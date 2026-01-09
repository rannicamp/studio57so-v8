// hooks/financeiro/useRelatorioFinanceiro.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, eachDayOfInterval, isValid } from 'date-fns';

export function useRelatorioFinanceiro(filtros) {
  const supabase = createClient();
  
  // 1. Normalização dos Filtros (Garante que o SQL entenda tudo)
  const filtrosJson = {
      // Datas formatadas como string simples (YYYY-MM-DD) para evitar confusão de fuso horário
      startDate: filtros?.startDate && isValid(new Date(filtros.startDate)) 
          ? format(new Date(filtros.startDate), 'yyyy-MM-dd') 
          : null,
      endDate: filtros?.endDate && isValid(new Date(filtros.endDate)) 
          ? format(new Date(filtros.endDate), 'yyyy-MM-dd') 
          : null,
      
      // Garante arrays para evitar erros de "in" no SQL
      contaIds: Array.isArray(filtros?.contaIds) ? filtros.contaIds : [],
      categoriaIds: Array.isArray(filtros?.categoriaIds) ? filtros.categoriaIds : [],
      empresaIds: Array.isArray(filtros?.empresaIds) ? filtros.empresaIds : [],
      empreendimentoIds: Array.isArray(filtros?.empreendimentoIds) ? filtros.empreendimentoIds : [],
      
      // Status padrão se não houver seleção
      status: filtros?.status && filtros.status.length > 0 ? filtros.status : ['Pago', 'Conciliado'], 
      
      // Configurações extras
      ignoreTransfers: filtros.ignoreTransfers ?? true,
      ignoreChargebacks: filtros.ignoreChargebacks ?? true,
      useCompetencia: filtros.useCompetencia ?? false,
      searchTerm: filtros.searchTerm || ''
  };

  // 2. Busca KPIs (Cards do Topo)
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['kpis-financeiro-v5', filtros.organizacaoId, filtrosJson],
    queryFn: async () => {
      if (!filtros.organizacaoId) return { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
      
      const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosJson
      });
      
      if (error) throw error;
      return data || { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
    },
    enabled: !!filtros.organizacaoId
  });

  // 3. Busca Gráfico de Fluxo (Barras)
  const { data: fluxoData, isLoading: fluxoLoading } = useQuery({
    queryKey: ['grafico-fluxo-v5', filtros.organizacaoId, filtrosJson],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      // Chama a função específica de gráfico que você atualizou no SQL
      const { data, error } = await supabase.rpc('get_dados_grafico_kpi', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosJson
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!filtros.organizacaoId
  });

  // 4. Busca Gráfico de Pizza (Categorias)
  const { data: pizzaData, isLoading: pizzaLoading } = useQuery({
    queryKey: ['grafico-pizza-v5', filtros.organizacaoId, filtrosJson],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      const { data, error } = await supabase.rpc('get_financeiro_grafico_pizza', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosJson
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!filtros.organizacaoId
  });

  // 5. Processamento dos Dados do Gráfico (Preenche dias vazios)
  let graficoFluxoCompleto = [];
  if (fluxoData && filtrosJson.startDate && filtrosJson.endDate) {
    try {
        // Força o horário T00:00:00 para garantir que a geração de dias não pule nada por fuso
        const start = new Date(filtrosJson.startDate + 'T00:00:00');
        const end = new Date(filtrosJson.endDate + 'T00:00:00');
        
        if (isValid(start) && isValid(end)) {
            const todosDias = eachDayOfInterval({ start, end });
            graficoFluxoCompleto = todosDias.map(dia => {
              const diaStr = format(dia, 'yyyy-MM-dd');
              
              // AQUI ESTAVA O ERRO: O SQL novo retorna 'data_ref', não 'data_ordem'
              const dadosDoDia = fluxoData.find(d => d.data_ref === diaStr);
              
              return {
                name: format(dia, 'dd/MM'),
                data_ref: diaStr, // Mantemos coerência
                Receita: dadosDoDia ? Number(dadosDoDia.receita) : 0,
                Despesa: dadosDoDia ? Number(dadosDoDia.despesa) : 0
              };
            });
        }
    } catch (e) {
        console.error("Erro ao processar datas do gráfico", e);
    }
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
    refetch: () => { refetchKpis(); } // Função para recarregar manualmente se precisar
  };
}
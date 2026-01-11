// hooks/financeiro/useRelatorioFinanceiro.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, eachDayOfInterval, isValid } from 'date-fns';

export function useRelatorioFinanceiro(filtros) {
  const supabase = createClient();
  
  // ============================================================================
  // 🔧 PREPARAÇÃO LOCAL DOS DADOS
  // ============================================================================
  // Criamos o objeto para o banco AQUI DENTRO, sem depender de arquivos externos.
  
  const filtrosParaBanco = {
      ...filtros, // Mantém o que já veio

      // 1. Tratamento de Datas (Garante YYYY-MM-DD para não quebrar gráfico)
      startDate: filtros?.startDate && isValid(new Date(filtros.startDate)) 
          ? format(new Date(filtros.startDate), 'yyyy-MM-dd') 
          : null,
      endDate: filtros?.endDate && isValid(new Date(filtros.endDate)) 
          ? format(new Date(filtros.endDate), 'yyyy-MM-dd') 
          : null,
      
      // 2. TIPO (Receita/Despesa)
      tipo: Array.isArray(filtros?.tipo) 
            ? filtros.tipo 
            : (filtros?.tipo ? [filtros.tipo] : []),

      // 3. Blindagem de Arrays (Para o RPC não reclamar de null)
      contaIds: Array.isArray(filtros?.contaIds) ? filtros.contaIds : [],
      categoriaIds: Array.isArray(filtros?.categoriaIds) ? filtros.categoriaIds : [],
      empresaIds: Array.isArray(filtros?.empresaIds) ? filtros.empresaIds : [],
      empreendimentoIds: Array.isArray(filtros?.empreendimentoIds) ? filtros.empreendimentoIds : [],
      etapaIds: Array.isArray(filtros?.etapaIds) ? filtros.etapaIds : [],
      
      // 4. Status (Padrão seguro se vazio)
      status: (filtros?.status && filtros.status.length > 0) 
              ? filtros.status 
              : ['Pago', 'Conciliado'], 

      // 5. Favorecido
      favorecidoId: (filtros?.favorecidoId && filtros.favorecidoId !== 'null') 
              ? filtros.favorecidoId 
              : null,
      searchTerm: filtros?.searchTerm || ''
  };

  // ============================================================================
  // 📡 CHAMADAS AO BANCO (RPC)
  // ============================================================================

  // 1. KPIs
  const { data: kpis, isLoading: kpiLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['kpis-financeiro-final', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
      
      const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      
      if (error) {
        console.error("Erro KPI:", error);
        return { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
      }
      return data || { totalReceitas: 0, totalDespesas: 0, resultado: 0 };
    },
    enabled: !!filtros.organizacaoId
  });

  // 2. Gráfico de Fluxo
  const { data: fluxoData, isLoading: fluxoLoading } = useQuery({
    queryKey: ['grafico-fluxo-final', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      const { data, error } = await supabase.rpc('get_dados_grafico_kpi', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      if (error) return [];
      return data || [];
    },
    enabled: !!filtros.organizacaoId
  });

  // 3. Gráfico de Pizza
  const { data: pizzaData, isLoading: pizzaLoading } = useQuery({
    queryKey: ['grafico-pizza-final', filtros.organizacaoId, filtrosParaBanco],
    queryFn: async () => {
      if (!filtros.organizacaoId) return [];
      const { data, error } = await supabase.rpc('get_financeiro_grafico_pizza', {
        p_organizacao_id: filtros.organizacaoId,
        p_filtros: filtrosParaBanco
      });
      if (error) return [];
      return data || [];
    },
    enabled: !!filtros.organizacaoId
  });

  // ============================================================================
  // 🎨 TRATAMENTO VISUAL
  // ============================================================================
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
    refetch: () => { refetchKpis(); }
  };
}
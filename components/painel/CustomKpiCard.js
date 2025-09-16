// components/painel/CustomKpiCard.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import KpiCard from '../KpiCard';
import { faSpinner, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

// =================================================================================
// INÍCIO DA CORREÇÃO PONTUAL
// O PORQUÊ: Esta função foi ajustada para chamar a função do banco de dados
// 'consultar_lancamentos_filtrados' EXATAMENTE como a página 'financeiro/page.js' faz.
// 1. Ela passa o objeto 'filters' inteiro como o parâmetro 'p_filtros'.
// 2. Ela encadeia o .select('valor, tipo') para buscar apenas os dados necessários.
// Isso garante 100% de consistência com a lógica de busca já existente.
// =================================================================================
async function calculateKpiValue({ queryKey }) {
    const [_key, kpiDefinition, organizacao_id] = queryKey;

    if (!organizacao_id || !kpiDefinition) {
        return [];
    }

    const supabase = createClient();
    const filters = kpiDefinition.filtros || {};

    const { data, error } = await supabase
        .rpc('consultar_lancamentos_filtrados', {
            p_organizacao_id: organizacao_id,
            p_filtros: filters 
        })
        .select('valor, tipo');

    if (error) {
        console.error("Erro ao calcular KPI:", error);
        throw new Error(error.message);
    }

    return data || [];
}
// =================================================================================
// FIM DA CORREÇÃO PONTUAL
// =================================================================================

export default function CustomKpiCard({ kpi }) {
    const { organizacao_id } = useAuth();

    const { data: rawData, isLoading, isError, error } = useQuery({
        queryKey: ['customKpiValue', kpi, organizacao_id],
        queryFn: calculateKpiValue,
        enabled: !!organizacao_id && !!kpi,
    });

    const formattedValue = useMemo(() => {
        if (isLoading) return 'Calculando...';
        if (isError) {
            console.error("Erro no KPI Card:", error);
            return 'Erro no cálculo';
        }
        if (!rawData) return 'R$ 0,00';

        // O PORQUÊ: A função RPC retorna uma lista de lançamentos.
        // Esta lógica calcula os totais a partir dessa lista,
        // garantindo que o valor seja processado corretamente.
        const receitas = rawData.filter(l => l.tipo === 'Receita').reduce((acc, l) => acc + (l.valor || 0), 0);
        const despesas = rawData.filter(l => l.tipo === 'Despesa').reduce((acc, l) => acc + (l.valor || 0), 0);

        let total;
        switch (kpi.tipo_calculo) {
            case 'receitas': total = receitas; break;
            case 'despesas': total = despesas; break;
            case 'resultado': total = receitas - despesas; break;
            case 'contagem': return rawData.length.toString();
            default: total = 0;
        }
        
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total || 0);
    }, [rawData, isLoading, isError, kpi.tipo_calculo, error]);

    return (
        <KpiCard
            title={kpi.titulo}
            value={formattedValue}
            icon={isLoading ? faSpinner : faChartPie}
            color="text-purple-600"
            isLoading={isLoading}
            tooltip={kpi.descricao}
        />
    );
}
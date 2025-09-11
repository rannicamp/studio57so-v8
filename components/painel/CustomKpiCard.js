"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import KpiCard from '../KpiCard';
import { faSpinner, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

// Função que aplica os filtros (a mesma que usamos no construtor)
const applyFiltersToQuery = (query, currentFilters) => {
    if (!currentFilters) return query;
    if (currentFilters.searchTerm) query = query.ilike('descricao', `%${currentFilters.searchTerm}%`);
    if (currentFilters.startDate) query = query.gte('data_transacao', currentFilters.startDate);
    if (currentFilters.endDate) query = query.lte('data_transacao', currentFilters.endDate);
    if (currentFilters.empresaIds?.length > 0) query = query.in('empresa_id', currentFilters.empresaIds);
    if (currentFilters.contaIds?.length > 0) query = query.in('conta_id', currentFilters.contaIds);
    if (currentFilters.categoriaIds?.length > 0) query = query.in('categoria_id', currentFilters.categoriaIds);
    if (currentFilters.empreendimentoIds?.length > 0) query = query.in('empreendimento_id', currentFilters.empreendimentoIds);
    if (currentFilters.favorecidoId) query = query.eq('favorecido_contato_id', currentFilters.favorecidoId);
    if (currentFilters.tipo?.length > 0 && currentFilters.tipo[0] !== '') {
        query = query.in('tipo', Array.isArray(currentFilters.tipo) ? currentFilters.tipo : [currentFilters.tipo]);
    }
    return query;
};

// Função que busca e calcula o valor de UM kpi
async function calculateKpiValue({ queryKey }) {
    const [_key, kpiDefinition] = queryKey;
    const supabase = createClient();

    let query = supabase.from('lancamentos').select('valor, tipo');
    query = applyFiltersToQuery(query, kpiDefinition.filtros);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return data || [];
}

export default function CustomKpiCard({ kpi }) {
    // Cada card busca seu próprio dado de forma independente
    const { data: rawData, isLoading, isError } = useQuery({
        queryKey: ['customKpiValue', kpi], // Chave única para este KPI específico
        queryFn: calculateKpiValue,
    });

    const formattedValue = useMemo(() => {
        if (isLoading) return 'Calculando...';
        if (isError) return 'Erro';
        if (!rawData) return 'N/A';

        const receitas = rawData.filter(l => l.tipo === 'Receita').reduce((acc, l) => acc + l.valor, 0);
        const despesas = rawData.filter(l => l.tipo === 'Despesa').reduce((acc, l) => acc + l.valor, 0);

        let total;
        switch (kpi.tipo_calculo) {
            case 'receitas': total = receitas; break;
            case 'despesas': total = despesas; break;
            case 'resultado': total = receitas - despesas; break;
            case 'contagem': return rawData.length.toString();
            default: total = 0;
        }
        
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
    }, [rawData, isLoading, isError, kpi.tipo_calculo]);

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
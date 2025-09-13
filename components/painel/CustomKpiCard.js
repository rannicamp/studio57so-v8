"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import KpiCard from '../KpiCard';
import { faSpinner, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

// A função de aplicar filtros permanece a mesma, pois a segurança é garantida antes.
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

// O PORQUÊ: A função agora recebe 'organizacao_id' para garantir que os cálculos
// sejam feitos apenas com os dados da organização correta.
async function calculateKpiValue({ queryKey }) {
    const [_key, kpiDefinition, organizacao_id] = queryKey;
    if (!organizacao_id) return []; // Retorna vazio se não houver organização

    const supabase = createClient();

    // BLINDADO: A query agora é filtrada por 'organizacao_id' antes de qualquer outro filtro.
    let query = supabase.from('lancamentos').select('valor, tipo').eq('organizacao_id', organizacao_id);
    query = applyFiltersToQuery(query, kpiDefinition.filtros);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return data || [];
}

export default function CustomKpiCard({ kpi }) {
    const { organizacao_id } = useAuth(); // BLINDADO: Pegamos a organização

    const { data: rawData, isLoading, isError } = useQuery({
        // O PORQUÊ: A chave da query agora inclui o 'organizacao_id' para garantir
        // que os dados de cada organização sejam cacheados separadamente.
        queryKey: ['customKpiValue', kpi, organizacao_id],
        queryFn: calculateKpiValue,
        enabled: !!organizacao_id, // A query só roda se a organização existir.
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
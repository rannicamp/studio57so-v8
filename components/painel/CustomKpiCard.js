// components/painel/CustomKpiCard.js
"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import KpiCard from '@/components/shared/KpiCard';
import { faSpinner, faChartPie } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';

// =================================================================================
// INÍCIO DA EVOLUÇÃO (FASE 4)
// O PORQUÊ: Esta função agora é o cérebro que decide qual motor usar.
// 1. Ela verifica o campo 'kpi.tipo_kpi'.
// 2. Se for 'generico', ela chama a nova "super função" 'calcular_kpi_generico',
//    passando a "receita" completa do KPI (tabela, operação, etc.).
// 3. Se for 'financeiro' (ou um KPI antigo sem esse campo), ela chama a função
//    original 'consultar_lancamentos_filtrados', garantindo compatibilidade.
// 4. No final, ela retorna os dados em um formato padronizado para o componente.
// =================================================================================
async function calculateKpiValue({ queryKey }) {
    const [_key, kpi, organizacao_id] = queryKey;

    if (!organizacao_id || !kpi) return null;

    const supabase = createClient();

    // ROTA 1: Para os novos KPIs Genéricos (Contratos, RH, etc.)
    if (kpi.tipo_kpi === 'generico') {
        const { data, error } = await supabase.rpc('calcular_kpi_generico', {
            p_organizacao_id: organizacao_id,
            p_tabela_fonte: kpi.tabela_fonte,
            p_operacao: kpi.operacao,
            p_coluna_alvo: kpi.coluna_alvo,
            p_filtros: kpi.filtros
        });

        if (error) {
            console.error("Erro ao calcular KPI Genérico:", error);
            throw new Error(error.message);
        }
        
        // Retorna um objeto padronizado com o valor e o tipo de operação
        return { value: data, operation: kpi.operacao };
    
    // ROTA 2: Para os KPIs Financeiros (mantém o funcionamento antigo)
    } else {
        const { data, error } = await supabase
            .rpc('consultar_lancamentos_filtrados', {
                p_organizacao_id: organizacao_id,
                p_filtros: kpi.filtros 
            })
            .select('valor, tipo');

        if (error) {
            console.error("Erro ao calcular KPI Financeiro:", error);
            throw new Error(error.message);
        }

        // Processa os dados financeiros para chegar ao valor final
        const receitas = data.filter(l => l.tipo === 'Receita').reduce((acc, l) => acc + (l.valor || 0), 0);
        const despesas = data.filter(l => l.tipo === 'Despesa').reduce((acc, l) => acc + (l.valor || 0), 0);

        let total;
        let operationType = 'SUM'; // Padrão para valores monetários

        switch (kpi.tipo_calculo) {
            case 'receitas': total = receitas; break;
            case 'despesas': total = despesas; break;
            case 'resultado': total = receitas - despesas; break;
            case 'contagem': 
                total = data.length;
                operationType = 'COUNT';
                break;
            default: total = 0;
        }

        // Retorna o mesmo objeto padronizado
        return { value: total, operation: operationType };
    }
}
// =================================================================================
// FIM DA EVOLUÇÃO
// =================================================================================

export default function CustomKpiCard({ kpi }) {
    const { organizacao_id } = useAuth();

    const { data: calculatedData, isLoading, isError, error } = useQuery({
        queryKey: ['customKpiValue', kpi, organizacao_id],
        queryFn: calculateKpiValue,
        enabled: !!organizacao_id && !!kpi,
    });

    const formattedValue = useMemo(() => {
        if (isLoading) return 'Calculando...';
        if (isError) return 'Erro';
        if (!calculatedData) return 'N/A';

        // O PORQUÊ: Graças ao formato padronizado, esta lógica ficou super simples.
        // Se a operação for de contagem, mostra um número.
        // Se não, formata como moeda.
        if (calculatedData.operation === 'COUNT') {
            return calculatedData.value.toString();
        }
        
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatedData.value || 0);
    }, [calculatedData, isLoading, isError]);

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
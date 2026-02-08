"use client";

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { format, isValid } from 'date-fns';

export function useFinanceiroStats({ filters }) {
    const supabase = createClient();

    // Normalização RIGOROSA dos filtros (Igual ao Relatório)
    const filtrosNormalizados = {
        // Datas: Se for objeto Date, converte para string YYYY-MM-DD. Se inválido, manda null.
        startDate: filters?.startDate && isValid(new Date(filters.startDate)) 
            ? format(new Date(filters.startDate), 'yyyy-MM-dd') 
            : null,
        endDate: filters?.endDate && isValid(new Date(filters.endDate)) 
            ? format(new Date(filters.endDate), 'yyyy-MM-dd') 
            : null,
            
        // IDs: Garante que sejam arrays
        contaIds: Array.isArray(filters?.contaIds) ? filters.contaIds : [],
        categoriaIds: Array.isArray(filters?.categoriaIds) ? filters.categoriaIds : [],
        empresaIds: Array.isArray(filters?.empresaIds) ? filters.empresaIds : [],
        empreendimentoIds: Array.isArray(filters?.empreendimentoIds) ? filters.empreendimentoIds : [],
        
        // Status: Se vazio, o SQL assume todos (mas podemos filtrar aqui se quiser)
        status: Array.isArray(filters?.status) ? filters.status : [],
        
        // Configurações
        useCompetencia: filters?.useCompetencia ?? false,
        searchTerm: filters?.searchTerm || '',
        ignoreTransfers: true // Sempre ignora transferências nos KPIs para não duplicar valores
    };

    return useQuery({
        queryKey: ['financeiro-kpis-unificado', filtrosNormalizados],
        queryFn: async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) return null;
            
            const organizacaoId = userData.user.user_metadata?.organizacao_id;
            if (!organizacaoId) return null;

            // Chama a função consolidada (O Cérebro Único)
            const { data, error } = await supabase.rpc('get_financeiro_consolidado', {
                p_organizacao_id: organizacaoId,
                p_filtros: filtrosNormalizados
            });

            if (error) {
                console.error('Erro ao buscar stats unificados:', error);
                throw error;
            }

            // O retorno do RPC já vem no formato:
            // { totalReceitas, totalDespesas, resultado, totalPago, totalPendente }
            
            // Adicionamos cálculos extras se necessário para a UI antiga
            return [
                // Transformamos em array para compatibilidade com código legado se necessário, 
                // ou retornamos o objeto direto se refatorarmos o componente visual.
                // Aqui mantemos a estrutura que o componente visual espera ou adaptamos.
                // Como o componente visual (FinanceiroStats.js) que você me mostrou antes 
                // esperava um array de linhas para somar, vamos adaptar o COMPONENTE VISUAL também 
                // para usar esses dados prontos, que é muito mais rápido.
                data
            ];
        },
        staleTime: 1000 * 60 * 5, // Cache de 5 minutos
        refetchOnWindowFocus: false
    });
}
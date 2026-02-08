// Caminho: hooks/useActivityFormOptions.js
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

export function useActivityFormOptions(organizacaoId, propsData = {}) {
    const supabase = createClient();
    const { 
        allEmpresas: propEmpresas, 
        empreendimentos: propEmpreendimentos, 
        funcionarios: propFuncionarios 
    } = propsData;

    // --- 1. BUSCA EMPRESAS ---
    const { data: fetchedEmpresas, isLoading: loadingEmpresas } = useQuery({
        queryKey: ['activityOptions', 'empresas', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return [];
            const { data, error } = await supabase
                .from('cadastro_empresa')
                .select('id, razao_social, nome_fantasia')
                .eq('organizacao_id', organizacaoId)
                .order('razao_social');
            if (error) throw error;
            return data;
        },
        enabled: !propEmpresas && !!organizacaoId,
        staleTime: 1000 * 60 * 10,
    });

    // --- 2. BUSCA EMPREENDIMENTOS ---
    const { data: fetchedEmpreendimentos, isLoading: loadingObras } = useQuery({
        queryKey: ['activityOptions', 'empreendimentos', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return [];
            const { data, error } = await supabase
                .from('empreendimentos')
                .select('id, nome, empresa_proprietaria_id, status')
                .eq('organizacao_id', organizacaoId)
                .order('nome');
            if (error) throw error;
            return data;
        },
        enabled: !propEmpreendimentos && !!organizacaoId,
        staleTime: 1000 * 60 * 5,
    });

    // --- 3. BUSCA FUNCIONÁRIOS (CORRIGIDO) ---
    const { data: fetchedFuncionarios, isLoading: loadingFunc } = useQuery({
        queryKey: ['activityOptions', 'funcionarios', organizacaoId],
        queryFn: async () => {
            if (!organizacaoId) return [];
            
            // CORREÇÃO CRÍTICA:
            // 1. Removi 'cargo' (não existe na tabela).
            // 2. Mantive 'full_name' (que é o correto segundo seu banco).
            const { data, error } = await supabase
                .from('funcionarios')
                .select('id, full_name') 
                .eq('organizacao_id', organizacaoId)
                .eq('status', 'Ativo') 
                .order('full_name'); 
            
            if (error) {
                console.error("Erro ao buscar funcionários:", error);
                throw error;
            }
            return data;
        },
        enabled: !propFuncionarios && !!organizacaoId,
        staleTime: 1000 * 60 * 10,
    });

    // --- Mesclagem ---
    const empresas = propEmpresas || fetchedEmpresas || [];
    const empreendimentos = propEmpreendimentos || fetchedEmpreendimentos || [];
    const funcionarios = propFuncionarios || fetchedFuncionarios || [];

    const isLoading = 
        (!propEmpresas && loadingEmpresas) || 
        (!propEmpreendimentos && loadingObras) || 
        (!propFuncionarios && loadingFunc);

    return {
        empresas,
        empreendimentos,
        funcionarios,
        isLoading
    };
}
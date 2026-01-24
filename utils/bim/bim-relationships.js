import { createClient } from '../supabase/client';

const supabase = createClient();

/**
 * Busca todos os IDs de elementos vinculados a uma lista de atividades
 */
export async function getElementosPorAtividades(atividadeIds, projetoBimId) {
    if (!atividadeIds || atividadeIds.length === 0) return [];

    const { data, error } = await supabase
        .from('atividades_elementos')
        .select('external_id, atividade_id')
        .eq('projeto_bim_id', projetoBimId)
        .in('atividade_id', atividadeIds);

    if (error) {
        console.error("Erro ao buscar vínculos BIM:", error);
        return [];
    }

    return data;
}
// Caminho: utils/bim/bim-relationships.js
import { createClient } from '../supabase/client';

const supabase = createClient();

/**
 * Busca todos os elementos vinculados a atividades específicas dentro de um projeto BIM
 */
export async function getElementosPorAtividades(atividadeIds, projetoBimId) {
    if (!atividadeIds || atividadeIds.length === 0 || !projetoBimId) return [];

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
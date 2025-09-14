// utils/getOrganizationId.js
import { createClient } from './supabase/server';

export const getOrganizationId = async (userId) => {
    if (!userId) {
        console.error("getOrganizationId foi chamado sem um userId.");
        return null;
    }
    
    const supabase = createClient();
    
    const { data: userProfile, error } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Erro ao buscar organização do usuário no servidor:", error.message);
        return null;
    }

    if (!userProfile) {
        console.error(`Nenhum perfil de usuário encontrado para o ID: ${userId}`);
        return null;
    }

    return userProfile.organizacao_id;
};
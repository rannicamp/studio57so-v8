// utils/getOrganizationId.js
import { createClient } from './supabase/server';

// ATUALIZAÇÃO: Removemos o 'userId' dos parênteses.
// A função agora vai descobrir o usuário sozinha.
export const getOrganizationId = async () => {
    // CORREÇÃO: Adicionamos 'await' aqui porque no Next.js 15 o createClient é assíncrono
    const supabase = await createClient();
    
    // 1. Buscamos o usuário logado aqui dentro
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Se deu erro ou não achou usuário, paramos aqui
    if (authError || !user) {
        console.error("getOrganizationId: Erro ao buscar usuário ou usuário não logado.", authError?.message);
        return null;
    }
    
    // 2. Agora usamos o 'user.id' que encontramos para buscar o perfil
    const { data: userProfile, error: profileError } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id) // ATUALIZAÇÃO: Usamos o user.id que buscamos aqui
        .single();

    if (profileError) {
        console.error("Erro ao buscar organização do usuário no servidor:", profileError.message);
        return null;
    }

    if (!userProfile) {
        console.error(`Nenhum perfil de usuário encontrado para o ID: ${user.id}`);
        return null;
    }

    // 3. Retornamos a organização!
    return userProfile.organizacao_id;
};
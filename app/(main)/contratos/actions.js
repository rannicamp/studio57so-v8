// app/(main)/contratos/actions.js

'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation';

export async function createNewContrato() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { error: "Usuário não autenticado." };
    }

    const { data: userProfile, error: profileError } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();

    if (profileError || !userProfile) {
        console.error("Erro ao buscar perfil do usuário:", profileError);
        return { error: "Não foi possível encontrar o perfil do usuário." };
    }

    const organizacaoId = userProfile.organizacao_id;

    const { data: newContrato, error: insertError } = await supabase
        .from('contratos')
        .insert({
            organizacao_id: organizacaoId,
            status_contrato: 'Rascunho',
            valor_final_venda: 0,
            data_venda: new Date().toISOString().split('T')[0], // Define a data de hoje como padrão
        })
        .select('id')
        .single();

    if (insertError) {
        console.error("Erro ao criar novo contrato:", insertError);
        return { error: "Falha ao criar o contrato no banco de dados." };
    }

    if (newContrato) {
        redirect(`/contratos/${newContrato.id}`);
    }
}
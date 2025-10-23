// app/(main)/contratos/actions.js

'use server';

import { createClient } from '../../../utils/supabase/server';
import { redirect } from 'next/navigation'; // Mantemos para o redirect final

// --- ATUALIZAÇÃO: A função agora aceita empreendimentoId ---
export async function createNewContrato(empreendimentoId) { 
    const supabase = createClient();

    // Validação de entrada
    if (!empreendimentoId) {
        return { error: "O Empreendimento é obrigatório para criar um contrato." };
    }

    // Busca usuário e organização (como antes)
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

    // --- ATUALIZAÇÃO: Insere o contrato JÁ COM o empreendimento_id ---
    const { data: newContrato, error: insertError } = await supabase
        .from('contratos')
        .insert({
            empreendimento_id: empreendimentoId, // <-- USA O PARÂMETRO!
            organizacao_id: organizacaoId,
            status_contrato: 'Rascunho',
            valor_final_venda: 0, 
            data_venda: new Date().toISOString().split('T')[0],
            criado_por_usuario_id: user.id // <-- Adiciona quem criou
        })
        .select('id')
        .single();

    if (insertError) {
        console.error("Erro ao criar novo contrato:", insertError);
        // Retorna o erro em vez de redirecionar em caso de falha
        return { error: "Falha ao criar o contrato no banco de dados." }; 
    }

    // --- ATUALIZAÇÃO: Retorna o ID para o cliente redirecionar ---
    if (newContrato) {
        // Não redireciona mais aqui, retorna o ID para a página
        return { success: true, newContractId: newContrato.id }; 
    }

    // Fallback caso algo muito estranho aconteça
    return { error: "Ocorreu um erro inesperado ao criar o contrato." }; 
}

// Manter outras actions se houver...
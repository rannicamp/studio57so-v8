// app/(corretor)/portal-contratos/actions.js

'use server';

// --- CORREÇÃO: Ajustado o caminho da importação ---
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation'; 

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

    // --- Lógica de inserção (estava correta e foi mantida) ---
    const { data: newContrato, error: insertError } = await supabase
        .from('contratos')
        .insert({
            empreendimento_id: empreendimentoId,
            organizacao_id: organizacaoId,
            status_contrato: 'Rascunho',
            valor_final_venda: 0, 
            data_venda: new Date().toISOString().split('T')[0],
            criado_por_usuario_id: user.id // <-- O "carimbo" de dono!
        })
        .select('id')
        .single();

    if (insertError) {
        console.error("Erro ao criar novo contrato:", insertError);
        return { error: "Falha ao criar o contrato no banco de dados." }; 
    }

    if (newContrato) {
        return { success: true, newContractId: newContrato.id }; 
    }

    return { error: "Ocorreu um erro inesperado ao criar o contrato." }; 
}

// Manter outras actions se houver...
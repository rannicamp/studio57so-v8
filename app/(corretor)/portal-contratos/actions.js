// app/(corretor)/portal-contratos/actions.js

'use server';

// --- CORREÇÃO: Ajustado o caminho da importação ---
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation'; 

// --- MUDANÇA 1: Recebe 'empreendimentoId' E 'tipoDocumento' ---
export async function createNewContrato(empreendimentoId, tipoDocumento) { 
    const supabase = createClient();

    // Validação de entrada
    if (!empreendimentoId) {
        return { error: "O Empreendimento é obrigatório." };
    }
    // --- MUDANÇA 2: Validação do tipo de documento ---
    if (!tipoDocumento) {
        return { error: "O Tipo de Documento é obrigatório." };
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

    // --- MUDANÇA 3: Insere o 'tipo_documento' no banco ---
    const { data: newContrato, error: insertError } = await supabase
        .from('contratos')
        .insert({
            empreendimento_id: empreendimentoId,
            tipo_documento: tipoDocumento,       // <-- CAMPO ADICIONADO!
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
        return { error: "Falha ao criar o documento no banco de dados." }; 
    }

    if (newContrato) {
        return { success: true, newContractId: newContrato.id }; 
    }

    return { error: "Ocorreu um erro inesperado ao criar o documento." }; 
}

// Manter outras actions se houver...
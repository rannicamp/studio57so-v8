// app/(main)/contratos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- FUNÇÃO 1: CRIAR CONTRATO (Mantida) ---
export async function createNewContrato(empreendimentoId, tipoDocumento) {
    const supabase = createClient();

    if (!empreendimentoId) return { error: "O Empreendimento é obrigatório." };
    if (!tipoDocumento) return { error: "O Tipo de Documento é obrigatório." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Usuário não autenticado." };

    const { data: userProfile } = await supabase.from('usuarios').select('organizacao_id').eq('id', user.id).single();
    if (!userProfile) return { error: "Perfil não encontrado." };

    const { data: newContrato, error } = await supabase
        .from('contratos')
        .insert({
            empreendimento_id: empreendimentoId,
            tipo_documento: tipoDocumento,
            organizacao_id: userProfile.organizacao_id,
            status_contrato: 'Rascunho',
            valor_final_venda: 0,
            data_venda: new Date().toISOString().split('T')[0],
            criado_por_usuario_id: user.id
        })
        .select('id')
        .single();

    if (error) {
        console.error("Erro ao criar:", error);
        return { error: "Falha ao criar documento." };
    }

    return { success: true, newContractId: newContrato.id };
}

// --- FUNÇÃO 2: ATUALIZAR STATUS (ATUALIZADA E CORRIGIDA) ---
export async function updateContratoStatus(contratoId, newStatus) {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autorizado." };

    // 1. Busca dados do contrato para saber o tipo e organização
    const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select('id, tipo_documento, organizacao_id')
        .eq('id', contratoId)
        .single();

    if (fetchError || !contrato) return { error: "Contrato não encontrado." };

    // 2. Atualiza o status do CONTRATO
    const { error: updateError } = await supabase
        .from('contratos')
        .update({ status_contrato: newStatus })
        .eq('id', contratoId);

    if (updateError) return { error: "Erro ao atualizar status." };

    // 3. LÓGICA DE PRODUTOS (CORREÇÃO: Busca na tabela de vínculos correta)
    
    // Primeiro, buscamos quais produtos estão ligados a esse contrato
    const { data: produtosVinculados } = await supabase
        .from('contrato_produtos')
        .select('produto_id')
        .eq('contrato_id', contratoId)
        .eq('organizacao_id', contrato.organizacao_id);

    // Cria uma lista limpa apenas com os IDs
    const listaDeProdutos = produtosVinculados?.map(p => p.produto_id) || [];

    // Se houver produtos vinculados, aplicamos a regra
    if (listaDeProdutos.length > 0) {
        
        // CENÁRIO A: Contrato Assinado
        if (newStatus === 'Assinado') {
            let novoStatusProduto = 'Vendido'; // Padrão para contratos de venda

            // Normaliza o texto para garantir a verificação
            const tipoDoc = (contrato.tipo_documento || '').trim().toLowerCase();
            
            // --- A MÁGICA AQUI ---
            // Se for Termo de Interesse (ou Reserva), muda para RESERVADO
            if (tipoDoc.includes('termo') || tipoDoc.includes('interesse') || tipoDoc.includes('reserva')) {
                novoStatusProduto = 'Reservado';
            }

            // Atualiza TODOS os produtos vinculados de uma vez
            await supabase
                .from('produtos_empreendimento')
                .update({ status: novoStatusProduto })
                .in('id', listaDeProdutos)
                .eq('organizacao_id', contrato.organizacao_id);
        }

        // CENÁRIO B: Contrato Cancelado ou Distratado
        if (newStatus === 'Cancelado' || newStatus === 'Distratado') {
            // Libera os produtos de volta para Disponível
            await supabase
                .from('produtos_empreendimento')
                .update({ status: 'Disponível' })
                .in('id', listaDeProdutos)
                .eq('organizacao_id', contrato.organizacao_id);
        }
    }

    revalidatePath('/contratos');
    revalidatePath('/empreendimentos'); 
    return { success: true };
}
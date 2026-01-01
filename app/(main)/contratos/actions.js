// app/(main)/contratos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { enviarNotificacao } from '@/utils/notificacoes';

// --- FUNÇÃO 1: CRIAR CONTRATO ---
export async function createNewContrato(empreendimentoId, tipoDocumento) {
    const supabase = await createClient();

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
        return { error: `Falha ao criar documento: ${error.message}` };
    }

    // Mantemos a notificação de CRIAÇÃO
    await enviarNotificacao({
        userId: user.id,
        titulo: `Novo Documento Iniciado 📄`,
        mensagem: `Um novo ${tipoDocumento} foi criado como Rascunho.`,
        link: `/contratos/${newContrato.id}`,
        organizacaoId: userProfile.organizacao_id,
        canal: 'contratos'
    });

    return { success: true, newContractId: newContrato.id };
}

// --- FUNÇÃO 2: ATUALIZAR STATUS ---
export async function updateContratoStatus(contratoId, newStatus) {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autorizado." };

    // 1. Busca dados do contrato
    const { data: contrato, error: fetchError } = await supabase
        .from('contratos')
        .select('id, tipo_documento, organizacao_id, numero_contrato')
        .eq('id', contratoId)
        .single();

    if (fetchError || !contrato) {
        console.error("Erro ao buscar contrato:", fetchError);
        return { error: "Contrato não encontrado ou sem permissão." };
    }

    // 2. Atualiza o status do CONTRATO
    const { error: updateError } = await supabase
        .from('contratos')
        .update({ status_contrato: newStatus })
        .eq('id', contratoId);

    if (updateError) {
        console.error("Erro REAL ao atualizar status:", updateError);
        // AQUI ESTÁ A MÁGICA: Retornamos a mensagem técnica para você ver na tela
        return { error: `Erro no Banco de Dados: ${updateError.message} (Código: ${updateError.code})` };
    }

    // 3. LÓGICA DE PRODUTOS
    try {
        const { data: produtosVinculados } = await supabase
            .from('contrato_produtos')
            .select('produto_id')
            .eq('contrato_id', contratoId)
            .eq('organizacao_id', contrato.organizacao_id);

        const listaDeProdutos = produtosVinculados?.map(p => p.produto_id) || [];

        if (listaDeProdutos.length > 0) {
            // CENÁRIO A: Contrato Assinado
            if (newStatus === 'Assinado') {
                let novoStatusProduto = 'Vendido'; 
                const tipoDoc = (contrato.tipo_documento || '').trim().toLowerCase();
                
                if (tipoDoc.includes('termo') || tipoDoc.includes('interesse') || tipoDoc.includes('reserva')) {
                    novoStatusProduto = 'Reservado';
                }

                await supabase
                    .from('produtos_empreendimento')
                    .update({ status: novoStatusProduto })
                    .in('id', listaDeProdutos)
                    .eq('organizacao_id', contrato.organizacao_id);
            }

            // CENÁRIO B: Contrato Cancelado ou Distratado
            if (newStatus === 'Cancelado' || newStatus === 'Distratado') {
                await supabase
                    .from('produtos_empreendimento')
                    .update({ status: 'Disponível' })
                    .in('id', listaDeProdutos)
                    .eq('organizacao_id', contrato.organizacao_id);
            }
        }
    } catch (prodError) {
        console.error("Erro não fatal ao atualizar produtos vinculados:", prodError);
    }

    revalidatePath('/contratos');
    revalidatePath('/empreendimentos'); 
    return { success: true };
}
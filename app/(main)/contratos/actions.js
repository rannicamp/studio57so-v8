'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { enviarNotificacao } from '@/utils/notificacoes';

// --- FUNÇÃO 1: CRIAR CONTRATO (MANTIDA) ---
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

// --- FUNÇÃO 2: ATUALIZAR STATUS (LÓGICA AJUSTADA) ---
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
        return { error: "Contrato não encontrado ou sem permissão." };
    }

    // 2. Atualiza o status do CONTRATO
    const { error: updateError } = await supabase
        .from('contratos')
        .update({ status_contrato: newStatus })
        .eq('id', contratoId);

    if (updateError) {
        return { error: `Erro no Banco de Dados: ${updateError.message}` };
    }

    // 3. LÓGICA DE PRODUTOS (MÁQUINA DE ESTADOS)
    try {
        const { data: produtosVinculados } = await supabase
            .from('contrato_produtos')
            .select('produto_id')
            .eq('contrato_id', contratoId)
            .eq('organizacao_id', contrato.organizacao_id);

        const listaDeProdutos = produtosVinculados?.map(p => p.produto_id) || [];

        if (listaDeProdutos.length > 0) {
            let novoStatusProduto = null;

            // CASO 1: CONTRATO FINALIZADO/ASSINADO
            if (newStatus === 'Assinado') {
                const tipoDoc = (contrato.tipo_documento || '').trim().toUpperCase();
                
                // Se for explicitamente CONTRATO DE VENDA -> VENDIDO
                if (tipoDoc === 'CONTRATO' || tipoDoc.includes('COMPRA E VENDA')) {
                    if (!tipoDoc.includes('TERMO') && !tipoDoc.includes('INTERESSE')) {
                        novoStatusProduto = 'Vendido';
                    } else {
                        novoStatusProduto = 'Reservado'; // Segurança se tiver "Termo" no nome
                    }
                } else {
                    // Qualquer outra coisa (Termo, Reserva, Vazio) -> RESERVADO
                    novoStatusProduto = 'Reservado';
                }
            }
            
            // CASO 2: "DESFAZER" ou CANCELAR
            // Se voltar para Rascunho, Em assinatura, Negociação ou Cancelado -> DISPONÍVEL
            else if (['Rascunho', 'Em assinatura', 'Em negociação', 'Cancelado', 'Distratado'].includes(newStatus)) {
                novoStatusProduto = 'Disponível';
            }

            // Se houve mudança de estado definida, aplica no banco
            if (novoStatusProduto) {
                await supabase
                    .from('produtos_empreendimento')
                    .update({ status: novoStatusProduto })
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
// app/(corretor)/portal-contratos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- FUNÇÃO 1: CRIAR NOVO CONTRATO (Mantida) ---
export async function createNewContrato(empreendimentoId, tipoDocumento) { 
    const supabase = await createClient();

    if (!empreendimentoId) return { error: "O Empreendimento é obrigatório." };
    if (!tipoDocumento) return { error: "O Tipo de Documento é obrigatório." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Usuário não autenticado." };

    const { data: userProfile, error: profileError } = await supabase
        .from('usuarios')
        .select('organizacao_id')
        .eq('id', user.id)
        .single();

    if (profileError || !userProfile) {
        console.error("Erro perfil:", profileError);
        return { error: "Perfil não encontrado." };
    }

    const organizacaoId = userProfile.organizacao_id;

    // Cria o contrato garantindo que lixeira é false
    const { data: newContrato, error: insertError } = await supabase
        .from('contratos')
        .insert({
            empreendimento_id: empreendimentoId,
            tipo_documento: tipoDocumento,
            organizacao_id: organizacaoId,
            status_contrato: 'Rascunho',
            valor_final_venda: 0, 
            data_venda: new Date().toISOString().split('T')[0],
            criado_por_usuario_id: user.id,
            lixeira: false // <--- Nasce visível
        })
        .select('id')
        .single();

    if (insertError) {
        console.error("Erro ao criar:", insertError);
        return { error: "Falha ao criar o documento." }; 
    }

    if (newContrato) {
        revalidatePath('/portal-contratos');
        return { success: true, newContractId: newContrato.id }; 
    }

    return { error: "Erro inesperado na criação." }; 
}

// --- FUNÇÃO 2: LISTAR CONTRATOS (Com filtro de lixeira) ---
export async function getMeusContratos() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('contratos')
    .select(`
      *,
      empreendimentos ( nome ),
      contatos ( nome ),
      produtos_empreendimento ( unidade )
    `)
    .eq('criado_por_usuario_id', user.id)
    .eq('lixeira', false) // <--- Só traz o que NÃO foi excluído
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar contratos:', error)
    return []
  }

  return data
}

// --- FUNÇÃO 3: EXCLUSÃO SUAVE (A CORREÇÃO ESTÁ AQUI) ---
export async function softDeleteContrato(contratoId) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Não autorizado' }

  // ATENÇÃO: Usamos UPDATE, não DELETE!
  const { error } = await supabase
    .from('contratos')
    .update({ lixeira: true }) // <--- O SEGREDO: Marca como lixo, não apaga
    .eq('id', contratoId)
    .eq('criado_por_usuario_id', user.id) // Segurança: só apaga o que é dele

  if (error) {
      console.error('Erro ao mover para lixeira:', error)
      return { error: error.message }
  }

  revalidatePath('/portal-contratos')
  return { success: true }
}
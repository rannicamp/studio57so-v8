// app/(corretor)/portal-contratos/actions.js
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// --- FUNÇÃO 1: CRIAR NOVO CONTRATO (Mantida) ---
export async function createNewContrato(empreendimentoId, tipoDocumento) { 
 try {
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
  valor_final_venda: 0, data_venda: new Date().toISOString().split('T')[0],
  criado_por_usuario_id: user.id,
  lixeira: false // <--- Nasce visível
  })
  .select('id')
  .single();

  if (insertError) {
  console.error("Erro ao criar:", insertError);
  return { error: "Falha ao criar o documento." }; }

  if (newContrato) {
  revalidatePath('/portal-contratos');
  return { success: true, newContractId: newContrato.id }; }

  return { error: "Erro inesperado na criação." }; 
 } catch(err) {
  console.error('Edge crash prevent', err);
  return { error: 'Erro de conectividade.' };
 }
}

// --- FUNÇÃO 2: LISTAR CONTRATOS (Com filtro de lixeira) ---
export async function getMeusContratos() {
 try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
  .from('usuarios')
  .select('funcao_id, is_superadmin, organizacao_id, funcoes(nome_funcao)')
  .eq('id', user.id)
  .single()

  if (!profile) return []

  // Restringe apenas se for Corretor
  const isCorretor = profile.funcoes?.nome_funcao?.toLowerCase().includes('corretor') || profile.funcao_id === 20;

  let query = supabase
  .from('contratos')
  .select(`
  *,
  empreendimentos ( nome ),
  contatos ( nome ),
  produtos_empreendimento ( unidade )
  `)
  .eq('organizacao_id', profile.organizacao_id)
  .eq('lixeira', false) // <--- Só traz o que NÃO foi excluído

  if (isCorretor) {
    query = query.eq('criado_por_usuario_id', user.id)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
  console.error('Erro ao buscar contratos:', error)
  return []
  }

  return data
 } catch (err){
  console.error('Edge crash prevent', err)
  return []
 }
}

// --- FUNÇÃO 3: EXCLUSÃO SUAVE ---
export async function softDeleteContrato(contratoId) {
 try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: profile } = await supabase
  .from('usuarios')
  .select('funcao_id, is_superadmin, funcoes(nome_funcao)')
  .eq('id', user.id)
  .single()

  if (!profile) return { error: 'Não autorizado' }

  // Restringe apenas se for Corretor
  const isCorretor = profile.funcoes?.nome_funcao?.toLowerCase().includes('corretor') || profile.funcao_id === 20;

  let query = supabase
  .from('contratos')
  .update({ lixeira: true })
  .eq('id', contratoId)

  if (isCorretor) {
    query = query.eq('criado_por_usuario_id', user.id) // Segurança: só apaga o que é dele
  }

  const { error } = await query

  if (error) {
  console.error('Erro ao mover para lixeira:', error)
  return { error: error.message }
  }

  revalidatePath('/portal-contratos')
  return { success: true }
 } catch (err) {
  console.error('Edge crash prevent', err)
  return { error: 'Erro de conectividade' }
 }
}
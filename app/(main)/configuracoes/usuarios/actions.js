'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// --- CLIENTE ADMIN (Service Role) ---
// Permite bypass nas regras de segurança para o Gestor fazer tudo
const supabaseAdmin = createClient(
 process.env.NEXT_PUBLIC_SUPABASE_URL,
 process.env.SUPABASE_SERVICE_ROLE_KEY,
 {
 auth: {
 autoRefreshToken: false,
 persistSession: false
 }
 }
);

// ==============================================================================
// 1. CRIAÇÃO DE USUÁRIO (NOVO)
// ==============================================================================
export async function createUser(prevState, formData) {
 const data = {
 nome: formData.get('nome'),
 sobrenome: formData.get('sobrenome'),
 email: formData.get('email'),
 password: formData.get('password'),
 funcao_id: formData.get('funcao_id'),
 funcionario_id: formData.get('funcionario_id') || null,
 organizationId: formData.get('organizationId'),
 }

 if (!data.email || !data.password || !data.nome || !data.organizationId) {
 return { success: false, message: 'Campos essenciais (nome, email, senha, organização) são obrigatórios.' }
 }

 // A. Criar na Autenticação (Auth)
 const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
 email: data.email,
 password: data.password,
 email_confirm: true, // Já forçamos a confirmação na criação também
 user_metadata: {
 nome: data.nome,
 sobrenome: data.sobrenome,
 },
 })

 if (authError) {
 console.error('Erro Supabase Auth:', authError);
 return { success: false, message: `Erro ao criar login: ${authError.message}` }
 }

 if (!authUser.user) {
 return { success: false, message: 'Não foi possível criar o usuário. Email pode ser inválido.' }
 }

 // B. Criar no Banco de Dados (Tabela usuarios)
 const { error: profileError } = await supabaseAdmin
 .from('usuarios')
 .insert({
 id: authUser.user.id,
 nome: data.nome,
 sobrenome: data.sobrenome,
 email: data.email,
 funcao_id: data.funcao_id,
 funcionario_id: data.funcionario_id,
 organizacao_id: data.organizationId,
 is_active: true
 })

 if (profileError) {
 console.error('Erro Profile:', profileError);
 // Remove o login criado se falhar ao criar o perfil para não ficar "lixo" no sistema
 await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
 return { success: false, message: `Erro ao salvar dados do usuário: ${profileError.message}` }
 }

 revalidatePath('/configuracoes/usuarios')
 return { success: true, message: 'Usuário criado com sucesso!' }
}

// ==============================================================================
// 2. EDIÇÃO DE DADOS // ==============================================================================
export async function updateUserAction(formData) {
 const userId = formData.get('userId')
 const roleId = formData.get('roleId')
 const funcionarioId = formData.get('funcionarioId')
 const isActive = formData.get('isActive') === 'on'
try {
 const { error } = await supabaseAdmin
 .from('usuarios')
 .update({
 funcao_id: roleId,
 funcionario_id: funcionarioId === 'null' ? null : funcionarioId,
 updated_at: new Date()
 })
 .eq('id', userId)

 if (error) throw error
 await toggleUserStatus(userId, !isActive)
revalidatePath('/configuracoes/usuarios')
 return { success: true, message: 'Dados atualizados com sucesso!' }
 } catch (error) {
 console.error('Erro ao atualizar:', error)
 return { success: false, message: 'Erro ao atualizar usuário.' }
 }
}

// ==============================================================================
// 3. ALTERAR STATUS (ATIVAR/DESATIVAR COM BANIMENTO)
// ==============================================================================
export async function toggleUserStatus(userId, currentStatus) {
 try {
 const newStatus = !currentStatus;

 const { error: dbError } = await supabaseAdmin
 .from('usuarios')
 .update({ is_active: newStatus })
 .eq('id', userId);

 if (dbError) throw new Error(dbError.message);

 if (newStatus === false) {
 await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
} else {
 await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
}

 revalidatePath('/configuracoes/usuarios');
 return { success: true, message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.` };
 } catch (error) {
 console.error('Erro ao alterar status:', error);
 return { success: false, message: 'Erro ao alterar status do usuário.' };
 }
}

// ==============================================================================
// 4. EXCLUIR USUÁRIO
// ==============================================================================
export async function deleteUserAction(userId) {
 try {
 const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
 if (authError) console.error("Erro ao deletar do Auth:", authError)

 const { error: dbError } = await supabaseAdmin
 .from('usuarios')
 .delete()
 .eq('id', userId)

 if (dbError) throw dbError

 revalidatePath('/configuracoes/usuarios')
 return { success: true, message: 'Usuário excluído definitivamente.' }
 } catch (error) {
 console.error('Erro ao excluir:', error)
 if (error.code === '23503') {
 return { success: false, message: 'Não é possível excluir: Usuário possui vínculos (vendas, logs, etc). Tente apenas Desativar.' }
 }
 return { success: false, message: 'Erro ao excluir usuário.' }
 }
}

// ==============================================================================
// 5. REDEFINIR SENHA // ==============================================================================
export async function resetUserPassword(userId, newPassword) {
 try {
 if (!newPassword || newPassword.length < 6) {
 return { success: false, message: 'A senha deve ter pelo menos 6 caracteres.' };
 }

 const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
 password: newPassword,
 email_confirm: true // Se não estava confirmado, confirma agora
 });

 if (error) throw error;

 return { success: true, message: 'Senha redefinida com sucesso!' };
 } catch (error) {
 console.error('Erro ao resetar senha:', error);
 return { success: false, message: 'Erro ao redefinir a senha.' };
 }
}

// ==============================================================================
// 6. LIBERAÇÃO FORÇADA DE ACESSO (O "BYPASS" MÁGICO DO DEVONILDO 🪄)
// ==============================================================================
export async function forceUnlockUser(userId) {
 try {
 // Força a senha padrão e confirma o e-mail para acesso imediato
 const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
 password: '123456',
 email_confirm: true,
 ban_duration: 'none' // Garante que não está banido
 });

 if (error) throw error;

 // Opcional: Garantir que ele tá ativo na nossa tabela visual
 await supabaseAdmin.from('usuarios').update({ is_active: true }).eq('id', userId);

 revalidatePath('/configuracoes/usuarios');
 return { success: true, message: 'Acesso liberado! Senha padrão definida como 123456.' };
 } catch (error) {
 console.error('Erro ao forçar liberação:', error);
 return { success: false, message: 'Erro ao liberar o acesso do usuário.' };
 }
}

// ==============================================================================
// 7. VINCULAR CONTATO (CRM / RODÍZIO)
// ==============================================================================
export async function linkUserToContact(userId, contactId) {
  try {
    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({ contato_id: contactId === 'null' || !contactId ? null : contactId })
      .eq('id', userId);

    if (error) throw error;

    revalidatePath('/configuracoes/usuarios');
    return { success: true, message: 'Contato vinculado com sucesso!' };
  } catch (error) {
    console.error('Erro ao vincular contato:', error);
    return { success: false, message: 'Erro ao vincular o contato ao usuário.' };
  }
}
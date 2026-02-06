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
    email_confirm: true,
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
// 2. EDIÇÃO DE DADOS (RESTAURADO PARA O MODAL)
// ==============================================================================
export async function updateUserAction(formData) {
  const userId = formData.get('userId')
  const roleId = formData.get('roleId')
  const funcionarioId = formData.get('funcionarioId')
  // Converte "on" para true, null para false (caso venha do checkbox)
  const isActive = formData.get('isActive') === 'on' 

  try {
    // 1. Atualiza dados básicos
    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({
        funcao_id: roleId,
        funcionario_id: funcionarioId === 'null' ? null : funcionarioId,
        // Se quiser atualizar o status aqui também, descomente:
        // is_active: isActive, 
        updated_at: new Date()
      })
      .eq('id', userId)

    if (error) throw error
    
    // 2. Sincroniza o status/banimento se o checkbox foi alterado no modal
    // Chamamos a função de toggle para garantir que o Auth também seja atualizado
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
  // Nota: currentStatus é o status ATUAL. O novo será o inverso.
  // Se for passado um booleano direto para "statusDesejado", adapte a lógica abaixo.
  // Aqui assumimos que se currentStatus=true, queremos desativar.
  
  try {
    const newStatus = !currentStatus;

    // A. Atualiza na tabela visual 'usuarios'
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update({ is_active: newStatus })
      .eq('id', userId);

    if (dbError) throw new Error(dbError.message);

    // B. Banir/Desbanir no Auth do Supabase (impede login real)
    if (newStatus === false) {
       await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }); // Banir por 100 anos
    } else {
       await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' }); // Remover banimento
    }

    revalidatePath('/configuracoes/usuarios');
    return { success: true, message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso.` };
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    return { success: false, message: 'Erro ao alterar status do usuário.' };
  }
}

// ==============================================================================
// 4. EXCLUIR USUÁRIO (RESTAURADO PARA A LIXEIRA)
// ==============================================================================
export async function deleteUserAction(userId) {
  try {
    // A. Deleta do Auth (Sistema de Login)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authError) {
        console.error("Erro ao deletar do Auth:", authError)
    }

    // B. Deleta da tabela pública 'usuarios'
    // (Geralmente o Supabase deleta em cascata se configurado, mas garantimos aqui)
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId)

    if (dbError) throw dbError

    revalidatePath('/configuracoes/usuarios')
    return { success: true, message: 'Usuário excluído definitivamente.' }
  } catch (error) {
    console.error('Erro ao excluir:', error)
    if (error.code === '23503') { // Código Postgres para violação de chave estrangeira
        return { success: false, message: 'Não é possível excluir: Usuário possui vínculos (vendas, logs, etc). Tente apenas Desativar.' }
    }
    return { success: false, message: 'Erro ao excluir usuário.' }
  }
}

// ==============================================================================
// 5. REDEFINIR SENHA (NOVO)
// ==============================================================================
export async function resetUserPassword(userId, newPassword) {
    try {
        if (!newPassword || newPassword.length < 6) {
            return { success: false, message: 'A senha deve ter pelo menos 6 caracteres.' };
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword
        });

        if (error) throw error;

        return { success: true, message: 'Senha redefinida com sucesso!' };
    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        return { success: false, message: 'Erro ao redefinir a senha.' };
    }
}
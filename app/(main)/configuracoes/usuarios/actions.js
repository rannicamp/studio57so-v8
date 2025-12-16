'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Criamos um cliente ADMIN para realizar operações privilegiadas
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

  // 1. Criar na Autenticação (Auth)
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

  // 2. Criar no Banco de Dados (Tabela usuarios)
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

export async function toggleUserStatus(userId, currentStatus) {
  try {
    const newStatus = !currentStatus;

    // 1. Atualiza na tabela visual 'usuarios'
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update({ is_active: newStatus })
      .eq('id', userId);

    if (dbError) throw new Error(dbError.message);

    // 2. Opcional: Banir/Desbanir no Auth do Supabase (impede login real)
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
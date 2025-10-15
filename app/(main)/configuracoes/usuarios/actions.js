// app/(main)/configuracoes/usuarios/actions.js
'use server'

// Importamos o criador de cliente padrão do Supabase
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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

  // Validação simples dos dados recebidos
  if (!data.email || !data.password || !data.nome || !data.organizationId) {
    return { message: 'Campos essenciais (nome, email, senha, organização) são obrigatórios.' }
  }

  // Criamos um cliente Supabase ADMIN aqui dentro.
  // Este cliente usa a Chave de Serviço (Service Role Key) e não tenta mexer nos cookies.
  // Certifique-se que as variáveis de ambiente estão no seu ficheiro .env.local
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // Estas opções garantem que este cliente não tentará gerir sessões ou cookies.
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // 1. Criar o utilizador na autenticação do Supabase (como administrador)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // O utilizador não precisará de confirmar o email
    user_metadata: {
      nome: data.nome,
      sobrenome: data.sobrenome,
    },
  })

  if (authError) {
    console.error('Erro Supabase Auth:', authError);
    return {
      message: `Erro ao criar utilizador na autenticação: ${authError.message}`,
    }
  }

  if (!authUser.user) {
    return {
        message: 'Não foi possível criar o utilizador. O email pode já estar em uso ou ser inválido.'
    }
  }

  // 2. Inserir os dados do utilizador na nossa tabela 'usuarios'
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
    console.error('Erro Supabase Profile:', profileError);
    // Se der erro aqui, apagamos o utilizador criado na autenticação para não deixar dados inconsistentes
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return {
      message: `Erro ao guardar perfil do utilizador: ${profileError.message}`,
    }
  }

  // Se tudo correu bem, atualizamos os dados na página e retornamos sucesso
  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}
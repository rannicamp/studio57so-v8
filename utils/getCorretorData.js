// utils/getCorretorData.js
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

/**
 * Busca os dados essenciais do corretor logado (ID do usuário e ID de contato).
 * Esta função é segura para ser usada em Server Components e Server Actions.
 * @returns {Promise<{ userId: string, contatoId: number | null, error: any }>}
 */
export async function getCorretorData() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // 1. Obter o usuário logado da sessão
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('Erro ao buscar usuário:', authError)
    return { userId: null, contatoId: null, error: 'Usuário não autenticado.' }
  }

  const userId = user.id

  // 2. Buscar o 'funcionario_id' na tabela 'usuarios'
  const { data: usuarioData, error: usuarioError } = await supabase
    .from('usuarios')
    .select('funcionario_id')
    .eq('id', userId)
    .single()

  if (usuarioError || !usuarioData) {
    console.error('Erro ao buscar dados do usuário:', usuarioError)
    return {
      userId,
      contatoId: null,
      error: 'Dados do perfil de usuário não encontrados.',
    }
  }

  const funcionarioId = usuarioData.funcionario_id

  if (!funcionarioId) {
    return {
      userId,
      contatoId: null,
      error: 'Usuário não está vinculado a um funcionário.',
    }
  }

  // 3. Buscar o 'contato_id' na tabela 'funcionarios'
  const { data: funcionarioData, error: funcionarioError } = await supabase
    .from('funcionarios')
    .select('contato_id')
    .eq('id', funcionarioId)
    .single()

  if (funcionarioError || !funcionarioData) {
    console.error('Erro ao buscar dados do funcionário:', funcionarioError)
    return {
      userId,
      contatoId: null,
      error: 'Dados do funcionário não encontrados.',
    }
  }

  const contatoId = funcionarioData.contato_id

  if (!contatoId) {
    return {
      userId,
      contatoId: null,
      error: 'Funcionário não está vinculado a um contato.',
    }
  }

  // 4. Sucesso! Retorna o ID do usuário e o ID de contato
  return { userId, contatoId, error: null }
}
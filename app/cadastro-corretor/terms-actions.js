'use server'

import { createClient } from '@/utils/supabase/server'

export async function getLatestTerms(organizacaoId) {
  const supabase = createClient()

  if (!organizacaoId) {
    console.error('ID da organização não fornecido para buscar termos.')
    return null
  }

  // Busca o termo ativo para corretores DA ORGANIZAÇÃO ESPECÍFICA
  const { data, error } = await supabase
    .from('termos_uso')
    .select('*')
    .eq('tipo', 'CORRETOR')
    .eq('ativo', true)
    .eq('organizacao_id', organizacaoId) // <--- Filtro crucial adicionado
    .order('versao', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Erro ao buscar termos:', error)
    return null
  }

  return data
}
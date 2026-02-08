// app/cadastro-corretor/terms-actions.js
'use server'

import { createAdminClient } from '@/utils/supabase/server'

export async function getLatestTerms(organizacaoId) {
  // CORREÇÃO: Usamos o AdminClient (Chave Mestra)
  // Isso permite que usuários NÃO LOGADOS (anônimos) leiam os termos
  // sem serem bloqueados pelas regras de segurança do banco (RLS).
  const supabase = createAdminClient()

  if (!organizacaoId) {
    console.error('ID da organização não fornecido para buscar termos.')
    return null
  }

  try {
    // Busca o termo ativo para corretores DA ORGANIZAÇÃO ESPECÍFICA
    const { data, error } = await supabase
      .from('termos_uso')
      .select('*')
      .eq('tipo', 'CORRETOR')
      .eq('ativo', true)
      .eq('organizacao_id', organizacaoId)
      .order('versao', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Erro ao buscar termos (Supabase):', error.message)
      return null
    }

    return data

  } catch (err) {
    console.error('Erro fatal ao buscar termos:', err)
    return null
  }
}
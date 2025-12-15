'use server'

import { createClient } from '@/utils/supabase/server'

export async function getLatestTerms() {
  const supabase = createClient()

  // Busca o termo ativo para corretores com a maior versão
  const { data, error } = await supabase
    .from('termos_uso')
    .select('*')
    .eq('tipo', 'CORRETOR')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Erro ao buscar termos:', error)
    return null
  }

  return data
}

export async function registerTermAcceptance(userId, termId) {
    // Esta função será chamada internamente pelo server action de cadastro
    // mas deixamos preparada aqui se precisar ser chamada via client
    const supabase = createClient()
    
    await supabase.from('termos_aceite').insert({
        user_id: userId,
        termo_id: termId
    })
}
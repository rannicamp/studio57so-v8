// app/(main)/configuracoes/politicas/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const ORGANIZACAO_ID = 2; // Studio 57

// Buscar o histórico de termos
export async function getTermHistory() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('termos_uso')
    .select('*')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('tipo', 'CORRETOR')
    .order('versao', { ascending: false })

  if (error) {
    console.error('Erro ao buscar histórico:', error)
    return []
  }
  
  return data
}

// Salvar uma NOVA versão do termo
export async function saveNewTermVersion(conteudoHtml) {
  const supabase = await createClient()

  // 1. Descobrir qual é a última versão
  const { data: lastTerm } = await supabase
    .from('termos_uso')
    .select('versao')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('tipo', 'CORRETOR')
    .order('versao', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (lastTerm?.versao || 0) + 1

  // 2. Desativar todos os anteriores (Opcional, mas bom para garantir)
  await supabase
    .from('termos_uso')
    .update({ ativo: false })
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('tipo', 'CORRETOR')

  // 3. Inserir o novo termo como ATIVO
  const { error } = await supabase.from('termos_uso').insert({
    tipo: 'CORRETOR',
    conteudo: conteudoHtml,
    versao: nextVersion,
    ativo: true,
    organizacao_id: ORGANIZACAO_ID
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/configuracoes/politicas')
  return { success: true, version: nextVersion }
}
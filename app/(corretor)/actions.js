// app/(corretor)/actions.js
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const ORGANIZACAO_ID = 2

// Verifica se o usuário precisa aceitar um novo termo
export async function checkTermsStatus() {
  const supabase = createClient()
  
  // 1. Pegar usuário logado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { mustAccept: false } // Se não tá logado, o middleware resolve

  // 2. Pegar a versão MAIS RECENTE e ATIVA do termo
  const { data: latestTerm, error: termError } = await supabase
    .from('termos_uso')
    .select('id, versao, conteudo')
    .eq('organizacao_id', ORGANIZACAO_ID)
    .eq('tipo', 'CORRETOR')
    .eq('ativo', true)
    .order('versao', { ascending: false })
    .limit(1)
    .single()

  if (termError || !latestTerm) return { mustAccept: false }

  // 3. Verificar se o usuário JÁ ACEITOU essa versão específica
  const { data: acceptance } = await supabase
    .from('termos_aceite')
    .select('id')
    .eq('user_id', user.id)
    .eq('termo_id', latestTerm.id) // <--- O pulo do gato: tem que ser o ID do termo ATUAL
    .single()

  // Se tem aceite, retorna falso. Se não tem (undefined), retorna que PRECISA aceitar
  if (acceptance) {
    return { mustAccept: false }
  } else {
    return { 
        mustAccept: true, 
        termContent: latestTerm.conteudo,
        termId: latestTerm.id 
    }
  }
}

// Salvar o aceite do novo termo
export async function acceptUpdatedTerms(termId) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { error: 'Usuário não identificado' }

    // Salvar na tabela de aceites
    const { error } = await supabase.from('termos_aceite').insert({
        user_id: user.id,
        termo_id: termId,
        organizacao_id: ORGANIZACAO_ID
    })

    if (error) {
        console.error('Erro ao aceitar termo:', error)
        return { error: 'Erro ao processar aceite.' }
    }

    // Atualizar tabela de usuarios (opcional, mas bom pra redundância)
    await supabase.from('usuarios').update({
        aceitou_termos: true,
        data_aceite_termos: new Date().toISOString()
    }).eq('id', user.id)

    revalidatePath('/(corretor)', 'layout')
    return { success: true }
}
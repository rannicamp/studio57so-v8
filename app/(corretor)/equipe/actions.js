// app/(corretor)/equipe/actions.js
'use server'

import { createAdminClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function toggleCorretorStatus(corretorId, newStatus) {
 try {
 const supabaseAdmin = createAdminClient()
 // Segurança: Em um cenário real super restrito, deveríamos validar // se quem está chamando esta função realmente é o gerente (funcao_id 21) // e se o corretor pertence à mesma organizacao_id.
 const { error } = await supabaseAdmin
 .from('usuarios')
 .update({ is_active: newStatus })
 .eq('id', corretorId)

 if (error) throw error
 return { success: true }
 } catch (error) {
 console.error('Erro ao atualizar status do corretor:', error)
 return { success: false, error: error.message }
 }
}

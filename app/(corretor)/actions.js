'use server'

// Importamos o AdminClient (A chave mestra que ignora bloqueios)
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const ORGANIZACAO_ID = 2

// Verifica se o usuário precisa aceitar um novo termo
export async function checkTermsStatus() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { mustAccept: false } 

  // Busca o termo ativo mais recente
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

  // Verifica se já aceitou ESTA versão específica
  const { data: acceptance } = await supabase
    .from('termos_aceite')
    .select('id')
    .eq('user_id', user.id)
    .eq('termo_id', latestTerm.id)
    .single()

  // Se NÃO tem aceite, retorna true (precisa aceitar)
  if (!acceptance) {
    return { 
        mustAccept: true, 
        termContent: latestTerm.conteudo,
        termId: latestTerm.id 
    }
  }
  
  return { mustAccept: false }
}

// Salvar o aceite do novo termo (USANDO ADMIN)
export async function acceptUpdatedTerms(termId) {
    console.log('[ACTION] Tentando aceitar termo ID:', termId);
    
    const supabase = await createClient()
    // Aqui está o segredo: Usamos o AdminClient para gravar sem restrição
    const supabaseAdmin = createAdminClient() 
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        console.error('[ACTION] Erro: Usuário não logado.');
        return { error: 'Sessão expirada. Faça login novamente.' }
    }

    try {
        // Tenta inserir
        const { error: insertError } = await supabaseAdmin.from('termos_aceite').insert({
            user_id: user.id,
            termo_id: termId,
            organizacao_id: ORGANIZACAO_ID
        })

        if (insertError) {
            // Se der erro, joga pro catch para ver no console
            throw new Error(insertError.message);
        }

        // Atualiza flag no usuário (Opcional, mas bom ter)
        await supabaseAdmin.from('usuarios').update({
            aceitou_termos: true,
            data_aceite_termos: new Date().toISOString()
        }).eq('id', user.id)

        console.log('[ACTION] Aceite registrado com sucesso para:', user.email);
        
        revalidatePath('/(corretor)', 'layout')
        return { success: true }

    } catch (error) {
        console.error('[ACTION] ERRO CRÍTICO AO SALVAR ACEITE:', error.message);
        return { error: `Erro no banco de dados: ${error.message}` }
    }
}
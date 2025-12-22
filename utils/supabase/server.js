import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createAdminClientOnly } from '@supabase/supabase-js' // Importa o cliente JS padrão

// Função ORIGINAL para criar o cliente baseado em cookies (para requests normais)
// ATENÇÃO: Agora é async por causa do Next.js 15
export async function createClient() {
  const cookieStore = await cookies() // Adicionado await aqui

  return _createServerClient( // Renomeado para evitar conflito
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { // Simplificado
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
             cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignora erros se os cookies não puderem ser definidos
          }
        },
        remove(name, options) {
           try {
              cookieStore.set({ name, value: '', ...options })
           } catch (error) {
             // Ignora erros
           }
        },
      },
    }
  )
}

// --- NOVA FUNÇÃO ---
// Função para criar um cliente com a SERVICE_ROLE_KEY (ignora RLS)
// USE COM EXTREMO CUIDADO - APENAS EM SERVER ACTIONS SEGURAS!
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está definida nas variáveis de ambiente do servidor.');
  }

  // Usa o createClient padrão do @supabase/supabase-js com a chave de admin
  // Este cliente NÃO gerencia cookies/sessão automaticamente
  return createAdminClientOnly(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
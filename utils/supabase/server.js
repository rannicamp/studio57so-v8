// rannicamp/teste-netlify/teste-netlify-1f74408eafb3943aeb9eb92a02aecae60eaac333/utils/supabase/server.js
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: async (name) => { // DEVE SER ASYNC
          return (await cookieStore.get(name))?.value // DEVE USAR AWAIT
        },
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.set(name, '', options)
        },
      },
    }
  )
}
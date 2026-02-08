// utils/supabase/middleware.js
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export function createClient(req) {
  // Cria uma resposta 'genérica' que será usada
  // se precisarmos atualizar os cookies
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  // Cria o cliente Supabase do tipo 'Server'
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // Função para PEGAR um cookie
        get(name) {
          return req.cookies.get(name)?.value
        },
        // Função para SETAR um cookie
        set(name, value, options) {
          // Se for setar, precisamos usar a resposta real
          // para garantir que o cookie seja salvo no navegador
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        // Função para REMOVER um cookie
        remove(name, options) {
          // Mesma lógica: usar a resposta real
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Retorna o cliente e a resposta
  return { supabase, response }
}
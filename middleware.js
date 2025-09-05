import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ***** INÍCIO DA ALTERAÇÃO *****
  // Adicionamos uma exceção para a página pública do simulador.
  // Se a URL começar com '/simulador-financiamento', o "segurança" deixa passar sem pedir login.
  if (request.nextUrl.pathname.startsWith('/simulador-financiamento')) {
    return response;
  }
  // ***** FIM DA ALTERAÇÃO *****

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options, })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options, })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options, })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options, })
        },
      },
    }
  )

  // O restante do código só será executado se o caminho NÃO for o do simulador.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname !== '/login' && request.nextUrl.pathname !== '/register') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

// Não precisamos alterar o 'matcher', pois a lógica já resolve a exceção.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
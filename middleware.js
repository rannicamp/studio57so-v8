import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ***** INÍCIO DA ALTERAÇÃO *****
  // Criamos uma lista de caminhos públicos.
  // O "segurança" vai deixar passar qualquer URL que comece com um desses caminhos.
  const publicPaths = [
    '/simulador-financiamento',
    '/cadastro-cliente',
    '/cadastro' // <-- ESTA É A ÚNICA LINHA ADICIONADA
  ];

  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
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

  const { data: { user } } = await supabase.auth.getUser()

  // Se não for um caminho público, aplicamos a segurança normal.
  if (!user && request.nextUrl.pathname !== '/login' && request.nextUrl.pathname !== '/register') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

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
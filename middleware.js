// Caminho do arquivo: middleware.js

import { NextResponse } from 'next/server';
// O PORQUÊ DA MUDANÇA: Voltamos a usar o createServerClient direto do pacote @supabase/ssr,
// que é o método que o seu projeto já conhecia. Isso corrige o erro "Module not found".
import { createServerClient } from '@supabase/ssr';

export async function middleware(req) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const { pathname } = req.nextUrl;

  // A nossa lista de permissões continua aqui, completa e correta.
  const publicPaths = [
    '/', // A nova home page pública
    '/login',
    '/register',
    '/cadastro',
    '/cadastro-cliente',
    '/residencialalfa',
    '/residencialalfa/obrigado',
    '/simulador-financiamento'
  ];
  
  // O porteiro continua liberando o acesso a APIs e arquivos do sistema.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    publicPaths.some(path => pathname.startsWith(path))
  ) {
    return res;
  }

  // O PORQUÊ DESTA PARTE: Esta é a forma "original" do seu projeto de se conectar
  // ao Supabase dentro do middleware. Estamos respeitando essa estrutura.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({
            request: { headers: req.headers },
          });
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          req.cookies.set({ name, value: '', ...options });
          res = NextResponse.next({
            request: { headers: req.headers },
          });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // A nossa lógica de segurança inteligente continua aqui.
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/crm', req.url));
  }

  return res;
}

// A configuração do "matcher" também permanece a mesma.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
// Caminho do arquivo: middleware.js

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createClient(req);
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // =================================================================================
  // O PORQUÊ DESTA VERSÃO (A NOSSA VERSÃO FINAL)
  // Esta lista combina as suas necessidades antigas com as novas.
  // Note que '/cadastro', '/cadastro-cliente', e '/simulador-financiamento'
  // estão aqui, garantindo que eles continuem públicos, junto com a nova home ('/').
  // =================================================================================
  const publicPaths = [
    '/', // A nova home page pública
    '/login',
    '/register', // Caso exista uma página de registro
    '/cadastro', // SUA REGRA ANTIGA - MANTIDA!
    '/cadastro-cliente', // SUA REGRA ANTIGA - MANTIDA!
    '/residencialalfa', // Landing Page do Alfa
    '/residencialalfa/obrigado',
    '/simulador-financiamento' // SUA REGRA ANTIGA - MANTIDA!
  ];
  
  // O "porteiro" também libera o acesso a APIs e arquivos do sistema
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    publicPaths.some(path => pathname.startsWith(path))
  ) {
    return res;
  }

  // REGRA 1: Se o usuário NÃO está logado e tenta acessar uma página protegida...
  if (!session) {
    // ...mandamos ele para a página de login.
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  // REGRA 2: Se o usuário JÁ ESTÁ logado e tenta acessar a página de login...
  if (session && pathname === '/login') {
    // ...mandamos ele direto para o CRM.
    return NextResponse.redirect(new URL('/crm', req.url));
  }

  // Se nenhuma regra se aplica, o usuário pode continuar.
  return res;
}

// Configuração padrão para o "porteiro"
export const config = {
  matcher: [
    /*
     * Faz a correspondência de todos os caminhos de solicitação, exceto os de:
     * - api (rotas da API)
     * - _next/static (arquivos estáticos)
     * - _next/image (arquivos de otimização de imagem)
     * - favicon.ico (ícone do site)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
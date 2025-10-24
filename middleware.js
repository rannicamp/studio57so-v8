// middleware.js
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware' //

export async function middleware(req) {
  const { supabase, response } = createClient(req) //

  const {
    data: { session },
  } = await supabase.auth.getSession() //

  const {
    data: { user },
  } = await supabase.auth.getUser() //

  const url = req.nextUrl.clone() //

  // =================================================================
  // LÓGICA DE PÁGINA PÚBLICA CORRIGIDA
  // =================================================================
  // 1. Redirecionar para /login se não estiver logado E não estiver em uma página pública

  // Caminhos que devem ser EXATAMENTE iguais
  const publicExactPaths = [
    '/',
    '/login',
    '/register',
    '/cadastro-corretor', // <-- AQUI ESTÁ A CORREÇÃO!
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta',
    '/sobre-nos',
    '/api/meta/webhook',
    '/api/whatsapp/webhook',
  ] //

  // Caminhos que podem ter sub-rotas (ex: /simulador-financiamento/123)
  const publicPrefixPaths = [
    '/cadastrocliente', // Permite /cadastrocliente/obrigado e /cadastrocliente/[slug]
    '/simulador-financiamento', // Permite /simulador-financiamento/[id]
    '/api/auth', 
  ]

  // Verifica se o caminho atual é um match exato
  let isPublicPath = publicExactPaths.includes(url.pathname) //

  // Se não for um match exato, verifica se começa com um dos prefixos
  if (!isPublicPath) {
    isPublicPath = publicPrefixPaths.some((path) =>
      url.pathname.startsWith(path)
    ) //
  }
  // =================================================================
  // FIM DA CORREÇÃO
  // =================================================================

  if (!session && !isPublicPath) {
    console.log(`Middleware: Acesso negado a ${url.pathname}. Redirecionando para /login.`) //
    return NextResponse.redirect(new URL('/login', req.url)) //
  }

  // 2. Se estiver logado, buscar dados do perfil (funcao_id)
  if (session && user) {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('funcao_id')
      .eq('id', user.id)
      .single() //

    const funcao_id = profile?.funcao_id //

    // 3. Lógica de redirecionamento PÓS-LOGIN
    // Se o usuário logado tentar acessar o /login, redireciona ele
    if (url.pathname === '/login') {
      // Se for Corretor (20), vai para o portal-painel
      if (funcao_id === 20) {
        return NextResponse.redirect(new URL('/portal-painel', req.url)) //
      }
      // Outros usuários vão para o /painel
      return NextResponse.redirect(new URL('/painel', req.url)) //
    }

    // 4. Lógica de proteção do Portal do Corretor
    const isCorretorPath = url.pathname.startsWith('/portal-') || url.pathname.startsWith('/clientes') || url.pathname.startsWith('/tabela-de-vendas') //
    
    if (isCorretorPath && funcao_id !== 20) {
      // Se não for corretor e tentar acessar área do corretor, redireciona para o painel normal
      console.warn(`Middleware: Acesso negado a ${url.pathname} para usuário (Função ID: ${funcao_id}). Redirecionando para /painel.`) //
      return NextResponse.redirect(new URL('/painel', req.url)) //
    }

    // 5. Lógica de proteção do Painel Principal
    const isMainPanelPath = !isCorretorPath && !isPublicPath && url.pathname !== '/login' //
    
    if (isMainPanelPath && funcao_id === 20) {
      // Se for corretor e tentar acessar o painel principal, redireciona para o portal do corretor
      console.warn(`Middleware: Corretor (ID 20) tentou acessar ${url.pathname}. Redirecionando para /portal-painel.`) //
      return NextResponse.redirect(new URL('/portal-painel', req.url)) //
    }
  }

  // Se passou por todas as verificações, deixa a requisição continuar
  return response //
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (images in public folder)
     * - icons/ (icons for PWA)
     * - sounds/ (sounds for notifications)
     * - sw.js, manifest.json, workbox-*.js (PWA files)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-).*)', //
  ],
}
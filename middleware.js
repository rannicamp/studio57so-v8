// middleware.js
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(req) {
  const { supabase, response } = createClient(req)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = req.nextUrl.clone()

  // =================================================================
  // LÓGICA DE PÁGINA PÚBLICA
  // =================================================================
  
  // Caminhos que devem ser EXATAMENTE iguais
  const publicExactPaths = [
    '/',
    '/login',
    '/register',
    '/cadastro-corretor',
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta',
    '/sobre-nos',
    '/api/meta/webhook',
    '/api/whatsapp/webhook',
  ]

  // Caminhos que podem ter sub-rotas
  const publicPrefixPaths = [
    '/cadastrocliente', 
    '/simulador-financiamento', 
    '/api/auth', 
  ]

  // Verifica se é rota pública
  let isPublicPath = publicExactPaths.includes(url.pathname)

  if (!isPublicPath) {
    isPublicPath = publicPrefixPaths.some((path) =>
      url.pathname.startsWith(path)
    )
  }

  // 1. BLOQUEIO: Se não tem sessão e não é pública -> Login
  if (!session && !isPublicPath) {
    console.log(`Middleware: Acesso negado a ${url.pathname}. Redirecionando para /login.`)
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 2. LÓGICA DE USUÁRIO LOGADO
  if (session && user) {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('funcao_id')
      .eq('id', user.id)
      .single()

    const funcao_id = profile?.funcao_id

    // 3. REDIRECIONAMENTO INTELIGENTE (HOME E LOGIN)
    // Se o usuário já está logado e tenta acessar Login ou a Home, joga pro painel
    if (url.pathname === '/login' || url.pathname === '/') {
      
      // Se for Corretor (20), vai para o portal-painel
      if (funcao_id === 20) {
        return NextResponse.redirect(new URL('/portal-painel', req.url))
      }
      
      // Outros usuários vão para o /painel
      return NextResponse.redirect(new URL('/painel', req.url))
    }

    // 4. Proteção do Portal do Corretor
    const isCorretorPath = url.pathname.startsWith('/portal-') || url.pathname.startsWith('/clientes') || url.pathname.startsWith('/tabela-de-vendas')
    
    if (isCorretorPath && funcao_id !== 20) {
      console.warn(`Middleware: Acesso negado a ${url.pathname} para usuário (Função ID: ${funcao_id}). Redirecionando para /painel.`)
      return NextResponse.redirect(new URL('/painel', req.url))
    }

    // 5. Proteção do Painel Principal
    const isMainPanelPath = !isCorretorPath && !isPublicPath && url.pathname !== '/login'
    
    if (isMainPanelPath && funcao_id === 20) {
      console.warn(`Middleware: Corretor (ID 20) tentou acessar ${url.pathname}. Redirecionando para /portal-painel.`)
      return NextResponse.redirect(new URL('/portal-painel', req.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-).*)',
  ],
}
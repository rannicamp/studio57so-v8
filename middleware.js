import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(req) {
  // Cria o cliente Supabase para o contexto do Next.js
  const { supabase, response } = createClient(req)

  // Atualiza a sessão
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Busca os dados do usuário
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = req.nextUrl.clone()

  // =================================================================
  // 1. CONFIGURAÇÃO DE ROTAS PÚBLICAS
  // =================================================================
  
  // A. Caminhos EXATOS
  const publicExactPaths = [
    '/',
    '/login',
    '/recuperar-senha',
    '/atualizar-senha',
    '/register',
    '/cadastro-corretor',
    '/upload', 
    '/api/teste-manual',
    '/sitemap.xml',
    '/robots.txt'
  ]

  // B. PREFIXOS
  const publicPrefixPaths = [
    // --- Landing Pages ---
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta',
    '/betasuites',
    '/migracao',
    '/sobre-nos',
    
    // --- Funcionalidades Públicas ---
    '/cadastrocliente', 
    '/simulador-financiamento',
    
    // --- APIs e Webhooks ---
    '/api/auth',
    '/api/meta',
    '/api/whatsapp',
    '/api/notifications',
    '/api/cron',
    '/api/aps' // Adicionado para garantir que rotas APS sejam consideradas públicas/api
  ]

  // =================================================================
  // LÓGICA DE VERIFICAÇÃO
  // =================================================================

  let isPublicPath = publicExactPaths.includes(url.pathname)

  if (!isPublicPath) {
    isPublicPath = publicPrefixPaths.some((path) =>
      url.pathname.startsWith(path)
    )
  }

  // =================================================================
  // 2. BLOQUEIO DE SEGURANÇA
  // =================================================================
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // =================================================================
  // 3. ROTEAMENTO DE USUÁRIO LOGADO
  // =================================================================
  if (session && user) {
    const isAuthPage = ['/login', '/', '/recuperar-senha', '/register'].includes(url.pathname);

    if (isAuthPage) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('funcao_id')
          .eq('id', user.id)
          .single()
    
        const funcao_id = profile?.funcao_id
        
        if (funcao_id === 20) {
            return NextResponse.redirect(new URL('/portal-painel', req.url))
        }
        return NextResponse.redirect(new URL('/painel', req.url))
    }
    
    if (!isPublicPath && url.pathname !== '/atualizar-senha') {
        const { data: profile } = await supabase
            .from('usuarios')
            .select('funcao_id')
            .eq('id', user.id)
            .single()

        const funcao_id = profile?.funcao_id

        // A. Proteção das Rotas de Corretor
        const isCorretorPath = url.pathname.startsWith('/portal-') || url.pathname.startsWith('/clientes') || url.pathname.startsWith('/tabela-de-vendas')
        
        if (isCorretorPath && funcao_id !== 20) {
          return NextResponse.redirect(new URL('/painel', req.url))
        }

        // B. Proteção do Painel Administrativo
        const isMainPanelPath = !isCorretorPath && !isPublicPath && url.pathname !== '/login'
        
        if (isMainPanelPath && funcao_id === 20) {
          return NextResponse.redirect(new URL('/portal-painel', req.url))
        }
    }
  }

  return response
}

// --- AQUI ESTÁ A CORREÇÃO CRÍTICA PARA O ERRO 10MB ---
export const config = {
  matcher: [
    /*
     * Ignora arquivos estáticos E a rota de upload da Autodesk
     * Adicionado: |api/aps/upload
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-|api/aps/upload).*)',
  ],
}
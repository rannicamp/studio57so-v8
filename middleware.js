import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(req) {
  // Cria o cliente Supabase para o contexto do Next.js (lê cookies, etc)
  const { supabase, response } = createClient(req)

  // Atualiza a sessão (segurança padrão do Supabase no Next.js)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Busca os dados do usuário para verificar a função (role)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = req.nextUrl.clone()

  // =================================================================
  // 1. CONFIGURAÇÃO DE ROTAS PÚBLICAS
  // =================================================================
  
  // Caminhos exatos que NÃO exigem login
  const publicExactPaths = [
    '/',
    '/login',
    '/recuperar-senha',
    '/atualizar-senha',
    '/register',
    '/cadastro-corretor',
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta', // Mantive o que estava
    '/betasuites',  // Adicionei por garantia (pasta que criamos antes)
    '/migracao',    // <--- ADICIONADO: Nova página do Plano de Transição
    '/sobre-nos',
    '/api/meta/webhook',
    '/api/whatsapp/webhook',
    '/api/notifications/push', 
    '/api/teste-manual' 
  ]

  // Prefixos que NÃO exigem login (ex: todas as rotas dentro de /api/auth/*)
  const publicPrefixPaths = [
    '/cadastrocliente', 
    '/simulador-financiamento', 
    '/api/auth',
    '/api/cron', 
  ]

  // Verifica se a rota atual é pública
  let isPublicPath = publicExactPaths.includes(url.pathname)

  if (!isPublicPath) {
    isPublicPath = publicPrefixPaths.some((path) =>
      url.pathname.startsWith(path)
    )
  }

  // =================================================================
  // 2. BLOQUEIO DE SEGURANÇA (Se não for público e não tiver sessão)
  // =================================================================
  if (!session && !isPublicPath) {
    // Redireciona para login, mas salva a URL que ele tentou acessar para voltar depois (opcional)
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // =================================================================
  // 3. ROTEAMENTO DE USUÁRIO LOGADO
  // =================================================================
  if (session && user) {
    // Lista de páginas de Autenticação (onde usuário logado não deve ficar)
    const isAuthPage = ['/login', '/', '/recuperar-senha'].includes(url.pathname);

    // Se usuário logado tentar entrar no login, mandamos para o painel dele
    if (isAuthPage) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('funcao_id')
          .eq('id', user.id)
          .single()
    
        const funcao_id = profile?.funcao_id
        
        // Se for Corretor (20) -> Portal
        if (funcao_id === 20) {
            return NextResponse.redirect(new URL('/portal-painel', req.url))
        }
        // Outros -> Painel Admin
        return NextResponse.redirect(new URL('/painel', req.url))
    }
    
    // Verificação de permissão para rotas protegidas (exceto troca de senha)
    if (!isPublicPath && url.pathname !== '/atualizar-senha') {
        const { data: profile } = await supabase
            .from('usuarios')
            .select('funcao_id')
            .eq('id', user.id)
            .single()

        const funcao_id = profile?.funcao_id

        // A. Proteção das Rotas de Corretor
        // Se a rota começa com portal, clientes ou tabela, e NÃO é corretor -> Chuta pro Painel
        const isCorretorPath = url.pathname.startsWith('/portal-') || url.pathname.startsWith('/clientes') || url.pathname.startsWith('/tabela-de-vendas')
        
        if (isCorretorPath && funcao_id !== 20) {
          return NextResponse.redirect(new URL('/painel', req.url))
        }

        // B. Proteção do Painel Administrativo
        // Se a rota NÃO é de corretor, NÃO é pública, NÃO é login, e O USUÁRIO É CORRETOR -> Chuta pro Portal
        const isMainPanelPath = !isCorretorPath && !isPublicPath && url.pathname !== '/login'
        
        if (isMainPanelPath && funcao_id === 20) {
          return NextResponse.redirect(new URL('/portal-painel', req.url))
        }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/ (public images)
     * - icons/ (public icons)
     * - sounds/ (public sounds)
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     * - workbox- (workbox scripts)
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-).*)',
  ],
}
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
  
  // A. Caminhos EXATOS (Só libera se for exatamente isso)
  const publicExactPaths = [
    '/',
    '/login',
    '/recuperar-senha',
    '/atualizar-senha',
    '/register',
    '/cadastro-corretor',
    '/upload', // Rota de upload isolada
    '/api/teste-manual'
  ]

  // B. PREFIXOS (Libera a rota E TUDO que vier depois dela "filhos")
  // DICA DO TIO DEVONILDO: Coloque suas Landing Pages AQUI!
  // Assim, /betasuites/obrigado funciona automaticamente.
  const publicPrefixPaths = [
    // --- Landing Pages (Adicione novos projetos aqui) ---
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
    '/api/meta',      // Libera todos os webhooks da Meta
    '/api/whatsapp',  // Libera todos os webhooks do Whats
    '/api/notifications',
    '/api/cron'
  ]

  // =================================================================
  // LÓGICA DE VERIFICAÇÃO
  // =================================================================

  // 1. É um caminho exato?
  let isPublicPath = publicExactPaths.includes(url.pathname)

  // 2. Se não for exato, verifica se começa com algum prefixo permitido
  if (!isPublicPath) {
    isPublicPath = publicPrefixPaths.some((path) =>
      url.pathname.startsWith(path)
    )
  }

  // =================================================================
  // 2. BLOQUEIO DE SEGURANÇA (Se não for público e não tiver sessão)
  // =================================================================
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // =================================================================
  // 3. ROTEAMENTO DE USUÁRIO LOGADO
  // =================================================================
  if (session && user) {
    // Lista de páginas de Autenticação (onde usuário logado não deve ficar)
    const isAuthPage = ['/login', '/', '/recuperar-senha', '/register'].includes(url.pathname);

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
    
    // Verificação de permissão para rotas protegidas
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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-).*)',
  ],
}
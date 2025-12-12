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
    '/recuperar-senha', // <--- ADICIONADO: Página de pedido de senha
    '/atualizar-senha', // <--- ADICIONADO: Página de nova senha
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

  // Caminhos que podem ter sub-rotas (Prefixos)
  const publicPrefixPaths = [
    '/cadastrocliente', 
    '/simulador-financiamento', 
    '/api/auth',
    '/api/cron', 
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
    // console.log(`Middleware: Acesso negado a ${url.pathname}. Redirecionando para /login.`)
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 2. LÓGICA DE USUÁRIO LOGADO
  if (session && user) {
    // Se o usuário está tentando acessar login ou recuperação estando logado,
    // vamos ver para onde redirecionar.
    // Mas ATENÇÃO: Se ele estiver em /atualizar-senha, deixamos ele ficar lá para trocar a senha!
    const isAuthPage = ['/login', '/', '/recuperar-senha'].includes(url.pathname);

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
    
    // Se não é página de auth, prossegue com verificação de permissões
    // Mas precisamos carregar o profile se não carregamos acima
    // Nota: Para otimizar, idealmente verificaríamos o pathname antes de buscar o profile novamente,
    // mas para manter a lógica segura e simples:
    
    // (Apenas para rotas protegidas que precisam de verificação de função)
    if (!isPublicPath && url.pathname !== '/atualizar-senha') {
        const { data: profile } = await supabase
            .from('usuarios')
            .select('funcao_id')
            .eq('id', user.id)
            .single()

        const funcao_id = profile?.funcao_id

        // 4. Proteção do Portal do Corretor
        const isCorretorPath = url.pathname.startsWith('/portal-') || url.pathname.startsWith('/clientes') || url.pathname.startsWith('/tabela-de-vendas')
        
        if (isCorretorPath && funcao_id !== 20) {
          return NextResponse.redirect(new URL('/painel', req.url))
        }

        // 5. Proteção do Painel Principal
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
    // O matcher ignora arquivos estáticos para performance
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|sounds/|sw.js|manifest.json|workbox-).*)',
  ],
}
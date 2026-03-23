// middleware.js
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(req) {
  // 1. Configuração Inicial do Supabase
  const { supabase, response } = createClient(req)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const url = req.nextUrl.clone()
  const path = url.pathname

  // =================================================================
  // 2. DEFINIÇÃO DE ROTAS PÚBLICAS (Abertas para o mundo)
  // =================================================================
  const publicPaths = [
    '/',
    '/login',
    '/cadastro',     // <--- Liberado para criar novas empresas!
    '/recuperar-senha',
    '/atualizar-senha',
    '/register',
    '/cadastro-corretor',
    '/upload',
    '/politicas',
    '/sitemap.xml',
    '/robots.txt'
  ]

  const publicPrefixes = [
    '/api/',                  // APIs precisam estar abertas
    '/_next/',                // Next.js interno
    '/static/',               // Estáticos
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta',
    '/betasuites',
    '/migracao',
    '/sobre-nos',
    '/cadastrocliente',
    '/auth/'                  // Callbacks de autenticação
  ]

  // Verifica se o caminho atual é uma rota pública
  const isPublicPath = publicPaths.includes(path) || publicPrefixes.some(prefix => path.startsWith(prefix))

  // =================================================================
  // 3. PROTEÇÃO DE LOGIN
  // =================================================================

  // Se não tem sessão (user) e NÃO é uma rota pública: Manda pro Login
  if (!user && !isPublicPath) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // =================================================================
  // 4. LÓGICA PARA USUÁRIOS LOGADOS
  // =================================================================
  if (user) {
    // Se o usuário já está logado e tenta ir para /login ou /cadastro,
    // nós mandamos ele para o painel principal dele.
    if (path === '/login' || path === '/cadastro') {
      // Buscamos o perfil para saber o cargo e decidir o destino
      const { data: profile } = await supabase
        .from('usuarios')
        .select('funcao_id')
        .eq('id', user.id)
        .single()

      const funcaoId = profile?.funcao_id

      if (funcaoId === 4) return NextResponse.redirect(new URL('/bim-manager', req.url));
      if (funcaoId === 20 || funcaoId === 21) return NextResponse.redirect(new URL('/portal-painel', req.url));
      return NextResponse.redirect(new URL('/painel', req.url));
    }

    // --- REGRAS DE ACESSO POR CARGO (Acesso restrito) ---
    const { data: profile } = await supabase
      .from('usuarios')
      .select('funcao_id, is_superadmin')
      .eq('id', user.id)
      .single()

    const funcaoId = profile?.funcao_id
    const isSuperAdmin = profile?.is_superadmin

    // REGRA DE SUPER ADMIN (ACESSO AO /admin)
    if (path.startsWith('/admin')) {
      if (!isSuperAdmin) {
        // Ocultar a área de backoffice mandando ele pra home do sistema dele
        return NextResponse.redirect(new URL('/painel', req.url))
      }
    }

    // REGRA DO PROJETISTA (ID 4)
    if (funcaoId === 4) {
      const isBimManager = path.startsWith('/bim-manager');
      const isApi = path.startsWith('/api/');
      if (!isBimManager && !isApi && !isPublicPath) {
        return NextResponse.redirect(new URL('/bim-manager', req.url))
      }
    }

    // REGRA DO CORRETOR (ID 20) E GERENTE (ID 21)
    else if (funcaoId === 20 || funcaoId === 21) {
      const isPortalCorretor = path.startsWith('/portal-') ||
        path.startsWith('/clientes') ||
        path.startsWith('/tabela-de-vendas') ||
        path.startsWith('/equipe') ||
        path.startsWith('/simuladores') ||
        path.startsWith('/api/');

      if (!isPortalCorretor && !isPublicPath) {
        return NextResponse.redirect(new URL('/portal-painel', req.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Pega todas as rotas exceto:
     * - _next/static (assets estáticos do Next.js)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     * - Arquivos com extensão conhecida (imagens, fonts, manifests, scripts, etc.)
     * ⚠️ CRÍTICO PWA: .json e .js DEVEM estar aqui para que
     * /manifest.json e /custom-sw.js sejam servidos sem redirect para /login
     */
    '/((?!_next/static|_next/image|favicon.ico|apple-touch-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|txt|webmanifest|woff|woff2|ttf|otf|mp3|mp4)$).*)',
  ],
}
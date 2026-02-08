import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function middleware(req) {
  // 1. Configuração Inicial do Supabase
  const { supabase, response } = createClient(req)

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const url = req.nextUrl.clone()
  const path = url.pathname

  // =================================================================
  // 2. DEFINIÇÃO DE ROTAS PÚBLICAS (Onde não precisa de login)
  // =================================================================
  const publicPaths = [
    '/', 
    '/login', 
    '/recuperar-senha', 
    '/atualizar-senha', 
    '/register', 
    '/cadastro-corretor',
    '/upload',
    '/sitemap.xml',
    '/robots.txt'
  ]

  const publicPrefixes = [
    '/api/',                 // APIs precisam estar abertas para o front funcionar
    '/_next/',               // Arquivos internos do Next.js
    '/static/',              // Arquivos estáticos
    '/empreendimentosstudio',
    '/refugiobraunas',
    '/residencialalfa',
    '/studiosbeta',
    '/betasuites',
    '/migracao',
    '/sobre-nos',
    '/cadastrocliente',
    '/simulador-financiamento'
  ]

  // Verifica se é pública
  let isPublicPath = publicPaths.includes(path) || publicPrefixes.some(prefix => path.startsWith(prefix))

  // =================================================================
  // 3. PROTEÇÃO DE LOGIN (Se não tá logado, tchau!)
  // =================================================================
  if (!session && !isPublicPath) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // =================================================================
  // 4. LÓGICA DE CARGOS (Seu lindo, aqui está a "Inversão")
  // =================================================================
  if (session) {
    // Busca quem é o usuário
    const { data: { user } } = await supabase.auth.getUser()
    
    // Busca o cargo no banco
    const { data: profile } = await supabase
        .from('usuarios')
        .select('funcao_id')
        .eq('id', user.id)
        .single()
    
    const funcaoId = profile?.funcao_id

    // -------------------------------------------------------------
    // REGRA SUPREMA DO PROJETISTA (ID 4)
    // -------------------------------------------------------------
    if (funcaoId === 4) {
        // Rotas estritamente permitidas para o Projetista
        // Ele SÓ PODE estar aqui ou chamando API.
        const isBimManager = path.startsWith('/bim-manager');
        const isApi = path.startsWith('/api/');
        
        // Se ele tentar ir para QUALQUER outro lugar (Painel, RDO, Financeiro, Raiz...)
        if (!isBimManager && !isApi) {
            // Joga ele de volta para a única tela que ele deve ver
            return NextResponse.redirect(new URL('/bim-manager', req.url))
        }
    }

    // -------------------------------------------------------------
    // REGRA DO CORRETOR (ID 20)
    // -------------------------------------------------------------
    else if (funcaoId === 20) {
        // Corretor só vê o Portal do Corretor
        const isPortalCorretor = path.startsWith('/portal-') || 
                                 path.startsWith('/clientes') || 
                                 path.startsWith('/tabela-de-vendas') ||
                                 path.startsWith('/api/');

        if (!isPortalCorretor && !isPublicPath) {
             return NextResponse.redirect(new URL('/portal-painel', req.url))
        }
    }
    
    // -------------------------------------------------------------
    // REDIRECIONAMENTO INTELIGENTE DO LOGIN
    // Se o cara logado tentar acessar /login de novo
    // -------------------------------------------------------------
    if (path === '/login' || path === '/') {
        if (funcaoId === 4) return NextResponse.redirect(new URL('/bim-manager', req.url));
        if (funcaoId === 20) return NextResponse.redirect(new URL('/portal-painel', req.url));
        return NextResponse.redirect(new URL('/painel', req.url));
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Matcher para pegar todas as rotas, exceto estáticos claros.
     * Isso garante que o Middleware rode em tudo.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
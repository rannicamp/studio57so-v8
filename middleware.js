// middleware.js
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

// Função auxiliar para redirecionar copiando cookies da response original
function redirectWithCookies(targetUrl, sourceResponse) {
  const redirectRes = NextResponse.redirect(targetUrl);
  sourceResponse.cookies.getAll().forEach(cookie => {
    redirectRes.cookies.set(cookie.name, cookie.value, {
      path: cookie.path,
      domain: cookie.domain,
      maxAge: cookie.maxAge,
    });
  });
  return redirectRes;
}

export async function middleware(req) {
  // 1. Configuração Inicial do Supabase
  const { supabase, response } = createClient(req)

  let user = null;
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user;
  } catch (err) {
    console.error('Edge Middleware Auth Fetch Error:', err.message);
    // Em caso de falha severa da rede no Edge, assumimos usuário offline
  }

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
    '/robots.txt',
    '/planejamento-cobranca',
    '/proposta-504'
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
    '/perovaz',               // Adicionado para acesso público e Puppeteer
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
    return redirectWithCookies(redirectUrl, response);
  }

  // =================================================================
  // 4. LÓGICA PARA USUÁRIOS LOGADOS
  // =================================================================
  if (user) {
    // Se o usuário já está logado e tenta ir para /login ou /cadastro,
    // nós mandamos ele para o painel principal dele.
    if (path === '/login' || path === '/cadastro') {
      let funcaoId = req.cookies.get('sys_user_role')?.value;

      if (!funcaoId) {
        try {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('funcao_id')
            .eq('id', user.id)
            .single()
          funcaoId = profile?.funcao_id;
        } catch (dbErr) {
          console.error("Erro ao buscar funcaoId (login path):", dbErr.message);
        }
      } else {
        funcaoId = parseInt(funcaoId, 10);
      }

      if (funcaoId === 4) return redirectWithCookies(new URL('/bim-manager', req.url), response);
      if (funcaoId === 20 || funcaoId === 21 || funcaoId === 30 || funcaoId === 31) {
        return redirectWithCookies(new URL('/portal-painel', req.url), response);
      }
      return redirectWithCookies(new URL('/painel', req.url), response);
    }

    // --- REGRAS DE ACESSO POR CARGO (Acesso restrito) ---
    // NOVO: Sistema Anti-Timeout (Cache via Cookies) para não explodir a Edge Function da Netlify
    let funcaoId = req.cookies.get('sys_user_role')?.value;
    let isSuperAdmin = req.cookies.get('sys_is_admin')?.value;
    let orgId = req.cookies.get('sys_org_id')?.value;
    let subStatus = req.cookies.get('sys_sub_status')?.value;
    let subExpires = req.cookies.get('sys_sub_expires')?.value;
    let planoCodigo = req.cookies.get('sys_plano_codigo')?.value;

    if (!funcaoId || isSuperAdmin === undefined || !orgId || !subStatus || !subExpires || !planoCodigo) {
      try {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('funcao_id, is_superadmin, organizacao_id')
          .eq('id', user.id)
          .single()

        funcaoId = profile?.funcao_id;
        isSuperAdmin = profile?.is_superadmin ? 'true' : 'false';
        orgId = profile?.organizacao_id ? String(profile.organizacao_id) : '';

        // Buscar status da assinatura da organização
        let status = 'trialing';
        let expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
        let currentPlano = 'essencial';

        if (profile?.organizacao_id) {
          const { data: org } = await supabase
            .from('organizacoes')
            .select('subscription_status, subscription_expires_at, trial_ends_at, plano_codigo')
            .eq('id', profile.organizacao_id)
            .single();

          if (org) {
            status = org.subscription_status || 'trialing';
            expiresAt = org.subscription_expires_at || org.trial_ends_at || expiresAt;
            currentPlano = org.plano_codigo || 'essencial';
          }
        }

        subStatus = status;
        subExpires = expiresAt;
        planoCodigo = currentPlano;

        // Salva nos cookies
        response.cookies.set('sys_user_role', String(funcaoId || ''), { maxAge: 60 * 30 }); // Função/Cargo: 30 min
        response.cookies.set('sys_is_admin', isSuperAdmin, { maxAge: 60 * 30 });            // Admin status: 30 min
        response.cookies.set('sys_org_id', orgId, { maxAge: 60 * 30 });                     // Org ID: 30 min
        response.cookies.set('sys_plano_codigo', planoCodigo, { maxAge: 60 * 30 });         // Plano: 30 min
        
        // NOVO: Assinatura e Expiração têm cache curto de 1 minuto (60s) 
        // para bloquear acessos rapidamente em caso de inadimplência real ou cancelamento no Asaas
        response.cookies.set('sys_sub_status', subStatus, { maxAge: 60 }); 
        response.cookies.set('sys_sub_expires', subExpires, { maxAge: 60 });
      } catch (dbErr) {
         console.error("Erro ao buscar profile/assinatura (edge):", dbErr.message);
         funcaoId = null;
         isSuperAdmin = false;
         orgId = '';
         planoCodigo = 'essencial';
         subStatus = 'trialing';
         subExpires = new Date().toISOString();
      }
    } else {
      funcaoId = parseInt(funcaoId, 10);
      isSuperAdmin = isSuperAdmin === 'true';
    }


    // =================================================================
    // 4.5. BLOQUEIO POR ASSINATURA VENCIDA OU INATIVA
    // =================================================================
    const isSuperAdminUser = isSuperAdmin === true || isSuperAdmin === 'true';
    const isMatriz = orgId === '1' || orgId === 1;

    console.log(`[Middleware Debug] Path: ${path} | Org: ${orgId} | Status: ${subStatus} | Expira: ${subExpires} | Admin: ${isSuperAdminUser} | Matriz: ${isMatriz}`);

    if (!isSuperAdminUser && !isMatriz) {
      const dataAtual = new Date();
      const dataExpiracao = new Date(subExpires);
      const dataValida = !isNaN(dataExpiracao.getTime());
      
      const assinaturaInativa = ['pending', 'inactive', 'overdue', 'suspended', 'canceled'].includes(subStatus);
      const trialVencido = subStatus === 'trialing' && dataValida && dataAtual > dataExpiracao;
      const assinaturaExpirada = dataValida && dataAtual > dataExpiracao;
      
      // Se for vitalício (lifetime), ignora o bloqueio
      const isLifetime = subStatus === 'lifetime';

      // Impede acesso se a assinatura expirou e não está na página de checkout/assinatura ou rotas públicas
      if (!isLifetime && 
          (assinaturaInativa || trialVencido || (dataValida && assinaturaExpirada)) && 
          path !== '/configuracoes/assinatura' && 
          !isPublicPath) {
        
        console.warn(`[Assinatura] Acesso bloqueado. Org: ${orgId}, Status: ${subStatus}, Expira em: ${subExpires}`);
        return redirectWithCookies(new URL('/configuracoes/assinatura?bloqueado=true', req.url), response);
      }

      // --- TRAVA DE MÓDULOS POR PLANO ---
      if (!isPublicPath && path !== '/configuracoes/assinatura') {
        const routeModuleMap = [
          { prefix: '/bim-manager', module: 'bim' },
          { prefix: '/crm', module: 'crm' },
          { prefix: '/recursos-humanos', module: 'recursos_humanos' },
          { prefix: '/orcamento', module: 'orcamento' },
          { prefix: '/pedidos', module: 'pedidos' },
          { prefix: '/almoxarifado', module: 'almoxarifado' },
          { prefix: '/rdo', module: 'rdo' },
          { prefix: '/contratos', module: 'contratos' },
          { prefix: '/relatorios', module: 'relatorios' },
          { prefix: '/caixa-de-entrada', module: 'caixa_de_entrada' },
        ];

        const planoModulosMap = {
          essencial: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true },
          pro: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true, recursos_humanos: true, crm: true, tabela_vendas: true, orcamento: true, pedidos: true, almoxarifado: true, rdo: true, bim: true, relatorios: true, caixa_de_entrada: true },
          ia: { painel: true, financeiro: true, empresas: true, empreendimentos: true, contatos: true, simulador: true, atividades: true, contratos: true, recursos_humanos: true, crm: true, tabela_vendas: true, orcamento: true, pedidos: true, almoxarifado: true, rdo: true, bim: true, relatorios: true, inteligencia_artificial: true, caixa_de_entrada: true }
        };

        const modulosPermitidos = planoModulosMap[planoCodigo] || planoModulosMap['essencial'];

        for (const rule of routeModuleMap) {
          if (path.startsWith(rule.prefix)) {
            if (!modulosPermitidos[rule.module]) {
              console.warn(`[Permissões] Acesso bloqueado à rota ${path} para o plano ${planoCodigo}`);
              return redirectWithCookies(new URL('/configuracoes/assinatura?upgrade=true', req.url), response);
            }
          }
        }
      }
    }


    // REGRA DE SUPER ADMIN (ACESSO AO /admin)
    if (path.startsWith('/admin')) {
      if (!isSuperAdmin) {
        // Ocultar a área de backoffice mandando ele pra home do sistema dele
        return redirectWithCookies(new URL('/painel', req.url), response)
      }
    }

    // REGRA DO PROJETISTA (ID 4)
    if (funcaoId === 4) {
      const isBimManager = path.startsWith('/bim-manager');
      const isApi = path.startsWith('/api/');
      if (!isBimManager && !isApi && !isPublicPath) {
        return redirectWithCookies(new URL('/bim-manager', req.url), response)
      }
    }

    // REGRA DO CORRETOR (ID 20) E GERENTE (ID 21) - E IDs locais da Org 2 (30/31)
    else if (funcaoId === 20 || funcaoId === 21 || funcaoId === 30 || funcaoId === 31) {
      const isPortalCorretor = path.startsWith('/portal-') ||
        path.startsWith('/clientes') ||
        path.startsWith('/tabela-de-vendas') ||
        path.startsWith('/equipe') ||
        path.startsWith('/simuladores') ||
        path.startsWith('/api/');

      if (!isPortalCorretor && !isPublicPath) {
        return redirectWithCookies(new URL('/portal-painel', req.url), response)
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
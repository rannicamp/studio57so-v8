import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // O Supabase manda um "code" na URL quando o usuário clica no e-mail
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/painel';

  // --- CORREÇÃO DO DEVONILDO ---
  // Forçamos a URL de produção aqui. Se você estiver local, mude manualmente ou use ENV.
  // Em produção, isso garante que nunca vá para localhost.
  const isProduction = process.env.NODE_ENV === 'production';
  const siteUrl = isProduction ? 'https://studio57.arq.br' : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  
  // Remove barra no final para evitar duplicidade (ex: .br//painel)
  const origin = siteUrl.replace(/\/$/, '');

  if (code) {
    const supabase = await createClient();
    
    // Troca o código por uma sessão de usuário real
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Se deu certo, manda o usuário para a página de definir senha no DOMÍNIO CERTO
      return NextResponse.redirect(`${origin}${next}`);
    } else {
        console.error("Erro no callback de auth:", error);
    }
  }

  // Se der erro (link expirado, etc), manda para login na URL certa
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
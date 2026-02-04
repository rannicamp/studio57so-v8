import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  // O Supabase manda um "code" na URL quando o usuário clica no e-mail
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // O "next" é o nosso redirectTo (/atualizar-senha)
  const next = searchParams.get('next') ?? '/painel';

  if (code) {
    const supabase = await createClient();
    
    // Troca o código por uma sessão de usuário real
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Se deu certo, manda o usuário para a página de definir senha
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Se der erro, manda para home ou login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
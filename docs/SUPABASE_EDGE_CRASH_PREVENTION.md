# 🛡️ Blindagem Anti-Crash do Supabase (Edge Middleware)

Este documento guarda um aprendizado crítico arquitetural descoberto durante o desenvolvimento do Módulo Multi-Tenant do Elo 57. É de leitura **OBRIGATÓRIA** sempre que você tiver que criar ou editar arquivos de Middleware.js Edge ou Server Actions que realizem consultas síncronas de autorização.

## O Diagnóstico da Queda ("Application Error")
A Netlify e a Vercel rodam a função `middleware.js` na **Borda (Edge)**. Ambientes de borda possuem limites estritos de Timeout (50 milissegundos a 1 segundo).

### O Erro
Ao realizar `await supabase.auth.getSession()` ou qualquer consulta ao banco no cabeçalho das páginas, se o Banco de Dados do Supabase estiver passando por um **"Reload Schema Cache"** (O que ocorre frequentemente quando enviamos Migrations de SQL/RLS pesadas em produção), a latência do banco oscila rapidamente para 1 a 3 segundos.
Nenhum código quebra, mas a *Edge Function* excede seu tempo limite esperando a promessa e colapsa enviando um erro 500 para a tela do Usuário e quebrando a navegação global.

## A Solução (Regra de Ouro Inquebrável)
**TODO** e **QUALQUER** código que opere na Borda (Edge) e faça interações síncronas ao banco de dados DEVE obrigatoriamente ser encapsulado numa barreira de contenção `try/catch` com lógica de desvio amigável ou resposta nula de queda, jamais explodindo o erro bruto nativo.

```javascript
// ❌ O QUE NUNCA FAZER NO EDGE (Vai derrubar a UI se o banco der um engasgo de 1s)
export async function middleware(request) {
    const supabase = createMiddlewareClient({ req: request, res: NextResponse.next() });
    const { data: { session } } = await supabase.auth.getSession(); // Risco de Unhandled Promise Rejection!
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
}

// ✅ O PADRÃO OURO DE BLINDAGEM DO ELO 57
export async function middleware(request) {
    let session = null;
    let fallbackRes = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res: fallbackRes });
    
    try {
        // Envolve a promessa perigosa num escudo local
        const { data } = await supabase.auth.getSession();
        session = data?.session;
    } catch (error) {
        console.error('⚠️ [EDGE SHIELD] Timeout ou Falha de Conexão com Supabase no Middleware:', error.message);
        // O sistema sobrevive e redireciona polidamente ou aceita o fallback
        return NextResponse.redirect(new URL('/login?error=timeout', request.url));
    }

    if (!session) return NextResponse.redirect(new URL('/login', request.url));
}
```

Aplica-se o mesmo raciocínio para qualquer chamada à banco em Roteadores e Server Actions cruciais da navegação. O usuário final deve receber uma interface amigável (Toast, "Tente Novamente", Loading), **nunca** uma tela branca de erro de Application Error não tratada.

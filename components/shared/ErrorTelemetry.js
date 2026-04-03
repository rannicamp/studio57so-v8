'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Esse componente não renderiza nada visualmente.
 * Ele faz um "Monkey Patch" (Sobrescreve) a função `toast.error` original do pacote sonner.
 * Assim que for chamado um erro na interface (toast.error), ele primeiro manda pro backend em stealth (fetch sem await).
 */
export default function ErrorTelemetry() {
  const isPatched = useRef(false);
  const { user, userData } = useAuth(); // Pega dados caso o usuário esteja logado

  useEffect(() => {
    // Evita patch duplo se o React bater duas vezes no useEffect
    if (isPatched.current) return;

    const originalError = toast.error;

    // Sobrescrevendo
    toast.error = function (message, data) {
      
      // Chama o toast normal na UI imediatamente para não travar a experiência do usuário
      const result = originalError.apply(this, [message, data]);

      // Extrai os detalhes caso tenham sido passados como description no toast
      const details = data?.description || null;

      // Monta as informações do Navegador
      const navInfo = typeof navigator !== 'undefined' ? 
        { browser: navigator.platform, ua: navigator.userAgent } : 
        { browser: 'Unknown', ua: 'Unknown' };

      // Prepara e atira o log no breu do servidor sem segurar a UI
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: message,
          detalhes: details,
          url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
          browser: navInfo.browser,
          userAgent: navInfo.ua,
          userId: user?.id || null, // ID do supabase auth
          orgId: userData?.organizacao_id || null // OrgId do DB
        })
      }).catch(err => {
        // Se a própria tentativa de logar falhar, a gente só ignora no console silenciosamente
        console.warn('[Telemetry UI] Falha ao despachar log de erro', err);
      });

      return result;
    };

    isPatched.current = true;

    // Quando o componente for desmontado (raro, pois fica no RootLayout), tentamos restaurar para não vazar memória.
    return () => {
      toast.error = originalError;
      isPatched.current = false;
    };
  }, [user, userData]); // Atualiza o interceptador se o usuário alternar de sessão

  return null;
}

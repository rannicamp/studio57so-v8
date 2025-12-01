"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Verifica se é navegador e tem suporte
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      
      const register = async () => {
        try {
          // Registra explicitamente o custom-sw.js
          const registration = await navigator.serviceWorker.register("/custom-sw.js", {
            scope: "/",
          });
          
          console.log("✅ Service Worker registrado com sucesso:", registration.scope);

          // Se houver uma atualização esperando, força ela a rodar
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

        } catch (error) {
          console.error("❌ Falha ao registrar Service Worker:", error);
        }
      };

      // Executa após o carregamento da página para não travar o render inicial
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
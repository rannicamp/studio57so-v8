// components/ServiceWorkerRegistrar.js
"use client";

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  // Este hook executa o código apenas no navegador, após a página carregar.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('Service Worker registrado com sucesso:', registration.scope);
        }).catch(err => {
          console.error('Falha no registro do Service Worker:', err);
        });
      });
    }
  }, []);

  // Este componente não renderiza nada visível na tela, apenas executa a lógica acima.
  return null;
}
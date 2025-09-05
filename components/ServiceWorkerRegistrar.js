// components/ServiceWorkerRegistrar.js

"use client"; // A diretiva mágica que diz: "Este é um funcionário do Navegador!"

import { useEffect } from 'react';

const ServiceWorkerRegistrar = () => {
  // Este bloco de código agora está no lugar certo!
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => console.log('Service Worker registrado com sucesso:', registration.scope))
        .catch(error => console.log('Falha no registro do Service Worker:', error));
    }
  }, []);

  // Este componente não precisa mostrar nada na tela, ele só executa o código acima.
  return null; 
};

export default ServiceWorkerRegistrar;
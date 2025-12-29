// public/custom-sw.js

// 1. Instalação: Força o novo SW a assumir o controle imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Ativação: Limpa caches antigos e assume controle das abas
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. Recebimento do Push
self.addEventListener("push", function (event) {
  // Padrão de segurança caso o payload falhe
  let data = { 
    title: "Studio 57", 
    body: "Nova atualização disponível", 
    url: "/", 
    icon: "/icons/icon-192x192.png",
    tag: "system-notification"
  };

  if (event.data) {
    try {
      // Tenta ler como JSON (o formato que seu utils/notificacoes.js envia)
      const payload = event.data.json();
      
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body;
      data.url = payload.url || payload.link || data.url;
      // Garante que o ícone sempre tenha um valor válido ou fallback
      data.icon = payload.icon || data.icon;
      data.tag = payload.tag || 'general';
      
    } catch (e) {
      // Fallback para texto simples se não for JSON
      console.log('Push recebido não é JSON:', event.data.text());
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon, // O Android exige isso. Se falhar o download, ele usa o padrão do app se configurado no manifest
    badge: data.icon, // Ícone pequeno na barra de status (Android)
    tag: data.tag, // Agrupa notificações iguais para não encher a barra
    vibrate: [100, 50, 100], // Padrão de vibração
    data: { 
      url: data.url,
      timestamp: Date.now() 
    },
    requireInteraction: true, // Mantém na tela até o usuário interagir
    actions: [
      { action: "open", title: "Ver" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // Tenta recuperar a URL salva no payload
  let urlToOpen = event.notification.data?.url || '/';

  // Garante que a URL é absoluta se for relativa (ex: /crm -> https://site.com/crm)
  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // 1. Tenta focar em uma aba já aberta
      for (const client of clientList) {
        // Se a aba estiver aberta no mesmo domínio, foca nela e navega
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
             client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // 2. Se não tiver aba aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
// public/custom-sw.js
// ⚠️ VERSÃO DO CACHE: Atualize este número para forçar atualização no celular
const CACHE_VERSION = 'v1.5';
const CACHE_NAME = `elo57-cache-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  console.log(`[SW] Instalando versão ${CACHE_VERSION}`);
  // Força o novo SW a tomar o controle imediatamente (SEM esperar aba fechar)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Apaga TODOS os caches antigos (versões anteriores)
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Deletando cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log(`[SW] Ativado! Cache atual: ${CACHE_NAME}`);
      return clients.claim(); // Assume controle de todas as abas abertas
    })
  );
});

self.addEventListener("push", function (event) {
  let data = {
    title: "Elo 57",
    body: "Nova atualização",
    url: "/",
    icon: "/icons/icon-192x192.png"
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Garante URL absoluta para o ícone (Ajuda no Android)
  const iconUrl = data.icon.startsWith('http') ? data.icon : self.location.origin + data.icon;

  const options = {
    body: data.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: data.tag || 'notification-' + Date.now(),
    renotify: true,
    vibrate: [500, 100, 500],
    data: {
      url: data.url,
      timestamp: Date.now()
    },
    actions: [
      { action: "open", title: "Ver Agora" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  let urlToOpen = event.notification.data?.url || '/';
  if (!urlToOpen.startsWith('http')) {
    urlToOpen = self.location.origin + urlToOpen;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// --- FETCH: Necessário para o Chrome Android reconhecer como PWA instalável ---
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) return response;
        
        // Se a requisição for de página (navegador tentando carregar a UI)
        if (event.request.mode === 'navigate' || 
           (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
          const offlineHtml = `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Offline | Elo 57</title>
              <style>
                body { font-family: sans-serif; text-align: center; margin-top: 20%; background-color: #f9fafb; color: #111827; }
                h1 { color: #f97316; }
              </style>
            </head>
            <body>
              <h1>Você está offline</h1>
              <p>Por favor, verifique sua conexão com a internet para acessar o Studio 57.</p>
            </body>
            </html>
          `;
          return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // Se for requisição de dados/API, responde com JSON limpo para não quebrar JSON.parse
        return new Response(JSON.stringify({ error: "offline", message: "Você está offline." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    })
  );
});
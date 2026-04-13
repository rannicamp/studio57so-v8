// public/custom-sw.js
// ⚠️ VERSÃO DO CACHE: Atualize este número para forçar atualização no celular
const CACHE_VERSION = 'v1.7';
const CACHE_NAME = `elo57-cache-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  console.log(`[SW] Instalando versão ${CACHE_VERSION}`);
  // Força o novo SW a tomar o controle imediatamente (SEM esperar aba fechar)
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
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
      return clients.claim();
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

// --- FETCH: Network-first, com fallback offline APENAS para navegação ---
// ⚠️ REGRAS DE SEGURANÇA:
// 1. Nunca interceptar requisições POST (login, mutações)
// 2. Nunca interceptar requisições para Supabase (auth, API)
// 3. Nunca interceptar /auth/ ou /api/ (callbacks de autenticação)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isPost = event.request.method !== 'GET';
  const isAuthPath = url.pathname.startsWith('/auth/') || 
                     url.pathname.startsWith('/api/') ||
                     url.pathname.startsWith('/login') ||
                     url.pathname.startsWith('/_next/');
  const isSupabase = url.hostname.includes('supabase.co') || 
                     url.hostname.includes('supabase.in');

  // ✅ DEIXA PASSAR SEM INTERCEPTAR:
  // - Requisições POST (login, formulários, mutações)
  // - Supabase (auth, banco)
  // - /auth/, /api/, /login, /_next/
  // - Requisições cross-origin (exceto Supabase já coberto)
  if (isPost || isSupabase || isAuthPath || !isSameOrigin) {
    return; // Passa direto para a rede sem interceptar
  }

  // Para requisições GET de assets/páginas: network-first
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) return response;

        // Só retorna offline page se for navegação HTML
        if (event.request.mode === 'navigate') {
          const offlineHtml = `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Offline | Elo 57</title>
              <style>
                body { font-family: sans-serif; text-align: center; margin-top: 20%; background:#000; color:#fff; }
                h1 { color: #fff; }
                p { color: #aaa; }
              </style>
            </head>
            <body>
              <h1>Elo 57</h1>
              <p>Você está offline. Verifique sua conexão.</p>
            </body>
            </html>
          `;
          return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }

        // Para assets (imagens, JS, CSS): falha silenciosa
        return new Response('', { status: 408 });
      });
    })
  );
});
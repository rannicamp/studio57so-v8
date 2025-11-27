import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// 1. Configurações do PWA
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// O Next.js injeta os arquivos aqui
precacheAndRoute(self.__WB_MANIFEST || []);

// --- 2. CARREGAMENTO MÁGICO (CACHE) ---

// a) Cache de Imagens (Guarda por 30 dias para não baixar de novo)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'imagens-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, 
      }),
    ],
  })
);

// b) Cache de API (Mostra dados antigos instantaneamente enquanto busca novos em background)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/'),
  new StaleWhileRevalidate({
    cacheName: 'dados-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 horas
      }),
    ],
  })
);

// --- 3. LÓGICA DE NOTIFICAÇÃO (PUSH) ---
self.addEventListener('push', function (event) {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : { title: 'Studio 57', body: 'Nova notificação' };
  } catch (e) {
    console.error('Erro push:', e);
    data = { title: 'Studio 57', body: event.data ? event.data.text() : 'Nova mensagem' };
  }

  const options = {
    body: data.message || data.body || 'Nova atualização!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png', // Ícone pequeno na barra superior do Android
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'explore', title: 'Ver Agora' }
    ],
    tag: 'studio57-notification',
    renotify: true,
    requireInteraction: true // Faz a notificação ficar na tela até vc clicar
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Studio 57', options)
  );
});

// --- 4. CLIQUE NA NOTIFICAÇÃO ---
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || '/';
      
      // Tenta focar numa janela já aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não tiver, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
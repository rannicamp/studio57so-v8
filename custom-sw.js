import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// 1. Configurações Iniciais do PWA
self.skipWaiting(); // Força o SW a ativar imediatamente
clientsClaim(); // Assume o controle da página imediatamente
cleanupOutdatedCaches(); // Limpa caches velhos

// O Next.js injeta os arquivos estáticos aqui automaticamente
precacheAndRoute(self.__WB_MANIFEST || []);

// --- 2. CARREGAMENTO MÁGICO (ESTRATÉGIAS DE CACHE) ---

// a) Cache de Imagens (Avatares, Logos, Uploads)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'imagens-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Dias
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// b) Cache de Dados da API (A Mágica da Velocidade)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.pathname.includes('/_next/data/'),
  new StaleWhileRevalidate({
    cacheName: 'dados-api-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 horas
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// c) Fontes e Scripts Externos
registerRoute(
  ({ url }) => url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com') || url.pathname.endsWith('.js'),
  new CacheFirst({
    cacheName: 'assets-estaticos',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1 Ano
    ],
  })
);

// --- 3. SISTEMA DE NOTIFICAÇÃO (PUSH) ROBUSTO ---

self.addEventListener('push', function (event) {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : { title: 'Studio 57', body: 'Nova atualização disponível!' };
  } catch (e) {
    console.error('Erro ao ler push:', e);
    data = { title: 'Studio 57', body: event.data ? event.data.text() : 'Nova mensagem recebida' };
  }

  const options = {
    body: data.message || data.body || 'Toque para visualizar.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    image: data.image || null,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      { action: 'explore', title: 'Ver Agora' }
    ],
    requireInteraction: true,
    tag: 'studio57-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Studio 57', options)
  );
});

// --- 4. CLIQUE NA NOTIFICAÇÃO ---
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// --- 5. MENSAGENS INTERNAS ---
const broadcast = new BroadcastChannel('studio57-updates');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // SILENCIADO: Comentei a linha abaixo para parar de exibir o toast "Página atualizada!"
  // broadcast.postMessage({ type: 'SW_ACTIVATED', message: 'Nova versão disponível!' });
  console.log('Service Worker ativado (atualização silenciosa)');
});
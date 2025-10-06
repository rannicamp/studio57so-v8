// sw.js - VERSÃO DE TESTE V4 - COMPLETA
console.log('[Service Worker] Script de TESTE v4 (Completo) Carregado.');

// MUDAMOS O NOME DO CACHE PARA V4. Forçando a atualização completa.
const CACHE_NAME = 'studio57-cache-v4';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/caixa-de-entrada'
];

// 1. LÓGICA DE INSTALAÇÃO E CACHE (SEU CÓDIGO ORIGINAL MANTIDO)
self.addEventListener('install', event => {
  console.log('[Service Worker] Evento INSTALL v4 Disparado.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache v4 aberto e arquivos salvos.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Forçando a ativação da nova versão (skipWaiting).');
        return self.skipWaiting();
      })
  );
});

// 2. LÓGICA DE ATIVAÇÃO E LIMPEZA (SEU CÓDIGO ORIGINAL MANTIDO)
self.addEventListener('activate', event => {
  console.log('[Service Worker] Evento ACTIVATE v4 Disparado.');
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Cache zumbi removido:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        console.log('[Service Worker] Assumindo o controle de todos os clientes (clients.claim).');
        return self.clients.claim();
    })
  );
});

// 3. LÓGICA DE FETCH (SEU CÓDIGO ORIGINAL MANTIDO)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) { return response; }
        return fetch(event.request).then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') { return response; }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return response;
          }
        );
      })
  );
});

// 4. LÓGICA DE PUSH (MODIFICADA APENAS PARA O TESTE)
self.addEventListener('push', event => {
    console.log('[Service Worker] TESTE v4: Evento PUSH recebido.');

    // Ignoramos qualquer dado que venha do servidor e usamos um texto fixo.
    const title = 'Isto é um Teste';
    const options = {
        body: 'Se você vê esta mensagem, o sistema funciona. O problema está nos dados.',
        icon: '/icons/icon-512x512.png',
        badge: '/icons/icon-192x192.png',
        sound: '/sounds/notification.mp3',
        vibrate: [200, 100, 200],
        data: { url: self.location.origin + '/caixa-de-entrada' } // Mantemos o link
    };

    console.log('[Service Worker] TESTE v4: Tentando mostrar a notificação de teste.');
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// 5. LÓGICA DE CLIQUE (SEU CÓDIGO ORIGINAL MANTIDO)
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notificação de TESTE (v4) clicada.');
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const urlToOpen = event.notification.data.url;
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) { return client.focus(); }
      }
      if (clients.openWindow) { return clients.openWindow(urlToOpen); }
    })
  );
});
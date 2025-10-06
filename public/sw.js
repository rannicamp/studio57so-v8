// MUDAMOS O NOME DO CACHE PARA V2. Isso força o navegador a ver este arquivo como uma grande atualização.
const CACHE_NAME = 'studio57-cache-v2';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/caixa-de-entrada'
];

// Evento 'install': Agora ele força a ativação do novo Service Worker.
self.addEventListener('install', event => {
  console.log('[Service Worker] Nova versão v2 tentando se instalar...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache v2 aberto e arquivos salvos.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // ESSA LINHA É CRUCIAL: Manda o SW antigo para o espaço e ativa o novo imediatamente.
        console.log('[Service Worker] Forçando a ativação da nova versão (skipWaiting).');
        return self.skipWaiting();
      })
  );
});

// Evento 'activate': Agora ele limpa o lixo antigo e assume o controle.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Nova versão v2 ativada.');
  const cacheWhitelist = [CACHE_NAME]; // Só o nosso cache v2 pode viver.

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Se o cache não for o v2, ele é um zumbi. Delete!
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Cache zumbi removido:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // ESSA LINHA É CRUCIAL: O novo SW toma controle de todas as páginas abertas.
        console.log('[Service Worker] Assumindo o controle de todos os clientes (clients.claim).');
        return self.clients.claim();
    })
  );
});

// Evento 'fetch' (sem alterações, continua servindo os arquivos do cache)
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

// Evento 'push' (código correto, sem alterações)
self.addEventListener('push', event => {
  console.log('[Service Worker] Push (v2) Recebido.');
  let data = { title: 'Nova Mensagem', body: 'Você tem uma nova mensagem.' };
  if (event.data) { try { data = event.data.json(); } catch (e) { data = { title: 'Nova Notificação', body: event.data.text() }; } }

  const notificationTitle = "Studio 57 - Caixa de Entrada";
  const notificationBody = `${data.title}: ${data.body}`;
  const options = {
    body: notificationBody, icon: '/icons/icon-512x512.png', badge: '/icons/icon-192x192.png',
    sound: '/sounds/notification.mp3', vibrate: [200, 100, 200],
    data: { url: self.location.origin + '/caixa-de-entrada' }
  };
  event.waitUntil(self.registration.showNotification(notificationTitle, options));
});


// Evento 'notificationclick' (código correto, sem alterações)
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notificação (v2) clicada.');
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
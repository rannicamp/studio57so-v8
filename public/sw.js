// Define um nome e versão para o nosso cache. Mude a versão se quiser forçar uma atualização do cache.
const CACHE_NAME = 'studio57-cache-v1';

// Lista de arquivos essenciais para o "shell" do seu aplicativo funcionar offline.
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/caixa-de-entrada'
];

// Evento 'install': é disparado quando o Service Worker é registrado pela primeira vez.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache aberto e arquivos essenciais salvos.');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': é disparado toda vez que o navegador tenta buscar um recurso (página, imagem, etc.).
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});

// Evento 'activate': é disparado quando o Service Worker é ativado.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Cache antigo removido:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// Evento 'push': disparado quando o servidor envia uma notificação.
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Recebido.');
  
  let data = { title: 'Nova Mensagem', body: 'Você tem uma nova mensagem.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('[Service Worker] Erro ao ler dados do push como JSON:', e);
      data = { title: 'Nova Notificação', body: event.data.text() };
    }
  }

  // --- LÓGICA DA NOTIFICAÇÃO ATUALIZADA ---
  const notificationTitle = "Studio 57 - Caixa de Entrada";
  const notificationBody = `${data.title}: ${data.body}`;

  const options = {
    body: notificationBody,
    icon: '/icons/icon-512x512.png',   // Ícone principal da notificação (maior)
    badge: '/icons/icon-192x192.png',  // Emblema para a barra de status (menor)
    sound: '/sounds/notification.mp3', 
    vibrate: [200, 100, 200],         
    data: {
      url: self.location.origin + '/caixa-de-entrada'
    }
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, options)
  );
});


// Evento 'notificationclick': disparado quando o usuário clica na notificação.
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notificação clicada.');
  
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
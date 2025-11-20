import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

// 1. Configurações do PWA
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// O Next.js vai injetar os arquivos aqui
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. LÓGICA DE NOTIFICAÇÃO
self.addEventListener('push', function (event) {
  let data = {};
  
  // Tenta ler o JSON. Se falhar, cria um objeto padrão.
  try {
    data = event.data ? event.data.json() : { title: 'Studio 57', body: 'Nova notificação' };
  } catch (e) {
    console.error('Erro ao ler JSON do push:', e);
    data = { title: 'Studio 57', body: event.data ? event.data.text() : 'Nova mensagem' };
  }

  const options = {
    body: data.body || 'Nova atualização!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'explore', title: 'Abrir' }
    ],
    tag: 'studio57-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Studio 57', options)
  );
});

// 3. CLIQUE NA NOTIFICAÇÃO
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || '/';
      
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
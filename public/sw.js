import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

// 1. Configurações do PWA (Cache e Offline)
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// O plugin do Next irá substituir esta linha pelos arquivos reais do site durante o build
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. LÓGICA DE NOTIFICAÇÃO (Push Notification)
self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      const options = {
        body: data.body || 'Nova atualização!',
        icon: '/icons/icon-192x192.png', 
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
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
    } catch (err) {
      console.error('Erro push:', err);
      // Fallback simples
      event.waitUntil(
        self.registration.showNotification('Studio 57', { body: 'Nova notificação recebida' })
      );
    }
  }
});

// 3. CLIQUE NA NOTIFICAÇÃO
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || '/';
      
      // Tenta focar numa aba já aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
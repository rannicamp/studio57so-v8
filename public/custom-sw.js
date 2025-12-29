// public/custom-sw.js

// 1. Instalação
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Ativação
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. Recebimento do Push
self.addEventListener("push", function (event) {
  let data = { 
    title: "Studio 57", 
    body: "Nova atualização", 
    url: "/", 
    icon: "/icons/icon-192x192.png",
    tag: "system-notification"
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body;
      data.url = payload.url || payload.link || data.url;
      data.icon = payload.icon || data.icon;
      // Se não vier tag, usa o timestamp para garantir que seja única (sempre vibra)
      data.tag = payload.tag || 'notification-' + Date.now();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: '/icons/icon-192x192.png', // Ícone da barra de status (Android)
    tag: data.tag, 
    renotify: true, // <--- OBRIGATÓRIO: Força vibração mesmo se a tag for repetida
    vibrate: [200, 100, 200], // Vibração mais forte
    data: { 
      url: data.url,
      timestamp: Date.now() 
    },
    requireInteraction: true,
    actions: [
      { action: "open", title: "Abrir" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  let urlToOpen = event.notification.data?.url || '/';
  if (urlToOpen && !urlToOpen.startsWith('http')) {
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
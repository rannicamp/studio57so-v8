// public/custom-sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", function (event) {
  let data = { 
    title: "Studio 57", 
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
    badge: iconUrl, // Ícone pequeno da barra de status
    tag: data.tag || 'notification-' + Date.now(),
    renotify: true, // Força vibração mesmo se a tag repetir
    vibrate: [500, 100, 500], // Vibração Longa-Curta-Longa (Chama atenção)
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
      // Tenta focar numa aba existente
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Se não, abre nova janela
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});
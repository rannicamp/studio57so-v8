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
    body: "Nova notificação", 
    url: "/caixa-de-entrada", 
    icon: "/icons/icon-192x192.png",
    tag: "studio57-general" 
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body; 
      data.url = payload.url || payload.link || data.url;       
      data.icon = payload.icon || data.icon;
      data.tag = payload.tag || data.tag; 
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    data: { url: data.url },
    tag: data.tag,
    renotify: true,
    requireInteraction: true,
    actions: [{ action: "open", title: "Ver Agora" }]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação (A MÁGICA ATUALIZADA ✨)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // Monta o link absoluto corretamente (ex: https://site.com/caixa-de-entrada?email_id=123)
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Tenta achar uma aba que já seja do nosso site
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // O SEGREDO: Foca na janela E FORÇA a navegação para o link novo
          return client.focus().then(() => client.navigate(urlToOpen));
        }
      }
      // Se não tiver nenhuma aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
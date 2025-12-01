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
    body: "Nova notificação!", 
    url: "/painel",
    icon: "/icons/icon-192x192.png" 
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      data.url = payload.url || payload.link || data.url;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Opções simplificadas para funcionar no Windows e Android
  const options = {
    body: data.body,
    icon: data.icon, // Ícone principal
    image: data.image, // Imagem grande (se houver)
    data: { url: data.url },
    requireInteraction: true, // Importante para o Windows: mantém o aviso na tela
    // Removemos 'badge' e 'vibrate' aqui para evitar conflitos no Windows, 
    // mas o Android usa os padrões dele.
    actions: [
      { action: "open", title: "Ver" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || "/";

      // Tenta focar numa aba aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // Se não, abre nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
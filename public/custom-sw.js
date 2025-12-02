// public/custom-sw.js

// 1. Instalação Instantânea
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Ativação e Controle
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. Recebimento do Push
self.addEventListener("push", function (event) {
  // Dados padrão
  let data = { 
    title: "Studio 57", 
    body: "Você tem uma nova notificação!", 
    url: "/painel",
    icon: "/icons/icon-192x192.png" 
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      
      // Mapeamento Inteligente (Corrige o problema do texto sumir)
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body; // Aceita 'body' OU 'message'
      data.url = payload.url || payload.link || data.url;       // Aceita 'url' OU 'link'
      data.icon = payload.icon || data.icon;

    } catch (e) {
      data.body = event.data.text();
    }
  }

  // ⚠️ O SEGREDO DO WINDOWS ESTÁ AQUI:
  // Removemos 'vibrate' e 'badge' que quebram o Desktop.
  const options = {
    body: data.body,
    icon: data.icon,
    data: { url: data.url },
    tag: "studio57-notification",
    renotify: true,
    requireInteraction: true, // Mantém o aviso na tela do Windows até clicar
    actions: [
      { action: "open", title: "Ver" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação (Abre a janela)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || "/";

      // Tenta focar numa aba já aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // Se não, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
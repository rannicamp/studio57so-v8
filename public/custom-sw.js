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
  let data = { 
    title: "Studio 57", 
    body: "Você tem uma nova notificação!", 
    url: "/painel", // Link padrão seguro
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
    data: { url: data.url }, // Guardamos o link curto aqui
    tag: data.tag,
    renotify: true,
    requireInteraction: true, 
    actions: [
      { action: "open", title: "Ver" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação (A CORREÇÃO ESTÁ AQUI)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // TRUQUE DO NETLIFY:
      // Montamos o URL completo usando a 'origem' atual do site.
      // Isso transforma '/caixa-de-entrada' em 'https://seusite.com/caixa-de-entrada'
      const relativeUrl = event.notification.data.url || "/";
      const urlToOpen = new URL(relativeUrl, self.location.origin).href;

      // 1. Tenta focar numa aba que já esteja aberta nesse link
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Compara URLs completos para evitar erros
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }

      // 2. Se não achar, abre uma nova janela com o link absoluto
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
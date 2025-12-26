// public/custom-sw.js

// 1. Instalação Instantânea
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Ativação e Controle
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// 3. Recebimento do Push (Onde a mágica acontece)
self.addEventListener("push", function (event) {
  // Dados padrão de segurança
  let data = { 
    title: "Studio 57", 
    body: "Você tem uma nova notificação!", 
    url: "/painel",
    icon: "/icons/icon-192x192.png",
    tag: "studio57-general" // Tag padrão se não vier nada
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      
      // Mapeamento Inteligente
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body; 
      data.url = payload.url || payload.link || data.url;       
      data.icon = payload.icon || data.icon;
      // AQUI ESTÁ O TRUQUE: Respeita a tag que enviamos do servidor (whatsapp ou email)
      data.tag = payload.tag || data.tag; 

    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    data: { url: data.url }, // Guarda o link para abrir depois
    tag: data.tag,           // Usa a tag correta para não agrupar errado
    renotify: true,          // Vibra de novo mesmo se tiver outra notificação igual
    requireInteraction: true, 
    actions: [
      { action: "open", title: "Ver" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação (Abre a janela certa)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || "/";

      // Tenta focar numa aba já aberta que tenha o mesmo URL
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
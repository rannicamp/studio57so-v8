// public/custom-sw.js

// 1. Instalação: Força o novo Service Worker a assumir o controle imediatamente
self.addEventListener('install', (event) => {
  console.log('👷 Service Worker: Instalando...');
  self.skipWaiting(); // Pula a espera e ativa na hora!
});

// 2. Ativação: Limpa caches antigos e reclama controle das abas abertas
self.addEventListener('activate', (event) => {
  console.log('👷 Service Worker: Ativo e pronto!');
  event.waitUntil(clients.claim()); // Toma controle de todas as abas abertas
});

// 3. Recebimento do Push (O Carteiro chegou)
self.addEventListener("push", function (event) {
  console.log('🔔 Push recebido no SW!');

  // Dados padrão caso venha vazio
  let data = { 
    title: "Studio 57", 
    body: "Você tem uma nova mensagem.", 
    url: "/painel",
    icon: "/icons/icon-192x192.png"
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
      // Normaliza URL (aceita 'link' ou 'url')
      data.url = payload.url || payload.link || data.url;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Configurações Específicas para Android
  const options = {
    body: data.body,
    icon: data.icon, // Ícone grande (ao lado do texto)
    badge: "/icons/icon-192x192.png", // Ícone pequeno na barra de status (deve ser branco/transparente idealmente)
    vibrate: [100, 50, 100, 50, 100], // Padrão de vibração mais chamativo
    data: { url: data.url }, // Guarda a URL para usar no clique
    tag: "studio57-notification", // Agrupa notificações para não encher a barra
    renotify: true, // Vibra novamente mesmo se a notificação já estiver lá
    requireInteraction: true, // (Opcional) A notificação fica na tela até o usuário interagir
    actions: [
      { action: "open", title: "Ver Agora 🚀" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 4. Clique na Notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close(); // Fecha o aviso

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || "/painel";

      // Tenta focar numa aba que já existe
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      
      // Se não tiver, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
self.addEventListener("push", function (event) {
  // 1. Prepara os dados padrão (caso tudo falhe)
  let data = { 
    title: "Studio 57", 
    body: "Nova notificação recebida!", 
    url: "/" 
  };

  // 2. Tenta extrair os dados reais enviados pelo servidor
  if (event.data) {
    try {
      // Tenta converter o texto para JSON (Objeto)
      const payload = event.data.json();
      
      // Se conseguir, atualiza os dados
      data.title = payload.title || data.title;
      data.body = payload.body || data.body;
      data.url = payload.url || payload.link || data.url; // Aceita 'url' ou 'link'
      
    } catch (e) {
      // Se der erro no JSON, usa o texto puro como mensagem
      console.log("Erro ao ler JSON da notificação:", e);
      data.body = event.data.text();
    }
  }

  // 3. Configurações Visuais do Android
  const options = {
    body: data.body,
    icon: "/icons/icon-192x192.png", // Ícone grande
    badge: "/icons/icon-192x192.png", // Ícone pequeno na barra de status
    vibrate: [100, 50, 100], // Padrão de vibração
    data: {
      url: data.url
    },
    actions: [
      { action: "open", title: "Ver Agora" }
    ],
    tag: "studio57-notification", // Evita flood de notificações iguais
    renotify: true // Vibra novamente mesmo se tiver o mesmo tag
  };

  // 4. O comando SHOWNOTIFICATION é OBRIGATÓRIO.
  // Usamos event.waitUntil para garantir que o navegador espere isso terminar.
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Ação ao Clicar na Notificação
self.addEventListener("notificationclick", function (event) {
  event.notification.close(); // Fecha a notificação da barra

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const urlToOpen = event.notification.data.url || "/";

      // Tenta focar numa aba já aberta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      
      // Se não tiver aba aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Define um nome e versão para o nosso cache. Mude a versão se quiser forçar uma atualização do cache.
const CACHE_NAME = 'studio57-cache-v1';

// Lista de arquivos essenciais para o "shell" do seu aplicativo funcionar offline.
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Evento 'install': é disparado quando o Service Worker é registrado pela primeira vez.
self.addEventListener('install', event => {
  // O navegador espera até que a promessa dentro de waitUntil seja resolvida.
  event.waitUntil(
    // Abrimos o cache com o nome que definimos.
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        // Adicionamos todos os arquivos da nossa lista ao cache.
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento 'fetch': é disparado toda vez que o navegador tenta buscar um recurso (página, imagem, etc.).
self.addEventListener('fetch', event => {
  event.respondWith(
    // Verificamos se o recurso solicitado já existe no nosso cache.
    caches.match(event.request)
      .then(response => {
        // Se encontrarmos no cache, retornamos a resposta do cache.
        if (response) {
          return response;
        }

        // Se não encontrarmos no cache, buscamos na rede.
        return fetch(event.request).then(
          response => {
            // Verificamos se a resposta da rede é válida.
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clonamos a resposta para poder guardá-la no cache e enviá-la ao navegador.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Guardamos a nova resposta no cache para uso futuro.
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Evento 'activate': é disparado quando o Service Worker é ativado.
// Usado para limpar caches antigos e garantir que a nova versão esteja no controle.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Se o nome do cache não estiver na nossa lista de permissões, ele é um cache antigo. Apagamos!
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// --- CÓDIGO NOVO A SER ADICIONADO NO FINAL DO ARQUIVO ---

// Evento 'push': disparado quando o servidor envia uma notificação.
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Recebido.');
  
  let data = { title: 'Nova Notificação', body: 'Você tem uma nova mensagem.' };
  // Tenta extrair os dados da notificação (título, corpo, ícone, etc.)
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Erro ao ler dados do push como JSON:', e);
      data = { title: 'Nova Notificação', body: event.data.text() };
    }
  }

  const title = data.title || 'Studio 57';
  const options = {
    body: data.body || 'Você tem uma nova atualização.',
    icon: data.icon || '/icons/icon-192x192.png', // Ícone que aparece na notificação
    badge: '/icons/icon-192x192.png', // Ícone para a barra de status em alguns Androids
    data: {
      url: data.url || '/' // URL para abrir ao clicar na notificação
    }
  };

  // Pede para o navegador manter o service worker vivo até a notificação ser exibida.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento 'notificationclick': disparado quando o usuário clica na notificação.
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notificação clicada.');
  
  // Fecha a notificação que foi clicada
  event.notification.close();

  // Abre a URL que foi enviada com a notificação ou, na falta dela, a página inicial.
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
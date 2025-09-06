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
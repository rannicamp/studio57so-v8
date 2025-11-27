import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// 1. Configurações Iniciais do PWA
self.skipWaiting(); // Força o SW a ativar imediatamente
clientsClaim(); // Assume o controle da página imediatamente
cleanupOutdatedCaches(); // Limpa caches velhos

// O Next.js injeta os arquivos estáticos aqui automaticamente
precacheAndRoute(self.__WB_MANIFEST || []);

// --- 2. CARREGAMENTO MÁGICO (ESTRATÉGIAS DE CACHE) ---

// a) Cache de Imagens (Avatares, Logos, Uploads)
// Guarda por 30 dias. Se tiver no cache, mostra na hora. Se não, baixa.
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'imagens-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Dias
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200], // Aceita respostas opacas (de outros servidores como Supabase)
      }),
    ],
  })
);

// b) Cache de Dados da API (A Mágica da Velocidade)
// Estratégia: StaleWhileRevalidate (Obsoleto Enquanto Revalida)
// 1. Mostra o dado antigo INSTANTANEAMENTE.
// 2. Vai no servidor buscar o novo em background.
// 3. Atualiza o cache para a próxima vez.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.pathname.includes('/_next/data/'),
  new StaleWhileRevalidate({
    cacheName: 'dados-api-cache-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 horas
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// c) Fontes e Scripts Externos (Google Fonts, FontAwesome)
registerRoute(
  ({ url }) => url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com') || url.pathname.endsWith('.js'),
  new CacheFirst({
    cacheName: 'assets-estaticos',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }), // 1 Ano
    ],
  })
);

// --- 3. SISTEMA DE NOTIFICAÇÃO (PUSH) ROBUSTO ---

self.addEventListener('push', function (event) {
  let data = {};
  
  // Tenta ler o JSON enviado pelo servidor
  try {
    data = event.data ? event.data.json() : { title: 'Studio 57', body: 'Nova atualização disponível!' };
  } catch (e) {
    console.error('Erro ao ler push:', e);
    data = { title: 'Studio 57', body: event.data ? event.data.text() : 'Nova mensagem recebida' };
  }

  // Configuração Específica para Android
  const options = {
    body: data.message || data.body || 'Toque para visualizar.',
    icon: '/icons/icon-192x192.png', // Ícone quadrado grande
    badge: '/icons/icon-192x192.png', // Ícone pequeno monocromático (barra de status)
    image: data.image || null, // Se tiver imagem grande no push
    vibrate: [100, 50, 100], // Padrão de vibração
    data: {
      url: data.url || '/', // Link para onde vai ao clicar
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      { action: 'explore', title: 'Ver Agora' }
    ],
    requireInteraction: true, // Mantém a notificação até o usuário interagir
    tag: 'studio57-notification' // Evita spam, substitui notificações antigas se for o mesmo assunto
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Studio 57', options)
  );
});

// --- 4. CLIQUE NA NOTIFICAÇÃO ---
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Fecha a notificação ao clicar

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 1. Se já tem uma janela aberta no link certo, foca nela
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Se não tem, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// --- 5. MENSAGENS INTERNAS (Para avisar o app que tem dados novos) ---
// Isso vai permitir o aviso "Página atualizada!"
const broadcast = new BroadcastChannel('studio57-updates');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  broadcast.postMessage({ type: 'SW_ACTIVATED', message: 'Nova versão disponível!' });
});
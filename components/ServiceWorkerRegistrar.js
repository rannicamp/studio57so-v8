// components/ServiceWorkerRegistrar.js
"use client";

import { useEffect } from 'react';
import { toast } from 'sonner';

// Função auxiliar para converter a chave VAPID para o formato que o navegador entende
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Verifica se o navegador suporta Service Workers e Notificações
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      
      const registerAndSubscribe = async () => {
        try {
          // 1. Registra o Service Worker
          const registration = await navigator.serviceWorker.register('/custom-sw.js');
          console.log('Service Worker registrado com escopo:', registration.scope);

          // Aguarda o SW estar ativo
          await navigator.serviceWorker.ready;

          // 2. Verifica se já existe uma inscrição
          const existingSubscription = await registration.pushManager.getSubscription();
          
          // Se já estiver inscrito, não faz nada (ou poderia atualizar no banco se quisesse garantir)
          if (existingSubscription) {
             console.log('Usuário já inscrito nas notificações.');
             // Opcional: Reenviar para o backend para garantir que está salvo
             await sendSubscriptionToBackEnd(existingSubscription);
             return;
          }

          // 3. Pega a chave pública do arquivo .env.local
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

          if (!vapidPublicKey) {
              console.error('Chave VAPID Pública não encontrada no .env.local');
              return;
          }

          // 4. Converte a chave
          const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

          // 5. Tenta inscrever o usuário (Aqui o navegador pede permissão)
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });

          // 6. Envia para o Backend salvar no Supabase
          await sendSubscriptionToBackEnd(subscription);
          
          toast.success("Notificações ativadas!", {
              description: "Você receberá atualizações importantes."
          });

        } catch (error) {
          console.error('Erro ao registrar SW ou inscrever push:', error);
          // Se o erro for permissão negada, não adianta insistir
          if (Notification.permission === 'denied') {
              console.warn('Permissão de notificação negada pelo usuário.');
          }
        }
      };

      // Executa a função
      window.addEventListener('load', registerAndSubscribe);
    }
  }, []);

  // Função para enviar os dados para a API que você criou
  async function sendSubscriptionToBackEnd(subscription) {
    try {
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });

        if (!response.ok) {
          throw new Error('Falha ao salvar inscrição no servidor.');
        }
        console.log('Inscrição salva no banco de dados com sucesso!');
    } catch (err) {
        console.error('Erro ao enviar inscrição para API:', err);
    }
  }

  return null;
}
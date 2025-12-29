// components/ServiceWorkerRegistrar.js
"use client";

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// Função utilitária para converter a chave VAPID
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
  const supabase = createClient();

  useEffect(() => {
    // 1. Verifica se o navegador suporta Service Worker e Push
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      
      const registerSw = async () => {
        try {
          // 2. Registra o arquivo CORRETO (custom-sw.js)
          const registration = await navigator.serviceWorker.register('/custom-sw.js', {
            scope: '/',
          });

          console.log('✅ [SW] Service Worker registrado com sucesso:', registration.scope);

          // Aguarda o SW estar ativo para garantir que podemos assinar
          await navigator.serviceWorker.ready;

          // 3. Verifica/Cria a Assinatura de Push (Subscription)
          const subscription = await registration.pushManager.getSubscription();

          // Se já tem assinatura, apenas verificamos se está salva no servidor (opcional)
          // Se NÃO tem, criamos uma nova
          if (!subscription) {
            const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (vapidPublicKey) {
              const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
              
              const newSubscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
              });

              await saveSubscriptionToServer(newSubscription);
            }
          } else {
            // Garante que a assinatura atual está salva no banco para o usuário atual
            await saveSubscriptionToServer(subscription);
          }

        } catch (error) {
          console.error('❌ [SW] Falha ao registrar Service Worker ou Push:', error);
        }
      };

      registerSw();
    }
  }, []);

  // 4. Envia a assinatura para o seu Backend salvar no Supabase
  const saveSubscriptionToServer = async (subscription) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Chama sua rota de API para salvar
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          userId: user.id
        }),
      });
      
      console.log('📡 [Push] Assinatura enviada para o servidor.');

    } catch (err) {
      console.error('❌ [Push] Erro ao salvar assinatura no servidor:', err);
    }
  };

  return null; // Este componente não renderiza nada visual
}
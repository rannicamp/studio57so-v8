"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função para converter a chave VAPID para o navegador
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationManager() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState('default'); 
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkSubscription = async () => {
    try {
      setPermission(Notification.permission);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        setIsSubscribed(true);
        // Sincroniza silenciosamente se o usuário estiver logado
        if (user) syncSubscription(subscription);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error("Erro ao verificar inscrição:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async (subscription) => {
    if (!user) return;
    
    const subscriptionJSON = subscription.toJSON();
    
    // CORREÇÃO: Salvamos apenas nas colunas que existem no seu banco
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscriptionJSON.endpoint,
        subscription_data: subscriptionJSON, // Aqui dentro já tem o 'auth' e 'p256dh'
        organizacao_id: user.organizacao_id
      }, { onConflict: 'endpoint' });

    if (error) console.error("Erro ao sincronizar DB:", error.message);
  };

  const handleSubscribe = async () => {
    if (!user) return toast.error("Faça login para ativar notificações.");

    setLoading(true);
    try {
      // 1. Permissão do Navegador
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error("Você precisa permitir notificações no navegador.");
        setLoading(false);
        return;
      }

      // 2. Registra no Navegador
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) throw new Error("Chave VAPID não encontrada.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // 3. Salva no Banco (Supabase)
      await syncSubscription(subscription);

      setIsSubscribed(true);
      toast.success("Notificações ativadas!");

      // 4. Envia teste de boas-vindas
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: "Tudo pronto! 🎉",
          message: "Você receberá avisos aqui.",
          url: "/painel"
        })
      });

    } catch (error) {
      console.error("Erro ao inscrever:", error);
      toast.error("Erro ao ativar notificações.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        // Remove do banco pelo endpoint (chave única)
        if (user) {
            await supabase
            .from('notification_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
      }

      setIsSubscribed(false);
      toast.info("Notificações desativadas.");
    } catch (error) {
      console.error("Erro ao desinscrever:", error);
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'denied') {
    return (
      <div className="text-red-500 text-xs mt-2">
        <FontAwesomeIcon icon={faBellSlash} className="mr-1" />
        Bloqueado pelo navegador.
      </div>
    );
  }

  return (
    <button
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={loading}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all
        ${isSubscribed 
          ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}
        ${loading ? 'opacity-70 cursor-wait' : ''}
      `}
    >
      {loading ? (
        <FontAwesomeIcon icon={faSpinner} spin />
      ) : isSubscribed ? (
        <>
          <FontAwesomeIcon icon={faBell} />
          Ativo
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faBellSlash} />
          Ativar Avisos
        </>
      )}
    </button>
  );
}
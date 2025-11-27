"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função utilitária para converter a chave VAPID (obrigatória para o navegador entender)
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

export default function NotificationManager() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState('default'); // default, granted, denied
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
        // Opcional: Atualizar o backend para garantir que esta inscrição ainda é válida
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
    
    // Salva no Supabase
    const { error } = await supabase
      .from('notification_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscriptionJSON.endpoint,
        auth: subscriptionJSON.keys.auth,
        p256dh: subscriptionJSON.keys.p256dh,
        subscription_data: subscriptionJSON, // Backup do objeto completo
        organizacao_id: user.organizacao_id,
        updated_at: new Date()
      }, { onConflict: 'endpoint' });

    if (error) console.error("Erro ao sincronizar DB:", error);
  };

  const handleSubscribe = async () => {
    if (!user) return toast.error("Faça login para ativar notificações.");

    setLoading(true);
    try {
      // 1. Pedir permissão ao navegador
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error("Você precisa permitir notificações no navegador.");
        setLoading(false);
        return;
      }

      // 2. Obter o Service Worker Ativo
      const registration = await navigator.serviceWorker.ready;

      // 3. Inscrever no PushManager do navegador
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Chave Pública VAPID não encontrada no .env");

      const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // 4. Salvar no Banco de Dados
      await syncSubscription(subscription);

      setIsSubscribed(true);
      toast.success("Notificações ativadas com sucesso!");
      
      // Envia um teste automático silencioso
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: "Configuração Concluída",
          message: "Seu dispositivo está pronto para receber avisos.",
          url: "/perfil"
        })
      });

    } catch (error) {
      console.error("Erro ao inscrever:", error);
      toast.error(`Erro: ${error.message}`);
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
        // Remove do navegador
        await subscription.unsubscribe();
        
        // Remove do Banco de Dados
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
      <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">
        <FontAwesomeIcon icon={faBellSlash} className="mr-2" />
        Notificações bloqueadas no navegador. Clique no cadeado na barra de endereço para liberar.
      </div>
    );
  }

  return (
    <button
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={loading}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
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
          Notificações Ativas
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faBellSlash} />
          Ativar Notificações
        </>
      )}
    </button>
  );
}
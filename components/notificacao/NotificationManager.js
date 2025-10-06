//components\NotificationManager.js

"use client";

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationManager() {
    const { user } = useAuth();

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && user) {
            const subscribeUser = async () => {
                try {
                    await navigator.serviceWorker.register('/sw.js');
                    const registration = await navigator.serviceWorker.ready;

                    let subscription = await registration.pushManager.getSubscription();

                    if (subscription === null) {
                        console.log('Não inscrito, solicitando permissão e inscrevendo...');
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            console.log('Permissão para notificações negada.');
                            return;
                        }

                        subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
                        });
                    }

                    await fetch('/api/notifications/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(subscription),
                    });

                    console.log('Usuário inscrito para notificações push.');

                } catch (error) {
                    toast.error("Falha ao se inscrever para notificações.");
                    console.error('Erro na inscrição de push notification:', error);
                }
            };

            subscribeUser();
        }
    }, [user]);

    return null; // Este componente não renderiza nada na tela
}
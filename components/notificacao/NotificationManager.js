"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Converte a chave VAPID para o formato que o navegador entende
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
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
    const [permission, setPermission] = useState('default');
    const supabase = createClient();

    useEffect(() => {
        if ('Notification' in window && user) {
            setPermission(Notification.permission);
            checkSubscription();
        }
    }, [user]);

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) setIsSubscribed(true);
        }
    };

    const subscribeUser = async () => {
        if (!user) return toast.error("Você precisa estar logado.");

        try {
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') return toast.error("Permissão negada.");

            const registration = await navigator.serviceWorker.ready;
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (!vapidKey) {
                console.error("VAPID Key ausente no .env");
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });

            // Salva na tabela EXISTENTE 'notification_subscriptions'
            const { error } = await supabase
                .from('notification_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint, // Campo UNIQUE da sua tabela
                    subscription_data: subscription, // Campo JSONB da sua tabela
                    organizacao_id: user.organizacao_id 
                }, { onConflict: 'endpoint' });

            if (error) throw error;

            setIsSubscribed(true);
            toast.success("Notificações ativadas!");
            
            // Teste de envio imediato
            await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id, 
                    title: 'Studio 57', 
                    message: 'Dispositivo conectado com sucesso!',
                    organizacaoId: user.organizacao_id
                })
            });

        } catch (error) {
            console.error("Erro subscription:", error);
            toast.error("Erro ao ativar notificações.");
        }
    };

    if (!user) return null;

    if (permission === 'denied') {
        return <span className="text-red-500 text-xs"><FontAwesomeIcon icon={faBellSlash} /> Bloqueado</span>;
    }

    if (isSubscribed) {
        return <span className="text-green-600 text-xs font-medium"><FontAwesomeIcon icon={faCheckCircle} /> Ativo</span>;
    }

    return (
        <button 
            onClick={subscribeUser} 
            className="text-xs flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
        >
            <FontAwesomeIcon icon={faBell} /> Ativar Notificações
        </button>
    );
}
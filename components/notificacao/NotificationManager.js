"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash, faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função auxiliar para converter a chave
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
    const [isLoading, setIsLoading] = useState(false);
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
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    setIsSubscribed(true);
                }
            } catch (e) {
                console.error("Erro ao checar subscrição:", e);
            }
        }
    };

    const subscribeUser = async () => {
        if (!user) return toast.error("Você precisa estar logado.");
        setIsLoading(true);

        try {
            // 1. Pede permissão ao navegador
            const perm = await Notification.requestPermission();
            setPermission(perm);
            if (perm !== 'granted') {
                setIsLoading(false);
                return toast.error("Permissão de notificação negada.");
            }

            // 2. Registra no Service Worker
            const registration = await navigator.serviceWorker.ready;
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (!vapidKey) {
                alert("ERRO: Chave VAPID não encontrada no sistema (.env)!");
                setIsLoading(false);
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            });

            console.log("Subscrição gerada:", subscription);

            // 3. Salva no Supabase (AQUI QUE ESTAVA O PROBLEMA)
            const { error } = await supabase
                .from('notification_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint, 
                    subscription_data: subscription, 
                    organizacao_id: user.organizacao_id 
                }, { onConflict: 'endpoint' });

            if (error) {
                console.error("Erro Supabase:", error);
                // Mostra o erro técnico na tela para facilitar o debug no celular
                alert(`Erro ao salvar no banco: ${error.message || error.details}`);
                throw error;
            }

            setIsSubscribed(true);
            toast.success("Notificações ativadas com sucesso!");
            
            // 4. Teste de envio imediato
            await fetch('/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id, 
                    title: 'Studio 57', 
                    message: 'Dispositivo conectado! Você receberá avisos aqui.',
                    organizacaoId: user.organizacao_id
                })
            });

        } catch (error) {
            console.error("Erro fatal:", error);
            toast.error("Não foi possível ativar as notificações.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    if (isLoading) {
        return <span className="text-gray-500 text-xs"><FontAwesomeIcon icon={faSpinner} spin /> Processando...</span>;
    }

    if (permission === 'denied') {
        return <span className="text-red-500 text-xs"><FontAwesomeIcon icon={faBellSlash} /> Bloqueado no Navegador</span>;
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
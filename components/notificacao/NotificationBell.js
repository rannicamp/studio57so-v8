// components/notificacao/NotificationBell.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Função para converter a chave (Obrigatória para funcionar)
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

export default function NotificationBell() {
    const [permission, setPermission] = useState('default');
    const [loading, setLoading] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        // Verifica suporte e permissão atual ao carregar
        if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
            setIsSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermissionAndSubscribe = async () => {
        if (!isSupported) return;
        setLoading(true);

        try {
            // 1. Pede a permissão (O navegador vai mostrar o popup agora porque foi um clique)
            const userPermission = await Notification.requestPermission();
            setPermission(userPermission);

            if (userPermission !== 'granted') {
                toast.info("As notificações foram bloqueadas. Habilite nas configurações do navegador.");
                return;
            }

            // 2. Prepara a chave de segurança
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) throw new Error("Chave VAPID não encontrada");
            
            const convertedKey = urlBase64ToUint8Array(vapidKey);

            // 3. Cria a assinatura no navegador
            const swRegistration = await navigator.serviceWorker.ready;
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey // Chave convertida corretamente
            });

            // 4. Envia para o banco de dados
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' },
            });

            toast.success("Notificações ativadas com sucesso!");

        } catch (error) {
            console.error("Erro ao ativar notificações:", error);
            toast.error("Erro ao ativar. Tente limpar o cache e recarregar.");
        } finally {
            setLoading(false);
        }
    };

    if (!isSupported) return null; // Não mostra nada se não suportar

    // Se já estiver permitido, mostra o sino verde (apenas visual)
    if (permission === 'granted') {
        return (
            <div className="p-2 text-green-500" title="Notificações ativadas">
                <FontAwesomeIcon icon={faBell} className="h-5 w-5" />
            </div>
        );
    }

    // Botão para ativar
    return (
        <button
            onClick={requestPermissionAndSubscribe}
            disabled={loading}
            className={`p-2 transition-colors duration-200 ${
                permission === 'denied' ? 'text-red-500' : 'text-gray-500 hover:text-blue-600 animate-pulse'
            }`}
            title={permission === 'denied' ? "Notificações bloqueadas" : "Ativar notificações"}
        >
            {loading ? (
                <FontAwesomeIcon icon={faSpinner} spin className="h-5 w-5" />
            ) : (
                <FontAwesomeIcon icon={permission === 'denied' ? faBellSlash : faBell} className="h-5 w-5" />
            )}
        </button>
    );
}
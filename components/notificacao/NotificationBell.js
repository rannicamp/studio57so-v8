// components/NotificationBell.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faBellSlash } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function NotificationBell() {
    const [permission, setPermission] = useState('default');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Quando o componente carregar, verificamos qual é a permissão atual
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermissionAndSubscribe = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            toast.error("Seu navegador não suporta notificações.");
            return;
        }

        setLoading(true);

        try {
            // 1. Pedimos a permissão ao usuário
            const userPermission = await Notification.requestPermission();
            setPermission(userPermission);

            if (userPermission !== 'granted') {
                toast.info("Você precisa permitir as notificações para recebê-las.");
                setLoading(false);
                return;
            }

            // 2. Registramos a "assinatura" (o endereço de entrega)
            const swRegistration = await navigator.serviceWorker.ready;
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            });

            // 3. Enviamos a assinatura para o nosso backend (que ainda vamos criar)
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            toast.success("Inscrição para notificações realizada com sucesso!");

        } catch (error) {
            console.error("Erro ao se inscrever para notificações:", error);
            toast.error("Ocorreu um erro ao habilitar as notificações.");
        } finally {
            setLoading(false);
        }
    };

    if (permission === 'granted') {
        return (
            <div className="flex items-center text-green-600" title="As notificações estão ativas">
                <FontAwesomeIcon icon={faBell} className="h-5 w-5" />
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center text-red-600" title="As notificações estão bloqueadas nas configurações do seu navegador">
                <FontAwesomeIcon icon={faBellSlash} className="h-5 w-5" />
            </div>
        );
    }

    return (
        <button
            onClick={requestPermissionAndSubscribe}
            disabled={loading}
            className="text-gray-600 hover:text-blue-700 disabled:opacity-50"
            title="Habilitar notificações"
        >
            {loading ? 'Aguarde...' : <FontAwesomeIcon icon={faBell} className="h-5 w-5" />}
        </button>
    );
}
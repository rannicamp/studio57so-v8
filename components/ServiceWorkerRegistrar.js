"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function ServiceWorkerRegistrar() {
  const { user } = useAuth();

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      user && 
      VAPID_PUBLIC_KEY
    ) {
      registerServiceWorker();
    }
  }, [user]);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register("/custom-sw.js", {
        scope: "/",
      });

      // Aguarda o SW estar ativo
      await navigator.serviceWorker.ready;

      // Verifica se já existe inscrição
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        // Já inscrito, garante que está salvo no banco
        await saveSubscription(existingSubscription);
      } else {
        // Nova inscrição
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await saveSubscription(subscription);
      }
      
    } catch (error) {
      console.error("Falha no Service Worker/Push:", error);
    }
  }

  async function saveSubscription(subscription) {
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });
  }

  // Função utilitária para converter a chave VAPID
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return null; // Este componente não renderiza nada visual
}

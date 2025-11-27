"use client";

import { useEffect } from 'react';
import { toast } from 'sonner';

export default function UpdatePrompt() {
  useEffect(() => {
    // Escuta mensagens do Service Worker (BroadcastChannel)
    const channel = new BroadcastChannel('studio57-updates');
    
    channel.onmessage = (event) => {
      if (event.data.type === 'SW_ACTIVATED') {
        toast.info("Aplicação atualizada!", {
            description: "Novos dados foram carregados.",
            action: {
                label: "Recarregar",
                onClick: () => window.location.reload()
            },
            duration: 8000,
        });
      }
    };

    return () => {
      channel.close();
    };
  }, []);

  return null; // Este componente não renderiza nada visualmente, só dispara o Toast
}
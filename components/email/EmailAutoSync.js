'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';

export default function EmailAutoSync({ intervalMinutes = 2 }) {
    const queryClient = useQueryClient();
    const isSyncingRef = useRef(false);
    const [isVisualSyncing, setIsVisualSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);

    useEffect(() => {
        const runSync = async () => {
            // Evita rodar se já estiver rodando
            if (isSyncingRef.current) return;

            try {
                isSyncingRef.current = true;
                setIsVisualSyncing(true); // Liga o ícone girando

                // Chama o backend para olhar o IMAP
                const response = await fetch('/api/email/sync', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) throw new Error('Falha no sync silencioso');

                const data = await response.json();

                // FORÇA BRUTA: Reseta os caches para obrigar a busca dos novos números
                await queryClient.resetQueries({ queryKey: ['emailFolderCounts'] });
                await queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
                await queryClient.invalidateQueries({ queryKey: ['emailMessages'] });

                setLastSyncTime(new Date());

                if (data.synced > 0) {
                    toast.success(`📬 ${data.synced} novos e-mails chegaram!`);
                }

            } catch (error) {
                console.error('🤖 Robô: Erro ao verificar e-mails:', error);
            } finally {
                isSyncingRef.current = false;
                // Mantém o ícone rodando mais um pouquinho só para dar feedback visual
                setTimeout(() => setIsVisualSyncing(false), 1000);
            }
        };

        // Roda a primeira vez 3 segundos após abrir a tela
        const initialTimer = setTimeout(runSync, 3000);

        // Configura o loop infinito (setInterval)
        const loopTimer = setInterval(runSync, intervalMinutes * 60 * 1000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(loopTimer);
        };
    }, [intervalMinutes, queryClient]);

    // Retorna um indicador visual discreto que ficará no rodapé da Sidebar
    return (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 flex justify-between items-center">
            <span className="flex items-center gap-2">
                <FontAwesomeIcon 
                    icon={faSync} 
                    className={`text-blue-400 ${isVisualSyncing ? 'animate-spin' : ''}`} 
                />
                {isVisualSyncing ? 'Verificando e-mails...' : 'Monitoramento ativo'}
            </span>
            {lastSyncTime && (
                <span>{lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
        </div>
    );
}
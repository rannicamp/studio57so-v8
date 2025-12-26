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
            if (isSyncingRef.current) return;

            try {
                isSyncingRef.current = true;
                setIsVisualSyncing(true); 

                const response = await fetch('/api/email/sync', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) throw new Error('Falha no sync silencioso');

                const data = await response.json();

                await queryClient.resetQueries({ queryKey: ['emailFolderCounts'] });
                await queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
                await queryClient.invalidateQueries({ queryKey: ['emailMessages'] });

                setLastSyncTime(new Date());

                if (data.newEmails > 0) {
                    toast.success(`📬 ${data.newEmails} novos e-mails chegaram!`);
                    
                    // --- ATUALIZAÇÃO DO SININHO AQUI TAMBÉM ---
                    queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
                }

            } catch (error) {
                console.error('🤖 Robô: Erro ao verificar e-mails:', error);
            } finally {
                isSyncingRef.current = false;
                setTimeout(() => setIsVisualSyncing(false), 1000);
            }
        };

        const initialTimer = setTimeout(runSync, 3000);
        const loopTimer = setInterval(runSync, intervalMinutes * 60 * 1000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(loopTimer);
        };
    }, [intervalMinutes, queryClient]);

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
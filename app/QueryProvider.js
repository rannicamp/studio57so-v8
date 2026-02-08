// Local do Arquivo: app/QueryProvider.js
"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useRef, useState } from 'react';
// A importação do toast foi removida pois não será mais usada aqui.
// import { toast } from 'sonner'; 

export default function QueryProvider({ children }) {
    // Usamos um 'useRef' para criar um rastreador das queries já carregadas.
    const initialLoadDone = useRef(new Set());

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // ##### INÍCIO DO CARREGAMENTO MÁGICO (CACHE) #####
                // A propriedade 'staleTime' define por quanto tempo os dados são considerados "frescos".
                // Isso evita refetchs desnecessários imediatos e permite o carregamento instantâneo
                // ao navegar entre páginas.
                staleTime: 1000 * 60 * 5, // 5 minutos
            },
        },
    }));

    useEffect(() => {
        // ##### MONITORAMENTO SILENCIOSO DE ATUALIZAÇÕES #####
        // O subscribe continua ativo para manter nosso controle interno (initialLoadDone) atualizado,
        // mas sem disparar notificações visuais para o usuário.
        const unsubscribe = queryClient.getQueryCache().subscribe(event => {
            // Só nos importamos com eventos que indicam que uma query (busca de dados) foi ATUALIZADA.
            if (event.type !== 'updated' || !event.query) return;

            const { query } = event;
            const queryKey = query.queryHash; // Identidade única da busca

            const wasBackgroundFetch = initialLoadDone.current.has(queryKey);

            // AQUI HAVIA O CÓDIGO DA NOTIFICAÇÃO (toast.success).
            // Foi removido para garantir que nenhuma mensagem apareça na tela.
            // O sistema continuará atualizando os dados em segundo plano silenciosamente.

            // Se a busca teve sucesso e ainda não estava no nosso rastreador,
            // adicionamos agora. Isso serve apenas para controle interno.
            if (query.state.status === 'success' && !wasBackgroundFetch) {
                initialLoadDone.current.add(queryKey);
            }
        });

        // Limpeza da "escuta" quando o componente for desmontado.
        return () => {
            unsubscribe();
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* Ferramenta para desenvolvimento. Não aparece em produção. */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
// Local do Arquivo: app/QueryProvider.js
"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useRef, useState } from 'react';

export default function QueryProvider({ children }) {
    const initialLoadDone = useRef(new Set());

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 1000 * 60 * 5, // 5 minutos
                // ##### AQUI ESTÁ A CHAVE, SEU LINDO! #####
                // Desativamos a atualização automática ao voltar para a aba.
                refetchOnWindowFocus: false, 
                // Também evitamos que ele tente atualizar se a rede cair e voltar.
                refetchOnReconnect: false,
            },
        },
    }));

    useEffect(() => {
        const unsubscribe = queryClient.getQueryCache().subscribe(event => {
            if (event.type !== 'updated' || !event.query) return;
            const { query } = event;
            const queryKey = query.queryHash;
            const wasBackgroundFetch = initialLoadDone.current.has(queryKey);

            if (query.state.status === 'success' && !wasBackgroundFetch) {
                initialLoadDone.current.add(queryKey);
            }
        });
        return () => unsubscribe();
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
// Local do Arquivo: app/QueryProvider.js
"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useRef, useState } from 'react';
// Removi a importação do toast pois não vamos mais usar aqui
// import { toast } from 'sonner';

export default function QueryProvider({ children }) {
    // Usamos um 'useRef' para criar um rastreador. Ele vai guardar um registro
    // de todas as buscas de dados que já foram carregadas pela primeira vez na tela.
    const initialLoadDone = useRef(new Set());

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // ##### INÍCIO DO CARREGAMENTO MÁGICO (CACHE) #####
                // Mantemos o staleTime para garantir performance.
                // Os dados ficam "frescos" por 5 minutos, carregando instantaneamente.
                staleTime: 1000 * 60 * 5, // 5 minutos
            },
        },
    }));

    useEffect(() => {
        // ##### LÓGICA DE MONITORAMENTO SILENCIOSA #####
        // A função 'subscribe' continua escutando as atualizações de dados,
        // mas agora ela apenas atualiza o controle interno sem incomodar o usuário.
        const unsubscribe = queryClient.getQueryCache().subscribe(event => {
            // Só nos importamos com eventos que indicam que uma query foi ATUALIZADA.
            if (event.type !== 'updated' || !event.query) return;

            const { query } = event;
            const queryKey = query.queryHash; // Uma "identidade" única da busca

            const wasBackgroundFetch = initialLoadDone.current.has(queryKey);

            // AQUI ESTAVA A NOTIFICAÇÃO (toast.success).
            // Foi removida para garantir silêncio total. O app atualiza, mas não avisa.

            // Se a busca teve sucesso e ainda não estava no nosso rastreador,
            // nós a adicionamos agora. Assim, o sistema sabe que o dado está carregado.
            if (query.state.status === 'success' && !wasBackgroundFetch) {
                initialLoadDone.current.add(queryKey);
            }
        });

        // Limpeza da "escuta" ao desmontar
        return () => {
            unsubscribe();
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* Ferramenta para nos ajudar a programar. Não aparece para o usuário final em produção. */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
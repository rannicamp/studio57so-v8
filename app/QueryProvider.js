// Local do Arquivo: app/QueryProvider.js
"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function QueryProvider({ children }) {
    // Usamos um 'useRef' para criar um rastreador. Ele vai guardar um registro
    // de todas as buscas de dados que já foram carregadas pela primeira vez na tela.
    // Isso é essencial para sabermos quando uma atualização é em "segundo plano".
    const initialLoadDone = useRef(new Set());

    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                // ##### INÍCIO DO CARREGAMENTO MÁGICO (CACHE) #####
                // O PORQUÊ:
                // A propriedade 'staleTime' é o coração do nosso carregamento mágico.
                // Ao definir um valor de 5 minutos (em milissegundos), estamos dizendo ao sistema:
                // "Uma vez que você buscar um dado, considere-o 'fresco' e válido por 5 minutos."
                //
                // O que isso faz na prática?
                // 1. Você entra numa página -> os dados são buscados na internet (normal).
                // 2. Você sai e volta para a mesma página dentro de 5 minutos -> os dados aparecem
                //    INSTANTANEAMENTE, pois foram lidos da memória (cache).
                //
                // Enquanto você vê os dados antigos, o sistema verifica silenciosamente em
                // segundo plano se há algo novo. Se houver, a notificação será disparada.
                staleTime: 1000 * 60 * 5, // 5 minutos
            },
        },
    }));

    useEffect(() => {
        // ##### INÍCIO DA NOTIFICAÇÃO DE ATUALIZAÇÃO #####
        // O PORQUÊ:
        // A função 'subscribe' nos permite "escutar" tudo o que acontece com
        // os dados do sistema. Vamos usá-la para identificar quando uma busca
        // em segundo plano foi concluída com sucesso.
        const unsubscribe = queryClient.getQueryCache().subscribe(event => {
            // Só nos importamos com eventos que indicam que uma query (busca de dados) foi ATUALIZADA.
            if (event.type !== 'updated' || !event.query) return;

            const { query } = event;
            const queryKey = query.queryHash; // Uma "identidade" única da busca

            // A mágica acontece aqui. Verificamos se a busca que acabou de terminar
            // já estava no nosso rastreador 'initialLoadDone'. Se sim, significa que
            // não foi o primeiro carregamento, mas sim uma atualização em segundo plano.
            const wasBackgroundFetch = initialLoadDone.current.has(queryKey);

            // Condições para mostrar a notificação:
            // 1. A busca de dados teve sucesso.
            // 2. A ação que disparou o evento foi a de sucesso.
            // 3. Foi uma atualização em segundo plano (e não o carregamento inicial).
            if (
                query.state.status === 'success' &&
                event.action.type === 'success' &&
                wasBackgroundFetch
            ) {
                // Disparamos a notificação!
                toast.success('Página atualizada!', {
                    description: 'Novos dados foram carregados para você.',
                    duration: 3000 // A notificação some após 3 segundos
                });
            }

            // Se a busca teve sucesso e ainda não estava no nosso rastreador,
            // nós a adicionamos agora. Assim, da próxima vez que ela for
            // atualizada, saberemos que é um 'background fetch'.
            if (query.state.status === 'success' && !wasBackgroundFetch) {
                initialLoadDone.current.add(queryKey);
            }
        });

        // É uma boa prática limpar a "escuta" quando o componente não está mais na tela.
        return () => {
            unsubscribe();
        };
    }, [queryClient]);

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* Ferramenta para nos ajudar a programar. Não aparece para o usuário final. */}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
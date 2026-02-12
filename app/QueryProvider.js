'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Configurações globais para evitar refetching agressivo
        staleTime: 60 * 1000, // 1 minuto
        refetchOnWindowFocus: false, // Não recarrega ao trocar de aba
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      
      {/* Abaixo está a ferramenta de "Raio-X" (TanStack Devtools).
          Comentei para não atrapalhar o visual no celular.
          Se precisar depurar o cache no futuro, é só descomentar.
      */}
      {/* <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" /> */}
      
    </QueryClientProvider>
  );
}
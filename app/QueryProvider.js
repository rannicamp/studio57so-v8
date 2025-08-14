// app/QueryProvider.js
"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Este componente cria o "cérebro" da memória que usaremos em todo o sistema.
export default function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Guarda os dados em memória por 5 minutos antes de considerá-los "velhos".
        staleTime: 5 * 60 * 1000, 
        // Permite que a página verifique silenciosamente por atualizações quando você volta para a aba.
        refetchOnWindowFocus: true, 
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
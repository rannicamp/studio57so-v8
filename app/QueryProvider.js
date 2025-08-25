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
        
        // ##### CORREÇÃO APLICADA AQUI #####
        // Impede que a página busque dados novos apenas por ganhar foco (mudar de aba).
        refetchOnWindowFocus: false, 
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
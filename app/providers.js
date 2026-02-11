// app/providers.js
"use client";

import { AuthProvider } from '../contexts/AuthContext'; 
import { SessionProvider } from 'next-auth/react';
import QueryProvider from './QueryProvider';

export function Providers({ children }) {
  return (
    <AuthProvider>
      {/* Mantemos o refetchOnWindowFocus como false aqui também para 
        impedir que o Next-Auth tente checar a sessão ao mudar de aba.
      */}
      <SessionProvider 
        refetchOnWindowFocus={false} 
        refetchInterval={0} // Garante que não haja atualização por tempo
      >
        <QueryProvider>
          {children}
        </QueryProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
// app/providers.js
"use client";

import { AuthProvider } from '../contexts/AuthContext'; 
import { SessionProvider } from 'next-auth/react';
import QueryProvider from './QueryProvider';

export function Providers({ children }) {
  return (
    <AuthProvider>
      {/* ##### CORREÇÃO APLICADA AQUI #####
        Adicionamos refetchOnWindowFocus={false} ao SessionProvider.
        Isso impede que a sessão do usuário seja revalidada apenas por
        mudar de aba, que era a causa do recarregamento da página.
      */}
      <SessionProvider refetchOnWindowFocus={false}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
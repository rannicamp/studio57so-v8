// app/providers.js
"use client";

// --- CORREÇÃO APLICADA AQUI ---
// O caminho foi corrigido de './contexts/...' para '../contexts/...'
// para "subir" um nível de pasta antes de procurar por 'contexts'.
import { AuthProvider } from '../contexts/AuthContext'; 
// --- FIM DA CORREÇÃO ---

import { SessionProvider } from 'next-auth/react';
import QueryProvider from './QueryProvider';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <SessionProvider>
        <QueryProvider>
          {children}
        </QueryProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
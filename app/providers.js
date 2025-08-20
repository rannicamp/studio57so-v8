// app/providers.js
"use client";

import { AuthProvider } from './contexts/AuthContext';
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
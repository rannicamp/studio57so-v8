// app/providers.js
"use client";

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import QueryProvider from './QueryProvider';

export function Providers({ children }) {
 return (
 <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
 <AuthProvider>
 <OrganizationProvider>
 <QueryProvider>
 {children}
 </QueryProvider>
 </OrganizationProvider>
 </AuthProvider>
 </SessionProvider>
 );
}
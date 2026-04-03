import { Inter } from 'next/font/google';
// ✅ AQUI SIM devem estar esses imports:
import './globals.css';
import { Providers } from './providers';

import { Toaster } from 'sonner';
import Script from 'next/script';

import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar';
import ErrorTelemetry from '@/components/shared/ErrorTelemetry';
// Se este arquivo não existir, comente a linha abaixo para testar
// import '@/components/financeiro/pdfPolyfill'; 
const inter = Inter({ subsets: ['latin'] });

export const viewport = {
 themeColor: '#000000',
 width: 'device-width',
 initialScale: 1,
 maximumScale: 1,
};

export const metadata = {
 title: 'Elo 57',
 description: 'Sistema de Gestão',
 manifest: '/manifest.json',
 appleWebApp: {
 capable: true,
 statusBarStyle: 'default',
 title: 'Elo 57',
 },
 icons: {
 apple: [
 { url: '/apple-touch-icon.png', sizes: '192x192', type: 'image/png' },
 ],
 shortcut: '/icons/icon-192x192.png',
 },
};

export default function RootLayout({ children }) {
 return (
 <html lang="pt-br" suppressHydrationWarning>
 <body className={inter.className} suppressHydrationWarning>
 {/* Registro do PWA */}
 <ServiceWorkerRegistrar />

 <Providers>
 <ErrorTelemetry />
 {children}
 </Providers>

 <Toaster richColors position="top-right" />
 </body>
 </html>
 );
}
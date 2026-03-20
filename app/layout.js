import { Inter } from 'next/font/google';
// ✅ AQUI SIM devem estar esses imports:
import './globals.css';
import { Providers } from './providers';

import { Toaster } from 'sonner';
import Script from 'next/script';

import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar';
// Se este arquivo não existir, comente a linha abaixo para testar
// import '@/components/financeiro/pdfPolyfill'; 

const inter = Inter({ subsets: ['latin'] });

export const viewport = {
  themeColor: '#0288d1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata = {
  title: 'Elo 57',
  description: 'Sistema de Gestão',
  manifest: '/manifest.json?v=1.4',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* Registro do PWA */}
        <ServiceWorkerRegistrar />

        <Providers>
          {children}
        </Providers>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
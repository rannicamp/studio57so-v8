//app\layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import QueryProvider from './QueryProvider';

// 1. CORREÇÃO DE PDF (A Vacina 💉):
// Importamos o polyfill aqui para garantir que ele carregue antes de qualquer biblioteca de PDF
import '../components/financeiro/pdfPolyfill';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
  manifest: '/manifest.json', // <--- ESSENCIAL PARA O ANDROID
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
};

export default function RootLayout({ children }) {
  // Nota: RootLayout é Server Component por padrão.
  
  return (
    <html lang="pt-br">
      <head>
        <meta name="theme-color" content="#0288d1" />
      </head>
      <body className={inter.className}>
        {/* Componente responsável por registrar o Service Worker e Push Notifications */}
        <ServiceWorkerRegistrar />

        <div id="fb-root"></div>
        <Script
          async
          defer
          crossOrigin="anonymous"
          src="https://connect.facebook.net/pt_BR/sdk.js"
          strategy="afterInteractive"
        />
        <Script id="facebook-sdk-init" strategy="afterInteractive">
          {`
            window.fbAsyncInit = function() {
              FB.init({
                appId      : '1518358099511142',
                cookie     : true,
                xfml       : true,
                version    : 'v20.0'
              });
              FB.AppEvents.logPageView();   
            };
          `}
        </Script>
        <Script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js" strategy="beforeInteractive" />

        <Providers>
          <QueryProvider>
            {children}
          </QueryProvider>
        </Providers>

        {/* CORREÇÃO: toastOptions com print:hidden para não sair na impressão */}
        <Toaster 
          richColors 
          position="top-right" 
          toastOptions={{
            className: 'print:hidden'
          }}
        />
      </body>
    </html>
  );
}
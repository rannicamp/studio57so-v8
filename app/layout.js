// Local do Arquivo: app/layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

// ##### INÍCIO DA CORREÇÃO #####
// 1. Importamos o SessionProvider aqui, no arquivo principal.
import { SessionProvider } from 'next-auth/react';
// ##### FIM DA CORREÇÃO #####

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        <meta name="theme-color" content="#0288d1" />
      </head>
      <body className={inter.className}>
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

        {/* ##### INÍCIO DA CORREÇÃO ##### */}
        {/* 2. Envolvemos o <Providers> com o <SessionProvider>. */}
        <SessionProvider>
          <Providers>
            {children}
          </Providers>
        </SessionProvider>
        {/* ##### FIM DA CORREÇÃO ##### */}

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
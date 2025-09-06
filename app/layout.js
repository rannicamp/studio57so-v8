// Adicionamos "use client" pois o registro do Service Worker só acontece no navegador
"use client";

import { useEffect } from 'react'; // Importamos o useEffect
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

// O metadata é exportado separadamente em layouts "use client"
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
  // --- CÓDIGO DE REGISTRO DO SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('Service Worker registrado com sucesso:', registration.scope);
        }).catch(err => {
          console.error('Falha no registro do Service Worker:', err);
        });
      });
    }
  }, []);
  // --- FIM DO CÓDIGO DE REGISTRO ---

  return (
    <html lang="pt-br">
      <head>
        {/* O Next.js gerencia as tags do metadata automaticamente, mas o theme-color é bom ter aqui */}
        <meta name="theme-color" content="#0288d1" />
      </head>
      <body className={inter.className}>
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
          {children}
        </Providers>
        
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
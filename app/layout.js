// app/layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';
// --- ALTERAÇÃO: A linha abaixo foi REMOVIDA ---
// import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'; 

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
        
        {/* --- ALTERAÇÃO: O componente <ServiceWorkerRegistrar /> foi REMOVIDO מכאן --- */}
        
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
                xfml      : true,
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

        {/* --- INÍCIO DA ADIÇÃO --- */}
        {/* Script para registrar o Service Worker de forma direta */}
        <Script id="service-worker-registrar" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker
                  .register('/sw.js')
                  .then(registration => console.log('SW registrado com sucesso: ', registration.scope))
                  .catch(registrationError => console.log('Falha no registro do SW: ', registrationError));
              });
            }
          `}
        </Script>
        {/* --- FIM DA ADIÇÃO --- */}

      </body>
    </html>
  );
}
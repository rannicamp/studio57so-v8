// app/layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
// --- INÍCIO DA ALTERAÇÃO ---
// Importamos nosso novo componente "invólucro"
import { Providers } from './providers';
// --- FIM DA ALTERAÇÃO ---

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
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
                xfbml      : true,
                version    : 'v20.0'
              });
              
              FB.AppEvents.logPageView();   
            };
          `}
        </Script>
        <Script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js" strategy="beforeInteractive" />
        
        {/* --- INÍCIO DA ALTERAÇÃO --- */}
        {/* Agora, usamos o componente <Providers> para envolver o conteúdo */}
        <Providers>
          {children}
        </Providers>
        {/* --- FIM DA ALTERAÇÃO --- */}
        
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
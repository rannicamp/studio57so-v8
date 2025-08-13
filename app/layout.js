// app/layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script'; // Importamos a ferramenta de Script do Next.js

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
        
        {/* Adicionamos este bloco para carregar o SDK do Facebook */}
        <div id="fb-root"></div>
        <Script
          async
          defer
          crossOrigin="anonymous"
          src="https://connect.facebook.net/pt_BR/sdk.js" // Alterado para Português (pt_BR)
          strategy="afterInteractive"
        />

        {/* Este é o script de inicialização que você enviou, adaptado para o Next.js */}
        <Script id="facebook-sdk-init" strategy="afterInteractive">
          {`
            window.fbAsyncInit = function() {
              FB.init({
                appId      : '1518358099511142', // <-- SUBSTITUA PELO SEU APP ID
                cookie     : true,
                xfbml      : true,
                version    : 'v20.0'
              });
              
              FB.AppEvents.logPageView();   
            };

            // O restante do código de carregamento é gerenciado pelo <Script> acima
          `}
        </Script>
        
        <Script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js" strategy="beforeInteractive" />
        
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
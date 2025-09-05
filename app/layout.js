import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Studio 57',
  description: 'Sistema de Gestão Integrada',
  manifest: '/manifest.json',
  // --- INÍCIO DA ALTERAÇÃO ---
  // Adicionando ícones específicos para melhor compatibilidade com PWA
  icons: {
    icon: '/favicon.ico', // Ícone padrão para navegadores
    apple: '/icons/icon-192x192.png', // Ícone para Apple (iPhone/iPad) ao adicionar à Tela de Início
  },
  // --- FIM DA ALTERAÇÃO ---
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
        
        <Providers>
          {children}
        </Providers>
        
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
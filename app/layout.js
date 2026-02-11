// app/layout.js

import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import Script from 'next/script';
import { Providers } from './providers';
// CORREÇÃO CRÍTICA AQUI: Adicionado '/shared' ao caminho
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar';
import QueryProvider from './QueryProvider';

// 1. CORREÇÃO DE PDF (A Vacina 💉):
// Ajustei para @ para garantir que ache o arquivo independente de onde estiver
import '@/components/financeiro/pdfPolyfill';

const inter = Inter({ subsets: ['latin'] });

// 2. CONFIGURAÇÃO DE VIEWPORT (Next.js 15 Standard)
export const viewport = {
  themeColor: '#0288d1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// 3. SEO NÍVEL NASA 🚀
export const metadata = {
  metadataBase: new URL('https://www.studio57.com.br'),
  title: {
    default: 'Studio 57 - Sistema de Gestão Integrada',
    template: '%s | Studio 57',
  },
  description: 'Conectando você aos melhores investimentos imobiliários e residenciais.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://www.studio57.com.br',
    siteName: 'Studio 57',
    images: [
      {
        url: '/og-image-padrao.jpg',
        width: 1200,
        height: 630,
        alt: 'Studio 57 - Gestão e Negócios',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* Registro do PWA e Notificações */}
        <ServiceWorkerRegistrar />

        {/* Integração Facebook SDK */}
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
                xfbml      : true,  // <--- CORRIGIDO: Era xfml, agora é xfbml
                version    : 'v20.0'
              });
              FB.AppEvents.logPageView();   
            };
          `}
        </Script>

        {/* Utilitário de Áudio */}
        <Script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js" strategy="beforeInteractive" />

        <Providers>
          <QueryProvider>
            {children}
          </QueryProvider>
        </Providers>

        {/* Notificações Visuais (Sonner) */}
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
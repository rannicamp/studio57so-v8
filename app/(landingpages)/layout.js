// Caminho: app/(landingpages)/layout.js

import Script from 'next/script';
import { Toaster } from 'sonner';
import MenuPublico from './components/MenuPublico';
import { Roboto } from 'next/font/google';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';

// Impede o FontAwesome de adicionar CSS automaticamente (nós já importamos acima)
config.autoAddCss = false;

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// ID do Pixel e GA
const PIXEL_ID = '625880956813084';
const GA_MEASUREMENT_ID = 'G-JSGHN2BHQN'; 

export const metadata = {
  title: 'Studio 57 - Arquitetura e Incorporação',
  description: 'Arquitetura Inteligente e Empreendimentos Reais. A solução completa para o mercado imobiliário.',
};

export default function PublicLayout({ children }) {
  return (
    // CORREÇÃO: Substituímos <html> e <body> por uma <div> container.
    // Isso evita o erro de "Hydration Mismatch" (Boneca Russa).
    <div className={`${roboto.className} min-h-screen flex flex-col bg-gray-50 text-gray-800`}>
      
      {/* --- GOOGLE ANALYTICS --- */}
      {/* O Next.js gerencia a injeção desses scripts automaticamente no <head> ou final do <body> */}
      <Script 
        strategy="afterInteractive" 
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} 
      />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>

      {/* --- META PIXEL --- */}
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt="Meta Pixel"
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      
      {/* NOTA: Se o layout raiz (app/layout.js) já tiver o Toaster, 
          você pode remover este daqui para evitar duplicidade de avisos.
          Mas mantive conforme solicitado para garantir a configuração 'print:hidden'. */}
      <Toaster 
          richColors 
          position="top-right" 
          toastOptions={{
              className: 'print:hidden'
          }}
      />
      
      {/* MENU SUPERIOR */}
      <MenuPublico />
      
      {/* CONTEÚDO PRINCIPAL (Cresce para empurrar o footer) */}
      <main className="flex-grow">
        {children}
      </main>
      
      {/* RODAPÉ */}
      <footer className="bg-gray-800 text-white py-8 mt-auto">
        <div className="w-full px-6 text-center">
          <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
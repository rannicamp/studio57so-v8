// Caminho: app/(landingpages)/layout.js

// PARTES ADICIONADAS: Importamos o Script do Next.js e o Toaster para notificações.
import Script from 'next/script';
import { Toaster } from 'sonner';
// PARTES ORIGINAIS MANTIDAS:
import MenuPublico from './components/MenuPublico';
import { Roboto } from 'next/font/google';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// PARTE ADICIONADA: Definimos o ID do seu Pixel aqui.
const PIXEL_ID = '625880956813084';

// =========================================================================
// NOVO CÓDIGO: SEU ID DO GOOGLE ANALYTICS
const GA_MEASUREMENT_ID = 'G-JSGHN2BHQN'; 
// =========================================================================

// PARTE ORIGINAL MANTIDA: Seu título e descrição para o Google.
export const metadata = {
  title: 'Studio 57 - Arquitetura e Incorporação',
  description: 'Arquitetura Inteligente e Empreendimentos Reais. A solução completa para o mercado imobiliário.',
};

export default function PublicLayout({ children }) {
  return (
    // PARTE ORIGINAL MANTIDA: A fonte Roboto continua sendo aplicada em todo o site.
    <html lang="pt-br" className={roboto.className}>
      <head>
        {/* PARTE ORIGINAL MANTIDA: O ícone da aba do navegador. */}
        <link rel="icon" href="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092416467.png" sizes="any" />
      </head>
      {/* PARTE ORIGINAL MANTIDA: As classes de estilo do corpo da página. */}
      <body className="bg-gray-50 text-gray-800">

        {/* ================================================================= */}
        {/* =================== INÍCIO DO CÓDIGO GOOGLE ANALYTICS =================== */}
        {/* O PORQUÊ: Carregamos a biblioteca principal do GA. */}
        <Script 
            strategy="afterInteractive" 
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} 
        />
        {/* O PORQUÊ: Este script de configuração inicializa o GA em todas as páginas. */}
        <Script id="google-analytics-config" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {/* ==================== FIM DO CÓDIGO GOOGLE ANALYTICS ===================== */}


        {/* ================================================================= */}
        {/* =================== INÍCIO DO CÓDIGO META PIXEL (JÁ EXISTENTE) =================== */}
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
            src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
        <Toaster richColors position="top-right" />
        {/* ==================== FIM DO CÓDIGO META PIXEL ===================== */}
        
        {/* PARTES ORIGINAIS MANTIDAS: A estrutura do seu site. */}
        <MenuPublico />
        <main>
          {children}
        </main>
        <footer className="bg-gray-800 text-white py-8">
          <div className="container mx-auto px-6 text-center">
            <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
          </div>
        </footer>

      </body>
    </html>
  );
}
// Caminho do arquivo: app/(landingpages)/layout.js
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

export const metadata = {
  title: 'Studio 57 - Arquitetura e Incorporação',
  description: 'Arquitetura Inteligente e Empreendimentos Reais. A solução completa para o mercado imobiliário.',
};

export default function PublicLayout({ children }) {
  return (
    <html lang="pt-br" className={roboto.className}>
      <head>
        <link rel="icon" href="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092416467.png" sizes="any" />
      </head>
      <body className="bg-gray-50 text-gray-800">
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
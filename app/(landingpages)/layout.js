// Caminho do arquivo: app/(landingpages)/layout.js
import MenuPublico from './components/MenuPublico';
import { Roboto } from 'next/font/google';

// Importações do FontAwesome (mantidas do seu arquivo original)
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
config.autoAddCss = false;

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Studio 57 - Soluções Imobiliárias',
  description: 'Gestão de obras, vendas e empreendimentos. A solução completa para o mercado imobiliário.',
};

export default function PublicLayout({ children }) {
  return (
    <html lang="pt-br" className={roboto.className}>
      <head>
        {/* O PORQUÊ DESTA LINHA:
            Adicionamos esta tag para garantir que o favicon encontrado em app/favicon.ico
            seja carregado corretamente em todas as páginas que usam este layout. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-gray-50 text-gray-800">
        <MenuPublico />
        <main>
          {children}
        </main>
        <footer className="bg-gray-800 text-white py-8 mt-16">
          <div className="container mx-auto px-6 text-center">
            <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
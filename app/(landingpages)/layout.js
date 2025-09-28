// Caminho do arquivo: app/(landingpages)/layout.js
import MenuPublico from './components/MenuPublico';
import { Roboto } from 'next/font/google';

// Importações para corrigir o uso de ícones (FontAwesome) - MANTIVEMOS ISSO DO SEU ARQUIVO ORIGINAL
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
config.autoAddCss = false

// O PORQUÊ DA MUDANÇA:
// Estamos substituindo seu layout antigo por este mais robusto.
// Ele agora importa e exibe o MenuPublico, define uma fonte padrão para o site,
// adiciona um rodapé e mantém suas configurações do FontAwesome.
// Todas as páginas dentro de (landingpages) usarão este "molde".

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Studio 57 - Soluções Imobiliárias',
  description: 'Gestão de obras, vendas e empreendimentos. A solução completa para o mercado imobiliário.',
}

export default function PublicLayout({ children }) {
  return (
    <html lang="pt-br" className={roboto.className}>
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
  )
}
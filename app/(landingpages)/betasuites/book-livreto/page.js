// Caminho: app/(landingpages)/betasuites/book-livreto/page.js
import BetaSuitesBookLivretoClient from './BetaSuitesBookLivretoClient';

export const metadata = {
  title: 'Book do Investidor (Versão Impressa) - Beta Suítes | Studio 57',
  description: 'Apresentação do empreendimento Beta Suítes otimizada para impressão gráfica em formato Livreto (A4 Vertical).',
  robots: {
    index: false,
    follow: false,
  },
};

export default function BetaSuitesBookLivretoPage() {
  return <BetaSuitesBookLivretoClient />;
}

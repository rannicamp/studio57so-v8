// Caminho: app/(landingpages)/betasuites/book-a5/page.js
import BetaSuitesBookA5Client from './BetaSuitesBookA5Client';

export const metadata = {
  title: 'Book do Investidor (Livreto A5) - Beta Suítes | Studio 57',
  description: 'Apresentação do empreendimento Beta Suítes otimizada para impressão gráfica em formato Livreto (A5 Vertical).',
  robots: {
    index: false,
    follow: false,
  },
};

export default function BetaSuitesBookA5Page() {
  return <BetaSuitesBookA5Client />;
}

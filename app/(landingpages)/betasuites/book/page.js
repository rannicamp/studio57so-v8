import BetaSuitesBookClient from './BetaSuitesBookClient';

export const metadata = {
  title: 'Book de Vendas - Beta Suítes | Studio 57',
  description: 'Apresentação Oficial do Empreendimento Beta Suítes.',
  robots: 'noindex, nofollow', // Evita que o Google indexe essa rota secreta
};

export default function BetaSuitesBookPage() {
  return <BetaSuitesBookClient />;
}

import ManualCorretorA5Client from './ManualCorretorA5Client';

export const metadata = {
  title: 'Manual Tático do Corretor (A5) - Beta Suítes | Studio 57',
  description: 'Guia definitivo de vendas, rentabilidade e quebra de objeções para o corretor do Beta Suítes.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManualCorretorA5Page() {
  return <ManualCorretorA5Client />;
}

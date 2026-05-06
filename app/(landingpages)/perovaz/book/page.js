import PeroVazBookClient from "./PeroVazBookClient";

export const metadata = {
  title: 'Book do Investidor | Residencial Pero Vaz',
  description: 'Book de Vendas do Residencial Pero Vaz. Ideal para apresentar a clientes do Minha Casa Minha Vida.',
  robots: 'noindex, nofollow', // Evita que o book seja indexado no Google solto
};

export default function PeroVazBookPage() {
  return <PeroVazBookClient />;
}

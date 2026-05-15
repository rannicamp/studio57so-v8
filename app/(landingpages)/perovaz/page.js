// Caminho: app/(landingpages)/perovaz/page.js
import PeroVazClient from './PeroVazClient';
import Script from 'next/script';

export const metadata = {
  title: 'Residencial Pero Vaz | Saia do Aluguel',
  description: 'Apartamento térreo pronto para morar no Jardim Vera Cruz. Use seu FGTS e saia do aluguel hoje mesmo!',
};

export default function PeroVazPage() {
  return (
    <>
      <PeroVazClient />
    </>
  );
}

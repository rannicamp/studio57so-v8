// Caminho: app/(landingpages)/residencialalfa/page.js
import ResidencialAlfaClient from './ResidencialAlfaClient';
import Script from 'next/script';

// --- CONFIGURAÇÃO DE SEO BLINDADA ---
export const metadata = {
  title: 'Residencial Alfa | Investimento Inteligente em Governador Valadares',
  description: 'Apartamentos de 2 quartos no Alto Esplanada. Alta rentabilidade com aluguel temporário e valorização garantida. Conheça o Residencial Alfa.',
  keywords: ['Apartamento Governador Valadares', 'Residencial Alfa', 'Alto Esplanada', 'Investimento Imobiliário', 'Renda Passiva Imóveis'],
  openGraph: {
    title: 'Residencial Alfa | O Futuro do seu Investimento',
    description: 'Transforme seu dinheiro em renda passiva. Apartamentos otimizados no bairro que mais valoriza em GV.',
    url: 'https://www.studio57.com.br/residencialalfa',
    images: [
      {
        url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png',
        width: 1200,
        height: 630,
        alt: 'Fachada Residencial Alfa',
      },
    ],
  },
};

export default function ResidencialAlfaPage() {
  // Dados Estruturados (JSON-LD)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: 'Residencial Alfa',
    image: [
      'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png'
    ],
    description: 'Empreendimento residencial no Alto Esplanada.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Governador Valadares',
      addressRegion: 'MG',
      addressCountry: 'BR'
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock'
    }
  };

  return (
    <>
      <Script
        id="residencial-alfa-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Carrega o Site Visual (Client Component) */}
      <ResidencialAlfaClient />
    </>
  );
}
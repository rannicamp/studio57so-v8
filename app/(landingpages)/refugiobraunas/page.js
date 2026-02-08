// Caminho: app/(landingpages)/refugiobraunas/page.js
import RefugioBraunasClient from './RefugioBraunasClient';
import Script from 'next/script';

// --- CONFIGURAÇÃO DE SEO BLINDADA ---
export const metadata = {
  title: 'Refúgio Braúnas | Lotes de 1.000m² em Governador Valadares',
  description: 'Oportunidade única: Lotes a partir de 1.000m² a apenas 10 minutos do centro. Matrícula individualizada e financiamento facilitado. Construa sua chácara.',
  keywords: ['Loteamento Governador Valadares', 'Refúgio Braúnas', 'Chácara', 'Terreno 1000m2', 'Investimento Imobiliário'],
  openGraph: {
    title: 'Refúgio Braúnas | Seu paraíso particular',
    description: 'Lotes de 1.000m² com infraestrutura completa a 10 min do centro. Clique e veja!',
    url: 'https://www.studio57.com.br/refugiobraunas',
    images: [
      {
        url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png', // Imagem que peguei do seu arquivo anterior
        width: 1200,
        height: 630,
        alt: 'Refúgio Braúnas - Natureza e Conforto',
      },
    ],
  },
};

export default function RefugioBraunasPage() {
  // Dados Estruturados (JSON-LD)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: 'Refúgio Braúnas',
    image: [
      'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png'
    ],
    description: 'Loteamento de Chácaras em Governador Valadares.',
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
        id="refugio-braunas-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Carrega o Site Visual (Client Component) */}
      <RefugioBraunasClient />
    </>
  );
}
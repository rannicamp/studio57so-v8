// Caminho: app/(landingpages)/betasuites/page.js
import BetaSuitesClient from './BetaSuitesClient';
import Script from 'next/script';

// --- CONFIGURAÇÃO DE SEO BLINDADA ---
export const metadata = {
  title: 'Beta Suítes - Studios no Alto Esplanada | Studio 57',
  description: 'Studios de 23m² a 32m² em Governador Valadares. Perfeito para morar ou investir com alta rentabilidade. Ao lado da UFJF-GV e hospitais.',
  keywords: ['studio', 'apartamento', 'investimento', 'governador valadares', 'alto esplanada', 'imóvel compacto', 'rentabilidade'],
  openGraph: {
    title: 'Beta Suítes - O Futuro do Morar em GV',
    description: 'Conheça o empreendimento mais moderno do Alto Esplanada. Studios inteligentes para investidores exigentes.',
    url: 'https://www.studio57.com.br/betasuites',
    images: [
      {
        url: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png', // Usa a foto da fachada como capa do link
        width: 1200,
        height: 630,
        alt: 'Fachada Moderna do Beta Suítes',
      },
    ],
  },
};

export default function BetaSuitesPage() {
  // Dados Estruturados (JSON-LD) para o Google entender que isso é um Imóvel/Produto
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: 'Beta Suítes',
    image: [
      'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png'
    ],
    description: 'Empreendimento de Studios Modernos no Alto Esplanada.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Governador Valadares',
      addressRegion: 'MG',
      addressCountry: 'BR'
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: '190000.00',
      availability: 'https://schema.org/PreOrder' // Pré-lançamento
    }
  };

  return (
    <>
      {/* Script Invisível para o Robô do Google */}
      <Script
        id="beta-suites-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Carrega o Site Visual */}
      <BetaSuitesClient />
    </>
  );
}
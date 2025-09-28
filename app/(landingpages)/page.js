// Caminho do arquivo: app/(landingpages)/page.js
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faPuzzlePiece, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '700'], // Adicionando o peso '300' (light) para o slogan
});

export default function HomePage() {
  return (
    <>
      {/* 1. SEÇÃO INICIAL (HERO) - DESIGN FINAL */}
      <section className="relative min-h-[calc(100vh-74px)] flex items-center justify-center bg-black text-white overflow-hidden">
        <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759095131611.png"
            alt="Interior de um empreendimento de alto padrão"
            layout="fill"
            objectFit="cover"
            className="z-0"
            priority
        />
        {/* O PORQUÊ DA MUDANÇA:
            A div que criava a "capa cinza" (overlay) foi removida para que a imagem de fundo
            apareça de forma "pura", como você solicitou. */}
        
        <div className="relative z-20 flex flex-col items-center p-4 text-center">
            <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                alt="Logo Studio 57 Arquitetura e Incorporação"
                width={500}
                height={125}
                className="w-full max-w-xs md:max-w-md object-contain mb-4 filter invert"
                priority
                style={{ filter: 'invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.7))' }} // Sombra na logo para legibilidade
            />
            {/* O PORQUÊ DA MUDANÇA:
                - Adicionamos a classe 'uppercase' para deixar o texto em caixa alta.
                - Adicionamos 'tracking-widest' para aumentar o espaçamento entre as letras.
                - Mantivemos a sombra no texto para garantir a legibilidade sobre a imagem pura. */}
            <h1 className={`${montserrat.className} text-2xl md:text-3xl font-light uppercase tracking-widest`} style={{ textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)' }}>
                excelência em cada detalhe
            </h1>
        </div>
      </section>

      {/* 2. SEÇÃO DE PILARES (SERVIÇOS) */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nossos Pilares</h2>
          <p className="max-w-3xl mx-auto text-gray-600 mb-12">Da concepção à entrega, oferecemos soluções completas e integradas.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8"><FontAwesomeIcon icon={faCube} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Arquitetura BIM</h3><p className="text-gray-600">Criamos modelos 3D inteligentes que permitem visualizar cada detalhe do projeto antes da construção, garantindo precisão absoluta.</p></div>
            <div className="p-8"><FontAwesomeIcon icon={faPuzzlePiece} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Compatibilização</h3><p className="text-gray-600">Integramos projetos de arquitetura e engenharia para eliminar conflitos, otimizar processos e garantir uma execução de obra sem surpresas.</p></div>
            <div className="p-8"><FontAwesomeIcon icon={faBuilding} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Incorporação</h3><p className="text-gray-600">Desenvolvemos empreendimentos desde a análise de viabilidade até a entrega final, criando oportunidades de investimento sólidas e rentáveis.</p></div>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO DO PORTFÓLIO */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">Projetos em Destaque</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group relative overflow-hidden rounded-lg shadow-lg"><Image src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png" alt="Fachada Residencial Alfa" width={800} height={600} className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"><span className="text-white text-2xl font-bold">Residencial Alfa</span></div></div>
            <div className="group relative overflow-hidden rounded-lg shadow-lg"><Image src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png" alt="Área Gourmet" width={800} height={600} className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"><span className="text-white text-2xl font-bold">Áreas de Lazer</span></div></div>
          </div>
          <div className="mt-12"><Link href="/empreendimentosstudio" className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity text-lg">Ver Todos os Projetos</Link></div>
        </div>
      </section>
    </>
  );
}
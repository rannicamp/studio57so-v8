// Caminho: app/(landingpages)/page.js
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faPuzzlePiece, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { Montserrat } from 'next/font/google';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
});

// --- DADOS DOS EMPREENDIMENTOS COM LOGOS ---
const empreendimentosData = [
  {
    id: 1,
    nome: 'Residencial Alfa',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png',
    // Logo do Alfa
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png',
    descricao: 'Apartamentos de 49 e 58m² no Alto Esplanada. Alta rentabilidade e valorização garantida.',
    link: '/residencialalfa',
  },
  {
    id: 2,
    nome: 'Beta Suítes',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png',
    // Logo do Beta
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png',
    descricao: 'Suítes de 23 a 32m² no Alto Esplanada. Investimento inteligente com foco em renda passiva.',
    link: '/betasuites',
  },
  {
    id: 3,
    nome: 'Refúgio Braúnas',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png',
    // Logo do Braúnas
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/LOGO-P_1760619039077.png',
    descricao: 'Lotes de 1.000m² a 10 minutos do centro. O espaço ideal para sua chácara dos sonhos.',
    link: '/refugiobraunas',
  },
];

export default function HomePage() {
  return (
    <>
      <style jsx global>{`
        .empreendimento-swiper .swiper-button-next,
        .empreendimento-swiper .swiper-button-prev {
            color: #45301f !important;
        }
        .empreendimento-swiper .swiper-pagination-bullet-active {
            background-color: #45301f !important;
        }
      `}</style>
      
      <section className="relative min-h-[calc(100vh-74px)] flex items-center justify-center bg-black text-white overflow-hidden">
        <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759095131611.png"
            alt="Interior de um empreendimento de alto padrão"
            layout="fill"
            objectFit="cover"
            className="z-0 opacity-60"
            priority
        />
        <div className="absolute bottom-0 left-0 w-[45%] max-w-xs sm:max-w-sm md:w-1/3 md:max-w-md z-20">
            <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759096504604.png"
                alt="Especialista Studio 57"
                width={600}
                height={900}
                className="w-full h-auto"
                priority
            />
        </div>
        <div className="relative z-20 flex flex-col items-center p-4">
            <div className="w-full max-w-xs md:max-w-md drop-shadow-2xl">
                <Image
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                    alt="Logo Studio 57 Arquitetura e Incorporação"
                    width={500}
                    height={125}
                    className="w-full h-auto object-contain mb-4"
                    priority
                />
                <h1 className={`${montserrat.className} text-base md:text-lg font-light uppercase tracking-widest text-white text-center drop-shadow-md`}>
                    excelência em cada detalhe
                </h1>
            </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-50">
        <div className="w-full px-6">
            <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Nossos Empreendimentos</h2>
            </div>
            <Swiper
                className="empreendimento-swiper"
                modules={[Pagination, Navigation]}
                spaceBetween={30}
                slidesPerView={1}
                navigation
                pagination={{ clickable: true }}
                breakpoints={{
                    768: {
                        slidesPerView: 2,
                    },
                    1024: {
                        slidesPerView: 3,
                    },
                }}
            >
                {empreendimentosData.map((empreendimento) => (
                    <SwiperSlide key={empreendimento.id}>
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full transform transition hover:scale-105 duration-300 group">
                            {/* Container da Imagem com Logo Sobreposta */}
                            <div className="relative w-full aspect-video">
                                {/* Imagem de Fundo */}
                                <Image 
                                    src={empreendimento.imagemUrl}
                                    alt={`Imagem do ${empreendimento.nome}`}
                                    layout="fill"
                                    objectFit="cover"
                                    className="transition-transform duration-700 group-hover:scale-110"
                                />
                                {/* Overlay Escuro para destacar a Logo */}
                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors duration-300"></div>
                                
                                {/* Logo Centralizada */}
                                <div className="absolute inset-0 flex items-center justify-center p-8">
                                    <div className="relative w-full h-full max-w-[200px] max-h-[100px]">
                                        <Image
                                            src={empreendimento.logoUrl}
                                            alt={`Logo ${empreendimento.nome}`}
                                            layout="fill"
                                            objectFit="contain"
                                            className="drop-shadow-xl filter brightness-0 invert opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-grow text-center">
                                {/* Removi o H3 do nome pois a logo já diz quem é */}
                                <p className="text-gray-600 mt-2 mb-4 flex-grow text-sm">{empreendimento.descricao}</p>
                                <Link href={empreendimento.link} className="inline-block mt-auto bg-gray-900 text-white font-bold py-3 px-6 rounded-full hover:bg-gray-700 transition-colors text-center uppercase text-sm tracking-wide">
                                    Saiba Mais
                                </Link>
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="w-full px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nossos Pilares</h2>
          <p className="max-w-3xl mx-auto text-gray-600 mb-12">Da concepção à entrega, oferecemos soluções completas e integradas.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center hover:shadow-xl transition-shadow"><FontAwesomeIcon icon={faCube} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Arquitetura BIM</h3><p className="text-gray-600">Criamos modelos 3D inteligentes que permitem visualizar cada detalhe do projeto antes da construção, garantindo precisão absoluta.</p></div>
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center hover:shadow-xl transition-shadow"><FontAwesomeIcon icon={faPuzzlePiece} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Compatibilização</h3><p className="text-gray-600">Integramos projetos de arquitetura e engenharia para eliminar conflitos, otimizar processos e garantir uma execução de obra sem surpresas.</p></div>
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center hover:shadow-xl transition-shadow"><FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Incorporação</h3><p className="text-gray-600">Desenvolvemos empreendimentos desde a análise de viabilidade até a entrega final, criando oportunidades de investimento sólidas e rentáveis.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
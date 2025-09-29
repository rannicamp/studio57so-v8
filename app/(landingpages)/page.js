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

const empreendimentosData = [
  {
    id: 1,
    nome: 'Residencial Alfa',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png',
    descricao: 'Apartamentos de 49 e 58m² no Alto Esplanada em Governador Valadares.',
    link: '/residencialalfa',
  },
  // Você pode adicionar um novo empreendimento aqui no futuro.
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
            className="z-0"
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
            <div className="w-full max-w-xs md:max-w-md">
                <Image
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                    alt="Logo Studio 57 Arquitetura e Incorporação"
                    width={500}
                    height={125}
                    className="w-full h-auto object-contain mb-4"
                    priority
                />
                <h1 className={`${montserrat.className} text-base md:text-lg font-light uppercase tracking-widest text-black text-center`} style={{ textShadow: '1px 1px 2px white' }}>
                    excelência em cada detalhe
                </h1>
            </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-6">
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
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col h-full">
                            <div className="relative w-full aspect-square">
                                <Image 
                                    src={empreendimento.imagemUrl}
                                    alt={`Imagem do ${empreendimento.nome}`}
                                    layout="fill"
                                    objectFit="contain"
                                />
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <h3 className="text-2xl font-bold text-gray-900">{empreendimento.nome}</h3>
                                <p className="text-gray-600 mt-2 mb-4 flex-grow">{empreendimento.descricao}</p>
                                {/* O PORQUÊ DA MUDANÇA: 
                                    Trocamos 'bg-primary' por 'bg-gray-900' para usar o cinza escuro.
                                    Adicionamos um efeito de hover para clarear um pouco ao passar o mouse. */}
                                <Link href={empreendimento.link} className="inline-block mt-auto bg-gray-900 text-white font-bold py-2 px-6 rounded-full hover:bg-gray-700 transition-colors text-center">
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
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nossos Pilares</h2>
          <p className="max-w-3xl mx-auto text-gray-600 mb-12">Da concepção à entrega, oferecemos soluções completas e integradas.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* O PORQUÊ DA MUDANÇA: Trocamos 'text-primary' por 'text-gray-900' nos 3 ícones abaixo. */}
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center"><FontAwesomeIcon icon={faCube} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Arquitetura BIM</h3><p className="text-gray-600">Criamos modelos 3D inteligentes que permitem visualizar cada detalhe do projeto antes da construção, garantindo precisão absoluta.</p></div>
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center"><FontAwesomeIcon icon={faPuzzlePiece} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Compatibilização</h3><p className="text-gray-600">Integramos projetos de arquitetura e engenharia para eliminar conflitos, otimizar processos e garantir uma execução de obra sem surpresas.</p></div>
            <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center"><FontAwesomeIcon icon={faBuilding} className="text-5xl text-gray-900 mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Incorporação</h3><p className="text-gray-600">Desenvolvemos empreendimentos desde a análise de viabilidade até a entrega final, criando oportunidades de investimento sólidas e rentáveis.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
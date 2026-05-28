// Caminho: app/(landingpages)/residencialalfa/ResidencialAlfaClient.js
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Roboto, Montserrat } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  faRulerCombined, faBed, faBath, faCouch, faElevator, faCar,
  faHospital, faGraduationCap, faCity, faCartShopping, faUtensils, faLocationDot,
  faSchool, faHouseMedical, faUsers, faLandmark, faXmark, faQuoteLeft,
  faSwimmingPool, faChartLine, faSackDollar, faCheck, faBuilding, faAward,
  faWater, faGear, faHammer
} from '@fortawesome/free-solid-svg-icons';

// Importações do Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Navigation } from 'swiper/modules';

// Importação dos estilos do Swiper
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// Import do Formulário de Contato
import FormularioDeContato from './FormularioDeContato';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '700', '900'],
});

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

// --- CONFIGURAÇÕES VISUAIS DO ALFA ---
const primaryColor = '#45301f'; // Marrom terra característico do Alfa
const accentColor = '#bfa084';  // Creme/dourado luxuoso para contrastes em fundo dark

// --- DADOS DO PORTFÓLIO DE EMPREENDIMENTOS ---
const empreendimentosPortfolio = [
  {
    nome: 'Residencial Alfa',
    status: 'EM EXECUÇÃO',
    statusColor: 'bg-green-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png',
    descricao: 'Apartamentos de 49 e 58m² no Alto Esplanada. Alta rentabilidade e valorização garantida.',
    link: '/residencialalfa'
  },
  {
    nome: 'Beta Suítes',
    status: 'PRÉ-LANÇAMENTO',
    statusColor: 'bg-blue-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg',
    descricao: 'Suítes de 23 a 32m² no Alto Esplanada. Investimento inteligente focado em renda passiva.',
    link: '/betasuites'
  },
  {
    nome: 'Refúgio Braúnas',
    status: 'CONCLUÍDO',
    statusColor: 'bg-[#2c5234]',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png',
    descricao: 'Lotes de 1.000m² a 10 minutos do centro com infraestrutura concluída e matriculados.',
    link: '/refugiobraunas'
  },
  {
    nome: 'Residencial Pero Vaz',
    status: 'PRONTO PARA MORAR',
    statusColor: 'bg-indigo-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649407.jpeg',
    descricao: 'Apartamento térreo de 2 quartos no Jardim Vera Cruz. Saia do aluguel hoje mesmo!',
    link: '/perovaz'
  }
];

// --- DADOS DA GALERIA 3D ---
const galleryImages = [
  { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png', alt: 'Fachada do Residencial Alfa' },
  { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png', alt: 'Área gourmet do Residencial Alfa' },
  { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018987365.png', alt: 'Área gourmet com vista para a cidade' },
  { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019021635.png', alt: 'Visão ampla da área gourmet' },
  { id: 5, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019089329.png', alt: 'Sala de TV e cozinha integradas' },
  { id: 6, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019116881.png', alt: 'Vista da sala de TV e cozinha' },
  { id: 7, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019141502.png', alt: 'Cozinha e área de serviço' },
  { id: 8, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019211163.png', alt: 'Sala de TV e Jantar' },
  { id: 9, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019255355.png', alt: 'Sala de TV decorada' },
  { id: 10, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019299839.png', alt: 'Quarto do apartamento de 49m²' },
  { id: 11, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019368515.png', alt: 'Quarto do apartamento de 58m²' },
  { id: 12, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019528512.png', alt: 'Segundo quarto decorado' },
];

// --- DADOS DAS FOTOS REAIS DA OBRA ---
const obrasImages = [
  { id: 1, src: '/fotos_alfa/alfa_cinematic_1_real.jpg', alt: 'Estrutura do Residencial Alfa vista da ladeira do Alto Esplanada' },
  { id: 2, src: '/fotos_alfa/alfa_cinematic_2_real.jpg', alt: 'Fachada traseira mostrando a alvenaria avançando e vegetação no entorno' },
  { id: 3, src: '/fotos_alfa/alfa_cinematic_3_real.jpg', alt: 'Vista frontal em contra-plongée com banner institucional da Studio 57' },
  { id: 4, src: '/fotos_alfa/alfa_cinematic_4_real.jpg', alt: 'Canteiro de obras ativo com estoque de blocos de alvenaria e operários' },
  { id: 5, src: '/fotos_alfa/alfa_cinematic_5_real.jpg', alt: 'Área do térreo/almoxarifado mostrando organização interna de insumos' },
  { id: 6, src: '/fotos_alfa/alfa_cinematic_6_real.jpg', alt: 'Fachada traseira e fundos destacando a concretagem e fundações em andamento' },
  { id: 7, src: '/fotos_alfa/alfa_cinematic_7_real.jpg', alt: 'Primeira visão interna do pavimento tipo com infraestrutura e pilares estruturais' },
  { id: 8, src: '/fotos_alfa/alfa_cinematic_8_real.jpg', alt: 'Segunda visão interna do pavimento tipo detalhando a concretagem das lajes e escoramentos' }
];

// --- DEPOIMENTOS REAIS ---
const testimonialsData = [
  {
    id: 1,
    name: "Beto Monte Alto",
    title: "Investidor Imobiliário",
    photoUrl: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759066935276.png",
    intro: "O Residencial Alfa se destaca como uma das melhores oportunidades do mercado.",
    fullText: "Com décadas de experiência como corretor e investidor, posso afirmar com segurança que o Residencial Alfa se destaca como uma das melhores oportunidades do mercado, com grande potencial de valorização no cenário imobiliário de Governador Valadares."
  },
  {
    id: 2,
    name: "Rogério Paiva",
    title: "Empreendedor",
    photoUrl: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759067740495.png",
    intro: "Para mim, o Residencial Alfa não é apenas um apartamento, é um investmento estratégico.",
    fullText: "Para mim, o Residencial Alfa não é apenas um apartamento, é um investimento estratégico no futuro das minhas filhas, combinando localização premium, qualidade construtiva e, o mais importante, segurança e potencial de valorização a longo prazo."
  }
];

// --- PLANTAS E PAVIMENTOS (CORRIGIDOS PARA TÉRREO E PAVIMENTO 1) ---
const pavimentosInfo = [
  {
    id: 1,
    subtitle: 'Acesso Seguro & Garagem',
    title: 'Pavimento',
    strongTitle: 'Térreo',
    text: 'A primeira impressão que consolida o valor do imóvel. O Residencial Alfa conta com eclusa de segurança para controle de acesso eficiente, garagem ampla estruturada com vãos livres otimizados e uma Loja Comercial de 71,24m² privativos que valoriza a entrada do condomínio.',
    features: [
      { name: 'Controle de Acesso Inteligente', desc: 'Sistemas preparados para portaria remota e alta segurança.' },
      { name: 'Loja Comercial no Térreo', desc: 'Disponível para venda. Excelente ponto comercial para comércio local.' }
    ],
    src: "/fotos_alfa/terreo.png",
    alt: 'Planta Humanizada Térreo'
  },
  {
    id: 2,
    subtitle: 'Lazer Completo & Vista Privilegiada',
    title: 'Pavimento',
    strongTitle: '1 (Lazer)',
    text: 'O lazer do Residencial Alfa fica localizado no Pavimento 1. Um espaço integrado de 133m² com piscina, deck de descanso e área gourmet decorada com capacidade oficial para receber até 88 pessoas, mantendo total integração com a vista definitiva para a Ibituruna.',
    features: [
      { name: 'Piscina & Deck no Pavimento 1', desc: 'Diversão e relaxamento com a melhor insolação e ventilação natural.' },
      { name: 'Espaço Gourmet Mobiliado', desc: 'Perfeito para celebrações familiares, mantendo a privacidade dos apartamentos.' }
    ],
    src: "/fotos_alfa/pav_1.png",
    alt: 'Planta Humanizada Pavimento 1'
  },
  {
    id: 3,
    subtitle: 'Apartamentos Confortáveis',
    title: 'Pavimento',
    strongTitle: 'Tipo',
    text: 'Os apartamentos do Residencial Alfa oferecem plantas inteligentes de 49m² (Tipo 2) e 58m² (Tipo 1) com 2 quartos. Graças à tecnologia de lajes nervuradas de concreto armado adotada pela Studio 57, a planta é totalmente livre de pilares internos limitadores, permitindo reconfiguração ou até mesmo a junção de duas unidades para criar uma residência duplex.',
    features: [
      { name: 'Unidades Tipo 1 (58,86m²)', desc: 'Finais 01 e 02. Espaço de convivência ampliado com ótima ventilação.' },
      { name: 'Unidades Tipo 2 (49,76m²)', desc: 'Finais 03 e 04. Planejamento milimétrico focado no custo-benefício.' }
    ],
    src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta%20humanizada%20aps.png",
    alt: 'Planta Humanizada Pavimento Tipo'
  }
];

// --- LOCALIZAÇÃO ---
const locationPoints = [
  { name: 'Residencial Alfa', time: 'Ponto de partida', icon: faLocationDot, highlight: true },
  { name: 'Maple Bear', time: '1 min', icon: faSchool },
  { name: 'Casa Unimed', time: '2 min', icon: faHouseMedical },
  { name: 'UFJF-GV', time: '2 min', icon: faGraduationCap },
  { name: 'Clube Filadélfia', time: '4 min', icon: faUsers },
  { name: 'Hospital São Lucas', time: '5 min', icon: faHospital },
  { name: 'Supermercado Big Mais / Coelho Diniz', time: '5 min', icon: faCartShopping },
];

const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeSeguranca = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;
const IconeLaje = () => <svg fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function ResidencialAlfaClient() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedTestimonial, setExpandedTestimonial] = useState(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  const openModal = (imageUrl) => setSelectedImage(imageUrl);
  const closeModal = () => setSelectedImage(null);
  const openLeadModal = () => setIsLeadModalOpen(true);
  const closeLeadModal = () => setIsLeadModalOpen(false);

  const handleToggleTestimonial = (id) => {
    setExpandedTestimonial(expandedTestimonial === id ? null : id);
  };

  return (
    // FUNDO GERAL CLARO PREMIUM
    <div className={`${montserrat.className} bg-white text-neutral-800`}>

      <style jsx global>{`
        /* Estilos Customizados para o Swiper Light/Glass */
        .swiper-button-next,
        .swiper-button-prev {
          color: #000000 !important;
          background-color: rgba(0, 0, 0, 0.05);
          border-radius: 50%;
          width: 40px !important;
          height: 40px !important;
          transition: all 0.3s ease;
          border: 1px solid rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(4px);
        }
        .swiper-button-next:hover,
        .swiper-button-prev:hover {
          background-color: ${primaryColor};
          color: #ffffff !important;
          border-color: ${accentColor};
        }
        .swiper-pagination-bullet {
          background-color: #000000 !important;
          width: 10px !important;
          height: 10px !important;
          opacity: 0.3;
        }
        .swiper-pagination-bullet-active {
          background-color: ${primaryColor} !important;
          opacity: 1;
        }
        .gallery-swiper .swiper-slide {
          width: 60% !important;
        }
        .gallery-swiper .swiper-slide-prev,
        .gallery-swiper .swiper-slide-next {
          width: 45% !important;
        }
        .floorplan-full-swiper .swiper-slide {
          width: 100% !important;
        }
        ::selection {
          background-color: ${primaryColor};
          color: white;
        }
        @media (min-width: 768px) {
          .gallery-swiper .swiper-slide {
            width: 45% !important;
          }
          .gallery-swiper .swiper-slide-prev,
          .gallery-swiper .swiper-slide-next {
            width: 35% !important;
          }
        }
      `}</style>

      {/* --- HERO SECTION COM IMAGEM E DETALHES DE URGÊNCIA --- */}
      <section className="relative min-h-screen flex items-center justify-center bg-white text-neutral-900 overflow-hidden">
        <div
          className="absolute inset-0 bg-no-repeat bg-center z-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/capa%20vazia2.png')",
            backgroundSize: 'cover',
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/50 to-white/95 z-10"></div>
        
        <div className="relative z-30 flex flex-col items-center justify-center p-4 w-full h-full min-h-screen">
          <div className="flex flex-col items-stretch w-full max-w-[340px] sm:max-w-[480px] md:max-w-[600px] lg:max-w-[700px] mx-auto -mt-12 text-center">
            
            {/* BADGE DE ESCASSEZ/URGÊNCIA COM PULSAR */}
            <div className="w-full flex justify-center mb-6">
              <span className="inline-flex items-center gap-2 bg-red-600/90 backdrop-blur-sm border border-red-500 text-white text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase px-5 py-2 rounded-full shadow-lg animate-pulse">
                🚨 restam apenas 3 unidades no estoque
              </span>
            </div>

            {/* LOGO DO RESIDENCIAL ALFA */}
            <div className="mb-4 w-full flex justify-center">
              <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png"
                alt="Residencial Alfa Logo"
                width={500}
                height={160}
                className="w-[280px] sm:w-[380px] md:w-[460px] h-auto object-contain drop-shadow-md filter brightness-0"
                priority
              />
            </div>

            {/* SUBTÍTULO E LOCALIZAÇÃO */}
            <p className="text-center w-full text-[10px] sm:text-xs md:text-sm font-bold text-neutral-600 drop-shadow-sm uppercase tracking-[0.4em] sm:tracking-[0.5em] md:tracking-[0.6em] mb-4">
              Alto Esplanada • Governador Valadares
            </p>

            <h1 className={`${roboto.className} text-center w-full text-[1.3rem] sm:text-3xl md:text-4xl lg:text-[2.8rem] whitespace-nowrap font-light text-neutral-900 drop-shadow-md tracking-[0.05em] sm:tracking-[0.1em] md:tracking-[0.15em] leading-tight mb-8 px-1`}>
              Apartamentos de <span className="font-semibold" style={{ color: primaryColor }}>49 e 58m²</span>
            </h1>

            {/* PILL ALONGADA DE INFORMAÇÕES */}
            <div 
              onClick={openLeadModal}
              className="w-full bg-black/5 backdrop-blur-md border border-black/10 py-5 rounded-xl flex justify-center items-center shadow-md transition-all hover:bg-black/10 cursor-pointer group"
            >
              <p className="text-xs sm:text-base md:text-lg font-light text-neutral-700 uppercase tracking-[0.15em] group-hover:text-black">
                Mais de <strong className="font-bold text-black tracking-wider">85% vendido</strong> • Garanta já a sua unidade
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={openLeadModal}
                className="inline-block bg-neutral-900 text-white font-bold py-4 px-10 rounded-xl hover:bg-neutral-800 transition-all duration-300 shadow-xl uppercase tracking-wide text-xs sm:text-sm"
              >
                Solicitar Tabela e Book Completo
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* --- CONCEITO E DIFERENCIAIS (Split-Screen) --- */}
      <section className="flex flex-col lg:flex-row-reverse min-h-[100vh] bg-white relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        
        <div className="w-full lg:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative z-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] mb-2" style={{ color: primaryColor }}>Foco em Conforto e Rentabilidade</span>
          <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-neutral-500 mb-6 tracking-[0.1em] md:tracking-[0.15em]`}>
            Investimento <strong className="font-bold text-neutral-900">Consolidado</strong>
          </h2>
          <p className="text-neutral-700 text-base md:text-lg mb-8 leading-relaxed">
            O **Residencial Alfa** é a melhor oportunidade no nobre Alto Esplanada. Planejado para quem busca valorização sólida de patrimônio e a melhor rentabilidade de locação por temporada da região.<br /><br />
            <span className="font-bold text-neutral-900">Retorno Estimado por Temporada:</span> O estudo de viabilidade aponta rendimento de até <strong className="text-neutral-900 text-xl">R$ 4.144,25 por mês</strong> no Airbnb, considerando diária média de R$ 197,25 e cenário conservador de ocupação de 70%.
          </p>

          {/* Grid de Diferenciais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-5 bg-black/5 backdrop-blur-sm rounded-xl border border-black/10 hover:bg-black/10 transition-colors">
              <div className="mb-3 text-neutral-800"><IconeLocalizacao /></div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">Localização Elevada</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">Alto Esplanada: livre de enchentes, seguro e próximo à UFJF-GV e hospitais.</p>
            </div>

            <div className="p-5 bg-black/5 backdrop-blur-sm rounded-xl border border-black/10 hover:bg-black/10 transition-colors">
              <div className="mb-3 text-neutral-800"><IconeRentabilidade /></div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">Rentabilidade Premium</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">Alta liquidez e constante fluxo de locação por turismo de voo livre e negócios.</p>
            </div>

            <div className="p-5 bg-black/5 backdrop-blur-sm rounded-xl border border-black/10 hover:bg-black/10 transition-colors">
              <div className="mb-3 text-neutral-800"><IconeSeguranca /></div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">Vista da Ibituruna</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">Vista definitiva e deslumbrante para a maior atração turística da cidade.</p>
            </div>

            <div className="p-5 bg-black/5 backdrop-blur-sm rounded-xl border border-black/10 hover:bg-black/10 transition-colors">
              <div className="mb-3 text-neutral-800"><IconeLaje /></div>
              <h3 className="font-bold text-neutral-900 text-sm mb-1">Laje Nervurada</h3>
              <p className="text-neutral-600 text-xs leading-relaxed">Apartamentos sem pilares internos limitadores, facilitando a customização.</p>
            </div>
          </div>

          <button
            onClick={openLeadModal}
            className="inline-block w-full sm:w-auto text-center bg-black/10 backdrop-blur-md border border-black/20 text-black font-bold py-4 px-10 rounded-xl hover:bg-black/15 transition-all duration-300 shadow-md uppercase tracking-wide text-xs"
          >
            Quero Mais Informações
          </button>
        </div>

        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png"
            alt="Residencial Alfa Fachada Nobre"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent lg:bg-gradient-to-l lg:from-white lg:via-white/20 lg:to-transparent"></div>
        </div>
      </section>

      {/* --- SEÇÃO RENTABILIDADE E ARQUITETURA FINANCEIRA (REGRA DE FLUXO 20/40/40 ATUALIZADA) --- */}
      <section className="bg-white py-16 md:py-24 relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between p-4 md:p-12 gap-12">

            {/* Lado Esquerdo: Descrição e Botão */}
            <div className="w-full lg:w-1/2 pr-0 lg:pr-12">
              <span className="text-xs font-bold uppercase tracking-[0.3em] mb-2 block" style={{ color: primaryColor }}>Facilidade de Aquisição Sem Descapitalização</span>
              <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-neutral-500 mb-6 tracking-[0.1em] md:tracking-[0.15em] uppercase`}>
                Arquitetura <strong className="font-bold text-neutral-900">Financeira</strong>
              </h2>
              <p className="text-neutral-700 text-base md:text-lg leading-relaxed text-justify mb-8">
                Invista com inteligência sem descapitalizar o seu negócio. Adotamos o modelo de fluxo de pagamento **20/40/40**, oferecendo alta flexibilidade durante a construção, com parcelas mensais suaves de obra e o saldo de chaves podendo ser quitado com financiamento em qualquer instituição financeira de sua livre escolha.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/RLT_1759011023928.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-black/5 backdrop-blur-sm border border-black/10 text-black font-bold py-4 px-8 rounded-xl hover:bg-black/10 transition-colors shadow-md text-xs tracking-wider"
                >
                  <FontAwesomeIcon icon={faChartLine} className="mr-2" />
                  Estudo de Rentabilidade (PDF)
                </a>
              </div>
            </div>

            {/* Lado Direito: Grid Explicativo do Fluxo 20/40/40 */}
            <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-3 gap-8 justify-center items-stretch border-l border-black/10 pl-0 lg:pl-12">
              {/* 20% Entrada */}
              <div className="text-center sm:text-left border-l-4 sm:border-l-0 sm:border-t sm:border-black/20 pt-0 sm:pt-4 pl-4 sm:pl-0">
                <p className="text-sm font-bold tracking-[0.15em] uppercase mb-1" style={{ color: primaryColor }}>Entrada</p>
                <p className="text-neutral-900 text-5xl md:text-6xl font-light tracking-tighter mb-2">20%</p>
                <p className="text-neutral-600 text-[10px] uppercase tracking-wider leading-relaxed">Sinal facilitado no fechamento do contrato.</p>
              </div>

              {/* 40% Durante a Obra */}
              <div className="text-center sm:text-left border-l-4 sm:border-l-0 sm:border-t sm:border-black/20 pt-0 sm:pt-4 pl-4 sm:pl-0">
                <p className="text-sm font-bold tracking-[0.15em] uppercase mb-1" style={{ color: primaryColor }}>Mensais</p>
                <p className="text-neutral-900 text-5xl md:text-6xl font-light tracking-tighter mb-2">40%</p>
                <p className="text-neutral-600 text-[10px] uppercase tracking-wider leading-relaxed">Parcelado em até 36x durante as obras.</p>
              </div>

              {/* 40% Chaves / Financiamento */}
              <div className="text-center sm:text-left border-l-4 sm:border-l-0 sm:border-t sm:border-black/20 pt-0 sm:pt-4 pl-4 sm:pl-0">
                <p className="text-sm font-bold tracking-[0.15em] uppercase mb-1" style={{ color: primaryColor }}>Chaves</p>
                <p className="text-neutral-900 text-5xl md:text-6xl font-light tracking-tighter mb-2">40%</p>
                <p className="text-neutral-600 text-[10px] uppercase tracking-wider leading-relaxed">Financiado via instituição financeira.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- LOCALIZAÇÃO (Split-Screen) --- */}
      <section className="flex flex-col lg:flex-row min-h-[80vh] bg-white relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        
        <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center relative z-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] mb-2" style={{ color: primaryColor }}>Privilégio do Alto Esplanada</span>
          <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-neutral-500 mb-12 tracking-[0.1em] md:tracking-[0.15em]`}>
            Localização <strong className="font-bold text-neutral-900">Privilegiada</strong>
          </h2>
          <div className="relative max-w-sm">
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-black/20"></div>
            {locationPoints.map((point, index) => (
              <div key={index} className={`relative pl-10 ${index === locationPoints.length - 1 ? '' : 'pb-8'}`}>
                <div className={`absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm ${point.highlight ? 'bg-black' : 'bg-black/20'}`}
                ></div>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={point.icon} className={`text-2xl mr-4 ${point.highlight ? 'text-black' : 'text-neutral-400'}`} />
                  <div>
                    <p className={`font-bold ${point.highlight ? 'text-neutral-900 text-lg' : 'text-neutral-500'}`}>
                      {point.name}
                    </p>
                    <p className="text-sm text-neutral-400">{point.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759017559883.png"
            alt="Localização Real do Residencial Alfa"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-white/20 to-transparent lg:bg-gradient-to-r lg:from-white lg:via-white/20 lg:to-transparent"></div>
          <p className="absolute bottom-4 left-4 right-4 text-center text-xs text-neutral-600 italic z-20 drop-shadow-sm">
            Perspectiva ilustrativa de inserção no local real da obra.
          </p>
        </div>
      </section>

      {/* --- MAPA DO GOOGLE MAPS CORRIGIDO --- */}
      <section className="bg-white pt-16 md:pt-24 pb-16 md:pb-24 relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="w-full px-4 text-center">
          <h2 className={`${roboto.className} text-3xl md:text-4xl font-light text-neutral-500 mb-4 tracking-tight`}>
            Explore no <strong className="font-bold text-neutral-900">Mapa</strong>
          </h2>
          <p className="max-w-2xl mx-auto mb-8 text-neutral-500 text-sm">
            Localização e rota do empreendimento a partir do Centro.
          </p>
          <div className="w-full h-96 rounded-xl shadow-md overflow-hidden border border-black/10 max-w-[1200px] mx-auto">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d7446.222001312552!2d-41.94300369753734!3d-18.848790756994234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0xb1a714d59a2e33%3A0x35d5a5b96d26169a!2sALFA!3m2!1d-18.8439779!2d-41.9396746!4m5!1s0xb1a709333008ad%3A0x9757bf086fe8a009!2sPra%C3%A7a%20Serra%20Lima%2C%20Av.%20Minas%20Gerais%2C%20588%20-%20Centro%2C%20Gov.%20Valadares%20-%20MG%2C%2035010-150!3m2!1d-18.854164!2d-41.946112!5e1!3m2!1spt-BR!2sbr!4v1779984242356!5m2!1spt-BR!2sbr"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>

      {/* --- PLANTAS E PAVIMENTOS (SWIPER AJUSTADO COM LARGURA MÁXIMA E PADDING MENOR) --- */}
      <section className="bg-white border-t border-black/10 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-25"></div>
        
        <Swiper
          slidesPerView={1}
          loop={true}
          pagination={{ clickable: true, dynamicBullets: true }}
          navigation={true}
          modules={[Pagination, Navigation]}
          className="floorplan-full-swiper w-full"
        >
          {pavimentosInfo.map((plan) => (
            <SwiperSlide key={plan.id}>
              <div className="flex flex-col lg:flex-row w-full min-h-[100vh] bg-neutral-50">
                
                {/* LADO TEXTO */}
                <div className="w-full lg:w-[35%] p-8 md:p-12 lg:p-16 flex flex-col justify-center border-t lg:border-t-0 lg:border-r border-black/10 z-20 order-2 lg:order-1 bg-neutral-50 relative">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: primaryColor }}>{plan.subtitle}</span>
                  <h2 className={`${roboto.className} text-4xl lg:text-5xl font-light text-neutral-500 mb-6 tracking-[0.1em] leading-tight`}>
                    {plan.title} <strong className="font-bold text-neutral-900">{plan.strongTitle}</strong>
                  </h2>
                  
                  <p className="text-neutral-700 text-sm md:text-base mb-8 leading-relaxed text-justify">
                    {plan.text}
                  </p>

                  <ul className="space-y-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx}>
                        <h3 className="font-bold text-neutral-900 text-xs uppercase tracking-wider mb-1">{feat.name}</h3>
                        <p className="text-neutral-600 text-[11px] md:text-xs leading-relaxed">{feat.desc}</p>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-12 lg:hidden text-center opacity-50">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-900">⟵ Deslize para ver os outros pavimentos ⟶</p>
                  </div>
                </div>

                {/* LADO PLANTA (AJUSTADO PARA LARGURA MÁXIMA E PADDINGS MENORES) */}
                <div 
                  className="w-full lg:w-[65%] relative min-h-[50vh] lg:min-h-[100vh] bg-white p-4 lg:p-6 flex flex-col items-center justify-center cursor-pointer order-1 lg:order-2 group"
                  onClick={() => openModal(plan.src)}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#45301f]/5 via-transparent to-transparent pointer-events-none z-0"></div>
                  
                  {/* ALAVANCANDO A IMAGEM NA HORIZONTAL COM max-w-full lg:max-w-[96%] e min-h maior */}
                  <div className="relative w-full max-w-full lg:max-w-[96%] h-full min-h-[45vh] lg:min-h-[85vh] rounded-xl overflow-hidden z-10 transition-transform duration-500 group-hover:scale-[1.01]">
                    <Image
                      src={plan.src}
                      alt={plan.alt}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 65vw"
                    />
                    
                    <div className="absolute bottom-4 right-4 bg-white/70 backdrop-blur-md border border-black/20 text-black rounded-full p-3 opacity-70 group-hover:opacity-100 transition-opacity">
                      <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path><path fillRule="evenodd" d="M8 6a1 1 0 011 1v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V10H6a1 1 0 110-2h1V7a1 1 0 011-1z" clipRule="evenodd"></path></svg>
                    </div>
                  </div>

                  <p className="absolute bottom-6 right-8 text-neutral-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
                    *Toque na imagem para ampliar.
                  </p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* --- GALERIA DE RENDERS 3D --- */}
      <section className="bg-white py-16 md:py-24 relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="w-full px-4">
          <span className="text-xs font-bold uppercase tracking-[0.3em] mb-2 block text-center" style={{ color: primaryColor }}>Perspectivas Ilustrativas de Luxo</span>
          <h2 className={`${roboto.className} text-3xl md:text-5xl font-light text-center text-neutral-500 mb-12 tracking-[0.1em] md:tracking-[0.15em]`}>
            Projeto <strong className="font-bold text-neutral-900">Visual 3D</strong>
          </h2>
          <div className="w-full">
            <Swiper
              effect={'coverflow'}
              grabCursor={true}
              centeredSlides={true}
              slidesPerView={'auto'}
              loop={true}
              coverflowEffect={{
                rotate: 50,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: true,
              }}
              pagination={{ clickable: true }}
              navigation={true}
              modules={[EffectCoverflow, Pagination, Navigation]}
              className="gallery-swiper"
            >
              {galleryImages.map((image) => (
                <SwiperSlide key={image.id}>
                  <div className="relative w-full h-64 md:h-96">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-lg cursor-pointer shadow-md border border-black/10"
                      onClick={() => openModal(image.src)}
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </section>

      {/* --- NOVA SEÇÃO: FOTOS DA OBRA (ACOMPANHAMENTO EM TEMPO REAL) --- */}
      <section className="bg-white py-16 md:py-24 relative border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="w-full max-w-[1200px] mx-auto px-4">
          
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.3em] mb-2 px-3 py-1 bg-black/5 border border-black/10 rounded-full" style={{ color: primaryColor }}>
              <FontAwesomeIcon icon={faHammer} className="mr-1 text-[10px]" /> Evolução Construtiva
            </span>
            <h2 className={`${roboto.className} text-3xl md:text-5xl font-light text-neutral-500 tracking-[0.1em] md:tracking-[0.15em] mb-4`}>
              Fotos da <strong className="font-bold text-neutral-900">Obra</strong>
            </h2>
            <p className="text-neutral-600 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              Transparência e excelência em engenharia. Acompanhe o progresso físico real do canteiro. A supraestrutura de concreto do prédio está **100% concluída**, com as instalações e fechamentos de alvenaria em ritmo acelerado.
            </p>
          </div>

          <div className="w-full">
            <Swiper
              effect={'coverflow'}
              grabCursor={true}
              centeredSlides={true}
              slidesPerView={'auto'}
              loop={true}
              coverflowEffect={{
                rotate: 35,
                stretch: 0,
                depth: 100,
                modifier: 1,
                slideShadows: true,
              }}
              pagination={{ clickable: true }}
              navigation={true}
              modules={[EffectCoverflow, Pagination, Navigation]}
              className="gallery-swiper"
            >
              {obrasImages.map((image) => (
                <SwiperSlide key={image.id}>
                  <div className="relative w-full h-64 md:h-[450px]">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-lg cursor-pointer shadow-md border border-black/10"
                      onClick={() => openModal(image.src)}
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-4 rounded-b-lg pointer-events-none">
                      <p className="text-white text-xs sm:text-sm font-semibold tracking-wide">{image.alt}</p>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

        </div>
      </section>

      {/* --- DEPOIMENTOS REALISTAS --- */}
      <section className="bg-white py-16 md:py-24 border-t border-black/10 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="w-full px-4 container mx-auto">
          <span className="text-xs font-bold uppercase tracking-[0.3em] mb-2 block text-center" style={{ color: primaryColor }}>Voz de Quem Confia</span>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-neutral-900 uppercase tracking-wide">
            O que nossos clientes dizem
          </h2>
          <div className="pt-12">
            <Swiper
              slidesPerView={1}
              spaceBetween={30}
              loop={true}
              pagination={{ clickable: true }}
              navigation={true}
              modules={[Pagination, Navigation]}
              className="testimonial-swiper"
              breakpoints={{
                768: { slidesPerView: 2, spaceBetween: 40 },
              }}
            >
              {testimonialsData.map((testimonial) => (
                <SwiperSlide key={testimonial.id}>
                  <div className="bg-black/5 border border-black/10 rounded-xl p-8 pt-16 shadow-md h-full flex flex-col text-center relative mt-12 backdrop-blur-md">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <Image
                        src={testimonial.photoUrl}
                        alt={testimonial.name}
                        width={96}
                        height={96}
                        className="rounded-full object-cover border-4 border-white shadow-2xl bg-white"
                      />
                    </div>

                    <div className="flex-grow">
                      <p className="font-bold text-neutral-900 text-lg mt-2">{testimonial.name}</p>
                      <p className="text-xs text-neutral-500 mb-6 uppercase tracking-wider">{testimonial.title}</p>
                      <FontAwesomeIcon icon={faQuoteLeft} className="text-2xl mb-4" style={{ color: primaryColor }} />
                      <p className="text-neutral-700 italic text-sm mb-4 leading-relaxed">{`"${testimonial.intro}"`}</p>
                      
                      <AnimatePresence>
                        {expandedTestimonial === testimonial.id && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4 }}
                            className="text-neutral-600 text-xs text-left leading-relaxed mt-4 border-t border-black/10 pt-4"
                          >
                            {testimonial.fullText}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button
                      onClick={() => handleToggleTestimonial(testimonial.id)}
                      className="font-bold self-center mt-6 hover:underline text-xs uppercase tracking-widest transition-all"
                      style={{ color: primaryColor }}
                    >
                      {expandedTestimonial === testimonial.id ? 'Ler menos' : 'Leia mais'}
                    </button>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </section>

      {/* --- FICHA TÉCNICA DO ALFA --- */}
      <section className="bg-white py-16 md:py-24 border-t border-black/10 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent"></div>
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col lg:flex-row gap-12">
          
          <div className="w-full lg:w-[35%] flex flex-col justify-center lg:border-r border-black/10 z-20">
            <span className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: primaryColor }}>Especificações Legais</span>
            <h2 className={`${roboto.className} text-3xl md:text-4xl lg:text-5xl font-light text-neutral-500 mb-6 tracking-[0.1em] leading-tight`}>
              Ficha <strong className="font-bold text-neutral-900">Técnica</strong>
            </h2>
            <p className="text-neutral-700 text-sm mb-8 leading-relaxed lg:pr-8 text-justify">
              O Residencial Alfa foi projetado sob os mais rígidos padrões estruturais da incorporação. A modelagem integrada em **BIM** assegura total precisão construtiva e baixo custo de manutenção condominial.
            </p>

            <div className="mt-4 p-6 bg-black/5 border border-black/10 rounded-xl shadow-md lg:mr-8">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1 font-bold">Incorporação e Vendas</p>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: primaryColor }}>STUDIO 57 INCORPORAÇÕES</h3>
              <div className="text-[10px] text-neutral-600 space-y-2">
                <p><strong>Registro de Incorporação:</strong> Nº 24.920/R-08 no 2º Ofício de Registro de Imóveis de Governador Valadares/MG.</p>
                <p><strong>Endereço da Obra:</strong> Avenida Dr. Sérvulo Teixeira, 725 - Alto Esplanada.</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[65%] flex flex-col justify-center relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faBuilding} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">O Empreendimento</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  Apenas 20 apartamentos residenciais divididos em 7 pavimentos, garantindo exclusividade e baixa taxa condominial.
                </p>
              </div>

              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faLocationDot} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">Localização Premium</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  Localização elevada no Alto Esplanada. Protegido de enchentes, ambiente residencial pacífico de alto padrão.
                </p>
              </div>

              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faCar} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">Vagas de Garagem</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  1 vaga de garagem coberta/semicoberta por unidade, com facilidade de manobra (laje nervurada).
                </p>
              </div>

              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faWater} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">Lazer no Pavimento 1</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  133m² de lazer localizado no Pavimento 1 com piscina, deck integrado e espaço gourmet de alta capacidade.
                </p>
              </div>

              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faAward} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">Alta Valorização</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  Média de valorização imobiliária constante desde o início das fundações, com grande potencial residual.
                </p>
              </div>

              <div className="p-5 bg-black/5 rounded-xl border border-black/5 shadow-md hover:border-black/20 transition-all">
                <div className="mb-3 text-neutral-800 text-xl"><FontAwesomeIcon icon={faGear} /></div>
                <h3 className="font-bold text-neutral-900 text-xs mb-2 uppercase tracking-wide">Tecnologia Construtiva</h3>
                <p className="text-neutral-600 text-[11px] leading-relaxed">
                  Estrutura em concreto armado de alto padrão, lajes nervuradas e alvenaria de vedação com isolamento termoacústico.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* --- MARCAS PARCEIRAS E REALIZAÇÃO --- */}
      <section className="bg-white py-20 border-t border-black/10 relative overflow-hidden">
         <div className="w-full flex flex-col items-center">
            
            <div className="flex flex-col items-center justify-center mb-16">
              <div className="w-[180px] md:w-[240px] mb-4">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Logo Studio 57"
                  className="w-full h-auto object-contain filter brightness-0 opacity-90"
                />
              </div>
              <h1 className={`${montserrat.className} text-[9px] md:text-[10px] font-light uppercase tracking-[0.4em] text-neutral-900 text-center opacity-85`}>
                excelência em cada detalhe
              </h1>
            </div>

            <p className="text-neutral-500 text-[10px] md:text-xs uppercase tracking-[0.3em] mb-10 font-bold">Projetos & Consultoria</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 px-4">
              <img src="/parceiros_beta/INTEC_png.png" alt="Intec" className="h-8 md:h-10 object-contain filter grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <img src="/parceiros_beta/BRIM Logomarca.png" alt="BRIM" className="h-8 md:h-10 object-contain filter grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <img src="/parceiros_beta/LZ ENGENHARIA.jpg" alt="LZ Engenharia" className="h-8 md:h-10 object-contain filter grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <img src="/parceiros_beta/TONZIRO.png" alt="Tonziro" className="h-8 md:h-10 object-contain filter grayscale opacity-60 hover:opacity-100 hover:grayscale-0 transition-all duration-300" />
              <img src="/parceiros_beta/logo-horizontal-04.png" alt="Planizar" className="h-10 md:h-12 object-contain filter brightness-0 opacity-60 hover:opacity-100 transition-all duration-300" />
            </div>
         </div>
      </section>

      {/* --- CTA FINAL COM ALTO IMPACTO DE ESCASSEZ --- */}
      <section className="bg-white py-20 relative overflow-hidden border-t border-black/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#45301f]/20 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-[#45301f]/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] via-white to-white pointer-events-none"></div>
        
        <div className="w-full px-4 text-center relative z-10">
          <span className="inline-block bg-red-600/90 text-white text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase px-4 py-1.5 rounded-full mb-6 shadow-md animate-pulse">
             ⚠️ ATENÇÃO: ÚLTIMAS UNIDADES
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-neutral-900 mb-6 uppercase tracking-wide">
            Garanta a Sua Unidade
          </h2>
          <p className="text-neutral-700 max-w-2xl mx-auto mb-10 text-base sm:text-lg leading-relaxed">
            Com as obras em ritmo acelerado e **17 de 20 unidades já vendidas**, restam apenas **3 oportunidades** para você adquirir seu imóvel no Alto Esplanada. Cadastre-se agora para receber as tabelas e condições.
          </p>
          <button 
            onClick={openLeadModal}
            className="inline-block bg-neutral-900 text-white font-bold py-4 px-12 rounded-xl hover:bg-neutral-800 transition-all duration-300 shadow-xl transform hover:scale-105 uppercase tracking-wider text-sm"
          >
            Solicitar Tabela de Vendas
          </button>
        </div>
      </section>

      {/* --- SEÇÃO PORTFÓLIO: OUTROS EMPREENDIMENTOS --- */}
      <section className="bg-neutral-50 py-20 border-t border-black/10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-[#45301f] uppercase block mb-3">CONHEÇA MAIS</span>
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 uppercase tracking-wide">
              Outros Empreendimentos
            </h2>
            <div className="w-16 h-1 bg-[#45301f] mx-auto mt-4"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {empreendimentosPortfolio
              .filter(emp => emp.link !== '/residencialalfa')
              .map((emp, index) => (
                <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-neutral-200/80 group hover:-translate-y-1">
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img 
                      src={emp.imagemUrl} 
                      alt={emp.nome}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className={`absolute top-4 right-4 ${emp.statusColor} text-white text-[9px] font-bold tracking-wider uppercase px-3 py-1 rounded-full shadow-sm`}>
                      {emp.status}
                    </span>
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-neutral-900 mb-2 uppercase tracking-wide">{emp.nome}</h3>
                    <p className="text-neutral-600 text-sm mb-6 flex-grow leading-relaxed">{emp.descricao}</p>
                    <a 
                      href={emp.link}
                      className="block w-full text-center bg-[#45301f] hover:bg-[#5a422e] text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs shadow-md"
                    >
                      Conhecer Empreendimento
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-white text-neutral-800 py-12 border-t border-black/10">
        <div className="w-full px-4 text-center">
          <div className="mb-6">
            <Image
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
              alt="Studio 57"
              width={120}
              height={48}
              className="mx-auto opacity-50 grayscale hover:grayscale-0 transition-all duration-300 filter brightness-0"
            />
          </div>
          <p className="text-neutral-500 text-xs mb-2">© {new Date().getFullYear()} Studio 57 Arquitetura e Incorporação.</p>
          <p className="text-neutral-600 font-medium text-xs mb-6">Residencial Alfa - Alto Esplanada, Governador Valadares. Registro de Incorporação: Nº 24.920/R-08</p>
        </div>
      </footer>

      {/* --- MODAIS DE SUPORTE --- */}
      {/* Modal de Zoom da Planta / Imagens */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] flex justify-center items-center cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-12 right-0 md:-right-12 text-gray-300 hover:text-white transition-colors z-[70]"
              onClick={closeModal}
              aria-label="Fechar imagem"
            >
              <FontAwesomeIcon icon={faXmark} size="2x" />
            </button>

            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              centerOnInit={true}
            >
              <TransformComponent wrapperClass="!w-full !h-full flex items-center justify-center">
                <Image
                  src={selectedImage}
                  alt="Imagem Ampliada"
                  width={1200}
                  height={800}
                  className="rounded-lg shadow-2xl object-contain max-h-[85vh] w-auto border border-white/10 pointer-events-none"
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}

      {/* Modal do Formulário de Lead (Book) */}
      <AnimatePresence>
        {isLeadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <FormularioDeContato onClose={closeLeadModal} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- BOTÃO FLUTUANTE WHATSAPP --- */}
      <a
        href="https://wa.me/5533998192119?text=Oi%2C%20gostaria%20de%20saber%20mais%20sobre%20as%20%C3%BAltimas%20unidades%20do%20Residencial%20Alfa"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 transform hover:scale-110 transition-transform duration-300"
        aria-label="Converse no WhatsApp"
      >
        <div className="w-16 h-16 bg-green-500 rounded-full shadow-lg flex items-center justify-center border-4 border-white/50">
          <FontAwesomeIcon icon={faWhatsapp} className="text-white text-4xl" />
        </div>
      </a>
      
    </div>
  );
}
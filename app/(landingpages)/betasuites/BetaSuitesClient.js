// Caminho: app/(landingpages)/betasuites/BetaSuitesClient.js
'use client';

import { useState } from 'react';
import FormularioDeContatoBeta from './FormularioDeContatoBeta';
import Image from 'next/image';
import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import {
  faRulerCombined, faBed, faElevator,
  faHospital, faGraduationCap, faCartShopping, faLocationDot,
  faSchool, faHouseMedical, faUsers, faXmark, faWater, faDumbbell, faUtensils, faTag, faLandmark, faCar, faJugDetergent, faBuilding, faAward
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

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '700', '900'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
});

// --- CONFIGURAÇÕES DO BETA ---
const primaryColor = '#f25a2f'; // --- DADOS DA GALERIA ---
const galleryImages = [
  { id: 1, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/academia.jpeg", alt: "ACADEMIA" },
  { id: 2, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/fachada..jpeg", alt: "FACHADA 1" },
  { id: 3, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/fachada.jpeg", alt: "FACHADA 2" },
  { id: 4, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/hall_entrada_1.jpeg", alt: "HALL ENTRADA 1" },
  { id: 5, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/hall_entrada_2.jpeg", alt: "HALL ENTRADA 2" },
  { id: 6, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/lavanderia_1.png", alt: "LAVANDERIA 1" },
  { id: 7, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/lavanderia.png", alt: "LAVANDERIA 2" },
  { id: 8, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_4..jpeg", alt: "SUÍTE 4 A" },
  { id: 9, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_4.jpeg", alt: "SUÍTE 4 B" },
  { id: 10, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_5..jpeg", alt: "SUÍTE 5 A" },
  { id: 11, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_5.jpeg", alt: "SUÍTE 5 B" },
  { id: 12, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_7..jpeg", alt: "SUÍTE 7 A" },
  { id: 13, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_7.jpeg", alt: "SUÍTE 7 B" },
  { id: 14, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/_rea_de_lazer_1.png", alt: "ÁREA DE LAZER 1" },
  { id: 15, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/_rea_de_lazer_2.jpeg", alt: "ÁREA DE LAZER 2" },
  { id: 16, src: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/_rea_de_lazer_3.png", alt: "ÁREA DE LAZER 3" }
];

// --- DADOS DAS PLANTAS (ALINHADAS COM O BOOK) ---
const pavimentosInfo = [
  {
    id: 1,
    subtitle: 'Acesso e Boas Vindas',
    title: 'Planta',
    strongTitle: 'Térreo',
    text: 'A primeira impressão é a que consolida o valor do imóvel. O pavimento térreo do Beta Suítes foi desenhado para oferecer uma recepção imponente, controle de acesso seguro e uma logística de garagem eficiente.',
    features: [
      { name: 'Recepção Elegante', desc: 'Hall de entrada desenhado com acabamentos premium.' },
      { name: 'Acesso Inteligente', desc: 'Eclusa de segurança e controle de acesso de última geração.' }
    ],
    src: '/terreo_final.jpeg',
    alt: 'Planta Humanizada Térreo'
  },
  {
    id: 2,
    subtitle: 'Garagem & Conveniência',
    title: 'O',
    strongTitle: 'Pavimento 1',
    text: 'O Pavimento 1 une a logística da garagem de acesso rápido com as facilidades do dia a dia, entregando aos inquilinos infraestrutura de apoio sem a necessidade de sair do prédio.',
    features: [
      { name: 'Lavanderia Compartilhada', desc: 'Equipada para centralizar o serviço de forma elegante e prática.' },
      { name: 'Garagem Otimizada', desc: 'Uso de lajes nervuradas garantindo total liberdade de manobra e conforto.' }
    ],
    src: '/pav1_final_v3.png',
    alt: 'Planta Humanizada Pavimento 1'
  },
  {
    id: 3,
    subtitle: 'Rentabilidade Otimizada',
    title: 'Pavimento',
    strongTitle: 'Tipo',
    text: 'Projetado para maximizar a rentabilidade do investidor e o conforto do inquilino. São Suítes de 28 a 32m² com layout inteligente que garante ventilação, iluminação natural e total privacidade entre as unidades.',
    features: [
      { name: 'Rentabilidade por m²', desc: 'Plantas otimizadas sem corredores ociosos, focando no que o inquilino valoriza.' },
      { name: 'Acústica e Privacidade', desc: 'Disposição estratégica para reduzir paredes de divisa seca.' }
    ],
    src: '/pav_tipo.png',
    alt: 'Planta Humanizada Pavimento Tipo'
  },
  {
    id: 4,
    subtitle: 'Clube Privativo',
    title: 'Terraço',
    strongTitle: 'Gourmet',
    text: 'O diferencial absoluto para locação por temporada. O Terraço Gourmet do Beta Suítes foi desenhado para ser o refúgio perfeito, unindo vista panorâmica e infraestrutura de clube no topo do edifício.',
    features: [
      { name: 'Piscina de Borda Infinita', desc: 'Relaxamento com vista deslumbrante e definitiva para a Ibituruna.' },
      { name: 'Espaço Gourmet & Academia', desc: 'Ambientes integrados e equipados. O inquilino tem tudo sem sair de casa.' }
    ],
    src: '/lazer.png',
    alt: 'Planta Humanizada Lazer'
  }
];

// --- DADOS DE LOCALIZAÇÃO ---
const locationPoints = [
  { name: 'Beta Suítes', time: 'Ponto de partida', icon: faLocationDot, highlight: true },
  { name: 'Maple Bear', time: '1 min', icon: faSchool },
  { name: 'Casa Unimed', time: '2 min', icon: faHouseMedical },
  { name: 'UFJF-GV', time: '2 min', icon: faGraduationCap },
  { name: 'Clube Filadélfia', time: '4 min', icon: faUsers },
  { name: 'Hospital São Lucas', time: '5 min', icon: faHospital },
  { name: 'Supermercado Big Mais', time: '5 min', icon: faCartShopping },
  { name: 'Supermercado Coelho Diniz', time: '5 min', icon: faCartShopping },
  { name: 'Colégio Ibituruna', time: '6 min', icon: faSchool },
  { name: 'Hospital Municipal', time: '7 min', icon: faHospital },
  { name: 'Caixa Serra Lima', time: '7 min', icon: faLandmark },
];

// Componentes de Ícones (Brancos para fundo escuro)
const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeSeguranca = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;

const IconeTicket = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;

export default function BetaSuitesClient() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (imageUrl) => setSelectedImage(imageUrl);
  const closeModal = () => setSelectedImage(null);
  const openLeadModal = () => setIsModalOpen(true);
  const closeLeadModal = () => setIsModalOpen(false);

  return (
    // FUNDO GERAL PRETO
    <div className={`${montserrat.className} bg-black text-gray-200`}>

      <style jsx global>{`
 /* Ajustes do Swiper para o modo Glass/Dark */
 .swiper-button-next,
 .swiper-button-prev {
 color: #ffffff !important;
 background-color: rgba(255, 255, 255, 0.1);
 border-radius: 50%;
 width: 40px !important;
 height: 40px !important;
 transition: all 0.3s ease;
 border: 1px solid rgba(255, 255, 255, 0.1);
 backdrop-filter: blur(4px);
 }
 .swiper-button-next:hover,
 .swiper-button-prev:hover {
 background-color: ${primaryColor};
 border-color: ${primaryColor};
 }
 .swiper-pagination-bullet {
 background-color: #ffffff !important;
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
 .floorplan-swiper .swiper-slide {
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
      {/* --- HERO SECTION COM VÍDEO DINÂMICO --- */}
      <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          poster="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765562188725.png"
        >
          <source src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/1774009421303_VIDEO_BETA_VERTICAL.mp4" media="(max-width: 767px)" type="video/mp4" />
          <source src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/1774009421304_VIDEO_ORBITA_BETA.mp4" media="(min-width: 768px)" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 z-10"></div>
        <div className="relative z-30 flex flex-col items-center justify-center p-4 w-full h-full min-h-screen">

          {/* CONTAINER DO BLOCO ALINHADO (Max Width Controlado) */}
          <div className="flex flex-col items-stretch w-full max-w-[340px] sm:max-w-[480px] md:max-w-[600px] lg:max-w-[680px] mx-auto -mt-20">

            {/* 0. PRÉ-LANÇAMENTO COM UNDERLINE LARANJA NO "PRÉ" */}
            <div className="w-full flex justify-center mb-2 sm:mb-4">
              {/* 
        AJUSTE MANUAL DE TAMANHO (RANNIERE): 
        Altere as classes "text-..." abaixo para ajustar o tamanho da fonte.
        Opções comuns: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl 
      */}
              <p className="text-gray-200 text-xs sm:text-sm md:text-base lg:text-lg tracking-[0.6em] sm:tracking-[0.8em] md:tracking-[1em] lg:tracking-[1.5em] uppercase font-light flex items-center justify-center drop-shadow-md">
                <span className="border-b-[2px] border-[#f25a2f] pb-[2px] mr-2 sm:mr-4">PRÉ</span>
                <span>- LANÇAMENTO</span>
              </p>
            </div>

            {/* 1. LOGO ALONGADA (Ocupa 100% do Container) */}
            <div className="mb-6 w-full">
              <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png"
                alt="Beta Suítes Logo"
                width={700}
                height={200}
                className="w-full h-auto object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* 2. TEXTO SUPERIOR COM ESPAÇAMENTO DISTRIBUÍDO PELO TRACKING */}
            <p className="text-center w-full text-[10px] sm:text-xs md:text-sm font-bold text-gray-300 drop-shadow-lg uppercase tracking-[0.4em] sm:tracking-[0.5em] md:tracking-[0.6em] mb-4">
              Alto Esplanada • Governador Valadares
            </p>

            {/* 3. TÍTULO PRINCIPAL COM ROBOTO E TRACKING MAXIMO (Esticando as letras) */}
            <h1 className={`${roboto.className} text-center w-full text-[1.4rem] sm:text-3xl md:text-4xl lg:text-[3.2rem] whitespace-nowrap font-light text-white drop-shadow-2xl tracking-[0.05em] sm:tracking-[0.1em] md:tracking-[0.15em] lg:tracking-[0.22em] leading-tight mb-8 px-1`}>
              Suítes de <span className="font-semibold">28 a 32m²</span>
            </h1>

            {/* 4. PILL ALONGADA (Botão ocupando a mesma largura) */}
            <div className="w-full bg-white/10 backdrop-blur-md border border-white/20 py-4 rounded-xl flex justify-center items-center shadow-2xl transition-all hover:bg-white/15">
              <p className="text-sm sm:text-lg md:text-xl font-light text-gray-100">
                Investimento a partir de <strong className="font-bold text-white tracking-wider ml-2">R$ 189.979</strong>
              </p>
            </div>

          </div>
        </div>
      </section>
      {/* --- TESE DE INVESTIMENTO E CARACTERÍSTICAS (Split-Screen) --- */}
      <section className="flex flex-col lg:flex-row-reverse min-h-[100vh] bg-black relative border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="w-full lg:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative z-10">

          <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-gray-400 mb-6 tracking-[0.1em] md:tracking-[0.15em]`}>
            Investimento <strong className="font-bold text-white">Inteligente</strong>
          </h2>
          <p className="text-gray-300 text-base md:text-lg mb-8 leading-relaxed">
            O Beta Suítes é o ativo imobiliário mais inteligente do Alto Esplanada. Projetado milimetricamente para o público estudantil de alta renda e profissionais de saúde.<br /><br />
            <span className="font-bold text-white">Rentabilidade Projetada: </span>
            Baseado no estudo de viabilidade, uma unidade pode render no mínimo <strong className="text-white text-xl">R$ 4.200,00</strong> por mês, considerando um cenário conservador de apenas <strong className="text-white">70% de ocupação</strong> e uma diária média de <strong className="text-white">R$ 200,00</strong>.
          </p>

          {/* Cards Integrados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

            {/* Polo Regional */}
            <div className="p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="mb-3 text-white"><IconeLocalizacao /></div>
              <h3 className="font-bold text-white text-sm mb-1">Polo Regional</h3>
              <p className="text-gray-400 text-xs leading-relaxed">GV atrai fluxo constante de estudantes e profissionais de saúde.</p>
            </div>

            {/* Alta Demanda */}
            <div className="p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="mb-3 text-white"><IconeRentabilidade /></div>
              <h3 className="font-bold text-white text-sm mb-1">Alta Demanda</h3>
              <p className="text-gray-400 text-xs leading-relaxed">A poucos passos da UFJF-GV. Garantia de ocupação e valorização.</p>
            </div>

            {/* Segurança Patrimonial */}
            <div className="p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="mb-3 text-white"><IconeSeguranca /></div>
              <h3 className="font-bold text-white text-sm mb-1">Segurança Total</h3>
              <p className="text-gray-400 text-xs leading-relaxed">Localização privilegiada e com total segurança patrimonial (Livre de enchentes).</p>
            </div>

            {/* Zero Descapitalização */}
            <div className="p-5 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
              <div className="mb-3 text-white"><IconeTicket /></div>
              <h3 className="font-bold text-white text-sm mb-1">Baixa Descapitalização</h3>
              <p className="text-gray-400 text-xs leading-relaxed">Entrada de apenas 20% e parcelas diluídas. Sua rentabilidade paga a conta.</p>
            </div>
          </div>

          <button
            onClick={openLeadModal}
            className="inline-block w-full sm:w-auto text-center bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-4 px-10 rounded-xl hover:bg-white/15 transition-all duration-300 shadow-2xl uppercase tracking-wide"
          >
            Quero Aproveitar a Oportunidade
          </button>
        </div>
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg"
            alt="Beta Suítes Pôr do Sol"
            fill
            className="object-cover object-right-bottom"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent lg:bg-gradient-to-l lg:from-black lg:via-black/20 lg:to-transparent"></div>
        </div>
      </section>

      {/* --- ARQUITETURA FINANCEIRA --- */}
      <section className="bg-black py-16 md:py-24 relative border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between p-4 md:p-12">

            <div className="w-full lg:w-1/2 mb-12 lg:mb-0 pr-0 lg:pr-12">
              <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-gray-400 mb-6 tracking-[0.1em] md:tracking-[0.15em] uppercase`}>
                Arquitetura <strong className="font-bold text-white">Financeira</strong>
              </h2>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                Você não precisa se descapitalizar para ter um imóvel no Alto Esplanada. Com um investimento inicial inteligente, o seu dinheiro volta muito mais rápido pro seu bolso.
              </p>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col sm:flex-row gap-12 sm:gap-8 justify-center items-center">
              {/* Dado 1 */}
              <div className="flex-1 text-center sm:text-left sm:border-l sm:border-white/20 sm:pl-8">
                <p className="text-[#f25a2f] text-sm md:text-base font-bold tracking-[0.2em] uppercase mb-2">Apenas</p>
                <p className="text-white text-7xl md:text-8xl font-light tracking-tighter mb-2">20%</p>
                <p className="text-gray-400 text-xs md:text-sm uppercase tracking-[0.15em]">de Entrada</p>
              </div>

              {/* Dado 2 */}
              <div className="flex-1 text-center sm:text-left sm:border-l sm:border-white/20 sm:pl-8">
                <p className="text-[#f25a2f] text-sm md:text-base font-bold tracking-[0.2em] uppercase mb-2">A partir de</p>
                <p className="text-white text-7xl md:text-8xl font-light tracking-tighter mb-2 whitespace-nowrap">R$ 1.800</p>
                <p className="text-gray-400 text-xs md:text-sm uppercase tracking-[0.15em]">Parcelas Mensais</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- LOCALIZAÇÃO (Split-Screen) --- */}
      <section className="flex flex-col lg:flex-row min-h-[80vh] bg-black relative border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center relative z-10">
          <h2 className={`${roboto.className} text-3xl sm:text-4xl md:text-5xl font-light text-gray-400 mb-12 tracking-[0.1em] md:tracking-[0.15em]`}>
            Localização <strong className="font-bold text-white">Estratégica</strong>
          </h2>
          <div className="relative max-w-sm">
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-white/20"></div>
            {locationPoints.map((point, index) => (
              <div key={index} className={`relative pl-10 ${index === locationPoints.length - 1 ? '' : 'pb-8'}`}>
                <div className={`absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-black shadow-sm ${point.highlight ? 'bg-white' : 'bg-white/20'
                  }`}
                ></div>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={point.icon} className={`text-2xl mr-4 ${point.highlight ? 'text-white' : 'text-gray-500'}`} />
                  <div>
                    <p className={`font-bold ${point.highlight ? 'text-white text-lg' : 'text-gray-400'}`}>
                      {point.name}
                    </p>
                    <p className="text-sm text-gray-500">{point.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/2 h-[50vh] lg:h-auto relative">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_bairro.jpeg"
            alt="Beta Suítes - Inserção no Local"
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent lg:bg-gradient-to-r lg:from-black lg:via-black/20 lg:to-transparent"></div>
          <p className="absolute bottom-4 left-4 right-4 text-center text-xs text-gray-400 italic z-20 drop-shadow-md">
            Perspectiva ilustrativa de inserção no local.
          </p>
        </div>
      </section>

      {/* --- MAPA --- */}
      <section className="bg-black pt-16 md:pt-24 pb-16 md:pb-24 relative border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="w-full px-4 text-center">
          <h2 className={`${roboto.className} text-3xl md:text-4xl font-light text-gray-400 mb-4 tracking-tight`}>
            Explore o <strong className="font-bold text-white">Mapa</strong>
          </h2>
          <p className="max-w-2xl mx-auto mb-8 text-gray-400">
            Explore a região do Alto Esplanada.
          </p>
          <div className="w-full h-96 rounded-xl shadow-xl overflow-hidden border border-white/10">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1123.4446044211293!2d-41.940456530379386!3d-18.844714498894543!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xb1a714cea1bf23%3A0x8b0d18e49baf52e6!2sR.%20das%20Arar%C3%A1s%2C%20543%20-%20Alto%20Esplanada%2C%20Gov.%20Valadares%20-%20MG%2C%2035064-001!5e1!3m2!1spt-BR!2sbr!4v1765551156537!5m2!1spt-BR!2sbr"
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
      {/* --- PLANTAS HUMANIZADAS (SPLIT-SCREEN SWIPER) --- */}
      <section className="bg-black border-t border-white/10 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-20"></div>
        
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
              <div className="flex flex-col lg:flex-row w-full min-h-[100vh] bg-[#161616]">
                
                {/* LADO TEXTO (Mobile: embaixo, Desktop: Esquerda) */}
                <div className="w-full lg:w-[35%] p-8 md:p-12 lg:p-16 flex flex-col justify-center border-t lg:border-t-0 lg:border-r border-white/10 z-20 order-2 lg:order-1 bg-[#161616] relative">
                  <div className="hidden lg:block absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
                  
                  <h2 className={`${roboto.className} text-4xl lg:text-5xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
                    {plan.title} <strong className="font-bold text-white">{plan.strongTitle}</strong>
                  </h2>
                  
                  <p className="text-gray-300 text-sm md:text-base mb-8 leading-relaxed text-justify">
                    {plan.text}
                  </p>

                  <ul className="space-y-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx}>
                        <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">{feat.name}</h3>
                        <p className="text-gray-400 text-[11px] md:text-xs leading-relaxed">{feat.desc}</p>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Dica de usabilidade para mobile */}
                  <div className="mt-12 lg:hidden text-center opacity-50">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white">⟵ Deslize para ver os outros andares ⟶</p>
                  </div>
                </div>

                {/* LADO PLANTA (Mobile: Em cima, Desktop: Direita) */}
                <div 
                  className="w-full lg:w-[65%] relative min-h-[50vh] lg:min-h-[100vh] bg-[#0a0a0a] p-8 lg:p-16 flex flex-col items-center justify-center cursor-pointer order-1 lg:order-2 group"
                  onClick={() => openModal(plan.src)}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#f25a2f]/5 via-transparent to-transparent pointer-events-none z-0"></div>
                  
                  <div className="relative w-full max-w-3xl lg:max-w-5xl h-full min-h-[40vh] lg:min-h-[80vh] rounded-xl overflow-hidden z-10 transition-transform duration-500 group-hover:scale-[1.02]">
                    <Image
                      src={plan.src}
                      alt={plan.alt}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 65vw"
                    />
                    
                    {/* Botão flutuante de Zoom */}
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full p-3 opacity-70 group-hover:opacity-100 transition-opacity">
                      <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path><path fillRule="evenodd" d="M8 6a1 1 0 011 1v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V10H6a1 1 0 110-2h1V7a1 1 0 011-1z" clipRule="evenodd"></path></svg>
                    </div>
                  </div>

                  <p className="absolute bottom-6 right-8 text-gray-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
                    *Toque na planta para ampliar.
                  </p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>
      {/* --- GALERIA COMPLETA --- */}
      <section className="bg-black py-16 md:py-24 relative border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="w-full px-4">
          <h2 className={`${roboto.className} text-3xl md:text-5xl font-light text-center text-gray-400 mb-12 tracking-[0.1em] md:tracking-[0.15em]`}>
            Tour <strong className="font-bold text-white">Visual</strong>
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
                      className="rounded-lg cursor-pointer shadow-2xl border border-white/10"
                      onClick={() => openModal(image.src)}
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </section>
      {/* --- FICHA TÉCNICA --- */}
      <section className="bg-black py-16 md:py-24 border-t border-white/10 relative">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col lg:flex-row gap-12">
          {/* LADO ESQUERDO: TÍTULO */}
          <div className="w-full lg:w-[35%] flex flex-col justify-center lg:border-r border-white/10 z-20">
            <h2 className={`${roboto.className} text-3xl md:text-4xl lg:text-5xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Ficha <strong className="font-bold text-white">Técnica</strong>
            </h2>
            <p className="text-gray-300 text-sm mb-8 leading-relaxed lg:pr-8">
              O Beta Suítes foi milimetricamente arquitetado com precisão <strong className="text-white">BIM</strong> para garantir solidez e baixo custo de manutenção. Abaixo, as especificações cruciais do projeto.
            </p>

            <div className="mt-4 p-6 bg-white/5 border border-white/10 rounded-xl shadow-xl lg:mr-8">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Realização</p>
              <h3 className="text-sm md:text-base font-bold text-[#f25a2f] uppercase tracking-wide mb-2">STUDIO 57 INCORPORAÇÕES LTDA</h3>
              <div className="text-[10px] md:text-xs text-gray-400 space-y-1">
                <p><strong>CNPJ:</strong> 41.464.589/0001-66</p>
                <p><strong>Sede:</strong> Av. Rio Doce, 1825, Loja A</p>
                <p>Ilha dos Araújos • Gov. Valadares/MG</p>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: GRID DE DADOS */}
          <div className="w-full lg:w-[65%] flex flex-col justify-center relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* O Empreendimento */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faBuilding} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">O Empreendimento</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Composto por 42 suítes de 28m² a 32m² e 1 ponto comercial estratégico localizado no térreo.
                </p>
              </div>

              {/* Localização Premium */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faLocationDot} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Localização Premium</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Situado no bairro Alto Esplanada (Gov. Valadares/MG), com proximidade direta à UFJF-GV e ao Polo Médico.
                </p>
              </div>

              {/* Garagem */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faCar} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Garagem</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Possui 21 vagas para carros e 15 vagas para motos com matrículas independentes, além de vãos amplos.
                </p>
              </div>

              {/* Lazer */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faWater} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Terraço Gourmet</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Lazer exclusivo no topo do edifício com piscina de borda infinita, academia e espaço gourmet.
                </p>
              </div>

              {/* Conveniência */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faJugDetergent} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Conveniência</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Lavanderia compartilhada projetada para reduzir o custo do condomínio e liberar espaço nas suítes.
                </p>
              </div>

              {/* Técnica Construtiva */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-[#f25a2f]/50 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faAward} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Técnica Construtiva</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Estrutura em concreto armado, lajes nervuradas e vedação em bloco cerâmico de alta resistência acústica.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* --- MARCAS PARCEIRAS E REALIZAÇÃO --- */}
      <section className="bg-black py-20 border-t border-white/10 relative overflow-hidden">
         <div className="w-full flex flex-col items-center">
            
            {/* Logo Studio 57 e Slogan */}
            <div className="flex flex-col items-center justify-center mb-16">
              <div className="w-[200px] md:w-[300px] mb-4">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Logo Studio 57"
                  className="w-full h-auto object-contain filter brightness-0 invert opacity-90"
                />
              </div>
              <h1 className={`${montserrat.className} text-[9px] md:text-[11px] font-light uppercase tracking-[0.4em] text-white text-center drop-shadow-md opacity-80`}>
                excelência em cada detalhe
              </h1>
            </div>

            <p className="text-gray-500 text-[10px] md:text-xs uppercase tracking-[0.3em] mb-10 font-bold">Projetos & Consultoria</p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 px-4">
              <img src="/parceiros_beta/INTEC_png.png" alt="Intec" className="h-8 md:h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/BRIM Logomarca.png" alt="BRIM" className="h-8 md:h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/LZ ENGENHARIA.jpg" alt="LZ Engenharia" className="h-8 md:h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/TONZIRO.png" alt="Tonziro" className="h-8 md:h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/logo-horizontal-04.png" alt="Planizar" className="h-10 md:h-14 object-contain opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
            </div>
          </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="bg-black py-16 md:py-20 relative overflow-hidden border-t border-white/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent z-10"></div>
        <div className="absolute inset-0 bg-[#f25a2f]/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] text-white/10 via-black to-black pointer-events-none"></div>
        <div className="w-full px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Garanta condições de Pré-Lançamento</h2>
          <p className="text-gray-300 max-w-2xl mx-auto mb-10 text-lg">Cadastre-se para receber a tabela de vendas exclusiva e o book completo do Beta Suítes.</p>
          <button onClick={openLeadModal}
            className="inline-block bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold py-4 px-12 rounded-xl hover:bg-white/15 transition-all duration-300 shadow-2xl transform hover:scale-105 uppercase tracking-wider text-lg"
          >
            Solicitar Tabela e Book
          </button>
        </div>
      </section>
      {/* --- FOOTER --- */}
      <footer className="bg-black text-white py-12 border-t border-white/10">
        <div className="w-full px-4 text-center">
          <div className="mb-6">
            <Image
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG" alt="Studio 57"
              width={120}
              height={48}
              className="mx-auto opacity-70 grayscale hover:grayscale-0 transition-all duration-300"
            />
          </div>
          <p className="text-gray-500 text-sm mb-2">© {new Date().getFullYear()} Studio 57 Arquitetura e Incorporação.</p>
          <p className="text-gray-400 font-medium mb-6">Beta Suítes - Alto Esplanada, Governador Valadares.</p>
          
          <a href="/betasuites/book-livreto" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-white transition-colors border-b border-gray-600 hover:border-white pb-1">
            Visualizar Versão Gráfica para Impressão (Livreto A4)
          </a>
        </div>
      </footer>
      {/* --- MODAL DE IMAGEM --- */}
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
              className="absolute -top-12 right-0 md:-right-12 text-gray-300 hover:text-[#f25a2f] transition-colors z-[70]"
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
      {/* --- FORMULÁRIO --- */}
      {isModalOpen && (
        <FormularioDeContatoBeta onClose={closeLeadModal} />
      )}
      {/* --- BOTÃO WHATSAPP --- */}
      <a
        href="https://wa.me/5533998192119?text=Oi%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Beta%20Suítes"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 transform hover:scale-110 transition-transform duration-300"
        aria-label="Converse no WhatsApp"
      >
        <div className="w-16 h-16 bg-green-500 rounded-full shadow-lg flex items-center justify-center border-4 border-black/50">
          <FontAwesomeIcon icon={faWhatsapp} className="text-white text-4xl" />
        </div>
      </a>
    </div>
  );
}
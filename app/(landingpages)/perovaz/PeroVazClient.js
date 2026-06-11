// Caminho: app/(landingpages)/perovaz/PeroVazClient.js
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  faRulerCombined, faBed, faBath, faCouch, faCar,
  faHouseMedical, faGraduationCap, faCartShopping, faSchool,
  faLocationDot, faCheck, faXmark
} from '@fortawesome/free-solid-svg-icons';

import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

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
    descricao: 'Suítes de 28 a 32m² no Alto Esplanada. Investimento inteligente focado em renda passiva.',
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

// --- DADOS DA GALERIA ---
const galleryImages = [
  { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095651162.jpg', alt: 'Sala de TV e Jantar' },
  { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095653460.jpg', alt: 'Sala de Estar e Jantar' },
  { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095652204.jpg', alt: 'Integração Sala e Cozinha' },
  { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095647132.jpg', alt: 'Cozinha e Área de Serviço' },
  { id: 5, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095646147.jpg', alt: 'Cozinha e Área de Serviço' },
  { id: 6, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095645144.jpg', alt: 'Banheiro Social' },
  { id: 7, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095650024.jpg', alt: 'Quarto Casal' },
  { id: 8, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649799.jpg', alt: 'Quarto Solteiro/Hóspedes' },
  { id: 9, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095653970.jpg', alt: 'Vaga de Garagem' },
  { id: 10, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095644559.jpg', alt: 'Área Externa/Acesso' },
  { id: 11, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095642400.jpg', alt: 'Acesso Bloco B' },
  { id: 12, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649407.jpeg', alt: 'Fachada do Residencial Pero Vaz' },
];

const floorPlanImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/PLAN_1778095655435.png";
const primaryColor = '#005bac'; // Azul Caixa Econômica / MCMV

export default function PeroVazClient() {
  const [selectedImage, setSelectedImage] = useState(null);

  const openModal = (imageUrl) => setSelectedImage(imageUrl);
  const closeModal = () => setSelectedImage(null);

  return (
    <div className={`${roboto.variable} bg-white text-gray-800 font-sans`}>
      <style jsx global>{`
        :root {
          --font-roboto: ${roboto.variable};
        }
        .font-sans {
          font-family: var(--font-roboto);
        }
        .text-shadow {
          text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .text-shadow-lg {
          text-shadow: 0px 4px 8px rgba(0, 0, 0, 0.4);
        }
        .bg-primary {
          background-color: ${primaryColor};
        }
        .text-primary {
          color: ${primaryColor};
        }
        .swiper-button-next,
        .swiper-button-prev {
          color: #ffffff !important;
          background-color: rgba(0, 0, 0, 0.4);
          border-radius: 50%;
          width: 40px !important;
          height: 40px !important;
          transition: background-color 0.3s ease;
        }
        .swiper-button-next:hover,
        .swiper-button-prev:hover {
          background-color: rgba(0, 0, 0, 0.7);
        }
        .swiper-button-next::after,
        .swiper-button-prev::after {
          font-size: 18px !important;
          font-weight: 700;
        }
        .swiper-pagination-bullet {
          background-color: #a1a1aa !important;
          width: 10px !important;
          height: 10px !important;
          opacity: 0.8;
        }
        .swiper-pagination-bullet-active {
          background-color: ${primaryColor} !important;
        }
        .gallery-swiper .swiper-slide {
          width: 60% !important;
        }
        .gallery-swiper .swiper-slide-prev,
        .gallery-swiper .swiper-slide-next {
          width: 45% !important;
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

      {/* HERO SECTION (ESTILO ALFA) */}
      <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover z-0"
          style={{
            backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649407.jpeg')",
          }}
        ></div>
        <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
        <div className="relative z-30 flex flex-col items-center text-center p-4 w-full pt-16 sm:pt-0">
          
          <h1 className="font-sans text-4xl md:text-6xl font-black uppercase tracking-widest text-shadow-lg mb-4 text-white">
            Residencial Pero Vaz
          </h1>
          <p className="font-sans text-xl md:text-3xl text-shadow font-thin tracking-wider opacity-90 mb-2">
            Saia do Aluguel Hoje Mesmo!
          </p>
          <p className="font-sans text-lg md:text-xl text-shadow font-normal text-gray-300 mb-8">
            Apartamento Térreo no Jardim Vera Cruz
          </p>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-8 mb-8">
            <div>
              <p className="text-sm text-gray-300 uppercase tracking-wider font-semibold mb-1">Avaliação Caixa</p>
              <p className="text-gray-400 line-through text-xl text-shadow">R$ 220.000,00</p>
            </div>
            <div className="hidden md:block w-px h-12 bg-white/20"></div>
            <div>
              <p className="text-sm text-green-400 uppercase tracking-wider font-bold mb-1">Preço Promocional</p>
              <p className="text-4xl font-extrabold text-white text-shadow-lg">R$ 180.000,00</p>
            </div>
          </div>

          <a
            href="#simular"
            className="px-8 py-4 bg-green-500 hover:bg-green-600 rounded-full text-lg font-bold transition-all shadow-xl hover:scale-105"
          >
            Quero Fazer uma Simulação
          </a>
        </div>
      </section>

      {/* --- SEÇÃO CAIXA (FINANCIAMENTO FACILITADO) --- */}
      <section id="simular" className="relative py-16 md:py-24 flex items-center justify-center text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover z-0"
          style={{
            backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1769174467802.png')",
          }}
        ></div>
        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="mb-8 flex justify-center">
            <Image
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1769174760534.png"
              alt="Logo Caixa Econômica Federal"
              width={220}
              height={90}
              className="object-contain h-16 md:h-20"
            />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white text-shadow">
            Ideal para o Minha Casa Minha Vida
          </h2>

          <p className="text-xl md:text-2xl font-light max-w-3xl mx-auto mb-10 leading-relaxed text-white">
            Use o seu FGTS e realize o sonho do imóvel próprio. O apartamento está pronto para financiar!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 group">
              <p className="text-5xl font-bold mb-2 text-white group-hover:scale-110 transition-transform">20%</p>
              <p className="text-sm font-bold uppercase tracking-widest text-white/90">de Entrada Estimada</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 group">
              <p className="text-5xl font-bold mb-2 text-white group-hover:scale-110 transition-transform">420</p>
              <p className="text-sm font-bold uppercase tracking-widest text-white/90">Meses para Pagar</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 group">
              <p className="text-5xl font-bold mb-2 text-white group-hover:scale-110 transition-transform">FGTS</p>
              <p className="text-sm font-bold uppercase tracking-widest text-white/90">Utilize seu Saldo</p>
            </div>
          </div>

          <div className="mt-12">
            <a
              href="https://wa.me/5533999999999?text=Oi%2C%20quero%20fazer%20uma%20simula%C3%A7%C3%A3o%20MCMV%20do%20Pero%20Vaz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-blue-800 font-bold py-4 px-10 rounded-full hover:bg-gray-100 transition-all shadow-xl transform hover:scale-105 uppercase tracking-wide border-2 border-transparent hover:border-white"
            >
              <FontAwesomeIcon icon={faCheck} className="mr-2" />
              Falar com o Corretor no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* PLANTAS E FICHA TÉCNICA */}
      <section className="py-16 md:py-24 bg-white">
        <div className="w-full px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center container mx-auto">
          <div className="md:order-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Planta Inteligente e Funcional</h2>
            <p className="mb-8 text-gray-700">
              Apartamento Térreo com 51 m² de área privativa, desenhado sem corredores perdidos, aproveitando cada centímetro para proporcionar o máximo de conforto.
            </p>

            <h3 className="text-center text-lg font-semibold uppercase text-gray-600 tracking-wider mb-8">
              Layout do Apartamento
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8 text-center">
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faRulerCombined} className="text-3xl text-primary mb-2" />
                <span className="text-sm text-gray-700 leading-tight">51m² de área privativa</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faBed} className="text-3xl text-primary mb-2" />
                <span className="text-sm text-gray-700 leading-tight">2 quartos espaçosos</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faBath} className="text-3xl text-primary mb-2" />
                <span className="text-sm text-gray-700 leading-tight">1 Banheiro Social</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faCouch} className="text-3xl text-primary mb-2" />
                <span className="text-sm text-gray-700 leading-tight">Sala de Estar e Jantar</span>
              </div>
              <div className="flex flex-col items-center">
                <FontAwesomeIcon icon={faCar} className="text-3xl text-primary mb-2" />
                <span className="text-sm text-gray-700 leading-tight">1 Vaga de Garagem Inclusa</span>
              </div>
            </div>
          </div>
          <div className="md:order-1">
            <div className="bg-gray-50 p-4 rounded-xl shadow-inner">
              <Image
                src={floorPlanImage}
                alt="Planta Humanizada do Apartamento Pero Vaz"
                width={800}
                height={800}
                className="rounded-lg shadow-xl mx-auto cursor-pointer object-contain"
                onClick={() => openModal(floorPlanImage)}
              />
            </div>
            <p className="text-center text-sm mt-2 text-gray-500">Clique na imagem para ampliar a planta</p>
          </div>
        </div>
      </section>

      {/* GALERIA */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="w-full px-4 container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Galeria de Imagens
          </h2>
          <p className="text-gray-500 text-center mb-12">Veja fotos reais do residencial pronto para você.</p>
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
                      style={{objectFit: 'cover'}}
                      className="rounded-lg cursor-pointer shadow-lg"
                      onClick={() => openModal(image.src)}
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </section>

      {/* MAPA DE LOCALIZAÇÃO */}
      <section className="bg-white py-16 md:py-24 border-t border-gray-100">
        <div className="w-full px-4 text-center container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Localização Privilegiada</h2>
          <p className="max-w-2xl mx-auto mb-8 text-gray-600">
            Encontre o Residencial Pero Vaz no Bairro Jardim Vera Cruz, com fácil acesso ao comércio, escolas e principais vias da cidade.
          </p>
          <div className="relative w-full h-96 rounded-2xl shadow-2xl overflow-hidden border-4 border-white">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d870.2977149162376!2d-41.957825320025336!3d-18.899633922536143!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1spt-BR!2sbr!4v1778094686981!5m2!1spt-BR!2sbr" 
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            {/* Pino Vermelho Centralizado Manualmente para forçar o marcador nas coordenadas */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-full pointer-events-none drop-shadow-xl">
              <FontAwesomeIcon icon={faLocationDot} className="text-red-600 text-5xl pb-2" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-white py-16 md:py-20 border-t border-gray-100">
        <div className="w-full px-4 text-center container mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Gostou do que viu?</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            O Apartamento 101 já possui Matrícula individualizada (Nº 54.630) e está livre de qualquer ônus. Nossa equipe cuida de toda a burocracia do financiamento para você.
          </p>
          <a 
            href="https://wa.me/5533999999999?text=Oi%2C%20gostaria%20de%20falar%20sobre%20o%20Pero%20Vaz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#005bac] text-white font-bold py-4 px-10 rounded-full hover:opacity-90 transition-all duration-300 shadow-lg transform hover:scale-105"
          >
            FALAR COM CORRETOR AGORA
          </a>
        </div>
      </section>

      {/* --- SEÇÃO PORTFÓLIO: OUTROS EMPREENDIMENTOS --- */}
      <section className="bg-neutral-50 py-20 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-[#005bac] uppercase block mb-3">CONHEÇA MAIS</span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 uppercase tracking-wide">
              Outros Empreendimentos
            </h2>
            <div className="w-16 h-1 bg-[#005bac] mx-auto mt-4"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {empreendimentosPortfolio
              .filter(emp => emp.link !== '/perovaz')
              .map((emp, index) => (
                <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full border border-gray-200 group hover:-translate-y-1">
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
                    <h3 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">{emp.nome}</h3>
                    <p className="text-gray-600 text-sm mb-6 flex-grow leading-relaxed">{emp.descricao}</p>
                    <a 
                      href={emp.link}
                      className="block w-full text-center bg-[#005bac] hover:bg-[#004e93] text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs shadow-md"
                    >
                      Conhecer Empreendimento
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-6">
        <div className="w-full px-4 text-center text-gray-400">
          <p>© {new Date().getFullYear()} Studio 57 Imobiliária. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* --- MODAIS --- */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-10 right-0 md:-right-10 w-8 h-8 flex items-center justify-center text-white hover:text-gray-300 transition-colors z-10"
              onClick={closeModal}
              aria-label="Fechar imagem"
            >
              <FontAwesomeIcon icon={faXmark} className="text-3xl" />
            </button>
            <Image
              src={selectedImage}
              alt="Imagem Ampliada"
              width={1200}
              height={800}
              className="rounded-lg shadow-2xl object-contain max-h-[90vh] w-auto"
            />
          </div>
        </div>
      )}

      {/* Botão Flutuante */}
      <a
        href="https://wa.me/5533999999999?text=Oi%2C%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Residencial%20Pero%20Vaz"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 transform hover:scale-110 transition-transform duration-300"
        aria-label="Converse no WhatsApp"
      >
        <div className="w-16 h-16 bg-green-500 rounded-full shadow-2xl flex items-center justify-center">
          <FontAwesomeIcon icon={faWhatsapp} className="text-white text-4xl" />
        </div>
      </a>
    </div>
  );
}

'use client';
import { useState } from 'react';
import FormularioDeContato from './FormularioDeContato';
import Image from 'next/image';
import { Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { 
  faRulerCombined, faBed, faBath, faCouch, faElevator, faCar,
  faHospital, faGraduationCap, faCity, faCartShopping, faUtensils, faLocationDot,
  faSchool, faHouseMedical, faUsers, faLandmark, faXmark
} from '@fortawesome/free-solid-svg-icons';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// --- DADOS DA GALERIA (IMAGENS FINAIS) ---
const galleryImages = [
  { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png', alt: 'Fachada do Residencial Alfa' },
  { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png', alt: 'Área gourmet do Residencial Alfa' },
  { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018987365.png', alt: 'Área gourmet com vista para a cidade' },
  { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018987365.png', alt: 'Detalhe da bancada da área gourmet' },
  { id: 5, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018987365.png', alt: 'Ambiente de convivência da área gourmet' },
  { id: 6, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019021635.png', alt: 'Visão ampla da área gourmet' },
  { id: 7, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019089329.png', alt: 'Sala de TV e cozinha integradas' },
  { id: 8, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019116881.png', alt: 'Vista da sala de TV e cozinha' },
  { id: 9, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019141502.png', alt: 'Cozinha e área de serviço' },
  { id: 10, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019211163.png', alt: 'Sala de TV e Jantar' },
  { id: 11, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019255355.png', alt: 'Sala de TV decorada' },
  { id: 12, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019299839.png', alt: 'Quarto do apartamento de 49m²' },
  { id: 13, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019368515.png', alt: 'Quarto do apartamento de 58m²' },
  { id: 14, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019528512.png', alt: 'Segundo quarto decorado' },
];

const floorPlanImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta%20humanizada%20aps.png";

// --- Componentes de Ícones (Exemplo) ---
const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeValorizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0115 15v3h1zM4.75 12.094A5.973 5.973 0 004 15v3H3v-3a3.005 3.005 0 01-.25-1.094z"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeCasa = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>;
const IconeCoracao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>;
const IconePiscina = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10 3a1 1 0 011 1v1.155a3.994 3.994 0 012.382 1.43 1 1 0 01-1.414 1.414A1.994 1.994 0 0010.5 6.586V8a1 1 0 01-2 0V6.586a1.994 1.994 0 00-1.468.413 1 1 0 01-1.414-1.414A3.994 3.994 0 018 5.155V4a1 1 0 011-1z"></path><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zM5.222 10.26a1 1 0 010 1.414 4 4 0 005.656 0 1 1 0 111.414-1.414 6 6 0 01-8.484 0 1 1 0 011.414 0z" clipRule="evenodd"></path></svg>;

export default function ResidencialAlfaPage() {
  const [view, setView] = useState('investidor'); // 'investidor' ou 'morador'
  const [selectedImage, setSelectedImage] = useState(null);
  const darkGrayColor = '#374151';

  const openModal = (imageUrl) => setSelectedImage(imageUrl);
  const closeModal = () => setSelectedImage(null);

  return (
    <div className={`${roboto.className} bg-white text-gray-800 font-sans`}>
      
      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 1 ======================= */}
      {/* =================================================================== */}
      <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-no-repeat bg-right-bottom z-0"
          style={{
            backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/capa%20vazia2.png')",
            backgroundSize: 'cover',
          }}
        ></div>
        <div className="absolute inset-0 bg-black opacity-20 z-10"></div>
        <div className="absolute bottom-0 left-0 w-[45%] max-w-xs sm:max-w-sm md:w-1/3 md:max-w-md z-20">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/tatisemfundo.png"
            alt="Tati, especialista do Residencial Alfa"
            width={600}
            height={900}
            className="w-full h-auto"
            priority
          />
        </div>
        <div className="relative z-30 flex flex-col items-center p-4 w-full pt-16 sm:pt-0">
            <Image
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png"
              alt="Logo Residencial Alfa"
              width={500}
              height={200}
              className="w-full max-w-xs md:max-w-md object-contain mb-8"
              priority
            />
          <div className="bg-gray-800/50 rounded-full p-1 flex items-center">
            <button
              onClick={() => setView('investidor')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'investidor' ? 'bg-gray-700 text-white' : 'text-white'}`}
            >
              Sou Investidor
            </button>
            <button
              onClick={() => setView('morador')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'morador' ? 'bg-gray-700 text-white' : 'text-white'}`}
            >
              Quero Morar
            </button>
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 1 ======================== */}
      {/* =================================================================== */}
      
      {/* =================================================================== */}
      {/* ================= INÍCIO DA SEÇÃO RENDA PASSIVA ================= */}
      {/* =================================================================== */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-gray-500 mb-4" style={{ letterSpacing: '0.05em' }}>
              Transforme seu dinheiro em Renda Passiva
            </h2>
            <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 whitespace-nowrap" style={{ letterSpacing: '0.02em' }}>
              Até R$ 4.144,25/mês
            </p>
            <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>
              Com aluguel temporário no Residencial Alfa, em um cenário de alta ocupação (70%). Uma oportunidade única de investimento com retorno rápido e seguro.
            </p>
            <div className="mt-8">
              <a
                href="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/RLT_1759011023928.pdf"
                target="_blank"
                rel="noopener noreferrer"
                download="Analise_de_Rentabilidade_Residencial_Alfa.pdf"
                className="inline-block bg-gray-800 text-white font-bold py-3 px-8 rounded-full hover:bg-gray-700 transition-colors duration-300 shadow-lg"
              >
                Download da Análise de Rentabilidade
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* =================== FIM DA SEÇÃO RENDA PASSIVA ================== */}
      {/* =================================================================== */}


      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 2 ======================= */}
      {/* =================================================================== */}
      {view === 'investidor' && (
        <>
          <section className="py-16 md:py-24 bg-white">
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeLocalizacao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Localização Estratégica</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Próximo ao Centro, UFJF e hospitais. O ponto mais desejado para aluguéis de curta e longa duração.</p>
                </div>
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeRentabilidade /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Demanda Elevada</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Governador Valadares recebe em média 13 mil turistas por mês, garantindo alta taxa de ocupação.</p>
                </div>
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeValorizacao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Valorização Garantida</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Invista no Alto Esplanada, o bairro com maior potencial de valorização da cidade, e veja seu patrimônio crescer.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white pb-16 md:pb-24">
            <div className="container mx-auto px-4">
                <div className="mt-0">
                    <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-12">
                    Mapa de Proximidades
                    </h3>
                    <div className="relative max-w-sm mx-auto">
                      <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-300"></div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-amber-800 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faLocationDot} className="text-2xl text-amber-800 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Residencial Alfa</p>
                              <p className="text-sm text-gray-500">Ponto de partida</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faSchool} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Maple Bear</p><p className="text-sm text-gray-500">1 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faHouseMedical} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Casa Unimed</p><p className="text-sm text-gray-500">2 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faGraduationCap} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">UFJF-GV</p><p className="text-sm text-gray-500">2 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faUsers} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Clube Filadélfia</p><p className="text-sm text-gray-500">4 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faHospital} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Hospital São Lucas</p><p className="text-sm text-gray-500">5 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faCartShopping} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Supermercado Big Mais</p><p className="text-sm text-gray-500">5 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faCartShopping} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Supermercado Coelho Diniz</p><p className="text-sm text-gray-500">5 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faSchool} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Colégio Ibituruna</p><p className="text-sm text-gray-500">6 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10 pb-8">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faHospital} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Hospital Municipal</p><p className="text-sm text-gray-500">7 min</p>
                          </div>
                          </div>
                      </div>
                      <div className="relative pl-10">
                          <div className="absolute left-0 top-1 w-5 h-5 bg-gray-700 rounded-full border-4 border-white"></div>
                          <div className="flex items-center">
                          <FontAwesomeIcon icon={faLandmark} className="text-2xl text-gray-600 mr-4" />
                          <div>
                              <p className="font-bold text-gray-800">Caixa Serra Lima</p><p className="text-sm text-gray-500">7 min</p>
                          </div>
                          </div>
                      </div>
                    </div>
                </div>
                <div className="mt-16 md:mt-24">
                    <Image
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759017559883.png"
                        alt="Renderização 3D do Residencial Alfa inserida no local real"
                        width={1200}
                        height={800}
                        className="w-full h-auto rounded-lg shadow-lg"
                    />
                </div>
            </div>
          </section>
          
          <section className="bg-white pt-16 md:pt-24 pb-16 md:pb-24">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Localização Privilegiada</h2>
              <p className="max-w-2xl mx-auto mb-8 text-gray-600">
                Encontre o Residencial Alfa no coração do Alto Esplanada, um bairro que combina tranquilidade e acesso rápido aos principais pontos da cidade.
              </p>
              <div className="w-full h-96 rounded-lg shadow-xl overflow-hidden border">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.123932221089!2d-41.95400582565618!3d-18.657788166699863!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x749c9339007c66b%3A0x768788f2641882c!2sAlto%20Esplanada%2C%20Gov.%20Valadares%20-%20MG%2C%2035020-010!5e0!3m2!1spt-BR!2sbr!4v1727481232870!5m2!1spt-BR!2sbr" 
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
        </>
      )}

      {view === 'morador' && (
        <>
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900" style={{ letterSpacing: '0.02em' }}>Um Novo Conceito de Viver Bem</h2>
                <p className="mb-4 text-gray-700" style={{ letterSpacing: '0.03em' }}>
                  O Residencial Alfa foi pensado em cada detalhe para oferecer o máximo de conforto, segurança e qualidade de vida para você e sua família.
                </p>
                <p className="text-gray-700" style={{ letterSpacing: '0.03em' }}>
                  Desfrute de uma vista privilegiada para a Ibituruna, excelente ventilação natural e a conveniência de estar perto de tudo que você precisa.
                </p>
              </div>
              <div>
                <Image src="/image_47b441.png" alt="Área de Lazer do Residencial Alfa" width={500} height={350} className="rounded-lg shadow-xl mx-auto"/>
              </div>
            </div>
          </section>
          <section className="bg-gray-50 py-16 md:py-24">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900" style={{ letterSpacing: '0.02em' }}>Diferenciais que Transformam seu Dia a Dia</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconePiscina /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Lazer Completo</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Piscina, área gourmet e tudo que você precisa para relaxar e se divertir sem sair de casa.</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeCasa /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Conforto e Sofisticação</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Apartamentos com plantas inteligentes e acabamento de alto padrão, pensados para o seu bem-estar.</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeCoracao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Qualidade de Vida</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>More em um bairro tranquilo, seguro e com fácil acesso a tudo que a cidade oferece de melhor.</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 2 ======================== */}
      {/* =================================================================== */}

      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 3 ======================= */}
      {/* =================================================================== */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900" style={{ letterSpacing: '0.02em' }}>Projetado para seu Conforto</h2>
              <p className="mb-8 text-gray-700" style={{ letterSpacing: '0.03em' }}>
                Apartamentos de 49 m² e 58 m² com plantas inteligentes que otimizam cada espaço, oferecendo o máximo de conforto e funcionalidade.
              </p>
              
              <h3 className="text-center text-lg font-semibold uppercase text-gray-600 tracking-wider mb-8" style={{fontFamily: 'Roboto'}}>
                Layout dos Apartamentos
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8 text-center">
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faRulerCombined} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">58m² e 49m² de área privativa</span>
                </div>
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faBed} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">2 quartos</span>
                </div>
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faBath} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">1 banheiro</span>
                </div>
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faCouch} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">Sala ampla, cozinha e área de serviço</span>
                </div>
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faElevator} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">Elevador</span>
                </div>
                <div className="flex flex-col items-center">
                  <FontAwesomeIcon icon={faCar} className="text-3xl text-gray-600 mb-2" />
                  <span className="text-sm text-gray-700 leading-tight">Uma vaga de garagem</span>
                </div>
              </div>

            </div>
              <div className="md:order-1">
                <Image 
                  src={floorPlanImage} 
                  alt="Planta Humanizada do Apartamento Alfa" 
                  width={500} 
                  height={500} 
                  className="rounded-lg shadow-xl mx-auto cursor-pointer"
                  onClick={() => openModal(floorPlanImage)}
                />
                <p className="text-center text-sm mt-2 text-gray-500" style={{ letterSpacing: '0.03em' }}>Clique na imagem para ampliar</p>
              </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 3 ======================== */}
      {/* =================================================================== */}
      
      {/* =================================================================== */}
      {/* ================= INÍCIO DA SEÇÃO GALERIA ======================= */}
      {/* =================================================================== */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
            Galeria de Imagens
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((image) => (
              <div key={image.id} className="cursor-pointer overflow-hidden rounded-lg shadow-md" onClick={() => openModal(image.src)}>
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* =================== FIM DA SEÇÃO GALERIA ======================== */}
      {/* =================================================================== */}

      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 5 ======================= */}
      {/* =================================================================== */}
      <section id="contato" className="bg-gray-800 text-white py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ letterSpacing: '0.02em' }}>Gostou? Dê o primeiro passo para realizar seu sonho.</h2>
          <p className="mb-8 max-w-2xl mx-auto text-gray-300" style={{ letterSpacing: '0.03em' }}>
            Preencha o formulário abaixo e nossa equipe entrará em contato para oferecer uma consultoria exclusiva e sem compromisso.
          </p>
          <div className="max-w-xl mx-auto">
            <FormularioDeContato />
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 5 ======================== */}
      {/* =================================================================== */}
      
      {/* =================================================================== */}
      {/* =========================== INÍCIO DO RODAPÉ ========================== */}
      {/* =================================================================== */}
      <footer className="bg-black text-white py-6">
        <div className="container mx-auto px-4 text-center text-gray-400" style={{ letterSpacing: '0.03em' }}>
          <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
          <p className="text-sm mt-1">Residencial Alfa - Registro de Incorporação: Nº 24.920/R-08</p>
        </div>
      </footer>
      {/* =================================================================== */}
      {/* ============================ FIM DO RODAPÉ ========================== */}
      {/* =================================================================== */}
      
      {/* --- CÓDIGO DO MODAL UNIFICADO (PARA PLANTA E GALERIA) --- */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute -top-4 -right-4 md:top-2 md:right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors z-10"
              onClick={closeModal}
              aria-label="Fechar imagem"
            >
              <FontAwesomeIcon icon={faXmark} />
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

      {/* BOTÃO DO WHATSAPP */}
      <a 
        href="https://wa.me/553398192119?text=Oi%2C%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Residencial%20Alfa"
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
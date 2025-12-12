// Caminho do arquivo: app/(landingpages)/betasuites/page.js
'use client';

import { useState } from 'react';
import FormularioDeContatoBeta from './FormularioDeContatoBeta';
import Image from 'next/image';
import { Montserrat } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
    faRulerCombined, faBed, faBath, faElevator,
    faHospital, faGraduationCap, faCartShopping, faLocationDot,
    faSchool, faHouseMedical, faUsers, faXmark, faQuoteLeft, faWater, faDumbbell, faUtensils, faTag
} from '@fortawesome/free-solid-svg-icons';

// Importações do Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Navigation } from 'swiper/modules';

// Importação dos estilos do Swiper
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const montserrat = Montserrat({
    subsets: ['latin'],
    weight: ['200', '300', '400', '500', '700', '900'],
});

// --- CONFIGURAÇÕES DO BETA ---
const primaryColor = '#f97316'; // Laranja do Beta

// --- DADOS DA GALERIA ---
const galleryImages = [
    { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png', alt: 'Fachada Beta Suítes' },
    { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png', alt: 'Área gourmet' },
    { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018987365.png', alt: 'Rooftop' },
];

const testimonialsData = [
    {
        id: 1,
        name: "Dr. Marcelo Silva",
        title: "Médico e Investidor",
        photoUrl: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759066935276.png",
        intro: "A localização próxima aos hospitais é perfeita para aluguel.",
        fullText: "Invisto em imóveis compactos há anos. O Beta Suítes tem a localização exata que residentes de medicina procuram: perto do Hospital São Vicente e da UFJF. É garantia de ocupação."
    },
    {
        id: 2,
        name: "Ana Clara",
        title: "Estudante de Medicina",
        photoUrl: "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759067740495.png",
        intro: "Praticidade é tudo que eu preciso na faculdade.",
        fullText: "Ter uma academia e lavanderia no prédio, além de estar a poucos metros da faculdade, me economiza horas do dia. O Beta foi pensado exatamente para o meu estilo de vida."
    }
];

const floorPlanImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta%20humanizada%20aps.png"; 

// Componentes de Ícones
const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeSeguranca = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;

export default function BetaSuitesPage() {
    const [selectedImage, setSelectedImage] = useState(null);
    const [expandedTestimonial, setExpandedTestimonial] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // CONTROLE DE VISIBILIDADE DOS DEPOIMENTOS
    // Mude para 'true' quando tiver depoimentos reais
    const showTestimonials = false;

    const openModal = (imageUrl) => setSelectedImage(imageUrl);
    const closeModal = () => setSelectedImage(null);
    
    const openLeadModal = () => setIsModalOpen(true);
    const closeLeadModal = () => setIsModalOpen(false);

    const handleToggleTestimonial = (id) => {
        setExpandedTestimonial(expandedTestimonial === id ? null : id);
    };

    return (
        <div className={`${montserrat.className} bg-white text-gray-800 font-sans`}>

            <style jsx global>{`
                .swiper-button-next,
                .swiper-button-prev {
                    color: #000000 !important;
                    background-color: rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                    width: 40px !important;
                    height: 40px !important;
                    transition: all 0.3s ease;
                }
                .swiper-button-next:hover,
                .swiper-button-prev:hover {
                    background-color: #ffffff;
                    color: ${primaryColor} !important;
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
                .testimonial-swiper .swiper-slide {
                    height: auto;
                    padding-bottom: 2.5rem; 
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
            
            {/* --- HERO SECTION --- */}
            <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
                <div
                    className="absolute inset-0 bg-no-repeat z-0"
                    style={{
                        backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'left bottom'
                    }}
                ></div>
                
                <div className="absolute inset-0 bg-black/65 z-10"></div>
                
                <div className="relative z-30 flex flex-col items-center p-4 w-full pt-16 sm:pt-0 text-center">
                    <div className="mb-4 drop-shadow-2xl">
                        <Image 
                            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png"
                            alt="Beta Suítes Logo"
                            width={350}
                            height={150}
                            className="object-contain"
                            priority
                        />
                    </div>

                    <div className="mt-4 text-center max-w-2xl">
                         <p className="text-lg md:text-xl font-light text-gray-100 drop-shadow-md uppercase tracking-wider">
                            Suítes de 23 a 32m² no Alto Esplanada.
                         </p>
                         <p className="text-2xl md:text-3xl font-bold text-orange-500 mt-2 drop-shadow-md">
                            A partir de R$ 190.000
                         </p>
                    </div>
                </div>
            </section>
            
            {/* --- SEGUNDA DOBRA: PRÉ-LANÇAMENTO --- */}
            <section className="bg-white py-16 md:py-20">
                <div className="container mx-auto px-4 text-center">
                    <div className="max-w-3xl mx-auto bg-gray-50 p-8 rounded-2xl shadow-lg border border-gray-100">
                        
                        {/* Selo de Destaque */}
                        <div className="inline-block bg-orange-100 text-orange-600 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest mb-6">
                            Fase de Pré-Lançamento
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                            Condições Especiais
                        </h2>
                        
                        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                            O Beta Suítes está em fase exclusiva de pré-lançamento. Aproveite este momento único para garantir sua unidade com <strong>tabela especial de investidor</strong> e máxima rentabilidade futura.
                        </p>
                        
                        {/* Ícones de Destaque da Oportunidade */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-10">
                            <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                <FontAwesomeIcon icon={faTag} className="text-3xl text-orange-500 mb-3"/>
                                <p className="font-bold text-gray-800">Preço de Tabela Zero</p>
                            </div>
                            <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                <FontAwesomeIcon icon={faGraduationCap} className="text-3xl text-orange-500 mb-3"/>
                                <p className="font-bold text-gray-800">Alta Demanda UFJF</p>
                            </div>
                            <div className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                <FontAwesomeIcon icon={faHouseMedical} className="text-3xl text-orange-500 mb-3"/>
                                <p className="font-bold text-gray-800">Polo de Saúde</p>
                            </div>
                        </div>
                        
                        <div>
                            <button
                                onClick={openLeadModal}
                                className="inline-block bg-orange-500 text-white font-bold py-4 px-10 rounded-full hover:bg-orange-600 transition-colors duration-300 shadow-xl uppercase tracking-wide transform hover:scale-105"
                            >
                                Quero Aproveitar a Oportunidade
                            </button>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* --- DEPOIMENTOS (ESCONDIDO CONDICIONALMENTE) --- */}
            {showTestimonials && (
                <section className="bg-gray-50 py-16 md:py-24">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
                            Por que escolher o Beta?
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
                                        <div className="bg-white rounded-xl p-8 pt-16 shadow-lg h-full flex flex-col text-center relative mt-12 border border-gray-100">
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                                <Image
                                                    src={testimonial.photoUrl}
                                                    alt={testimonial.name}
                                                    width={96}
                                                    height={96}
                                                    className="rounded-full object-cover border-4 border-gray-50 shadow-md"
                                                />
                                            </div>

                                            <div className="flex-grow">
                                                <p className="font-bold text-gray-900 text-lg mt-2">{testimonial.name}</p>
                                                <p className="text-sm text-gray-500 mb-4">{testimonial.title}</p>
                                                
                                                <FontAwesomeIcon icon={faQuoteLeft} className="text-orange-500 text-2xl mb-4" />
                                                <p className="text-gray-600 italic mb-4">{`"${testimonial.intro}"`}</p>
                                                
                                                <AnimatePresence>
                                                    {expandedTestimonial === testimonial.id && (
                                                        <motion.p
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.4 }}
                                                            className="text-gray-600 text-left text-sm"
                                                        >
                                                            {testimonial.fullText}
                                                        </motion.p>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            
                                            <button
                                                onClick={() => handleToggleTestimonial(testimonial.id)}
                                                className="text-orange-500 font-bold self-center mt-4 hover:underline"
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
            )}
            
            {/* --- CARACTERÍSTICAS (BG BRANCO) --- */}
            <section className="py-16 md:py-24 bg-white">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 bg-gray-50 rounded-xl text-center hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="mb-4 inline-block text-orange-500"><IconeLocalizacao /></div>
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Polo Regional</h3>
                            <p className="text-gray-600">GV atrai fluxo constante de estudantes de medicina e profissionais de saúde das cidades vizinhas.</p>
                        </div>
                        <div className="p-8 bg-gray-50 rounded-xl text-center hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="mb-4 inline-block text-orange-500"><IconeRentabilidade /></div>
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Alta Demanda</h3>
                            <p className="text-gray-600">A poucos passos da UFJF-GV e hospitais. Garantia de alta taxa de ocupação para seu investimento.</p>
                        </div>
                        <div className="p-8 bg-gray-50 rounded-xl text-center hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100">
                            <div className="mb-4 inline-block text-orange-500"><IconeSeguranca /></div>
                            <h3 className="text-xl font-bold mb-2 text-gray-900">Segurança Patrimonial</h3>
                            <p className="text-gray-600">O Alto Esplanada oferece segurança total contra sazonalidades climáticas (Livre de enchentes).</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- LOCALIZAÇÃO (BG CINZA CLARO) --- */}
            <section className="bg-gray-50 pb-16 md:pb-24 pt-16">
                <div className="container mx-auto px-4">
                    <div className="mt-0">
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-12">
                            Localização Estratégica
                        </h3>
                        <div className="relative max-w-sm mx-auto">
                            {/* Linha do tempo em cinza */}
                            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-300"></div>
                            
                            <div className="relative pl-10 pb-8">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-orange-500 rounded-full border-4 border-white shadow-sm"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faLocationDot} className="text-2xl text-orange-500 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">Beta Suítes</p>
                                        <p className="text-sm text-gray-500">Alto Esplanada</p>
                                    </div>
                                </div>
                            </div>

                            {/* Itens seguintes */}
                            <div className="relative pl-10 pb-8">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-gray-600 rounded-full border-4 border-white"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faGraduationCap} className="text-2xl text-gray-600 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800">UFJF-GV</p><p className="text-sm text-gray-500">950m</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="relative pl-10 pb-8">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-gray-600 rounded-full border-4 border-white"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faSchool} className="text-2xl text-gray-600 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800">Maple Bear</p><p className="text-sm text-gray-500">950m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="relative pl-10 pb-8">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-gray-600 rounded-full border-4 border-white"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faUsers} className="text-2xl text-gray-600 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800">Clube Filadélfia</p><p className="text-sm text-gray-500">1.6km</p>
                                    </div>
                                </div>
                            </div>

                            <div className="relative pl-10 pb-8">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-gray-600 rounded-full border-4 border-white"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faCartShopping} className="text-2xl text-gray-600 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800">Big Mais Supermercado</p><p className="text-sm text-gray-500">1.7km</p>
                                    </div>
                                </div>
                            </div>

                            <div className="relative pl-10">
                                <div className="absolute left-0 top-1 w-5 h-5 bg-gray-600 rounded-full border-4 border-white"></div>
                                <div className="flex items-center">
                                    <FontAwesomeIcon icon={faHospital} className="text-2xl text-gray-600 mr-4" />
                                    <div>
                                        <p className="font-bold text-gray-800">Hospitais (São Vicente/Unimed)</p><p className="text-sm text-gray-500">Próximos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white pt-16 md:pt-24 pb-16 md:pb-24">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Mapa</h2>
                    <p className="max-w-2xl mx-auto mb-8 text-gray-600">
                        Explore a região do Alto Esplanada.
                    </p>
                    <div className="w-full h-96 rounded-xl shadow-xl overflow-hidden border border-gray-200">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.40228156114!2d-41.95698588889815!3d-18.646002766395343!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7b102ff6720d20b%3A0x8a9e48f1b1b1e7f!2sResidencial%20Alfa!5e0!3m2!1spt-BR!2sbr!4v1727544078174!5m2!1spt-BR!2sbr"
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
            
            {/* --- LAYOUTS (BG CINZA CLARO) --- */}
            <section className="py-16 md:py-24 bg-gray-50">
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="md:order-2">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Layouts Inteligentes</h2>
                        <p className="mb-8 text-gray-700">
                            Suítes de 23m² a 32m² projetadas para otimizar cada centímetro, oferecendo funcionalidade total para o dia a dia.
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-8 text-center bg-white p-8 rounded-xl shadow-sm">
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faRulerCombined} className="text-3xl text-orange-500 mb-2" />
                                <span className="text-sm text-gray-700 font-medium">23m² a 32m²</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faBed} className="text-3xl text-orange-500 mb-2" />
                                <span className="text-sm text-gray-700 font-medium">Suíte Integrada</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faBath} className="text-3xl text-orange-500 mb-2" />
                                <span className="text-sm text-gray-700 font-medium">Banheiro Moderno</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faElevator} className="text-3xl text-orange-500 mb-2" />
                                <span className="text-sm text-gray-700 font-medium">Elevador</span>
                            </div>
                        </div>
                    </div>
                    <div className="md:order-1 relative">
                        <div className="group cursor-pointer relative overflow-hidden rounded-lg shadow-xl" onClick={() => openModal(floorPlanImage)}>
                            <Image
                                src={floorPlanImage}
                                alt="Planta Baixa Beta"
                                width={500}
                                height={500}
                                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 font-bold bg-black/50 px-4 py-2 rounded-full">Ampliar Planta</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* --- GALERIA (BG PRETO) --- */}
            <section className="bg-black py-16 md:py-24 text-white">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                        Galeria de Imagens
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
                                            style={{objectFit: 'cover'}}
                                            className="rounded-lg cursor-pointer shadow-lg border border-gray-800"
                                            onClick={() => openModal(image.src)}
                                        />
                                    </div>
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                </div>
            </section>
            
            {/* --- CTA FINAL (BG PRETO com Botão Laranja) --- */}
            <section className="bg-black py-16 md:py-20 relative overflow-hidden border-t border-gray-800">
                <div className="container mx-auto px-4 text-center relative z-10">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Garanta condições de Pré-Lançamento</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-8 text-lg">Cadastre-se para receber a tabela de vendas e o book completo do Beta Suítes.</p>
                    <button 
                        onClick={openLeadModal}
                        className="inline-block bg-orange-500 text-white font-bold py-4 px-10 rounded-full hover:bg-orange-600 transition-all duration-300 shadow-2xl transform hover:scale-105 uppercase tracking-wider"
                    >
                        Solicitar Tabela e Book
                    </button>
                </div>
            </section>
            
            <footer className="bg-black text-white py-8 border-t border-gray-900">
                <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
                    <div className="mb-4">
                         <Image
                            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG" 
                            alt="Studio 57"
                            width={100}
                            height={40}
                            className="mx-auto opacity-50 grayscale hover:grayscale-0 transition-all"
                        />
                    </div>
                    <p>© {new Date().getFullYear()} Studio 57 Arquitetura e Incorporação.</p>
                    <p className="mt-1">Beta Suítes - Alto Esplanada, Governador Valadares.</p>
                </div>
            </footer>
            
            {selectedImage && (
                 <div
                 className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                 onClick={closeModal}
             >
                 <div
                     className="relative max-w-5xl max-h-[90vh]"
                     onClick={(e) => e.stopPropagation()}
                 >
                     <button
                         className="absolute -top-10 right-0 text-white hover:text-orange-500 transition-colors z-10"
                         onClick={closeModal}
                         aria-label="Fechar imagem"
                     >
                         <FontAwesomeIcon icon={faXmark} size="2x" />
                     </button>
                     <Image
                         src={selectedImage}
                         alt="Imagem Ampliada"
                         width={1200}
                         height={800}
                         className="rounded-lg shadow-2xl object-contain max-h-[90vh] w-auto border border-gray-800"
                     />
                 </div>
             </div>
            )}
            
            {isModalOpen && (
                <FormularioDeContatoBeta onClose={closeLeadModal} />
            )}
            
            <a
                href="https://wa.me/5533998192119?text=Oi%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Beta%20Suítes"
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 z-50 transform hover:scale-110 transition-transform duration-300"
                aria-label="Converse no WhatsApp"
            >
                <div className="w-16 h-16 bg-green-500 rounded-full shadow-lg flex items-center justify-center border-4 border-white">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-white text-4xl" />
                </div>
            </a>
        </div>
    );
}
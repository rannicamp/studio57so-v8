// Caminho: app/(landingpages)/betasuites/BetaSuitesClient.js
'use client';

import { useState } from 'react';
import FormularioDeContatoBeta from './FormularioDeContatoBeta';
import Image from 'next/image';
import { Montserrat } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import {
    faRulerCombined, faBed, faElevator,
    faHospital, faGraduationCap, faCartShopping, faLocationDot,
    faSchool, faHouseMedical, faUsers, faXmark, faWater, 
    faDumbbell, faUtensils, faTag, faLandmark, faCar, faJugDetergent
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
const primaryColor = '#f97316'; 

// --- DADOS DA GALERIA ---
const galleryImages = [
    { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765545243766.png', alt: 'Fachada Beta Suítes' },
    { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549015211.png', alt: 'Hall de Entrada' },
    { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549054789.png', alt: 'Hall Social' },
    { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549105693.png', alt: 'Lavanderia Compartilhada' },
    { id: 5, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549145583.png', alt: 'Cozinha Compacta' },
    { id: 6, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549893836.png', alt: 'Suíte Decorada' },
    { id: 7, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765549928135.png', alt: 'Vista da Suíte' },
    { id: 8, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765550073799.png', alt: 'Academia Equipada' },
    { id: 9, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765550115538.png', alt: 'Terraço Gourmet' },
    { id: 10, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765550163018.png', alt: 'Área de Lazer no Terraço' },
];

// --- DADOS DAS PLANTAS ---
const floorPlanImages = [
    { id: 1, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556400555.png', alt: 'Planta Humanizada Opção 1' },
    { id: 2, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556372569.png', alt: 'Planta Humanizada Opção 2' },
    { id: 3, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556336345.png', alt: 'Planta Humanizada Opção 3' },
    { id: 4, src: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765556430412.png', alt: 'Planta Humanizada Opção 4' },
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

export default function BetaSuitesClient() {
    const [selectedImage, setSelectedImage] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (imageUrl) => setSelectedImage(imageUrl);
    const closeModal = () => setSelectedImage(null);
    
    const openLeadModal = () => setIsModalOpen(true);
    const closeLeadModal = () => setIsModalOpen(false);

    return (
        // FUNDO GERAL PRETO
        <div className={`${montserrat.className} bg-black text-gray-200 font-sans`}>

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
                
                <div className="absolute inset-0 bg-black/70 z-10"></div>
                
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
            
            {/* --- SEGUNDA DOBRA: PRÉ-LANÇAMENTO (Efeito Vidro) --- */}
            <section className="bg-black py-16 md:py-20 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-black to-black pointer-events-none"></div>
                
                <div className="w-full px-4 text-center relative z-10">
                    <div className="max-w-3xl mx-auto bg-white/5 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/10">
                        
                        <div className="inline-block bg-orange-500/10 text-orange-500 px-4 py-1 rounded-full text-sm font-bold uppercase tracking-widest mb-6 border border-orange-500/20">
                            Fase de Pré-Lançamento
                        </div>

                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
                            Condições Especiais
                        </h2>
                        
                        <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                            O Beta Suítes está em fase exclusiva de pré-lançamento. Aproveite este momento único para garantir sua unidade com <strong>tabela especial de investidor</strong> e máxima rentabilidade futura.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-10">
                            <div className="p-6 bg-black/40 rounded-xl shadow-sm border border-white/5 hover:border-white/20 transition-colors">
                                <FontAwesomeIcon icon={faTag} className="text-3xl text-white mb-3"/>
                                <p className="font-bold text-gray-200">Preço de Pré-Lançamento</p>
                            </div>
                            
                            <div className="p-6 bg-black/40 rounded-xl shadow-sm border border-white/5 hover:border-white/20 transition-colors">
                                <FontAwesomeIcon icon={faGraduationCap} className="text-3xl text-white mb-3"/>
                                <p className="font-bold text-gray-200">Alta Demanda Estudantil</p>
                            </div>
                            
                            <div className="p-6 bg-black/40 rounded-xl shadow-sm border border-white/5 hover:border-white/20 transition-colors">
                                <FontAwesomeIcon icon={faHouseMedical} className="text-3xl text-white mb-3"/>
                                <p className="font-bold text-gray-200">Polo de Saúde</p>
                            </div>
                        </div>
                        
                        <div>
                            <button
                                onClick={openLeadModal}
                                className="inline-block bg-orange-500 text-white font-bold py-4 px-10 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-lg shadow-orange-500/20 uppercase tracking-wide transform hover:scale-105"
                            >
                                Quero Aproveitar a Oportunidade
                            </button>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* --- CARACTERÍSTICAS (Efeito Vidro) --- */}
            <section className="py-16 md:py-24 bg-black">
                <div className="w-full px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 bg-white/5 backdrop-blur-sm rounded-xl text-center hover:bg-white/10 transition-all duration-300 border border-white/10 shadow-lg">
                            <div className="mb-4 inline-block text-white"><IconeLocalizacao /></div>
                            <h3 className="text-xl font-bold mb-2 text-white">Polo Regional</h3>
                            <p className="text-gray-400">GV atrai fluxo constante de estudantes de medicina e profissionais de saúde das cidades vizinhas.</p>
                        </div>
                        <div className="p-8 bg-white/5 backdrop-blur-sm rounded-xl text-center hover:bg-white/10 transition-all duration-300 border border-white/10 shadow-lg">
                            <div className="mb-4 inline-block text-white"><IconeRentabilidade /></div>
                            <h3 className="text-xl font-bold mb-2 text-white">Alta Demanda</h3>
                            <p className="text-gray-400">A poucos passos da UFJF-GV e hospitais. Garantia de alta taxa de ocupação para seu investimento.</p>
                        </div>
                        <div className="p-8 bg-white/5 backdrop-blur-sm rounded-xl text-center hover:bg-white/10 transition-all duration-300 border border-white/10 shadow-lg">
                            <div className="mb-4 inline-block text-white"><IconeSeguranca /></div>
                            <h3 className="text-xl font-bold mb-2 text-white">Segurança Patrimonial</h3>
                            <p className="text-gray-400">O Alto Esplanada oferece segurança total contra sazonalidades climáticas (Livre de enchentes).</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- LOCALIZAÇÃO (Efeito Vidro) --- */}
            <section className="bg-black pb-16 md:pb-24 pt-16">
                <div className="w-full px-4">
                    <div className="mt-0">
                        <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
                            Localização Estratégica
                        </h3>
                        <div className="relative max-w-sm mx-auto">
                            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-white/20"></div>
                            
                            {locationPoints.map((point, index) => (
                                <div key={index} className={`relative pl-10 ${index === locationPoints.length - 1 ? '' : 'pb-8'}`}>
                                    <div 
                                        className={`absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-black shadow-sm ${
                                            point.highlight ? 'bg-white' : 'bg-white/20'
                                        }`}
                                    ></div>
                                    <div className="flex items-center">
                                        <FontAwesomeIcon 
                                            icon={point.icon} 
                                            className={`text-2xl mr-4 ${point.highlight ? 'text-white' : 'text-gray-500'}`} 
                                        />
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
                        
                        <div className="mt-16 md:mt-24">
                             <Image
                                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1765557975005.png" 
                                alt="Beta Suítes - Inserção no Local"
                                width={1200}
                                height={800}
                                className="w-full h-auto rounded-xl shadow-2xl border border-white/10"
                            />
                            <p className="text-center text-sm text-gray-500 mt-4 italic">
                                Perspectiva ilustrativa de inserção no local.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- MAPA --- */}
            <section className="bg-black pt-16 md:pt-24 pb-16 md:pb-24">
                <div className="w-full px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Mapa</h2>
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
            
            {/* --- LAYOUTS INTELIGENTES --- */}
            <section className="py-16 md:py-24 bg-black">
                <div className="w-full px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="md:order-2">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Layouts Inteligentes</h2>
                        <p className="mb-8 text-gray-300">
                            Suítes de 23m² a 32m² projetadas para otimizar cada centímetro, oferecendo funcionalidade total para o dia a dia e áreas comuns completas.
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8 text-center bg-white/5 backdrop-blur-md p-8 rounded-xl shadow-lg border border-white/10">
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faRulerCombined} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">23m² a 32m²</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faBed} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Suíte Integrada</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faCar} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Vaga de Garagem</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faElevator} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Elevador</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faJugDetergent} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Lavanderia</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faDumbbell} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Academia</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faWater} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Piscina</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faUtensils} className="text-3xl text-white mb-2" />
                                <span className="text-sm text-gray-300 font-medium">Área Gourmet</span>
                            </div>
                        </div>
                    </div>
                    <div className="md:order-1 relative">
                        {/* SWIPER DE PLANTAS */}
                        <div className="relative rounded-lg shadow-xl overflow-hidden bg-white/5 border border-white/10">
                            <Swiper
                                slidesPerView={1}
                                loop={true}
                                pagination={{ clickable: true }}
                                navigation={true}
                                modules={[Pagination, Navigation]}
                                className="floorplan-swiper"
                            >
                                {floorPlanImages.map((plan) => (
                                    <SwiperSlide key={plan.id}>
                                        <div 
                                            className="relative group cursor-pointer"
                                            onClick={() => openModal(plan.src)}
                                        >
                                            <Image
                                                src={plan.src}
                                                alt={plan.alt}
                                                width={500}
                                                height={500}
                                                className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                                <span className="text-white opacity-0 group-hover:opacity-100 font-bold bg-black/70 px-4 py-2 rounded-full border border-white/20">
                                                    Ampliar Planta
                                                </span>
                                            </div>
                                        </div>
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                            <p className="text-center text-xs text-gray-400 py-2 bg-black/50">Arraste para ver mais opções</p>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* --- GALERIA COMPLETA --- */}
            <section className="bg-black py-16 md:py-24 text-white">
                <div className="w-full px-4">
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
            
            {/* --- CTA FINAL --- */}
            <section className="bg-black py-16 md:py-20 relative overflow-hidden border-t border-white/10">
                <div className="absolute inset-0 bg-orange-900/5 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/10 via-black to-black pointer-events-none"></div>
                <div className="w-full px-4 text-center relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Garanta condições de Pré-Lançamento</h2>
                    <p className="text-gray-300 max-w-2xl mx-auto mb-10 text-lg">Cadastre-se para receber a tabela de vendas exclusiva e o book completo do Beta Suítes.</p>
                    <button 
                        onClick={openLeadModal}
                        className="inline-block bg-orange-500 text-white font-bold py-4 px-12 rounded-lg hover:bg-orange-600 transition-all duration-300 shadow-lg shadow-orange-500/30 transform hover:scale-105 uppercase tracking-wider text-lg"
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
                            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG" 
                            alt="Studio 57"
                            width={120}
                            height={48}
                            className="mx-auto opacity-70 grayscale hover:grayscale-0 transition-all duration-300"
                        />
                    </div>
                    <p className="text-gray-500 text-sm mb-2">© {new Date().getFullYear()} Studio 57 Arquitetura e Incorporação.</p>
                    <p className="text-gray-400 font-medium">Beta Suítes - Alto Esplanada, Governador Valadares.</p>
                </div>
            </footer>
            
            {/* --- MODAL DE IMAGEM --- */}
            {selectedImage && (
                 <div
                 className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                 onClick={closeModal}
             >
                 <div
                     className="relative max-w-5xl max-h-[90vh]"
                     onClick={(e) => e.stopPropagation()}
                 >
                     <button
                         className="absolute -top-12 right-0 text-gray-300 hover:text-orange-500 transition-colors z-10"
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
                         className="rounded-lg shadow-2xl object-contain max-h-[90vh] w-auto border border-white/10"
                     />
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
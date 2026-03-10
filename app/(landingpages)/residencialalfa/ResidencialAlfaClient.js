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
    faSwimmingPool, faChartLine, faSackDollar, faCheck
} from '@fortawesome/free-solid-svg-icons';

// Importações do Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Pagination, Navigation } from 'swiper/modules';

// Importação dos estilos do Swiper
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// Import dos Formulários
import FormularioDeContato from './FormularioDeContato';
import FormularioCaixa from './FormularioCaixa';

const roboto = Roboto({
    weight: ['100', '300', '400', '500', '700', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-roboto',
});

// --- DADOS DA GALERIA ---
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
        intro: "Para mim, o Residencial Alfa não é apenas um apartamento, é um investimento estratégico.",
        fullText: "Para mim, o Residencial Alfa não é apenas um apartamento, é um investimento estratégico no futuro das minhas filhas, combinando localização premium, qualidade construtiva e, o mais importante, segurança e potencial de valorização a longo prazo."
    }
];

const floorPlanImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta%20humanizada%20aps.png";
const primaryColor = '#45301f'; 

const IconeLocalizacao = () => <FontAwesomeIcon icon={faLocationDot} className="w-8 h-8" />;
const IconeValorizacao = () => <FontAwesomeIcon icon={faChartLine} className="w-8 h-8" />;
const IconeRentabilidade = () => <FontAwesomeIcon icon={faSackDollar} className="w-8 h-8" />;
const IconeCasa = () => <FontAwesomeIcon icon={faCity} className="w-8 h-8" />;
const IconeCoracao = () => <FontAwesomeIcon icon={faUsers} className="w-8 h-8" />;
const IconePiscina = () => <FontAwesomeIcon icon={faSwimmingPool} className="w-8 h-8" />;

export default function ResidencialAlfaClient() {
    const [view, setView] = useState('investidor'); 
    const [selectedImage, setSelectedImage] = useState(null);
    const [expandedTestimonial, setExpandedTestimonial] = useState(null);
    
    // Estados para os Modais
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // Modal Padrão (Book)
    const [isCaixaModalOpen, setIsCaixaModalOpen] = useState(false); // Modal Caixa (Simulação)

    const openModal = (imageUrl) => setSelectedImage(imageUrl);
    const closeModal = () => setSelectedImage(null);
    
    // Funções para abrir/fechar Modal Padrão
    const openLeadModal = () => setIsLeadModalOpen(true);
    const closeLeadModal = () => setIsLeadModalOpen(false);

    // Funções para abrir/fechar Modal Caixa
    const openCaixaModal = () => setIsCaixaModalOpen(true);
    const closeCaixaModal = () => setIsCaixaModalOpen(false);

    const handleToggleTestimonial = (id) => {
        setExpandedTestimonial(expandedTestimonial === id ? null : id);
    };

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
                .testimonial-swiper .swiper-slide {
                    height: auto;
                    padding-bottom: 2.5rem; 
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
                .focus\\:border-primary:focus {
                    border-color: ${primaryColor};
                }
                .focus\\:ring-primary:focus {
                    --tw-ring-color: ${primaryColor};
                    --tw-ring-opacity: 1;
                    box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                }
            `}</style>
            
            {/* HERO SECTION */}
            <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
                <div
                    className="absolute inset-0 bg-no-repeat bg-right-bottom z-0"
                    style={{
                        backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/capa%20vazia2.png')",
                        backgroundSize: 'cover',
                    }}
                ></div>
                <div className="absolute inset-0 bg-black opacity-30 z-10"></div>
                
                <div className="relative z-30 flex flex-col items-center text-center p-4 w-full pt-16 sm:pt-0">
                    <Image
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png"
                        alt="Logo Residencial Alfa"
                        width={500}
                        height={200}
                        className="w-full max-w-xs md:max-w-md object-contain mb-8"
                        priority
                    />

                    <h1 className="font-sans text-2xl md:text-4xl font-thin uppercase tracking-widest text-shadow-lg mb-2">
                        Alto Esplanada
                    </h1>
                    <p className="font-sans text-lg md:text-xl text-shadow font-thin tracking-wider opacity-90 mb-8">
                        Investimento inteligente em Governador Valadares
                    </p>

                    <div className="bg-black/30 backdrop-blur-sm rounded-full p-1 flex items-center">
                        <button
                            onClick={() => setView('investidor')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'investidor' ? 'bg-primary text-white' : 'text-white'}`}
                        >
                            Sou Investidor
                        </button>
                        <button
                            onClick={() => setView('morador')}
                            className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'morador' ? 'bg-primary text-white' : 'text-white'}`}
                        >
                            Quero Morar
                        </button>
                    </div>
                </div>
            </section>

            {/* --- SEÇÃO CAIXA (BOTÃO ABRE MODAL CAIXA) --- */}
            <section className="relative py-16 md:py-24 flex items-center justify-center text-white overflow-hidden">
                {/* Background Image (Azul Caixa) */}
                <div
                    className="absolute inset-0 bg-center bg-cover z-0"
                    style={{
                        backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1769174467802.png')",
                    }}
                ></div>
                
                {/* Conteúdo */}
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
                        Financiamento Facilitado
                    </h2>

                    <p className="text-xl md:text-2xl font-light max-w-3xl mx-auto mb-10 leading-relaxed text-white">
                        Realize o sonho do seu imóvel próprio com as melhores condições do mercado.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 hover:bg-white/20 transition-all duration-300 group">
                            <p className="text-5xl font-bold mb-2 text-white group-hover:scale-110 transition-transform">20%</p>
                            <p className="text-sm font-bold uppercase tracking-widest text-white/90">de Entrada</p>
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
                        {/* AQUI ESTÁ O BOTÃO QUE ABRE O MODAL CAIXA */}
                        <button
                            onClick={openCaixaModal}
                            className="bg-white text-blue-800 font-bold py-4 px-10 rounded-full hover:bg-gray-100 transition-all shadow-xl transform hover:scale-105 uppercase tracking-wide border-2 border-transparent hover:border-white"
                        >
                            <FontAwesomeIcon icon={faCheck} className="mr-2" />
                            Simular Meu Financiamento
                        </button>
                    </div>
                </div>
            </section>
            
            {/* SEÇÃO RENTABILIDADE */}
            <section className="bg-gray-50 py-16 md:py-20">
                <div className="w-full px-4 text-center container mx-auto">
                    <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
                        <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-gray-500 mb-4">
                            Transforme seu dinheiro em Renda Passiva
                        </h2>
                        <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Até R$ 4.144,25/mês
                        </p>
                        <p className="text-gray-600">
                            Com aluguel temporário no Residencial Alfa, em um cenário de alta ocupação (70%). Uma oportunidade única de investimento com retorno rápido e seguro.
                        </p>
                        <div className="mt-8">
                            <a
                                href="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/RLT_1759011023928.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                download="Analise_de_Rentabilidade_Residencial_Alfa.pdf"
                                className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity duration-300 shadow-lg"
                            >
                                <FontAwesomeIcon icon={faChartLine} className="mr-2" />
                                Download da Análise de Rentabilidade
                            </a>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* DEPOIMENTOS */}
            <section className="bg-white py-16 md:py-24">
                <div className="w-full px-4 container mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
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
                                    <div className="bg-gray-50 rounded-lg p-8 pt-16 shadow-md h-full flex flex-col text-center relative mt-12">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <Image
                                                src={testimonial.photoUrl}
                                                alt={testimonial.name}
                                                width={96}
                                                height={96}
                                                className="rounded-full object-cover border-4 border-white shadow-md"
                                            />
                                        </div>

                                        <div className="flex-grow">
                                            <p className="font-bold text-gray-900 text-lg mt-2">{testimonial.name}</p>
                                            <p className="text-sm text-gray-500 mb-4">{testimonial.title}</p>
                                            
                                            <FontAwesomeIcon icon={faQuoteLeft} className="text-primary text-2xl mb-4" />
                                            <p className="text-gray-600 italic mb-4">{`"${testimonial.intro}"`}</p>
                                            
                                            <AnimatePresence>
                                                {expandedTestimonial === testimonial.id && (
                                                    <motion.p
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.4 }}
                                                        className="text-gray-600 text-left"
                                                    >
                                                        {testimonial.fullText}
                                                    </motion.p>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        
                                        <button
                                            onClick={() => handleToggleTestimonial(testimonial.id)}
                                            className="text-primary font-bold self-center mt-4 hover:underline"
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
            
            {/* CONTEÚDO CONDICIONAL */}
            {view === 'investidor' && (
                <>
                    <section className="py-16 md:py-24 bg-white">
                        <div className="w-full px-4 container mx-auto">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                    <div className="mb-4 inline-block text-primary"><IconeLocalizacao /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Localização Estratégica</h3>
                                    <p className="text-gray-600">Próximo ao Centro, UFJF e hospitais. O ponto mais desejado para aluguéis de curta e longa duração.</p>
                                </div>
                                <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                    <div className="mb-4 inline-block text-primary"><IconeRentabilidade /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Demanda Elevada</h3>
                                    <p className="text-gray-600">Governador Valadares recebe em média 13 mil turistas por mês, garantindo alta taxa de ocupação.</p>
                                </div>
                                <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                    <div className="mb-4 inline-block text-primary"><IconeValorizacao /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Valorização Garantida</h3>
                                    <p className="text-gray-600">Invista no Alto Esplanada, o bairro com maior potencial de valorização da cidade, e veja seu patrimônio crescer.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="bg-white pb-16 md:pb-24">
                        <div className="w-full px-4 container mx-auto">
                            <div className="mt-0">
                                <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center mb-12">
                                    Mapa de Proximidades
                                </h3>
                                <div className="relative max-w-sm mx-auto">
                                    <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-300"></div>
                                    
                                    <div className="relative pl-10 pb-8">
                                        <div className="absolute left-0 top-1 w-5 h-5 bg-primary rounded-full border-4 border-white"></div>
                                        <div className="flex items-center">
                                            <FontAwesomeIcon icon={faLocationDot} className="text-2xl text-primary mr-4" />
                                            <div>
                                                <p className="font-bold text-gray-800">Residencial Alfa</p>
                                                <p className="text-sm text-gray-500">Ponto de partida</p>
                                            </div>
                                        </div>
                                    </div>

                                    {[
                                        {icon: faSchool, title: 'Maple Bear', time: '1 min'},
                                        {icon: faHouseMedical, title: 'Casa Unimed', time: '2 min'},
                                        {icon: faGraduationCap, title: 'UFJF-GV', time: '2 min'},
                                        {icon: faUsers, title: 'Clube Filadélfia', time: '4 min'},
                                        {icon: faHospital, title: 'Hospital São Lucas', time: '5 min'},
                                        {icon: faCartShopping, title: 'Supermercado Big Mais', time: '5 min'},
                                    ].map((item, idx) => (
                                        <div key={idx} className="relative pl-10 pb-8">
                                            <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                            <div className="flex items-center">
                                                <FontAwesomeIcon icon={item.icon} className="text-2xl text-primary mr-4" />
                                                <div>
                                                    <p className="font-bold text-gray-800">{item.title}</p>
                                                    <p className="text-sm text-gray-500">{item.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
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
                        <div className="w-full px-4 text-center container mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Localização Privilegiada</h2>
                            <p className="max-w-2xl mx-auto mb-8 text-gray-600">
                                Encontre o Residencial Alfa no coração do Alto Esplanada, um bairro que combina tranquilidade e acesso rápido aos principais pontos da cidade.
                            </p>
                            <div className="w-full h-96 rounded-lg shadow-xl overflow-hidden border">
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
                </>
            )}

            {view === 'morador' && (
                <>
                    <section className="py-16 md:py-24 bg-white">
                        <div className="w-full px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center container mx-auto">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Um Novo Conceito de Viver Bem</h2>
                                <p className="mb-4 text-gray-700">
                                    O Residencial Alfa foi pensado em cada detalhe para oferecer o máximo de conforto, segurança e qualidade de vida para você e sua família.
                                </p>
                                <p className="text-gray-700">
                                    Desfrute de uma vista privilegiada para a Ibituruna, excelente ventilação natural e a conveniência de estar perto de tudo que você precisa.
                                </p>
                            </div>
                            <div>
                                <Image src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png" alt="Área de Lazer do Residencial Alfa" width={500} height={350} className="rounded-lg shadow-xl mx-auto" />
                            </div>
                        </div>
                    </section>
                    <section className="bg-gray-50 py-16 md:py-24">
                        <div className="w-full px-4 text-center container mx-auto">
                            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">Diferenciais que Transformam seu Dia a Dia</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                                <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                    <div className="mb-4 inline-block text-primary"><IconePiscina /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Lazer Completo</h3>
                                    <p className="text-gray-600">Piscina, área gourmet e tudo que você precisa para relaxar e se divertir sem sair de casa.</p>
                                </div>
                                <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                    <div className="mb-4 inline-block text-primary"><IconeCasa /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Conforto e Sofisticação</h3>
                                    <p className="text-gray-600">Apartamentos com plantas inteligentes e acabamento de alto padrão, pensados para o seu bem-estar.</p>
                                </div>
                                <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                    <div className="mb-4 inline-block text-primary"><IconeCoracao /></div>
                                    <h3 className="text-xl font-bold mb-2 text-gray-900">Qualidade de Vida</h3>
                                    <p className="text-gray-600">More em um bairro tranquilo, seguro e com fácil acesso a tudo que a cidade oferece de melhor.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            )}
            
            {/* PLANTAS */}
            <section className="py-16 md:py-24 bg-white">
                <div className="w-full px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center container mx-auto">
                    <div className="md:order-2">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Projetado para seu Conforto</h2>
                        <p className="mb-8 text-gray-700">
                            Apartamentos de 49 m² e 58 m² com plantas inteligentes que otimizam cada espaço, oferecendo o máximo de conforto e funcionalidade.
                        </p>

                        <h3 className="text-center text-lg font-semibold uppercase text-gray-600 tracking-wider mb-8">
                            Layout dos Apartamentos
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-8 text-center">
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faRulerCombined} className="text-3xl text-primary mb-2" />
                                <span className="text-sm text-gray-700 leading-tight">58m² e 49m² de área privativa</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faBed} className="text-3xl text-primary mb-2" />
                                <span className="text-sm text-gray-700 leading-tight">2 quartos</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faBath} className="text-3xl text-primary mb-2" />
                                <span className="text-sm text-gray-700 leading-tight">1 banheiro</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faCouch} className="text-3xl text-primary mb-2" />
                                <span className="text-sm text-gray-700 leading-tight">Sala ampla, cozinha e área de serviço</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faElevator} className="text-3xl text-primary mb-2" />
                                <span className="text-sm text-gray-700 leading-tight">Elevador</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <FontAwesomeIcon icon={faCar} className="text-3xl text-primary mb-2" />
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
                        <p className="text-center text-sm mt-2 text-gray-500">Clique na imagem para ampliar</p>
                    </div>
                </div>
            </section>
            
            {/* GALERIA */}
            <section className="bg-gray-50 py-16 md:py-24">
                <div className="w-full px-4 container mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
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
            
            {/* CTA FINAL (BOTÃO ABRE MODAL PADRÃO) */}
            <section className="bg-gray-50 py-16 md:py-20">
                <div className="w-full px-4 text-center container mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Gostou do que viu?</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto mb-8">Cadastre-se para receber em primeira mão o book completo com imagens, plantas e a tabela de vendas do Residencial Alfa.</p>
                    <button 
                        onClick={openLeadModal}
                        className="inline-block bg-primary text-white font-bold py-4 px-10 rounded-full hover:opacity-90 transition-all duration-300 shadow-lg transform hover:scale-105"
                    >
                        RECEBER BOOK E TABELA DE VENDAS
                    </button>
                </div>
            </section>
            
            <footer className="bg-black text-white py-6">
                <div className="w-full px-4 text-center text-gray-400">
                    <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
                    <p className="text-sm mt-1">Residencial Alfa - Registro de Incorporação: Nº 24.920/R-08</p>
                </div>
            </footer>
            
            {/* --- MODAIS --- */}
            
            {/* Modal de Zoom de Imagem */}
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
            
            {/* Modal do Formulário PADRÃO (Book) */}
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

            {/* Modal do Formulário CAIXA (Simulação) */}
            <AnimatePresence>
                {isCaixaModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <FormularioCaixa onClose={closeCaixaModal} />
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Botão Flutuante */}
            <a
                href="https://wa.me/5533998192119?text=Oi%2C%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Residencial%20Alfa"
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
// Caminho do arquivo: app/(landingpages)/refugiobraunas/page.js
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
    faCar,
    faHospital, faGraduationCap, faUsers, faCartShopping,
    faLocationDot, faFilePdf, faBuildingColumns, faShieldHalved,
    faDraftingGavel, faMountainSun, faSackDollar, faChartLine, faTreeCity,
    faXmark
} from '@fortawesome/free-solid-svg-icons';

// Importando a Server Action para os formulários
import { salvarLead } from './actions';

const roboto = Roboto({
    weight: ['400', '500', '700'],
    subsets: ['latin'],
    display: 'swap',
});

// --- Componentes de Ícones ---
const IconeLocalizacao = () => <FontAwesomeIcon icon={faTreeCity} className="w-8 h-8" />;
const IconeValorizacao = () => <FontAwesomeIcon icon={faChartLine} className="w-8 h-8" />;
const IconeRentabilidade = () => <FontAwesomeIcon icon={faSackDollar} className="w-8 h-8" />;
const IconeCasa = () => <FontAwesomeIcon icon={faDraftingGavel} className="w-8 h-8" />;
const IconeCoracao = () => <FontAwesomeIcon icon={faMountainSun} className="w-8 h-8" />;
const IconeSeguranca = () => <FontAwesomeIcon icon={faShieldHalved} className="w-8 h-8" />;

const primaryColor = '#2c5234'; // Um tom de verde escuro, sofisticado

export default function RefugioBraunasPage() {
    const [view, setView] = useState('investidor');
    const [selectedImage, setSelectedImage] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = (imageUrl) => setSelectedImage(imageUrl);
    const closeModal = () => setSelectedImage(null);
    
    const openLeadModal = () => setIsModalOpen(true);
    const closeLeadModal = () => setIsModalOpen(false);

    const floorPlanImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760615332918.png";

    return (
        <div className={`${roboto.className} bg-white text-gray-800 font-sans`}>
            
            {/* Seção Hero */}
            <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
                <div
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{
                        backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760614010702.png')",
                    }}
                ></div>
                <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
                <div className="relative z-30 flex flex-col items-center text-center p-4 w-full">
                    <Image
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/LOGO-P_1760614046416.png"
                        alt="Logo Refúgio Braúnas"
                        width={500}
                        height={200}
                        className="w-full max-w-xs md:max-w-md object-contain mb-8"
                        priority
                    />
                    <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-wider text-shadow-lg">
                        Seu Refúgio
                    </h1>
                    <p className="text-lg md:text-2xl mt-2 text-shadow">
                        A 10 minutos do centro de Governador Valadares
                    </p>
                    <div className="bg-black/30 backdrop-blur-sm rounded-full p-1 flex items-center mt-8">
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
            
            {/* Seção Gancho Principal */}
            <section className="bg-gray-50 py-16 md:py-20">
                <div className="container mx-auto px-4 text-center">
                    <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md">
                        <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-gray-500 mb-4">
                            Invista no seu refúgio
                        </h2>
                        <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Lotes de 1.000m² a partir de R$ 350.000
                        </p>
                        <p className="text-gray-600">
                            Localizado no bairro Braúnas, o Refúgio Braúnas é o lugar ideal para construir sua chácara dos sonhos — seja para morar, descansar nos fins de semana ou investir em um espaço de valorização garantida.
                        </p>
                        <div className="mt-8">
                            <button
                                onClick={openLeadModal}
                                className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity duration-300 shadow-lg"
                            >
                                <FontAwesomeIcon icon={faFilePdf} className="mr-2" />
                                Download do Book de Vendas
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Seção de Argumentos (Investidor / Morador) */}
            {view === 'investidor' && (
                <section className="py-16 md:py-24 bg-white">
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
                            Uma Oportunidade Única de Investimento
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                <div className="mb-4 inline-block text-primary"><IconeRentabilidade /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">O Melhor Custo-Benefício</h3>
                                <p className="text-gray-600">Com lotes a partir de R$ 350/m², o Refúgio Braúnas oferece uma oportunidade incomparável em Governador Valadares, posicionando você para uma valorização expressiva.</p>
                            </div>
                            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                <div className="mb-4 inline-block text-primary"><IconeValorizacao /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Potencial de Valorização</h3>
                                <p className="text-gray-600">Investir em um lote com custo por m² tão competitivo em uma área de expansão garante um potencial de valorização único e um retorno sólido sobre seu investimento.</p>
                            </div>
                            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
                                <div className="mb-4 inline-block text-primary"><IconeLocalizacao /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Qualidade de Vida como Ativo</h3>
                                <p className="text-gray-600">A crescente busca por espaço e natureza, a 10 minutos do centro, torna os lotes no Refúgio Braúnas um ativo altamente desejado para aluguel por temporada ou revenda.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {view === 'morador' && (
                <section className="bg-gray-50 py-16 md:py-24">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">
                            Diferenciais que Transformam seu Dia a Dia
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                <div className="mb-4 inline-block text-primary"><FontAwesomeIcon icon={faBuildingColumns} className="w-8 h-8" /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Financiamento Facilitado</h3>
                                <p className="text-gray-600">Realize o sonho da casa de campo com a segurança e as vantagens do financiamento pela Caixa para aquisição de lote e construção.</p>
                            </div>
                            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                <div className="mb-4 inline-block text-primary"><IconeCasa /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Projetos Personalizados</h3>
                                <p className="text-gray-600">Oferecemos suporte completo no desenvolvimento do seu projeto arquitetônico, otimizado para o processo de financiamento.</p>
                            </div>
                            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
                                <div className="mb-4 inline-block text-primary"><IconeCoracao /></div>
                                <h3 className="text-xl font-bold mb-2 text-gray-900">Espaço e Conveniência</h3>
                                <p className="text-gray-600">Desfrute da amplitude de um lote de 1.000m² sem abrir mão da conveniência de estar a apenas 10 minutos do coração da cidade.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Seção Detalhes do Imóvel */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="md:order-2">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Seu Espaço, Suas Regras</h2>
                        <p className="mb-8 text-gray-700">
                            No Refúgio Braúnas você tem a liberdade de construir a chácara que sempre sonhou. Lotes urbanos com matrículas individualizadas, garantindo total segurança e autonomia para o seu projeto.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-8 text-left">
                            <div className="flex items-center">
                                <FontAwesomeIcon icon={faMountainSun} className="text-3xl text-primary mr-4 w-8" />
                                <span className="text-md text-gray-700">Lotes a partir de 1.000m²</span>
                            </div>
                            <div className="flex items-center">
                                <FontAwesomeIcon icon={faDraftingGavel} className="text-3xl text-primary mr-4 w-8" />
                                <span className="text-md text-gray-700">Matrículas Individualizadas</span>
                            </div>
                            <div className="flex items-center">
                                <FontAwesomeIcon icon={faCar} className="text-3xl text-primary mr-4 w-8" />
                                <span className="text-md text-gray-700">A 10 min do Centro</span>
                            </div>
                             <div className="flex items-center">
                                <FontAwesomeIcon icon={faShieldHalved} className="text-3xl text-primary mr-4 w-8" />
                                <span className="text-md text-gray-700">Segurança Jurídica Total</span>
                            </div>
                        </div>
                    </div>
                    <div className="md:order-1">
                        <Image
                            src={floorPlanImage}
                            alt="Planta Masterplan do Refúgio Braúnas"
                            width={500}
                            height={500}
                            className="rounded-lg shadow-xl mx-auto cursor-pointer"
                            onClick={() => openModal(floorPlanImage)}
                        />
                        <p className="text-center text-sm mt-2 text-gray-500">Clique na imagem para ampliar</p>
                    </div>
                </div>
            </section>

            {/* Seção Proximidades e Mapa */}
            <section className="bg-gray-50 pt-16 md:pt-24 pb-16 md:pb-24">
                 <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div>
                             <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center md:text-left mb-12">
                                Mapa de Proximidades
                            </h3>
                            <div className="relative max-w-sm mx-auto md:mx-0">
                                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-300"></div>
                                <div className="relative pl-10 pb-8">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-primary rounded-full border-4 border-white"></div>
                                    <div className="flex items-center">
                                        <FontAwesomeIcon icon={faLocationDot} className="text-2xl text-primary mr-4" />
                                        <div>
                                            <p className="font-bold text-gray-800">Refúgio Braúnas</p>
                                            <p className="text-sm text-gray-500">Ponto de partida</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative pl-10 pb-8">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                    <div className="flex items-center"><FontAwesomeIcon icon={faGraduationCap} className="text-2xl text-primary mr-4" /><div><p className="font-bold text-gray-800">Univale</p><p className="text-sm text-gray-500">3 min (1,3 km)</p></div></div>
                                </div>
                                <div className="relative pl-10 pb-8">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                    <div className="flex items-center"><FontAwesomeIcon icon={faCartShopping} className="text-2xl text-primary mr-4" /><div><p className="font-bold text-gray-800">Big Mais Supermercado</p><p className="text-sm text-gray-500">6 min (3,5 km)</p></div></div>
                                </div>
                                <div className="relative pl-10 pb-8">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                    <div className="flex items-center"><FontAwesomeIcon icon={faCartShopping} className="text-2xl text-primary mr-4" /><div><p className="font-bold text-gray-800">Coelho Diniz</p><p className="text-sm text-gray-500">7 min (3,7 km)</p></div></div>
                                </div>
                                <div className="relative pl-10 pb-8">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                    <div className="flex items-center"><FontAwesomeIcon icon={faUsers} className="text-2xl text-primary mr-4" /><div><p className="font-bold text-gray-800">Clube Filadélfia</p><p className="text-sm text-gray-500">7 min (4,1 km)</p></div></div>
                                </div>
                                <div className="relative pl-10">
                                    <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                                    <div className="flex items-center"><FontAwesomeIcon icon={faHospital} className="text-2xl text-primary mr-4" /><div><p className="font-bold text-gray-800">Hospital São Lucas</p><p className="text-sm text-gray-500">9 min (4,9 km)</p></div></div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Image
                                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760615854574.png"
                                alt="Implantação do Refúgio Braúnas no local"
                                width={1200}
                                height={800}
                                className="w-full h-auto rounded-lg shadow-lg"
                            />
                        </div>
                    </div>
                     <div className="container mx-auto px-4 text-center mt-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Localização Privilegiada</h2>
                        <p className="max-w-2xl mx-auto mb-8 text-gray-600">
                           Encontre o seu refúgio no bairro Braúnas, uma área de grande expansão que combina a tranquilidade da natureza com acesso rápido ao centro da cidade.
                        </p>
                        <div className="w-full h-96 rounded-lg shadow-xl overflow-hidden border">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m24!1m12!1m3!1d2465.4576658092265!2d-41.910688610118235!3d-18.8329897438405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m9!3e0!4m3!3m2!1d-18.8325478!2d-41.907709499999996!4m3!3m2!1d-18.8518903!2d-41.9463703!5e1!3m2!1spt-BR!2sbr!4v1760615170381!5m2!1spt-BR!2sbr"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Seção de CTA Final */}
            <section className="bg-white py-16 md:py-20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Pronto para construir seu sonho?</h2>
                    <p className="text-gray-600 max-w-2xl mx-auto mb-8">Cadastre-se para receber em primeira mão o book completo com o masterplan, detalhes dos lotes e a tabela de vendas do Refúgio Braúnas.</p>
                    <button 
                        onClick={openLeadModal}
                        className="inline-block bg-primary text-white font-bold py-4 px-10 rounded-full hover:opacity-90 transition-all duration-300 shadow-lg transform hover:scale-105"
                    >
                        RECEBER BOOK E TABELA DE VENDAS
                    </button>
                </div>
            </section>
            
            {/* Rodapé */}
            <footer className="bg-black text-white py-6">
                <div className="container mx-auto px-4 text-center text-gray-400">
                    <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
                    <p className="text-sm mt-1">Refúgio Braúnas - Lotes com matrícula individualizada.</p>
                </div>
            </footer>
            
            {/* Modal de Imagem */}
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
            
            {/* Modal de Lead */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"
                        onClick={closeLeadModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white p-8 rounded-lg shadow-2xl space-y-5 max-w-lg w-full relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button 
                                onClick={closeLeadModal}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            >
                                <FontAwesomeIcon icon={faXmark} size="lg" />
                            </button>
                            
                            <h3 className="text-2xl font-bold text-center text-gray-800">Receba o material completo</h3>
                            <p className="text-center text-gray-600">Preencha os dados abaixo para receber o book e a tabela de vendas.</p>
                            
                            <form action={salvarLead} className="space-y-4">
                                <input type="hidden" name="origem" value="Modal - Book Refúgio Braúnas" />
                                <div>
                                    <label htmlFor="modal-nome" className="block text-sm font-medium text-gray-700">Nome completo</label>
                                    <input type="text" name="nome" id="modal-nome" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                                </div>
                                <div>
                                    <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700">Seu melhor e-mail</label>
                                    <input type="email" name="email" id="modal-email" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                                </div>
                                <div>
                                    <label htmlFor="modal-telefone" className="block text-sm font-medium text-gray-700">Telefone (WhatsApp)</label>
                                    <input type="tel" name="telefone" id="modal-telefone" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"/>
                                </div>
                                <button type="submit" className="w-full bg-primary text-white py-3 rounded-md font-bold text-lg hover:opacity-90 transition-transform transform hover:scale-105">
                                    QUERO RECEBER O MATERIAL
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Botão Flutuante do WhatsApp */}
            <a
                href="https://wa.me/5533998192119?text=Oi%2C%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Ref%C3%BAgio%20Bra%C3%BAnas"
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-5 right-5 z-50 transform hover:scale-110 transition-transform duration-300"
                aria-label="Converse no WhatsApp"
            >
                <div className="w-16 h-16 bg-green-500 rounded-full shadow-2xl flex items-center justify-center">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-white text-4xl" />
                </div>
            </a>

            <style jsx global>{`
                .bg-primary { background-color: ${primaryColor}; }
                .text-primary { color: ${primaryColor}; }
                .focus\\:border-primary:focus { border-color: ${primaryColor}; }
                .focus\\:ring-primary:focus {
                    --tw-ring-color: ${primaryColor};
                    --tw-ring-opacity: 1;
                    box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                }
                .text-shadow { text-shadow: 0px 2px 4px rgba(0,0,0,0.5); }
                .text-shadow-lg { text-shadow: 0px 4px 8px rgba(0,0,0,0.4); }
            `}</style>
        </div>
    );
}
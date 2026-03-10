// Caminho: app/(landingpages)/refugiobraunas/RefugioBraunasClient.js
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Roboto, Montserrat } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  faCar,
  faHospital,
  faGraduationCap,
  faUsers,
  faCartShopping,
  faLocationDot,
  faFilePdf,
  faBuildingColumns,
  faShieldHalved,
  faPencilRuler,
  faMountainSun,
  faSackDollar,
  faChartLine,
  faTreeCity,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

// --- MUDANÇA: REMOVEMOS A IMPORTAÇÃO DO salvarLead (JÁ ESTÁ NO COMPONENTE) ---
// --- MUDANÇA: IMPORTAMOS O FORMULÁRIO PADRONIZADO ---
import FormularioDeContatoRefugio from './FormularioDeContatoRefugio';

// Importando o modal de Zoom
import ZoomableImageModal from '../../../components/ZoomableImageModal';

const roboto = Roboto({
  weight: ['100', '300', '400', '500', '700', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

const montserrat = Montserrat({
  weight: ['700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
});

// --- Componentes de Ícones ---
const IconeLocalizacao = () => (
  <FontAwesomeIcon icon={faTreeCity} className="w-8 h-8" />
);
const IconeValorizacao = () => (
  <FontAwesomeIcon icon={faChartLine} className="w-8 h-8" />
);
const IconeRentabilidade = () => (
  <FontAwesomeIcon icon={faSackDollar} className="w-8 h-8" />
);
const IconeCasa = () => (
  <FontAwesomeIcon icon={faPencilRuler} className="w-8 h-8" />
);
const IconeCoracao = () => (
  <FontAwesomeIcon icon={faMountainSun} className="w-8 h-8" />
);
const IconeSeguranca = () => (
  <FontAwesomeIcon icon={faShieldHalved} className="w-8 h-8" />
);

const primaryColor = '#2c5234';

export default function RefugioBraunasClient() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (imageUrl) => setSelectedImage(imageUrl);
  const closeModal = () => setSelectedImage(null);

  const openLeadModal = () => setIsModalOpen(true);
  const closeLeadModal = () => setIsModalOpen(false);

  const floorPlanImage =
    'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760615332918.png';

  return (
    <div
      className={`${roboto.variable} ${montserrat.variable} font-sans bg-white text-gray-800`}
    >
      {/* --- ESTILOS GLOBAIS --- */}
      <style jsx global>{`
        :root {
          --font-roboto: ${roboto.variable};
          --font-montserrat: ${montserrat.variable};
        }
        .font-sans {
          font-family: var(--font-roboto);
        }
        .font-heading {
          font-family: var(--font-montserrat);
        }
        .bg-primary {
          background-color: ${primaryColor};
        }
        .text-primary {
          color: ${primaryColor};
        }
        .focus\\:border-primary:focus {
          border-color: ${primaryColor};
        }
        .focus\\:ring-primary:focus {
          --tw-ring-color: ${primaryColor};
          --tw-ring-opacity: 1;
          box-shadow: var(--tw-ring-inset) 0 0 0
            calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
        }
        .text-shadow {
          text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5);
        }
        .text-shadow-lg {
          text-shadow: 0px 4px 8px rgba(0, 0, 0, 0.4);
        }
      `}</style>

      {/* Seção Hero */}
      <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{
            backgroundImage:
              "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png')",
          }}
        ></div>
        <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
        <div className="relative z-30 flex flex-col items-center text-center p-4 w-full">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/LOGO-P_1760619039077.png"
            alt="Logo Refúgio Braúnas"
            width={500}
            height={200}
            className="w-full max-w-xs md:max-w-md object-contain mb-8"
            priority
          />
          
          <h1
            className={`font-sans text-2xl md:text-4xl font-thin uppercase tracking-widest text-shadow-lg`}
          >
            Seu Refúgio
          </h1>
          
          <p
            className={`font-sans text-lg md:text-xl mt-6 text-shadow font-thin tracking-wider opacity-90`}
          >
            A 10 minutos do centro de Governador Valadares
          </p>
          
          {/* Botão Único de CTA */}
          <div className="mt-10">
            <button
                onClick={openLeadModal}
                className="bg-primary/90 hover:bg-primary text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg backdrop-blur-sm border border-white/20"
            >
                <FontAwesomeIcon icon={faMountainSun} className="mr-2" />
                QUERO CONHECER
            </button>
          </div>
        </div>
      </section>

      {/* Intro Section (Preço e Book) */}
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
              Localizado no bairro Braúnas, o Refúgio Braúnas é o lugar ideal
              para construir sua chácara dos sonhos — seja para morar, descansar
              nos fins de semana ou investir em um espaço de valorização
              garantida.
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

      {/* Seção 1: Investimento e Valorização */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">
            Uma Oportunidade Única de Investimento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
              <div className="mb-4 inline-block text-primary">
                <IconeRentabilidade />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                O Melhor Custo-Benefício
              </h3>
              <p className="text-gray-600">
                Com lotes a partir de R$ 350/m², o Refúgio Braúnas oferece uma
                oportunidade incomparável em Governador Valadares,
                posicionando você para uma valorização expressiva.
              </p>
            </div>
            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
              <div className="mb-4 inline-block text-primary">
                <IconeValorizacao />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Potencial de Valorização
              </h3>
              <p className="text-gray-600">
                Investir em um lote com custo por m² tão competitivo em uma
                área de expansão garante um potencial de valorização único e
                um retorno sólido sobre seu investimento.
              </p>
            </div>
            <div className="p-6 bg-gray-100 rounded-lg shadow-sm text-center">
              <div className="mb-4 inline-block text-primary">
                <IconeLocalizacao />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Qualidade de Vida como Ativo
              </h3>
              <p className="text-gray-600">
                A crescente busca por espaço e natureza, a 10 minutos do
                centro, torna os lotes no Refúgio Braúnas um ativo altamente
                desejado para aluguel por temporada ou revenda.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção 2: Moradia e Qualidade de Vida */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">
            Diferenciais que Transformam seu Dia a Dia
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
              <div className="mb-4 inline-block text-primary">
                <FontAwesomeIcon
                  icon={faBuildingColumns}
                  className="w-8 h-8"
                />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Financiamento Facilitado
              </h3>
              <p className="text-gray-600">
                Realize o sonho da casa de campo com a segurança e as vantagens
                do financiamento Caixa na modalidade aquisição de lote e
                construção.
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
              <div className="mb-4 inline-block text-primary">
                <IconeCasa />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Projetos Personalizados
              </h3>
              <p className="text-gray-600">
                Oferecemos suporte completo no desenvolvimento do seu projeto
                arquitetônico, otimizado para o processo de financiamento.
              </p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-lg text-center">
              <div className="mb-4 inline-block text-primary">
                <IconeCoracao />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">
                Espaço e Conveniência
              </h3>
              <p className="text-gray-600">
                Desfrute da amplitude de um lote de 1.000m² sem abrir mão da
                conveniência de estar a apenas 10 minutos do coração da
                cidade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Comum: Detalhes e Mapa do Empreendimento */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="md:order-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Seu Espaço, Suas Regras
            </h2>
            <p className="mb-8 text-gray-700">
              No Refúgio Braúnas você tem a liberdade de construir a chácara que
              sempre sonhou. Lotes urbanos com matrículas individualizadas,
              garantindo total segurança e autonomia para o seu projeto.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 gap-y-8 text-left">
              <div className="flex items-center">
                <FontAwesomeIcon
                  icon={faMountainSun}
                  className="text-3xl text-primary mr-4 w-8"
                />
                <span className="text-md text-gray-700">
                  Lotes a partir de 1.000m²
                </span>
              </div>
              <div className="flex items-center">
                <FontAwesomeIcon
                  icon={faPencilRuler}
                  className="text-3xl text-primary mr-4 w-8"
                />
                <span className="text-md text-gray-700">
                  Matrículas Individualizadas
                </span>
              </div>
              <div className="flex items-center">
                <FontAwesomeIcon
                  icon={faCar}
                  className="text-3xl text-primary mr-4 w-8"
                />
                <span className="text-md text-gray-700">
                  A 10 min do Centro
                </span>
              </div>
              <div className="flex items-center">
                <FontAwesomeIcon
                  icon={faShieldHalved}
                  className="text-3xl text-primary mr-4 w-8"
                />
                <span className="text-md text-gray-700">
                  Segurança Jurídica Total
                </span>
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
            <p className="text-center text-sm mt-2 text-gray-500">
              Clique na imagem para ampliar
            </p>
          </div>
        </div>
      </section>

      {/* Mapa de Proximidades */}
      <section className="bg-gray-50 pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-800 text-center md:text-left mb-12">
                Mapa de Proximidades
              </h3>
              <div className="relative max-w-sm mx-auto md:mx-0">
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gray-300"></div>
                {/* Itens do Mapa */}
                <div className="relative pl-10 pb-8">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-primary rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faLocationDot}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">Refúgio Braúnas</p>
                      <p className="text-sm text-gray-500">Ponto de partida</p>
                    </div>
                  </div>
                </div>
                {/* Univale */}
                <div className="relative pl-10 pb-8">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">Univale</p>
                      <p className="text-sm text-gray-500">3 min (1,3 km)</p>
                    </div>
                  </div>
                </div>
                {/* Big Mais */}
                <div className="relative pl-10 pb-8">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faCartShopping}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">
                        Big Mais Supermercado
                      </p>
                      <p className="text-sm text-gray-500">6 min (3,5 km)</p>
                    </div>
                  </div>
                </div>
                {/* Coelho Diniz */}
                <div className="relative pl-10 pb-8">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faCartShopping}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">Coelho Diniz</p>
                      <p className="text-sm text-gray-500">7 min (3,7 km)</p>
                    </div>
                  </div>
                </div>
                {/* Clube Filadélfia */}
                <div className="relative pl-10 pb-8">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faUsers}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">Clube Filadélfia</p>
                      <p className="text-sm text-gray-500">7 min (4,1 km)</p>
                    </div>
                  </div>
                </div>
                {/* Hospital */}
                <div className="relative pl-10">
                  <div className="absolute left-0 top-1 w-5 h-5 bg-gray-400 rounded-full border-4 border-white"></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon
                      icon={faHospital}
                      className="text-2xl text-primary mr-4"
                    />
                    <div>
                      <p className="font-bold text-gray-800">
                        Hospital São Lucas
                      </p>
                      <p className="text-sm text-gray-500">9 min (4,9 km)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Imagem do Mapa */}
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Localização Privilegiada
            </h2>
            <p className="max-w-2xl mx-auto mb-8 text-gray-600">
              Encontre o seu refúgio no bairro Braúnas, uma área de grande
              expansão que combina a tranquilidade da natureza com acesso rápido
              ao centro da cidade.
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

      {/* CTA Final */}
      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Pronto para construir seu sonho?
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Cadastre-se para receber em primeira mão o book completo com o
            masterplan, detalhes dos lotes e a tabela de vendas do Refúgio
            Braúnas.
          </p>
          <button
            onClick={openLeadModal}
            className="inline-block bg-primary text-white font-bold py-4 px-10 rounded-full hover:opacity-90 transition-all duration-300 shadow-lg transform hover:scale-105"
          >
            RECEBER BOOK E TABELA DE VENDAS
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-6">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
          <p className="text-sm mt-1">
            Refúgio Braúnas - Lotes com matrícula individualizada.
          </p>
        </div>
      </footer>

      {/* --- MODAIS --- */}

      {/* Modal de Zoom */}
      <ZoomableImageModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage}
        onClose={closeModal}
      />

      {/* Modal de Lead - AGORA COM O FORMULÁRIO PADRÃO SEM EMAIL E COM MÁSCARA */}
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
              className="bg-white rounded-lg shadow-2xl max-w-lg w-full relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeLeadModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
              >
                <FontAwesomeIcon icon={faXmark} size="lg" />
              </button>
              
              {/* CHAMADA DO COMPONENTE PADRONIZADO AQUI */}
              <FormularioDeContatoRefugio />
              
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
    </div>
  );
}
// Caminho: app/(landingpages)/studiosbeta/page.js
'use client';

import { useState } from 'react';
import Image from 'next/image'; // Re-importamos o Image
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDumbbell, faTshirt, faUtensils, faBuilding } from '@fortawesome/free-solid-svg-icons';
import FormularioDeContatoBeta from './FormularioDeContatoBeta.js';

import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
});


export default function StudiosBetaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* O PORQUÊ DA MUDANÇA: A imagem de fundo está de volta!
            Usei 'object-cover' para que ela preencha toda a tela, que geralmente
            funciona melhor para fundos. */}
        <Image
          src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1759100949768.png"
          alt="Studios Beta - Fachada do empreendimento"
          layout="fill"
          objectFit="cover"
          className="z-0"
          priority
        />
        
        {/* O PORQUÊ DESTA NOVA ESTRUTURA:
            Este 'div' é o nosso "cartão flutuante". Ele tem um fundo cinza claro com 95% de opacidade
            e um efeito de desfoque ('backdrop-blur') no que está atrás dele. É isso que permite
            que o texto preto seja legível com a imagem no fundo. */}
        <div className="relative z-10 bg-gray-100/95 backdrop-blur-sm p-8 md:p-12 rounded-xl shadow-2xl max-w-2xl w-full text-center flex flex-col items-center text-black">
          
          <h1 className={`${montserrat.className} text-4xl md:text-6xl font-bold uppercase tracking-wider`}>
            PRÉ-LANÇAMENTO
          </h1>
          <h2 className="text-3xl md:text-5xl font-bold uppercase tracking-wider mt-2 text-gray-700">
            Studios Beta
          </h2>
          
          <p className="mt-6 max-w-xl text-base md:text-lg font-light text-gray-600">
            Studios de 1 e 2 quartos, pensados para quem valoriza praticidade e sofisticação. Com academia equipada, lavanderia, área gourmet e um rooftop com vista para a Ibituruna, o Beta é o lugar perfeito para um novo estilo de vida.
          </p>
          
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 max-w-2xl w-full text-gray-800">
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faDumbbell} className="text-3xl mb-2" /><span className="text-sm font-semibold">Academia Equipada</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faTshirt} className="text-3xl mb-2" /><span className="text-sm font-semibold">Lavanderia</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faUtensils} className="text-3xl mb-2" /><span className="text-sm font-semibold">Área Gourmet</span></div>
            <div className="flex flex-col items-center"><FontAwesomeIcon icon={faBuilding} className="text-3xl mb-2" /><span className="text-sm font-semibold">Rooftop</span></div>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="mt-10 bg-amber-500 text-gray-900 font-bold uppercase py-3 px-10 rounded-full shadow-lg hover:bg-amber-600 transition-colors duration-300">
            Tenho Interesse
          </button>
        </div>
      </main>
      {isModalOpen && (
        <FormularioDeContatoBeta onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
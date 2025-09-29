'use client';

import { useState } from 'react';
import Image from 'next/image';
import FormularioDeContatoBeta from './FormularioDeContatoBeta.js';

import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '700', '900'],
});

export default function StudiosBetaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <main className={`${montserrat.className} relative min-h-screen flex flex-col items-center p-4 overflow-hidden`}>
        
        <Image
          src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/IMG_1759100949768.png"
          alt="Studios Beta - Fachada do empreendimento"
          layout="fill"
          objectFit="cover"
          objectPosition="bottom right"
          className="z-0"
          priority
        />
        
        {/* O PORQUÊ DA MUDANÇA: 
            Este contêiner agora tem o único propósito de centralizar o nosso painel unificado na tela,
            tanto vertical quanto horizontalmente ('justify-center items-center').
        */}
        <div className="relative z-20 flex justify-center items-center w-full min-h-screen">

          {/* O NOVO PAINEL UNIFICADO:
              - É aqui que a mágica acontece. Este é o único elemento que tem o fundo 'bg-black/60 backdrop-blur-lg'.
              - 'flex flex-col gap-8': Organiza as seções internas verticalmente com um espaçamento consistente entre elas.
          */}
          <div className="w-full max-w-md bg-black/60 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 flex flex-col gap-8 text-center">
            
            {/* --- Seção 1: EM BREVE --- */}
            {/* O PORQUÊ: Este elemento não precisa mais de um fundo próprio, pois ele agora vive dentro do painel principal. */}
            <div>
              <h1 className="text-4xl md:text-5xl font-light uppercase tracking-[0.3em] text-white">
                EM BREVE
              </h1>
            </div>
            
            {/* --- Seção 2: Informações do Studio --- */}
            {/* O PORQUÊ: A mesma lógica aqui. Este bloco agora é apenas um agrupador de texto, sem estilo de fundo ou borda. */}
            <div className="text-gray-100">
              <p className="text-3xl font-light uppercase tracking-[0.2em]">Studios</p>
              <p className="text-xl font-extralight tracking-wider">20m² a 27m²</p>
              <p className="mt-4 text-lg italic font-extralight">a partir de</p>
              <p className="text-5xl font-bold tracking-tight">R$190MIL</p>
              <p className="mt-5 text-sm uppercase font-light tracking-[0.2em]">Alto Esplanada</p>
              <p className="text-xs uppercase font-extralight tracking-[0.25em]">Gov. Valadares</p>
            </div>
            
            {/* --- Seção 3: Chamada para Ação (CTA) --- */}
            {/* O PORQUÊ: Idem. Todo o conteúdo do CTA agora vive aqui, herdando o fundo do painel principal. */}
            <div className="w-full">
              <h2 className="text-3xl font-light uppercase tracking-[0.2em] text-white">Acesso Exclusivo</h2>
              <p className="mt-2 text-base font-extralight text-gray-300">
                Solicite as informações de pré-lançamento.
              </p>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="mt-6 w-full max-w-xs bg-orange-500 text-gray-900 font-bold uppercase py-3 px-10 rounded-full shadow-lg hover:bg-orange-600 transition-all duration-300 hover:scale-105"
              >
                Solicitar Acesso
              </button>
              <div className="mt-8">
                <Image
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Logo Studio 57 - Arquitetura e Incorporação"
                  width={160}
                  height={50}
                  className="mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <FormularioDeContatoBeta onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
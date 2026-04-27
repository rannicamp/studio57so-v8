'use client';

import React from 'react';
import Image from 'next/image';
import { Montserrat, Roboto } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '700', '900'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
});

export default function BetaSuitesBookClient() {
  // Uma função para encapsular a Folha A4
  const FolhaA4Horizontal = ({ children }) => (
    <section className="bg-black text-white relative flex-shrink-0 w-[297mm] h-[210mm] overflow-hidden print:w-[297mm] print:h-[210mm] print:break-after-page shadow-2xl mb-8 print:mb-0 print:shadow-none mx-auto border border-white/10 print:border-none">
      {children}
    </section>
  );

  return (
    <div className={`${montserrat.className} bg-zinc-900 min-h-screen py-8 print:py-0 print:bg-black`}>
      <style jsx global>{`
        /* Configurações Globais de Impressão para A4 Paisagem */
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: black !important;
          }
          /* Esconder elementos desnecessários na hora de imprimir */
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>

      {/* PÁGINA 1: CAPA (Idêntica à Hero do Site) */}
      <FolhaA4Horizontal>
        {/* Fundo da Capa (Imagem da Fachada Pôr do Sol que é bonita e estática) */}
        <Image
          src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg"
          alt="Fachada Beta Suítes"
          fill
          className="object-cover object-center z-0"
          priority
        />
        {/* 
          AJUSTE DE ESCURECIMENTO (RANNIERE): 
          Deixei um gradiente da ESQUERDA para a DIREITA (bg-gradient-to-r).
          Na esquerda ele é muito escuro (from-black/90) para a logo aparecer.
          Na direita ele some (to-transparent) para o prédio ficar 100% iluminado.
        */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent z-10 transition-opacity duration-300"></div>

        {/* Conteúdo da Capa */}
        <div className="relative z-30 flex flex-col items-start justify-center pl-[25mm] w-full h-full">
          <div className="flex flex-col items-start w-[450px]">

            {/* PRÉ-LANÇAMENTO */}
            {/* Ajustado com margin-left para alinhar com o corte da letra B e centralizado horizontalmente */}
            <div className="w-[415px] ml-[15px] mb-6 flex justify-center">
              <p className="text-gray-200 text-[12px] uppercase font-light flex items-center justify-center drop-shadow-md">
                <span className="border-b-[2px] border-[#f25a2f] pb-[2px] tracking-[1em]">PRÉ</span>
                <span className="tracking-[0.8em] ml-2">- LANÇAMENTO</span>
              </p>
            </div>

            {/* LOGO */}
            <div className="w-[450px] relative z-10">
              <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png"
                alt="Beta Suítes Logo"
                width={600}
                height={200}
                className="w-full h-auto object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* LOCALIZAÇÃO */}
            {/* 
              AJUSTE DE DISTÂNCIA MANUAL (RANNIERE):
              Para subir o texto (ficar mais perto da logo), mude o -mt-3 para -mt-4, -mt-5, -mt-6, etc.
              Para descer o texto (ficar mais longe da logo), mude o -mt-3 para -mt-2, -mt-1, ou remova o -mt.
            */}
            <div className="w-[415px] ml-[15px] flex justify-center -mt-1 relative z-20">
              <p className="text-gray-300 text-[10px] font-bold uppercase tracking-[0.41em] drop-shadow-lg whitespace-nowrap pl-1">
                ALTO ESPLANADA • GOVERNADOR VALADARES
              </p>
            </div>

          </div>
        </div>
      </FolhaA4Horizontal>

    </div>
  );
}

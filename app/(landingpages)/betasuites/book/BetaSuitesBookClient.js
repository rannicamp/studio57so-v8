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

// Componentes de Ícones para a Tese de Investimento
const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeSeguranca = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;
const IconeTicket = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;

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

      {/* PÁGINA 2: TESE DE INVESTIMENTO */}
      <FolhaA4Horizontal>
        <div className="relative flex w-full h-full">
          
          {/* FOTO DE FUNDO FULL BLEED */}
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_4..jpeg"
            alt="Estilo de Vida Beta Suítes"
            fill
            className="object-cover object-center z-0"
          />
          
          {/* GRADIENTE PESADO ESCURO */}
          {/* 
            AJUSTE DE GRADIENTE (RANNIERE):
            Na esquerda (from-black/95) ele é 95% preto para esconder a parte da cozinha/parede e focar na leitura.
            No meio (via-black/70) ele dá a transição.
            Na direita (to-transparent) a opacidade cai e o rapaz assistindo a TV com a luz da sacada brilha.
          */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-transparent z-10"></div>

          {/* LADO ESQUERDO: TEXTOS E CARDS */}
          <div className="w-[60%] p-12 flex flex-col justify-center relative z-20">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] drop-shadow-lg`}>
              Investimento <strong className="font-bold text-white">Inteligente</strong>
            </h2>
            
            <p className="text-gray-300 text-sm mb-8 leading-relaxed text-justify drop-shadow-md">
              O Beta Suítes é o ativo imobiliário mais inteligente do Alto Esplanada. Projetado milimetricamente para o público estudantil de alta renda e profissionais de saúde.
              <br /><br />
              <span className="font-bold text-white uppercase text-xs tracking-wider">Rentabilidade Projetada: </span><br/>
              Baseado no estudo de viabilidade, uma unidade pode render no mínimo <strong className="text-[#f25a2f] text-lg whitespace-nowrap">R$&nbsp;4.200,00</strong> por mês, considerando um cenário conservador de apenas <strong className="text-white whitespace-nowrap">70% de ocupação</strong> e uma diária média de <strong className="text-white whitespace-nowrap">R$&nbsp;200,00</strong>.
            </p>

            {/* Cards Integrados - Compactos para A4 */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Polo Regional */}
              <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl">
                <div className="mb-2 text-[#f25a2f]"><IconeLocalizacao /></div>
                <h3 className="font-bold text-white text-[11px] mb-1 uppercase tracking-wide">Polo Regional</h3>
                <p className="text-gray-400 text-[10px] leading-relaxed">GV atrai fluxo constante de estudantes e profissionais de saúde.</p>
              </div>

              {/* Alta Demanda */}
              <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl">
                <div className="mb-2 text-[#f25a2f]"><IconeRentabilidade /></div>
                <h3 className="font-bold text-white text-[11px] mb-1 uppercase tracking-wide">Alta Demanda</h3>
                <p className="text-gray-400 text-[10px] leading-relaxed">A poucos passos da UFJF-GV. Garantia de ocupação e valorização.</p>
              </div>

              {/* Segurança Patrimonial */}
              <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl">
                <div className="mb-2 text-[#f25a2f]"><IconeSeguranca /></div>
                <h3 className="font-bold text-white text-[11px] mb-1 uppercase tracking-wide">Segurança Total</h3>
                <p className="text-gray-400 text-[10px] leading-relaxed">Localização privilegiada e com total segurança (Livre de enchentes).</p>
              </div>

              {/* Zero Descapitalização */}
              <div className="p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl">
                <div className="mb-2 text-[#f25a2f]"><IconeTicket /></div>
                <h3 className="font-bold text-white text-[11px] mb-1 uppercase tracking-wide">Baixo Ticket</h3>
                <p className="text-gray-400 text-[10px] leading-relaxed">Sua rentabilidade liquida paga as próprias parcelas do imóvel.</p>
              </div>

            </div>
          </div>
          
        </div>
      </FolhaA4Horizontal>
    </div>
  );
}

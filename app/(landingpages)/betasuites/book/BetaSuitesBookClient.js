'use client';

import React, { useState } from 'react';

import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faSchool, faHouseMedical, faGraduationCap, faUsers, faHospital, faCartShopping, faLandmark, faBuilding, faCar, faWater, faTshirt, faAward } from '@fortawesome/free-solid-svg-icons';

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

export default function BetaSuitesBookClient() {
  // Uma função para encapsular a Folha A4
  const FolhaA4Horizontal = ({ children }) => (
    <div className="relative mx-auto w-[297mm] h-[210mm] mb-8 folha-page-wrapper" style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}>
      <div className="absolute -left-20 top-0 text-gray-500 text-sm font-bold tracking-widest uppercase print:hidden page-indicator"></div>
      <section 
        className="book-page bg-[#0a0a0a] text-white relative w-[297mm] h-[210mm] overflow-hidden shadow-2xl print:shadow-none border border-white/10 print:border-none"
      >
        {children}
      </section>
    </div>
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const pdfUrl = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/book/Book_Investidor_Beta_Suites.pdf';
      
      // Baixa o PDF
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('PDF não encontrado. Solicite a geração à equipe.');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Book_Investidor_Beta_Suites.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar PDF:', error);
      alert('Erro ao baixar o PDF: ' + error.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className={`${montserrat.className} bg-zinc-900 min-h-screen py-8 print:py-0 print:m-0 print:p-0 print:bg-[#0a0a0a] print:min-h-0`}>
      
      {/* Botão de Impressão Flutuante */}
      <button 
        onClick={handleDownloadPDF}
        disabled={isGeneratingPdf}
        className={`fixed top-28 right-8 z-50 bg-[#f25a2f] hover:bg-[#d94a24] text-white font-bold py-3 px-6 rounded-full shadow-2xl transition-all print:hidden flex items-center gap-3 uppercase tracking-widest text-xs ${isGeneratingPdf ? 'opacity-75 cursor-wait animate-pulse' : ''}`}
      >
        {isGeneratingPdf ? (
          <>
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Gerando PDF...
          </>
        ) : (
          <>
            <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"></path></svg>
            Gerar PDF
          </>
        )}
      </button>

      <div id="pdf-book-container" className="w-full h-full">

      <style jsx global>{`
        /* Contador de páginas para visualização em tela (NÃO IMPRIME) */
        body {
          counter-reset: page-counter;
        }
        .folha-page-wrapper {
          counter-increment: page-counter;
        }
        .page-indicator::after {
          content: "Pág " counter(page-counter);
        }

        /* ========================================= */
        /* CONFIGURAÇÕES AGRESSIVAS DE IMPRESSÃO PDF */
        /* ========================================= */
        @media print {
          @page {
            size: 297mm 210mm;
            margin: 0;
          }

          /* REGRA NUCLEAR: Forçar backgrounds em TODOS os elementos */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html {
            width: 297mm !important;
            height: 210mm !important;
          }

          body {
            background: #0a0a0a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            overflow: visible !important;
          }

          /* REMOVER overflow-hidden de tudo no print */
          .folha-page-wrapper {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            break-inside: avoid;
          }

          .folha-page-wrapper:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .book-page {
            overflow: visible !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          /* Garantir que imagens apareçam */
          img {
            max-width: none !important;
            display: block !important;
          }

          /* Esconder scrollbar */
          ::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>

      {/* PÁGINA 1: CAPA (Idêntica à Hero do Site) */}
      <FolhaA4Horizontal>
        {/* Fundo da Capa (Imagem da Fachada Pôr do Sol que é bonita e estática) */}
        <img 
          src="/render_fachada.jpeg" 
          alt="Fachada Beta Suítes" 
          className="absolute inset-0 w-full h-full object-cover object-center z-0"
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
              <img
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png"
                alt="Beta Suítes Logo"
                className="w-full h-auto object-contain drop-shadow-2xl"
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

      {/* PÁGINA 2: ARQUITETURA FINANCEIRA (Preços) */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] flex flex-col relative overflow-hidden">
          {/* Decoração sutil de fundo */}
          <div className="absolute top-0 right-0 w-full h-1/2 bg-gradient-to-b from-[#f25a2f]/5 to-transparent"></div>
          
          <div className="flex-1 flex flex-col justify-center items-center px-[25mm] z-10">
            <div className="mb-16 text-center">
              <h2 className={`${roboto.className} text-4xl font-light text-gray-400 tracking-[0.15em] uppercase mb-4`}>
                Arquitetura <strong className="font-bold text-white">Financeira</strong>
              </h2>
              <p className="text-gray-400 text-sm tracking-wide">
                Você não precisa se descapitalizar. Um investimento inteligente para o seu futuro.
              </p>
            </div>

            <div className="flex flex-row gap-24 justify-center items-center">
              {/* Dado 1 */}
              <div className="flex flex-col items-center text-center">
                <p className="text-[#f25a2f] text-sm font-bold tracking-[0.2em] uppercase mb-2">Apenas</p>
                <p className="text-white text-8xl font-light tracking-tighter mb-2">20%</p>
                <p className="text-gray-400 text-xs uppercase tracking-[0.15em]">de Entrada</p>
              </div>

              <div className="w-px h-32 bg-white/10"></div>

              {/* Dado 2 */}
              <div className="flex flex-col items-center text-center">
                <p className="text-[#f25a2f] text-sm font-bold tracking-[0.2em] uppercase mb-2">A partir de</p>
                <p className="text-white text-8xl font-light tracking-tighter mb-2 whitespace-nowrap">R$ 1.800</p>
                <p className="text-gray-400 text-xs uppercase tracking-[0.15em]">Parcelas Mensais</p>
              </div>
            </div>
          </div>

          {/* Aviso Legal (Rodapé) */}
          <div className="absolute bottom-10 w-full text-center px-16 z-10">
            <p className="text-gray-600 text-[8px] uppercase tracking-[0.2em] leading-relaxed">
              * Valores referenciais de pré-lançamento sujeitos a alteração sem aviso prévio. Consulte sempre a Studio 57 para confirmar a disponibilidade de unidades, confirmar os preços e garantir as condições vigentes no ato da negociação.
            </p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 3: TESE DE INVESTIMENTO */}
      <FolhaA4Horizontal>
        <div className="relative flex w-full h-full">
          
          {/* FOTO DE FUNDO FULL BLEED */}
          <img
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/su_te_4..jpeg"
            alt="Estilo de Vida Beta Suítes"
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
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

      {/* PÁGINA 3: INFRAESTRUTURA PREMIUM (ESTILO DE VIDA) */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#0a0a0a]">
          
          {/* LADO ESQUERDO: TEXTOS E COPY */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Estilo de Vida <br/><strong className="font-bold text-white">Premium</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              Investidores compram tijolos, mas inquilinos alugam <strong>estilo de vida</strong>. O grande segredo da liquidez do Beta Suítes não está nas paredes, mas na experiência completa que o edifício entrega aos seus moradores.
            </p>

            <ul className="space-y-6">
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Terraço Gourmet Panorâmico</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Uma área de lazer no topo do prédio com vista panorâmica do Ibituruna, perfeita para o descanso após o plantão ou aulas.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Academia</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Academia moderna e equipada no próprio prédio, eliminando o custo e tempo de deslocamento do morador.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Lavanderia</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Lavanderia compartilhada profissional, otimizando o espaço da suíte e oferecendo conveniência absoluta.</p>
              </li>
            </ul>
          </div>

          {/* LADO DIREITO: MOSAICO DE FOTOS */}
          <div className="w-[65%] h-full flex flex-col">
            
            {/* FOTO SUPERIOR (TERRAÇO) - 60% DA ALTURA */}
            <div className="w-full h-[60%] relative border-b border-white/10 group overflow-hidden">
              <img
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/_rea_de_lazer_1.png"
                alt="Terraço Gourmet Beta Suítes"
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent pointer-events-none"></div>
              <p className="absolute bottom-4 left-6 text-white text-xs uppercase tracking-[0.2em] font-light drop-shadow-md z-10">
                Terraço Gourmet Panorâmico
              </p>
            </div>

            {/* FOTOS INFERIORES (ACADEMIA E LAVANDERIA) - 40% DA ALTURA */}
            <div className="w-full h-[40%] flex">
              
              {/* ACADEMIA (50% DA LARGURA) */}
              <div className="w-1/2 h-full relative border-r border-white/10 group overflow-hidden">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/academia.jpeg"
                  alt="Academia Beta Suítes"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent pointer-events-none"></div>
                <p className="absolute bottom-4 left-4 text-white text-[10px] uppercase tracking-[0.2em] font-light drop-shadow-md z-10">
                  Academia
                </p>
              </div>

              {/* LAVANDERIA (50% DA LARGURA) */}
              <div className="w-1/2 h-full relative group overflow-hidden">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/galeria_rev2/lavanderia_1.png"
                  alt="Lavanderia Beta Suítes"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent pointer-events-none"></div>
                <p className="absolute bottom-4 left-4 text-white text-[10px] uppercase tracking-[0.2em] font-light drop-shadow-md z-10">
                  Lavanderia
                </p>
              </div>

            </div>

          </div>
          
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 4: LOCALIZAÇÃO (O MAPA DO OURO) */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#0a0a0a]">
          
          {/* LADO ESQUERDO: TEXTOS E TEMPOS DE DISTÂNCIA */}
          <div className="w-[50%] p-12 flex flex-col justify-center relative z-20">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              O Mapa do <strong className="font-bold text-white">Ouro</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify pr-8">
              O Beta Suítes está posicionado estrategicamente próximo a tudo que realmente importa. Inserido no Alto Esplanada, um dos bairros com maior índice de valorização em Governador Valadares, o empreendimento oferece acesso rápido ao maior polo de ensino superior da cidade e principais centros de saúde.
            </p>

            {/* TIMELINE DE DISTÂNCIAS - IDENTIDADE DA LANDING PAGE */}
            <div className="relative max-w-sm mt-2">
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-white/20"></div>
              {locationPoints.map((point, index) => (
                <div key={index} className={`relative pl-10 ${index === locationPoints.length - 1 ? '' : 'pb-3'}`}>
                  <div className={`absolute left-0 top-1 w-5 h-5 rounded-full border-4 border-[#0a0a0a] shadow-sm ${point.highlight ? 'bg-white' : 'bg-[#f25a2f]'
                    }`}
                  ></div>
                  <div className="flex items-center">
                    <FontAwesomeIcon icon={point.icon} className={`text-xl mr-4 ${point.highlight ? 'text-white' : 'text-gray-500'}`} />
                    <div>
                      <p className={`font-bold ${point.highlight ? 'text-white text-sm' : 'text-gray-400 text-xs'}`}>
                        {point.name}
                      </p>
                      <p className="text-[10px] text-gray-500">{point.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* LADO DIREITO: FOTO DO BAIRRO (SANGRANDO COM GRADIENTE) */}
          <div className="w-[50%] relative h-full">
            <img
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_bairro.jpeg"
              alt="Vista Aérea do Alto Esplanada"
              className="absolute inset-0 w-full h-full object-cover object-center z-0"
            />
            {/* 
              Gradiente duplo: 
              1. Da esquerda para a direita (transição suave do fundo preto para a imagem)
              2. De baixo para cima (para dar leitura ao texto da perspectiva)
            */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent z-10"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-transparent to-transparent z-10"></div>
            
            <p className="absolute bottom-6 right-8 text-gray-300 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
              Perspectiva ilustrada da inserção do empreendimento no Alto Esplanada.
            </p>
          </div>
          
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 5: MASTERPLAN E TÉRREO */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#161616]">
          
          {/* LADO ESQUERDO: TEXTOS E COPY */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20 bg-[#161616]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Planta <strong className="font-bold text-white">Térreo</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              A primeira impressão é a que consolida o valor do imóvel. O pavimento térreo do Beta Suítes foi desenhado para oferecer uma recepção imponente, controle de acesso seguro e uma logística de garagem eficiente para os moradores.
            </p>

            <ul className="space-y-6">
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Recepção Elegante</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Hall de entrada desenhado com acabamentos premium, garantindo que o inquilino sinta o alto padrão desde a calçada.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Acesso Inteligente</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Eclusa de segurança e tecnologia de controle de acesso de última geração, essenciais para o público moderno.</p>
              </li>
            </ul>
          </div>

          {/* LADO DIREITO: PLANTA HUMANIZADA (TÉRREO ORIGINAL) */}
          <div className="w-[65%] relative h-full bg-[#0a0a0a] p-12 flex flex-col items-center justify-center">
            
            {/* CONTAINER DA IMAGEM */}
            <div className="relative w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden border border-white/5">
              <img 
                src="/terreo_final.jpeg" 
                alt="Planta Humanizada do Térreo" 
                className="w-full h-auto block"
              />
            </div>

            <p className="absolute bottom-6 right-8 text-gray-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
              *Imagens meramente ilustrativas. Planta sujeita a alterações técnicas.
            </p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: FACHADA */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg" alt="Fachada" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Fachada e Acesso Principal</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: HALL DE ENTRADA */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_hall.jpeg" alt="Hall de Entrada" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Hall de Entrada Premium</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 6: PAVIMENTO 1 */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#161616]">
          
          {/* LADO ESQUERDO: TEXTOS E COPY */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20 bg-[#161616]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            

            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              O <strong className="font-bold text-white">Pavimento 1</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              O Pavimento 1 une a logística da garagem de acesso rápido com as facilidades do dia a dia, entregando aos inquilinos infraestrutura de apoio sem a necessidade de sair do prédio.
            </p>

            <ul className="space-y-6">
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Lavanderia Compartilhada</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Equipada com máquinas de alta performance, liberando espaço útil nas suítes e centralizando o serviço de forma elegante e prática.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Garagem Otimizada</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">O uso de <strong>lajes nervuradas</strong> na estrutura permite vãos maiores entre os pilares, garantindo total liberdade de manobra e conforto.</p>
              </li>
            </ul>
          </div>

          {/* LADO DIREITO: PLANTA HUMANIZADA COM PINOS E LEGENDA */}
          <div className="w-[65%] relative h-full bg-[#0a0a0a] p-12 flex flex-col items-center justify-center">
            
            {/* CONTAINER DA IMAGEM (Aspect Ratio perfeito para os Pinos) */}
            <div className="relative w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden border border-white/5">
              <img 
                src="/pav1_final_v3.png" 
                alt="Planta Humanizada do Pavimento 1" 
                className="w-full h-auto block"
              />

            </div>

            <p className="absolute bottom-6 right-8 text-gray-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
              *Imagens meramente ilustrativas. Planta sujeita a alterações técnicas.
            </p>
          </div>
          
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: LAVANDERIA */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_lavanderia.png" alt="Lavanderia Compartilhada" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Lavanderia Compartilhada</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 7: PAVIMENTO TIPO (SUÍTES) */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#0a0a0a]">
          
          {/* LADO ESQUERDO: TEXTOS E COPY */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20 bg-[#161616]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Pavimento <strong className="font-bold text-white">Tipo</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              Projetado para maximizar a rentabilidade do investidor e o conforto do inquilino. São <strong className="text-white">Suítes de 28 a 32m²</strong> com layout inteligente que garante ventilação, iluminação natural e total privacidade entre as unidades.
            </p>

            <ul className="space-y-6">
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Rentabilidade por m²</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Plantas otimizadas sem corredores ociosos dentro das unidades, entregando exatamente o que o público-alvo busca pagar.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Acústica e Privacidade</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Disposição estratégica das suítes para reduzir paredes de divisa seca e aumentar o conforto acústico.</p>
              </li>
            </ul>
          </div>

          {/* LADO DIREITO: PLANTA HUMANIZADA COM PINOS */}
          <div className="w-[65%] relative h-full bg-[#0a0a0a] p-12 flex flex-col items-center justify-center">
            
            {/* CONTAINER DA IMAGEM */}
            <div className="relative w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden border border-white/5">
              <img 
                src="/pav_tipo.png" 
                alt="Planta Humanizada do Pavimento Tipo" 
                className="w-full h-auto block"
              />
            </div>

            <p className="absolute bottom-6 right-8 text-gray-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
              *Imagens meramente ilustrativas. Planta sujeita a alterações técnicas.
            </p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: DIAGRAMA DE ÁREAS (PLANTA ESQUEMÁTICA) */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/planta_diagrama.png" alt="Diagrama de Áreas e Tipologias" className="max-w-full max-h-full object-contain" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase drop-shadow-md">Diagrama de Áreas e Tipologias (Suítes)</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: SUÍTE */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_suite.jpeg" alt="Interior da Suíte" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Interior - Suítes de 28 a 32m²</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: SUÍTE OPÇÃO 2 */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_suite_4.jpeg" alt="Interior da Suíte 2" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Interior - Suítes de 28 a 32m²</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: SUÍTE OPÇÃO 3 */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_suite_5.jpeg" alt="Interior da Suíte 3" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Interior - Suítes de 28 a 32m²</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 8: PAVIMENTO DE LAZER (ROOFTOP) */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#0a0a0a]">
          
          {/* LADO ESQUERDO: TEXTOS E COPY */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20 bg-[#161616]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            

            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Terraço <strong className="font-bold text-white">Gourmet</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              O diferencial absoluto para locação por temporada. O Terraço Gourmet do Beta Suítes foi desenhado para ser o refúgio perfeito, unindo vista panorâmica e infraestrutura de clube.
            </p>

            <ul className="space-y-6">
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Piscina de Borda Infinita</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Relaxamento com vista deslumbrante e definitiva para o Pico da Ibituruna, o cartão postal de Governador Valadares.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-1">Espaço Gourmet & Academia</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">Ambientes integrados e equipados no topo do prédio. O inquilino tem tudo o que precisa sem precisar sair de casa.</p>
              </li>
            </ul>
          </div>

          {/* LADO DIREITO: PLANTA HUMANIZADA COM PINOS */}
          <div className="w-[65%] relative h-full bg-[#0a0a0a] p-12 flex flex-col items-center justify-center">
            
            {/* CONTAINER DA IMAGEM */}
            <div className="relative w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden border border-white/5">
              <img 
                src="/lazer.png" 
                alt="Planta Humanizada do Pavimento de Lazer" 
                className="w-full h-auto block bg-black"
              />
            </div>

            <p className="absolute bottom-6 right-8 text-gray-500 text-[10px] font-light tracking-[0.2em] uppercase text-right z-20">
              *Imagens meramente ilustrativas. Planta sujeita a alterações técnicas.
            </p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: ÁREA DE LAZER */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_lazer.jpeg" alt="Piscina de Borda Infinita" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Piscina de Borda Infinita & Terraço Gourmet</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* RENDER: ACADEMIA */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative p-12 flex flex-col items-center justify-center">
          <img src="/render_academia.jpeg" alt="Academia Equipada" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/5" />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase">Academia</p>
          </div>
        </div>
      </FolhaA4Horizontal>
      {/* RENDER: ANÁLISE SOLAR */}
      <FolhaA4Horizontal>
        <div className="w-full h-full relative bg-[#0a0a0a]">
          <img 
            src="/analise_solar.jpeg" 
            alt="Estudo de Incidência Solar" 
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
          />
          <div className="absolute bottom-6 left-12 px-6 py-3 border-l-4 border-[#f25a2f] z-20">
            <p className="text-white text-xs font-light tracking-[0.2em] uppercase drop-shadow-md">Estudo de Incidência Solar</p>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA 12: FICHA TÉCNICA */}
      <FolhaA4Horizontal>
        <div className="flex w-full h-full bg-[#161616]">
          {/* LADO ESQUERDO: TÍTULO */}
          <div className="w-[35%] p-10 flex flex-col justify-center border-r border-white/10 z-20 bg-[#0a0a0a]">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-4xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight`}>
              Ficha <strong className="font-bold text-white">Técnica</strong>
            </h2>
            
            <p className="text-gray-300 text-[13px] mb-8 leading-relaxed text-justify">
              O Beta Suítes foi milimetricamente arquitetado com precisão <strong className="text-white">BIM</strong> para garantir solidez e baixo custo de manutenção. Abaixo, as especificações cruciais do projeto.
            </p>

            <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-xl shadow-xl">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Realização</p>
              <h3 className="text-sm font-bold text-[#f25a2f] uppercase tracking-wide mb-2">STUDIO 57 INCORPORAÇÕES LTDA</h3>
              <div className="text-[10px] text-gray-400 space-y-1">
                <p><strong>CNPJ:</strong> 41.464.589/0001-66</p>
                <p><strong>Sede:</strong> Av. Rio Doce, 1825, Loja A</p>
                <p>Ilha dos Araújos • Gov. Valadares/MG</p>
              </div>
            </div>
          </div>

          {/* LADO DIREITO: GRID DE DADOS */}
          <div className="w-[65%] p-12 flex flex-col justify-center relative bg-[#161616]">
            <div className="grid grid-cols-2 gap-6">
              
              {/* O Empreendimento */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faBuilding} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">O Empreendimento</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Composto por 42 suítes de 28m² a 32m² e 1 ponto comercial estratégico localizado no térreo.
                </p>
              </div>

              {/* Localização Premium */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faLocationDot} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Localização Premium</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Situado no bairro Alto Esplanada (Gov. Valadares/MG), com proximidade direta à UFJF-GV e ao Polo Médico da cidade.
                </p>
              </div>

              {/* Garagem */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faCar} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Garagem</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Possui 21 vagas para carros e 15 vagas para motos com matrículas independentes, além de vãos amplos para facilitar manobras.
                </p>
              </div>

              {/* Lazer */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faWater} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Terraço Gourmet</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Lazer exclusivo no topo do edifício com piscina de borda infinita (vista para a Ibituruna), academia e espaço gourmet.
                </p>
              </div>

              {/* Conveniência */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faTshirt} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Conveniência</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Lavanderia compartilhada projetada para reduzir drasticamente o custo do condomínio e liberar espaço útil dentro das suítes.
                </p>
              </div>

              {/* Técnica Construtiva */}
              <div className="p-5 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl hover:border-white/20 transition-colors">
                <div className="mb-3 text-white text-xl"><FontAwesomeIcon icon={faAward} /></div>
                <h3 className="font-bold text-white text-xs mb-2 uppercase tracking-wide">Técnica Construtiva</h3>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Estrutura em concreto armado, lajes nervuradas e vedação em bloco cerâmico.
                </p>
              </div>

            </div>
          </div>
        </div>
      </FolhaA4Horizontal>

      {/* PÁGINA FINAL: CONTRA-CAPA (STUDIO 57 + PARCEIROS) */}
      <FolhaA4Horizontal>
        <div className="w-full h-full bg-[#0a0a0a] relative flex flex-col items-center justify-center">
          
          {/* Logo Studio 57 e Slogan */}
          <div className="flex flex-col items-center justify-center -mt-20">
            <div className="w-[400px] mb-6">
              <img
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                alt="Logo Studio 57"
                className="w-full h-auto object-contain filter brightness-0 invert opacity-90"
              />
            </div>
            <h1 className={`${montserrat.className} text-sm font-light uppercase tracking-[0.3em] text-white text-center drop-shadow-md opacity-80`}>
              excelência em cada detalhe
            </h1>
          </div>

          {/* Marcas Parceiras */}
          <div className="absolute bottom-16 w-full flex flex-col items-center">
            <p className="text-gray-500 text-[9px] uppercase tracking-[0.3em] mb-6 font-bold">Projetos & Consultoria</p>
            <div className="flex justify-center items-center gap-12">
              <img src="/parceiros_beta/INTEC_png.png" alt="Intec" className="h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/BRIM Logomarca.png" alt="BRIM" className="h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/LZ ENGENHARIA.jpg" alt="LZ Engenharia" className="h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/TONZIRO.png" alt="Tonziro" className="h-12 object-contain filter grayscale invert opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
              <img src="/parceiros_beta/logo-horizontal-04.png" alt="Planizar" className="h-14 object-contain opacity-40 hover:opacity-100 transition-all duration-500 cursor-pointer" />
            </div>
          </div>

        </div>
      </FolhaA4Horizontal>

      </div> {/* Fim do pdf-book-container */}

    </div>
  );
}

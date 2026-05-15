'use client';

import React, { useState } from 'react';
import { Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faRulerCombined, faBed, faBath, faCouch, faCar, faLocationDot, faSchool, faCartShopping, faHouseMedical, faLandmark } from '@fortawesome/free-solid-svg-icons';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
});

const primaryColor = '#005bac';

// Componentes de Ícones para Tese
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeSeguranca = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>;
const IconeTicket = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;

const locationPoints = [
  { name: 'Residencial Pero Vaz', time: 'Jardim Vera Cruz', icon: faLocationDot, highlight: true },
  { name: 'Comércio Local', time: 'Acesso Rápido', icon: faCartShopping },
  { name: 'Escolas', time: 'Próximo', icon: faSchool },
  { name: 'Centro da Cidade', time: 'Fácil Acesso', icon: faLandmark },
];

export default function PeroVazBookClient() {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
      const pdfUrl = 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/book/Book_Residencial_Pero_Vaz.pdf';
      
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('PDF não encontrado. Solicite a geração à equipe executando o script local.');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Book_Residencial_Pero_Vaz.pdf';
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

  const FolhaA4Horizontal = ({ children, bgColor = "bg-white" }) => (
    <div className="relative mx-auto w-[297mm] h-[210mm] mb-8 folha-page-wrapper" style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}>
      <div className="absolute -left-20 top-0 text-gray-500 text-sm font-bold tracking-widest uppercase print:hidden page-indicator"></div>
      <section 
        className={`book-page ${bgColor} text-gray-900 relative w-[297mm] h-[210mm] overflow-hidden shadow-2xl print:shadow-none border border-gray-200 print:border-none`}
      >
        {children}
      </section>
    </div>
  );

  return (
    <div className={`${roboto.className} bg-gray-100 min-h-screen py-8 print:py-0 print:m-0 print:p-0 print:bg-white print:min-h-0`}>
      
      {/* Botão de Impressão Flutuante */}
      <button 
        onClick={handleDownloadPDF}
        disabled={isGeneratingPdf}
        className={`fixed top-28 right-8 z-50 bg-[#005bac] hover:bg-[#004a8c] text-white font-bold py-3 px-6 rounded-full shadow-2xl transition-all print:hidden flex items-center gap-3 uppercase tracking-widest text-xs ${isGeneratingPdf ? 'opacity-75 cursor-wait animate-pulse' : ''}`}
      >
        {isGeneratingPdf ? (
          <>
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Gerando PDF...
          </>
        ) : (
          <>
            <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"></path></svg>
            Baixar PDF (Alta Qualidade)
          </>
        )}
      </button>

      <div id="pdf-book-container" className="w-full h-full">

        <style jsx global>{`
          body {
            counter-reset: page-counter;
          }
          .folha-page-wrapper {
            counter-increment: page-counter;
          }
          .page-indicator::after {
            content: "Pág " counter(page-counter);
          }

          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              width: 297mm !important;
              height: auto !important;
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            .folha-page-wrapper {
              width: 297mm !important;
              height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              page-break-after: always;
              page-break-inside: avoid;
              break-after: page;
              break-inside: avoid;
              position: relative !important;
            }
            .folha-page-wrapper:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .book-page {
              overflow: hidden !important;
              width: 297mm !important;
              height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            img {
              max-width: none !important;
              display: block !important;
            }
            ::-webkit-scrollbar {
              display: none;
            }
          }
        `}</style>

        {/* PÁGINA 1: CAPA */}
        <FolhaA4Horizontal bgColor="bg-black">
          <img 
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649407.jpeg" 
            alt="Fachada Pero Vaz" 
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
          />
          <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
          
          <div className="relative z-30 flex flex-col items-center justify-center h-full w-full p-12 text-center text-white">
            <h1 className="text-6xl font-black uppercase tracking-widest mb-4 drop-shadow-2xl">
              Residencial Pero Vaz
            </h1>
            <p className="text-3xl font-thin tracking-wider opacity-90 mb-2 drop-shadow-md">
              Saia do Aluguel Hoje Mesmo!
            </p>
            <p className="text-xl font-normal text-gray-300 mb-12 drop-shadow-md">
              Apartamento Térreo no Jardim Vera Cruz
            </p>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl flex flex-row items-center gap-12 mt-12 shadow-2xl">
              <div>
                <p className="text-sm text-gray-300 uppercase tracking-wider font-semibold mb-1">Avaliação Caixa</p>
                <p className="text-gray-400 line-through text-2xl">R$ 220.000,00</p>
              </div>
              <div className="w-px h-16 bg-white/20"></div>
              <div>
                <p className="text-sm text-green-400 uppercase tracking-wider font-bold mb-1">Preço Promocional</p>
                <p className="text-5xl font-extrabold text-white drop-shadow-xl">R$ 180.000,00</p>
              </div>
            </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 2: ARQUITETURA FINANCEIRA (CAIXA / MCMV) */}
        <FolhaA4Horizontal bgColor="bg-[#005bac]">
          <div className="w-full h-full relative overflow-hidden flex flex-col items-center justify-center text-white p-16">
            <div className="absolute inset-0 bg-black/20 z-0"></div>
            
            <div className="relative z-10 text-center w-full">
              <div className="mb-10 flex justify-center">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1769174760534.png"
                  alt="Caixa Econômica Federal"
                  className="h-20 object-contain brightness-0 invert"
                />
              </div>

              <h2 className="text-5xl font-bold mb-6 drop-shadow-md">
                Financiado pelo Minha Casa Minha Vida
              </h2>

              <p className="text-2xl font-light max-w-3xl mx-auto mb-16 leading-relaxed">
                Use o seu FGTS e realize o sonho do imóvel próprio. O apartamento está pronto para financiar!
              </p>

              <div className="grid grid-cols-3 gap-8 max-w-5xl mx-auto">
                <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl border border-white/20 shadow-xl">
                  <p className="text-6xl font-bold mb-4 text-white">20%</p>
                  <p className="text-sm font-bold uppercase tracking-widest text-white/90">de Entrada Estimada</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl border border-white/20 shadow-xl">
                  <p className="text-6xl font-bold mb-4 text-white">420</p>
                  <p className="text-sm font-bold uppercase tracking-widest text-white/90">Meses para Pagar</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl border border-white/20 shadow-xl">
                  <p className="text-6xl font-bold mb-4 text-white">FGTS</p>
                  <p className="text-sm font-bold uppercase tracking-widest text-white/90">Utilize seu Saldo</p>
                </div>
              </div>
            </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 3: PLANTA INTELIGENTE E FICHA TÉCNICA */}
        <FolhaA4Horizontal bgColor="bg-white">
          <div className="flex w-full h-full">
            <div className="w-[45%] p-16 flex flex-col justify-center border-r border-gray-100">
              <h2 className="text-5xl font-bold mb-6 text-gray-900 leading-tight">
                Planta <br/><span className="text-blue-600 font-light">Inteligente</span>
              </h2>
              
              <p className="text-gray-600 text-lg mb-12 leading-relaxed text-justify">
                Apartamento Térreo com 51 m² de área privativa, desenhado sem corredores perdidos, aproveitando cada centímetro para proporcionar o máximo de conforto para a sua família.
              </p>

              <ul className="space-y-8">
                <li className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-6">
                    <FontAwesomeIcon icon={faRulerCombined} className="text-xl text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider">51m²</h3>
                    <p className="text-gray-500 text-sm">Área Privativa Otimizada</p>
                  </div>
                </li>
                <li className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-6">
                    <FontAwesomeIcon icon={faBed} className="text-xl text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider">2 Quartos</h3>
                    <p className="text-gray-500 text-sm">Espaçosos e bem ventilados</p>
                  </div>
                </li>
                <li className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-6">
                    <FontAwesomeIcon icon={faCar} className="text-xl text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 uppercase tracking-wider">1 Vaga</h3>
                    <p className="text-gray-500 text-sm">Vaga de Garagem Inclusa</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="w-[55%] relative h-full bg-gray-50 p-12 flex flex-col items-center justify-center">
              <img 
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/PLAN_1778095655435.png" 
                alt="Planta Humanizada do Apartamento Pero Vaz" 
                className="w-full h-auto object-contain max-h-[180mm] drop-shadow-xl"
              />
            </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 4: GALERIA INTERIOR 1 */}
        <FolhaA4Horizontal bgColor="bg-white">
          <div className="w-full h-full flex flex-col p-8">
            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-widest">Ambientes Prontos</h2>
            </div>
            
            <div className="flex-1 flex gap-4">
              <div className="w-2/3 h-full rounded-2xl overflow-hidden relative shadow-lg">
                <img 
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095651162.jpg" 
                  alt="Sala de Estar" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-6 bg-white/90 px-4 py-2 rounded-lg shadow-sm">
                  <p className="text-sm font-bold text-gray-900 uppercase">Sala de TV e Jantar</p>
                </div>
              </div>
              
              <div className="w-1/3 flex flex-col gap-4 h-full">
                <div className="flex-1 rounded-2xl overflow-hidden relative shadow-lg">
                  <img 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095652204.jpg" 
                    alt="Integração Sala" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 rounded-2xl overflow-hidden relative shadow-lg">
                  <img 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095647132.jpg" 
                    alt="Cozinha" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                    <p className="text-xs font-bold text-gray-900 uppercase">Cozinha Otimizada</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 5: GALERIA INTERIOR 2 */}
        <FolhaA4Horizontal bgColor="bg-white">
          <div className="w-full h-full flex flex-col p-8">
            <div className="flex-1 flex gap-4">
              
              <div className="w-1/3 flex flex-col gap-4 h-full">
                <div className="flex-1 rounded-2xl overflow-hidden relative shadow-lg">
                  <img 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095645144.jpg" 
                    alt="Banheiro" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                    <p className="text-xs font-bold text-gray-900 uppercase">Banheiro Social</p>
                  </div>
                </div>
                <div className="flex-1 rounded-2xl overflow-hidden relative shadow-lg">
                  <img 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649799.jpg" 
                    alt="Quarto 2" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-4 bg-white/90 px-3 py-1 rounded-lg shadow-sm">
                    <p className="text-xs font-bold text-gray-900 uppercase">Quarto Solteiro</p>
                  </div>
                </div>
              </div>

              <div className="w-2/3 h-full rounded-2xl overflow-hidden relative shadow-lg">
                <img 
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095650024.jpg" 
                  alt="Quarto Casal" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-6 bg-white/90 px-4 py-2 rounded-lg shadow-sm">
                  <p className="text-sm font-bold text-gray-900 uppercase">Amplo Quarto de Casal</p>
                </div>
              </div>

            </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 6: LOCALIZAÇÃO (SOMENTE MAPA E RUA) */}
        <FolhaA4Horizontal bgColor="bg-gray-50">
          <div className="w-full h-full p-16 flex flex-col items-center justify-center">
             <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-widest"><FontAwesomeIcon icon={faLocationDot} className="text-red-500 mr-2"/> Localização Exata</h2>
                <p className="text-lg text-gray-600">Rua Fernão Dias, n° 265, Bairro Jardim Vera Cruz - Governador Valadares/MG</p>
             </div>
             <div className="w-full flex-1 bg-gray-200 relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
               <img 
                 src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/mapa_pero_vaz_manual.png" 
                 alt="Mapa de Localização - Pero Vaz" 
                 className="absolute inset-0 w-full h-full object-cover object-center"
               />
             </div>
          </div>
        </FolhaA4Horizontal>

        {/* PÁGINA 7: CONTATO E ENCERRAMENTO */}
        <FolhaA4Horizontal bgColor="bg-white">
          <div className="w-full h-full flex flex-col items-center justify-center p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gray-50 z-0"></div>
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50 z-0"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-100 rounded-full blur-3xl opacity-50 z-0"></div>

            <div className="relative z-10 bg-white p-16 rounded-3xl shadow-2xl border border-gray-100 flex flex-col items-center text-center w-full max-w-3xl">
              <img 
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG" 
                alt="Studio 57 Imobiliária" 
                className="w-80 h-auto object-contain mb-10"
              />

              <h2 className="text-4xl font-bold text-gray-900 mb-4">Pronto para sair do aluguel?</h2>
              <p className="text-lg text-gray-600 mb-10">
                O imóvel já possui Matrícula individualizada e está 100% desembaraçado. Nossa equipe cuidará de toda a burocracia do financiamento Minha Casa Minha Vida para você.
              </p>

              <div className="grid grid-cols-2 gap-8 w-full border-t border-gray-100 pt-10">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600 text-2xl">
                    <FontAwesomeIcon icon={faLocationDot} />
                  </div>
                  <p className="text-gray-900 font-bold uppercase tracking-wider text-sm mb-1">Nosso Escritório</p>
                  <p className="text-gray-500 text-sm">Av. Rio Doce, 1825, Loja A<br/>Ilha dos Araújos - Governador Valadares/MG</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-green-600 text-3xl">
                    <svg fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  </div>
                  <p className="text-gray-900 font-bold uppercase tracking-wider text-sm mb-1">Contato Direto</p>
                  <p className="text-gray-500 text-sm">(33) 99819-2119<br/>comercial@studio57.arq.br</p>
                </div>
              </div>
            </div>
          </div>
        </FolhaA4Horizontal>

      </div>
    </div>
  );
}

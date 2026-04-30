// Caminho: app/(landingpages)/betasuites/book-a5/BetaSuitesBookA5Client.js
'use client';

import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faLocationDot,
  faCar,
  faWater,
  faAward,
  faHospital,
  faGraduationCap,
  faCartShopping,
  faTshirt,
  faPrint
} from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '700', '900'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700', '900'],
});

// Componente para a Folha A5 Retrato (Vertical)
// A5 dimensions: 148mm x 210mm
const FolhaA5Retrato = ({ children, isDark = true }) => {
  return (
    <div
      className={`w-[148mm] h-[210mm] mx-auto overflow-hidden relative break-after-page shadow-2xl mb-8 flex flex-col ${
        isDark ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black'
      } print:shadow-none print:m-0`}
      style={{
        pageBreakAfter: 'always',
      }}
    >
      {children}
    </div>
  );
};

export default function BetaSuitesBookA5Client() {
  
  const handlePrint = () => {
    window.print();
  };

  const locationPoints = [
    { time: '01 MIN', name: 'UFJF Campus', icon: faGraduationCap, highlight: true },
    { time: '03 MIN', name: 'Hospital Regional', icon: faHospital, highlight: false },
    { time: '05 MIN', name: 'Supermercados', icon: faCartShopping, highlight: false },
    { time: '07 MIN', name: 'Centro da Cidade', icon: faBuilding, highlight: false },
  ];

  return (
    <div className="min-h-screen bg-neutral-900 py-10 print:py-0 print:bg-transparent">
      
      {/* Definições de impressão essenciais para o A5 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 148mm 210mm;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}} />

      {/* Barra de Controles (Não aparece na impressão) */}
      <div className="max-w-[148mm] mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/50 p-4 rounded-xl border border-white/10 print:hidden sticky top-4 z-50 backdrop-blur-md">
        <div>
          <h1 className="text-white font-bold text-sm">Livreto Beta Suítes - A5 Vertical</h1>
          <p className="text-gray-400 text-xs">A5 Puro (14.8 x 21cm). Pronto para gráfica.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#f25a2f] hover:bg-[#d14b25] text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors w-full sm:w-auto justify-center"
        >
          <FontAwesomeIcon icon={faPrint} /> Imprimir A5
        </button>
      </div>

      <div className="pdf-book-container flex flex-col items-center">

        {/* ========================================================
            PÁGINA 1: CAPA
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[65%] relative">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg" 
              alt="Capa Beta Suítes" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent"></div>
          </div>
          <div className="h-[35%] flex flex-col items-center justify-center p-8 bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-[#f25a2f]/50 to-transparent"></div>
            
            <img src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/LOGO-P_1764944035362.png" alt="Beta Suítes" className="w-[85%] max-w-xs object-contain mb-6 drop-shadow-2xl" />
            
            <h1 className={`${montserrat.className} text-sm font-light uppercase tracking-[0.3em] text-white text-center`}>
              Investimento Inteligente
            </h1>
            <p className="text-gray-500 text-[10px] mt-3 tracking-[0.2em] uppercase font-bold">
              Book do Investidor
            </p>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 2: A TESE & LOCALIZAÇÃO
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[45%] relative">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_bairro.jpeg" 
              alt="Vista Aérea do Alto Esplanada" 
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
          </div>
          
          <div className="h-[55%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              O Mapa do <strong className="font-bold text-white">Ouro</strong>
            </h2>
            
            <p className="text-gray-300 text-[9px] mb-6 leading-relaxed text-justify">
              O Beta Suítes está posicionado estrategicamente próximo a tudo que realmente importa. Inserido no Alto Esplanada, um dos bairros com maior índice de valorização em Governador Valadares, o empreendimento oferece acesso rápido ao maior polo de ensino superior da cidade e principais centros de saúde.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10"></div>
                {locationPoints.slice(0, 2).map((point, index) => (
                  <div key={index} className="relative pl-6 pb-3">
                    <div className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-[#0a0a0a] ${point.highlight ? 'bg-white' : 'bg-[#f25a2f]'}`}></div>
                    <p className={`font-bold leading-none mb-1 ${point.highlight ? 'text-white text-[10px]' : 'text-gray-400 text-[9px]'}`}>{point.name}</p>
                    <p className="text-[8px] text-gray-500 leading-none">{point.time}</p>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10"></div>
                {locationPoints.slice(2, 4).map((point, index) => (
                  <div key={index} className="relative pl-6 pb-3">
                    <div className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-[#0a0a0a] bg-[#f25a2f]`}></div>
                    <p className="font-bold leading-none mb-1 text-gray-400 text-[9px]">{point.name}</p>
                    <p className="text-[8px] text-gray-500 leading-none">{point.time}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 3: PLANTA TÉRREO
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[50%] bg-[#161616] p-6 flex items-center justify-center relative">
             <img src="/terreo_final.jpeg" alt="Planta Térreo" className="max-w-full max-h-full object-contain drop-shadow-2xl rounded border border-white/5" />
          </div>
          
          <div className="h-[50%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              Planta <strong className="font-bold text-white">Térreo</strong>
            </h2>
            
            <p className="text-gray-300 text-[9px] mb-6 leading-relaxed text-justify">
              A primeira impressão é a que consolida o valor do imóvel. O pavimento térreo do Beta Suítes foi desenhado para oferecer uma recepção imponente, controle de acesso seguro e uma logística de garagem eficiente para os moradores.
            </p>

            <ul className="space-y-4">
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Recepção Elegante</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Hall de entrada desenhado com acabamentos premium, garantindo que o inquilino sinta o alto padrão desde a calçada.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Acesso Inteligente</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Eclusa de segurança e tecnologia de controle de acesso de última geração, essenciais para o público moderno.</p>
              </li>
            </ul>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 4: PAVIMENTO 1 & GARAGEM
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[50%] bg-[#161616] p-6 flex items-center justify-center relative">
             <img src="/pav1_final_v3.png" alt="Pavimento 1" className="max-w-full max-h-full object-contain drop-shadow-2xl rounded border border-white/5" />
          </div>
          
          <div className="h-[50%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              O <strong className="font-bold text-white">Pavimento 1</strong>
            </h2>
            
            <p className="text-gray-300 text-[9px] mb-6 leading-relaxed text-justify">
              O Pavimento 1 une a logística da garagem de acesso rápido com as facilidades do dia a dia, entregando aos inquilinos infraestrutura de apoio sem a necessidade de sair do prédio.
            </p>

            <ul className="space-y-4">
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Lavanderia Compartilhada</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Equipada com máquinas de alta performance, liberando espaço útil nas suítes e centralizando o serviço.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Garagem Otimizada</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">O uso de lajes nervuradas permite vãos maiores entre os pilares, garantindo total liberdade de manobra e conforto.</p>
              </li>
            </ul>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 5: PAVIMENTO TIPO
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[50%] bg-[#161616] p-6 flex items-center justify-center relative">
             <img src="/pav_tipo.png" alt="Pavimento Tipo" className="max-w-full max-h-full object-contain drop-shadow-2xl rounded border border-white/5" />
          </div>
          
          <div className="h-[50%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              Pavimento <strong className="font-bold text-white">Tipo</strong>
            </h2>
            
            <p className="text-gray-300 text-[9px] mb-6 leading-relaxed text-justify">
              Projetado para maximizar a rentabilidade do investidor e o conforto do inquilino. São <strong className="text-white">Suítes de 28 a 32m²</strong> com layout inteligente que garante ventilação e iluminação natural.
            </p>

            <ul className="space-y-4">
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Rentabilidade por m²</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Plantas otimizadas sem corredores ociosos, entregando o que o público busca pagar.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Acústica e Privacidade</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Disposição estratégica das suítes para reduzir paredes de divisa seca.</p>
              </li>
            </ul>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 6: SUÍTES - ESTILO DE VIDA
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[55%] relative">
             <img src="/render_suite_4.jpeg" alt="Interior da Suíte" className="absolute inset-0 w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
          </div>
          
          <div className="h-[45%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              Estilo de Vida <strong className="font-bold text-white">Contemporâneo</strong>
            </h2>
            
            <p className="text-gray-300 text-[10px] leading-relaxed text-justify">
              As suítes do Beta Suítes foram pensadas para entregar a melhor experiência de moradia compacta. Ambientes inteligentemente integrados que oferecem sensação de amplitude, banheiros modernos e acabamentos de primeiríssima linha.
            </p>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 7: SUÍTES - DETALHES
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[60%] flex flex-col relative bg-[#161616]">
            <div className="h-1/2 w-full">
              <img src="/render_suite.jpeg" alt="Detalhe Suíte 1" className="w-full h-full object-cover" />
            </div>
            <div className="h-1/2 w-full">
              <img src="/render_suite_5.jpeg" alt="Detalhe Suíte 2" className="w-full h-full object-cover" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
          </div>
          
          <div className="h-[40%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <ul className="space-y-5">
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-1">Acabamentos Impecáveis</h3>
                <p className="text-gray-400 text-[9px] leading-relaxed">Pisos e revestimentos que aliam alta durabilidade comercial com estética refinada.</p>
              </li>
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-1">Layout Integrado</h3>
                <p className="text-gray-400 text-[9px] leading-relaxed">Sem paredes desnecessárias, potencializando a luz natural, a ventilação e a mobilidade interna.</p>
              </li>
            </ul>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 8: ROOFTOP & LAZER (PLANTA)
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[50%] bg-[#161616] p-6 flex items-center justify-center relative">
             <img src="/lazer.png" alt="Rooftop Lazer" className="max-w-full max-h-full object-contain drop-shadow-2xl rounded border border-white/5 bg-black" />
          </div>
          
          <div className="h-[50%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-4 tracking-[0.1em] leading-tight`}>
              Terraço <strong className="font-bold text-white">Gourmet</strong>
            </h2>
            
            <p className="text-gray-300 text-[10px] mb-6 leading-relaxed text-justify">
              O diferencial absoluto para locação por temporada. O Terraço Gourmet foi desenhado para ser o refúgio perfeito, unindo vista panorâmica e infraestrutura de clube no topo do prédio.
            </p>

            <ul className="space-y-4">
              <li>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-wider mb-0.5">Lazer e Conexão</h3>
                <p className="text-gray-400 text-[9px] leading-relaxed">Ambientes integrados e equipados no topo do prédio para total conveniência.</p>
              </li>
            </ul>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 9: PISCINA DE BORDA INFINITA (RENDER)
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[75%] relative">
             <img src="/render_lazer.jpeg" alt="Piscina de Borda Infinita" className="absolute inset-0 w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
          </div>
          <div className="h-[25%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <h2 className={`${roboto.className} text-xl font-light text-white mb-2 tracking-[0.1em] leading-tight`}>
              Piscina de Borda Infinita
            </h2>
            <p className="text-gray-400 text-[9px] leading-relaxed">
              Relaxamento absoluto com vista deslumbrante e definitiva para o Pico da Ibituruna, o cartão postal da cidade.
            </p>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 10: ACADEMIA EQUIPADA (RENDER)
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="h-[75%] relative">
             <img src="/render_academia.jpeg" alt="Academia Equipada" className="absolute inset-0 w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent"></div>
          </div>
          <div className="h-[25%] p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            <h2 className={`${roboto.className} text-xl font-light text-white mb-2 tracking-[0.1em] leading-tight`}>
              Academia Equipada
            </h2>
            <p className="text-gray-400 text-[9px] leading-relaxed">
              Saúde e bem-estar garantidos sem precisar sair de casa. Vista panorâmica enquanto cuida do corpo.
            </p>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 11: FICHA TÉCNICA
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="w-full h-full p-8 flex flex-col justify-center bg-[#0a0a0a] relative">
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-400 mb-6 tracking-[0.1em] leading-tight text-center`}>
              Ficha <strong className="font-bold text-white">Técnica</strong>
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faBuilding} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">O Empreendimento</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">42 suítes (28 a 32m²) e 1 ponto comercial.</p>
              </div>

              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faLocationDot} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">Localização Premium</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Alto Esplanada, próximo à UFJF-GV.</p>
              </div>

              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faCar} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">Garagem</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">21 vagas de carros e 15 de motos.</p>
              </div>

              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faWater} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">Terraço Gourmet</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Piscina de borda infinita, academia e gourmet.</p>
              </div>

              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faTshirt} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">Conveniência</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Lavanderia compartilhada.</p>
              </div>

              <div className="p-4 bg-[#161616] rounded-xl border border-white/5 text-center flex flex-col items-center">
                <div className="mb-2 text-[#f25a2f] text-lg"><FontAwesomeIcon icon={faAward} /></div>
                <h3 className="font-bold text-white text-[9px] mb-1 uppercase tracking-wide">Técnica</h3>
                <p className="text-gray-400 text-[8px] leading-relaxed">Lajes nervuradas e isolamento acústico.</p>
              </div>
            </div>

            <div className="mt-8 p-5 bg-white/5 border border-white/10 rounded-xl text-center">
              <p className="text-[8px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Realização</p>
              <h3 className="text-[10px] font-bold text-white uppercase tracking-wide mb-1">STUDIO 57 INCORPORAÇÕES LTDA</h3>
              <p className="text-[9px] text-gray-500">CNPJ: 41.464.589/0001-66</p>
            </div>
          </div>
        </FolhaA5Retrato>


        {/* ========================================================
            PÁGINA 12: CONTRACAPA
        ======================================================== */}
        <FolhaA5Retrato>
          <div className="w-full h-full bg-[#0a0a0a] relative flex flex-col items-center justify-center p-8">
            
            <div className="flex flex-col items-center justify-center mb-16 mt-16">
              <div className="w-[180px] mb-5">
                <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Logo Studio 57"
                  className="w-full h-auto object-contain filter brightness-0 invert opacity-90"
                />
              </div>
              <h1 className={`${montserrat.className} text-[8px] font-light uppercase tracking-[0.4em] text-white text-center drop-shadow-md opacity-80`}>
                excelência em cada detalhe
              </h1>
            </div>

            <div className="absolute bottom-12 w-full flex flex-col items-center px-8">
              <p className="text-gray-500 text-[7px] uppercase tracking-[0.3em] mb-6 font-bold">Projetos & Consultoria</p>
              <div className="flex flex-wrap justify-center items-center gap-4">
                <img src="/parceiros_beta/INTEC_png.png" alt="Intec" className="h-5 object-contain filter grayscale invert opacity-40" />
                <img src="/parceiros_beta/BRIM Logomarca.png" alt="BRIM" className="h-5 object-contain filter grayscale invert opacity-40" />
                <img src="/parceiros_beta/LZ ENGENHARIA.jpg" alt="LZ Engenharia" className="h-5 object-contain filter grayscale invert opacity-40" />
                <img src="/parceiros_beta/TONZIRO.png" alt="Tonziro" className="h-5 object-contain filter grayscale invert opacity-40" />
                <img src="/parceiros_beta/logo-horizontal-04.png" alt="Planizar" className="h-7 object-contain opacity-40" />
              </div>
            </div>

          </div>
        </FolhaA5Retrato>

      </div> 
    </div>
  );
}

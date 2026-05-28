'use client';

import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPrint, faBullseye, faHandshake, faList, faMapLocationDot, 
  faBuilding, faDesktop, faCalculator, faComments, faHeadset,
  faCheckCircle, faFilePdf, faUsers, faLink, faChartLine,
  faQuestionCircle, faShieldHalved, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['200', '300', '400', '500', '700', '900'] });
const roboto = Roboto({ subsets: ['latin'], weight: ['100', '300', '400', '500', '700', '900'] });

// Componente para a Folha A5 Retrato (Vertical)
const FolhaA5Retrato = ({ children, isDark = false, isLast = false }) => {
  return (
    <div
      className={`w-[148mm] h-[210mm] mx-auto overflow-hidden relative shadow-2xl mb-8 flex flex-col ${
        isLast ? '' : 'break-after-page'
      } ${
        isDark ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black'
      } print:shadow-none print:m-0`}
    >
      {children}
    </div>
  );
};


export default function ManualCorretorAlfaClient() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen bg-neutral-900 py-10 print:py-0 print:bg-transparent ${montserrat.className}`}>
      
      {/* Definições de impressão essenciais para o A5 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
            size: 148mm 210mm; 
            margin: 0; 
          }
          
          /* REGRA NUCLEAR DO BOOK: Forçar backgrounds em TODOS os elementos */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* RESET DE VISIBILIDADE: globals.css esconde tudo (body * { visibility: hidden; }) */
          body * { visibility: visible !important; }
          
          /* Garantindo que o toaster continue oculto */
          [data-sonner-toaster] { display: none !important; }

          /* Ocultar elementos do Layout Global (Header/Menu e Footer) que estragam o PDF */
          header, footer { display: none !important; }
          
          /* GERENCIAMENTO DE QUEBRA DE PÁGINA */
          .break-after-page {
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            break-inside: avoid;
          }
          
          /* Impede que a última página force uma folha em branco no final */
          .break-after-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          body { 
            background: #0a0a0a !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          
          .pdf-book-container { display: block !important; visibility: visible !important; }
          .pdf-book-container * { visibility: visible !important; }
          
          /* Garantir que imagens apareçam */
          img { max-width: none !important; display: block !important; }
          
          /* Esconder scrollbar */
          ::-webkit-scrollbar { display: none; }
        }
      `}} />

      {/* Barra de Controles */}
      <div className="max-w-[148mm] mx-auto mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 bg-black/50 p-4 rounded-xl border border-white/10 print:hidden sticky top-4 z-50 backdrop-blur-md">
        <div>
          <h1 className="text-white font-bold text-[14px]">Manual do Corretor - A5</h1>
          <p className="text-gray-400 text-[12px]">A5 Puro (14.8 x 21cm). Visão Tática de Vendas.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-[#452921] hover:bg-[#d14b25] text-white px-5 py-2 rounded-lg text-[14px] font-bold transition-colors w-full sm:w-auto justify-center"
        >
          <FontAwesomeIcon icon={faPrint} /> Imprimir A5
        </button>
      </div>

      <div className="pdf-book-container flex flex-col items-center">

        {/* ========================================================
            CAPA DO MANUAL TÁTICO
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="absolute inset-0 w-full h-full">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png" 
              alt="Capa Residencial Alfa" 
              className="absolute inset-0 w-full h-full object-cover object-[65%_center] filter grayscale-[30%] opacity-40"
            />
            <div className="absolute inset-0 bg-white/80"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-[#452921]/10 via-transparent to-white"></div>
          </div>

          <div className="relative w-full h-full flex flex-col items-center justify-center p-8 z-10 text-center">
            <div className="w-[180px] mb-8">
               <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759007315252.png"
                  alt="Residencial Alfa Logo"
                  className="w-full h-auto object-contain drop-shadow-sm filter brightness-0"
                />
            </div>
            
            <div className="w-12 h-1 bg-[#452921] mb-8"></div>
            
            <h1 className={`${roboto.className} text-[1.6rem] font-light text-gray-900 uppercase tracking-[0.22em] leading-tight mb-6`}>
              Manual<br/>Do Corretor
            </h1>
            <div className="w-full flex justify-center">
              <p className="text-gray-600 text-[9px] tracking-[0.5em] uppercase font-bold text-center">
                Argumentos, Rentabilidade e Fechamento
              </p>
            </div>

            <div className="absolute bottom-12 flex flex-col items-center">
               <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Studio 57"
                  className="w-[100px] h-auto object-contain opacity-80 mb-2"
                />
               <p className="text-[12px] uppercase tracking-[0.2em] text-[#452921] font-bold mb-1">Restrito a Parceiros Cadastrados</p>
               <p className="text-[9px] uppercase tracking-[0.1em] text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full border border-gray-200 mt-1">
                 Atualizado em {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
               </p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 1: BEM-VINDO & PROPÓSITO
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faHandshake} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Bem-Vindo</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">O seu guia definitivo de vendas</p>
              </div>
            </div>

            <div className="flex-1">
               <h3 className="text-[14px] font-extrabold text-gray-800 mb-2 uppercase">Quem assina a obra</h3>
               <p className="text-[12px] text-gray-600 leading-[1.6] mb-6 text-justify">
                 Antes de apresentar o empreendimento, é importante que o cliente saiba a origem do projeto. O <strong>Studio 57</strong> construiu sua trajetória desenvolvendo arquitetura com extrema precisão, assinando projetos relevantes na região, como a Casa Trindade e as unidades da Hausmalte Cervejaria. 
                 <br/><br/>
                 Fundada a partir da convergência de ideais entre os arquitetos <em>Ranniere Campos</em> e <em>Igor Monte Alto</em> sobre como a arquitetura deveria ser executada, nossa base sempre foi a metodologia <strong>BIM (Building Information Modeling)</strong>. No entanto, o distanciamento entre o que era projetado no estúdio e o que era executado no canteiro por terceiros nos levou a uma decisão natural: assumir a responsabilidade completa. 
                 <br/><br/>
                 Ao nos tornarmos construtores e incorporadores, o objetivo foi um só: garantir que a arquitetura não fique apenas no papel. <em>Nós construímos exatamente o que projetamos, entregando com fidelidade o que o cliente comprou.</em>
               </p>

               <div className="bg-gray-50 border-l-4 border-[#452921] p-5 mb-6">
                 <h3 className="text-[13px] font-extrabold text-gray-800 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faBullseye} className="text-[#452921]" /> O Propósito Deste Guia
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">
                   Este manual tático contém as informações detalhadas sobre o Residencial Alfa, projetado exclusivamente para auxiliar você na argumentação tática e no fechamento da venda. 
                 </p>
               </div>

               <p className="text-[13px] text-gray-600 leading-[1.6] text-justify font-medium">
                 O Residencial Alfa é a materialização de <strong className="text-gray-900 text-[14px]">qualidade de vida e rentabilidade patrimonial sólida</strong>. Ele foi estrategicamente posicionado no Alto Esplanada para oferecer segurança, prestígio e proximidade aos principais polos da cidade.
               </p>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 01</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 2: SUMÁRIO
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faList} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Sumário</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Índice Tático</p>
              </div>
            </div>

            <div className="flex-1 space-y-5 mt-4">
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">01. Apresentação e Posicionamento</h3>
                 <p className="text-[12px] text-gray-600">A Máquina de Rentabilidade e a Marca Studio 57.</p>
               </div>
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">02. Raio-X do Empreendimento</h3>
                 <p className="text-[12px] text-gray-600">O Mapa do Ouro, Lazer Premium e Padrão de Acabamento.</p>
               </div>
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">03. O Portal do Corretor Studio 57</h3>
                 <p className="text-[12px] text-gray-600">Seu Escritório Virtual: Tabelas, Documentos e Clientes.</p>
               </div>
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">04. Arquitetura Financeira</h3>
                 <p className="text-[12px] text-gray-600">Fluxo 20/40/40 e a Engrenagem do Aluguel.</p>
               </div>
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">05. Arsenal Tático (Objeções)</h3>
                 <p className="text-[12px] text-gray-600">Respostas prontas para vacância, tamanho e preço.</p>
               </div>
               <div className="border-l-2 border-gray-200 pl-4 py-1">
                 <h3 className="text-[13px] text-[#452921] font-bold uppercase tracking-widest mb-1">06. Fechamento e Suporte</h3>
                 <p className="text-[12px] text-gray-600">Mídias e Contatos de Atendimento Direto.</p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 02</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 3: O MAPA DO OURO (LOCALIZAÇÃO)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faMapLocationDot} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>O Mapa do Ouro</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Localização Estratégica</p>
              </div>
            </div>

            <div className="flex-1">
               <h3 className="text-[14px] font-extrabold text-gray-800 mb-3 uppercase">Avenida Doutor Sérvulo Teixeira, 725 - Alto Esplanada</h3>
               <p className="text-[12px] text-gray-600 leading-[1.6] mb-4 text-justify">
                 <strong>Governador Valadares/MG (CEP: 35064-001).</strong> A localização é o maior escudo do investidor contra a vacância. O Residencial Alfa está posicionado no Alto Esplanada, o bairro mais procurado pela elite universitária e médica da cidade.
               </p>

               <div className="w-full h-[120px] rounded-lg shadow-sm overflow-hidden border border-gray-200 mb-6 print:border-gray-300 relative bg-gray-100">
                 <iframe
                   src="https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d7446.222001312552!2d-41.94300369753734!3d-18.848790756994234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0xb1a714d59a2e33%3A0x35d5a5b96d26169a!2sALFA!3m2!1d-18.8439779!2d-41.9396746!4m5!1s0xb1a709333008ad%3A0x9757bf086fe8a009!2sPra%C3%A7a%20Serra%20Lima%2C%20Av.%20Minas%20Gerais%2C%20588%20-%20Centro%2C%20Gov.%20Valadares%20-%20MG%2C%2035010-150!3m2!1d-18.854164!2d-41.946112!5e1!3m2!1spt-BR!2sbr!4v1779984242356!5m2!1spt-BR!2sbr"
                   width="100%"
                   height="100%"
                   style={{ border: 0 }}
                   allowFullScreen=""
                   loading="lazy"
                   referrerPolicy="no-referrer-when-downgrade"
                 ></iframe>
               </div>

               <ul className="space-y-4 mb-4">
                 <li className="flex items-start gap-4">
                   <FontAwesomeIcon icon={faCheckCircle} className="text-[#452921] mt-1 text-[16px]" />
                   <div>
                     <h4 className="text-[13px] font-bold text-gray-900 uppercase mb-1">Vantagens Mapeadas</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">Proximidade direta com a UFJF-GV e ao Polo Médico (Hospitais São Vicente, São Lucas e Hospital Municipal). Região vizinha a condomínios de luxo consolidados como o Belvedere e Bellevue.</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4">
                   <FontAwesomeIcon icon={faCheckCircle} className="text-[#452921] mt-1 text-[16px]" />
                   <div>
                     <h4 className="text-[13px] font-bold text-gray-900 uppercase mb-1">A Demanda Infinita</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">Sendo o bairro mais procurado por universitários e médicos residentes, o risco de vacância beira a zero. Além de oferecer vista deslumbrante e definitiva para o Pico da Ibituruna, trata-se de uma região elevada com <strong>risco zero de enchente</strong>.</p>
                   </div>
                 </li>
               </ul>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 03</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 4: O PRODUTO (ENGENHARIA)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faBuilding} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>O Produto</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">A Engenharia da Rentabilidade</p>
              </div>
            </div>

            <div className="flex-1">
               <ul className="space-y-5 mb-5">
                 <li className="flex items-start gap-4">
                   <FontAwesomeIcon icon={faCheckCircle} className="text-[#452921] mt-1 text-[16px]" />
                   <div>
                     <h4 className="text-[13px] font-bold text-gray-900 uppercase mb-1">Tipologia e Unidades</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">São 20 apartamentos residenciais, 1 loja e 20 garagens. O sucesso comercial é absoluto: <strong>32 unidades já vendidas</strong>. Restam apenas 4 Apartamentos (49,76m²), 1 Loja e 4 Vagas Avulsas.</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4">
                   <FontAwesomeIcon icon={faCheckCircle} className="text-[#452921] mt-1 text-[16px]" />
                   <div>
                     <h4 className="text-[13px] font-bold text-gray-900 uppercase mb-1">Área Gourmet e Convivência</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">Área Gourmet exclusiva (133m²) projetada para receber até <strong>88 pessoas</strong> confortavelmente, e loja no térreo para reduzir a cota de condomínio.</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4">
                   <FontAwesomeIcon icon={faCheckCircle} className="text-[#452921] mt-1 text-[16px]" />
                   <div>
                     <h4 className="text-[13px] font-bold text-gray-900 uppercase mb-1">Padrão de Acabamentos (Memorial)</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">Nível superior para locação premium: Porcelanatos nas áreas secas/molhadas, rodapés e bancadas em <strong>Granito Branco Dallas</strong>, metais Deca/Docol e forro de gesso.</p>
                   </div>
                 </li>
               </ul>

               <div className="bg-gray-50 border-l-4 border-[#0a0a0a] p-4 mt-6">
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase">O Inquilino Final</h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">
                   O Residencial Alfa atrai famílias buscando segurança em bairro nobre, casais em busca do primeiro imóvel com liquidez, e investidores focados em aluguel tradicional no Alto Esplanada. A metragem (49,76m²) é o ponto de equilíbrio perfeito: prático de manter e com ótima revenda.
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 04</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 5: PORTAL DO CORRETOR
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faDesktop} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Seu Escritório</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">O Portal do Corretor Studio 57</p>
              </div>
            </div>

            <div className="flex-1">
               <p className="text-[12px] text-gray-600 leading-[1.6] mb-8 text-justify">
                 Esqueça PDFs desatualizados perdidos no WhatsApp. O <strong>Portal do Corretor Studio 57</strong> é o ecossistema oficial onde você tem acesso em tempo real a todas as ferramentas necessárias para o fechamento. 
               </p>

               <ul className="space-y-5 mb-8">
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <FontAwesomeIcon icon={faFilePdf} className="text-[#452921] mt-1 text-[18px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Tabelas & Documentos</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">Acesse a disponibilidade ao vivo, simule fluxos e baixe Matrículas, Alvarás, Memorial Descritivo e Contratos. Tudo juridicamente validado.</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <FontAwesomeIcon icon={faUsers} className="text-[#452921] mt-1 text-[18px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Gestão de Clientes</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">Registre seus atendimentos no Portal e preserve o comissionamento do seu funil (Lead Protection). A venda é sua.</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <FontAwesomeIcon icon={faLink} className="text-[#452921] mt-1 text-[18px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Material de Marketing</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.6]">Baixe os Renders em alta definição, Vídeos de Fachada e Plantas Humanizadas para disparar direto para a sua base de leads.</p>
                   </div>
                 </li>
               </ul>

               <div className="bg-[#452921]/10 border border-[#452921]/30 p-4 rounded text-center mt-auto">
                 <p className="text-[12px] text-[#452921] font-bold uppercase mb-1">Aviso de Acesso</p>
                 <p className="text-[12px] text-gray-800">Caso você não tenha recebido o link para cadastro no portal, solicite via WhatsApp <strong>+55 33 9819-2119</strong> ou e-mail <strong>comercial@studio57.arq.br</strong>.</p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 05</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 6: A ARQUITETURA FINANCEIRA
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faCalculator} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>O Gatilho</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Da Escassez</p>
              </div>
            </div>

            <div className="flex-1">
               <p className="text-[13px] text-gray-800 font-bold leading-[1.6] mb-6 text-justify">
                 A Regra de Ouro: Não venda "casa própria", venda <strong className="text-[#452921]">ATIVO FINANCEIRO</strong>. O fluxo foi pensado arquiteturalmente para que o investidor não empate muito dinheiro do próprio bolso de uma só vez.
               </p>

               <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
                 <h4 className="text-[13px] font-black text-gray-900 uppercase mb-4 border-b border-gray-200 pb-2">O Fluxo de Pagamento 20/40/40</h4>
                 
                 <div className="space-y-4">
                   <div>
                     <span className="text-[12px] font-bold text-[#452921] uppercase block mb-1">Ato / Entrada (20%)</span>
                     <span className="text-[12px] text-gray-600 block">Parcelável em até 3 vezes (Custo de barreira reduzido).</span>
                   </div>
                   <div>
                     <span className="text-[12px] font-bold text-[#452921] uppercase block mb-1">Mensais da Obra (40%)</span>
                     <span className="text-[12px] text-gray-600 block">Pagamento diluído confortavelmente ao longo de 36 parcelas acompanhando o avanço da obra. <strong className="text-gray-800">Estas parcelas sofrerão correção mensal pelo INCC</strong> durante o período de construção.</span>
                   </div>
                   <div>
                     <span className="text-[12px] font-bold text-[#452921] uppercase block mb-1">Chaves e Saldo (40%)</span>
                     <span className="text-[12px] text-gray-600 block text-justify">
                       O saldo final (40%) deve ser pago <strong>rigorosamente em até 30 dias após a entrega das chaves</strong>. <br/><strong className="text-gray-800">Atenção a compras tardias:</strong> Se o cliente comprar a unidade meses após o início da obra (ex: 6 meses depois), as 6 parcelas de obra que "sobraram" serão empurradas para após a entrega das chaves. Todo saldo remanescente Pós-Chaves (seja os 40% ou parcelas atrasadas) sofrerá correção mensal rigorosa (IGPM + 1% a.m.).
                     </span>
                   </div>
                 </div>
               </div>

               <p className="text-[12px] text-gray-600 leading-[1.6] text-justify mb-5">
                 <strong>A Mágica: O Inquilino Paga a Conta.</strong> Quitação apenas no final do projeto (Pós-Habite-se). É o momento ideal para assumir um financiamento bancário, quando o imóvel já estará supervalorizado.
               </p>

               <p className="text-[12px] text-gray-400 italic leading-[1.4]">
                 *Nota: Este é o fluxo de pagamento padrão. Qualquer cliente pode sugerir propostas alternativas, sujeitas à aprovação da diretoria (sócios).
               </p>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 06</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 7: ANÁLISE DE RENTABILIDADE
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faChartLine} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Rentabilidade</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">O Gatilho do Studio</p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
               <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">
                 O Residencial Alfa não é mais uma promessa – é o empreendimento de maior liquidez atual da Studio 57. Com 80% das unidades vendidas, a escassez trabalha a seu favor no momento da negociação.
               </p>

               <ul className="space-y-3 mt-4">
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                   <FontAwesomeIcon icon={faBullseye} className="text-green-600 mt-1 text-[20px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Cenário Otimista (Temporada)</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.4] mb-1">Ocupação de 21 dias (70% do mês) focado no polo médico e universitário.</p>
                     <p className="text-[13px] font-black text-green-700">Renda Estimada: R$ 4.200,00 /mês</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                   <FontAwesomeIcon icon={faBuilding} className="text-yellow-600 mt-1 text-[20px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Aluguel Tradicional / Anual</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.4] mb-1">Locação convencional e segura para médicos/residentes sem gestão diária.</p>
                     <p className="text-[13px] font-black text-yellow-600">Renda Estimada: R$ 1.800 a R$ 2.200 /mês</p>
                   </div>
                 </li>
                 <li className="flex items-start gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
                   <FontAwesomeIcon icon={faChartLine} className="text-[#452921] mt-1 text-[20px]" />
                   <div>
                     <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-wider mb-1">Ganho de Capital (Ágio)</h4>
                     <p className="text-[12px] text-gray-600 leading-[1.4] mb-1">Valorização natural do patrimônio na entrega das chaves.</p>
                     <p className="text-[13px] font-black text-[#452921]">Lucro na Revenda Pós-Habite-se</p>
                   </div>
                 </li>
               </ul>

               <div className="bg-[#452921]/10 p-3 rounded-xl border border-[#452921]/30 mt-2">
                 <p className="text-[11px] text-gray-800 leading-[1.4] text-justify">
                   <strong>Payback Matador:</strong> Considerando um ticket médio de R$ 428 mil, no cenário otimista de locação (R$ 4.200/mês), o ativo <strong>se paga 100% em cerca de 8,5 anos</strong> (102 meses). Um prazo absurdamente mais rápido que os 15 a 20 anos da média nacional do mercado imobiliário. Além disso, o cliente surfa em valorização garantida.
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 07</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 8: ARSENAL TÁTICO (OBJEÇÕES 1 e 2)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faComments} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Arsenal Tático</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Quebra de Objeções (I)</p>
              </div>
            </div>

            <div className="flex-1 space-y-8">
               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-3 bg-gray-100 p-3 rounded border-l-4 border-[#0a0a0a]">
                   1. "Os apartamentos são muito pequenos."
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify px-3 border-l-2 border-[#452921] ml-1">
                   <strong>Sua Resposta:</strong> "Pelo contrário, 49m² no Alto Esplanada é um produto raro e inteligente. Ele oferece o layout exato para maximizar a área útil sem o desperdício de corredores antigos. Isso garante um IPTU menor, custo de mobília reduzido e alta facilidade de revenda."
                 </p>
               </div>

               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-3 bg-gray-100 p-3 rounded border-l-4 border-[#0a0a0a]">
                   2. "A entrada ainda pesa."
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify px-3 border-l-2 border-[#452921] ml-1">
                   <strong>Sua Resposta:</strong> "Sabe qual o segredo de um bom investimento imobiliário? Entrar pagando pouco. Estamos falando de uma entrada de 20% parcelada em até 3 vezes, e 40% parcelado em 36 vezes durante a obra. Se você procurar qualquer outro imóvel no Alto Esplanada, a descapitalização será absurdamente maior. Aqui, você alavanca seu patrimônio de forma inteligente."
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 08</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 9: ARSENAL TÁTICO (OBJEÇÕES 3 e 4)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faComments} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Arsenal Tático</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Quebra de Objeções (II)</p>
              </div>
            </div>

            <div className="flex-1 space-y-8">
               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-3 bg-gray-100 p-3 rounded border-l-4 border-[#0a0a0a]">
                   3. "O valor por m² parece alto."
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify px-3 border-l-2 border-[#452921] ml-1">
                   <strong>Sua Resposta:</strong> "Você não está comprando metro quadrado, você está comprando rentabilidade e localização. No modelo de Suítes, o ticket total da operação é o que importa. Com cerca de R$ 250 mil você se posiciona no bairro mais nobre e cobiçado de Governador Valadares. O Retorno sobre Investimento (ROI) de longo prazo é imbatível."
                 </p>
               </div>

               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-3 bg-gray-100 p-3 rounded border-l-4 border-[#0a0a0a]">
                   4. "Tenho medo de ficar vazio (vacância)."
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify px-3 border-l-2 border-[#452921] ml-1">
                   <strong>Sua Resposta:</strong> "A localização blinda o seu investimento. A proximidade com centros universitários e hospitalares traz uma demanda natural contínua. Imóveis de quase 50m² no Esplanada não ficam vazios, eles alugam rápido ou são revendidos com ágio muito acima da inflação."
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 09</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 10: INTELIGÊNCIA DE VENDAS (FAQ 1)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faQuestionCircle} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Top Dúvidas</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Inteligência de Campo</p>
              </div>
            </div>

            <div className="flex-1 space-y-6">
               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#452921]"></span>
                   1. A Garagem já vem inclusa?
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify bg-gray-50 p-3 rounded border border-gray-100">
                   <strong>Sim! A garagem já está inclusa no valor da unidade.</strong> O grande diferencial jurídico aqui é que a garagem possui uma <strong>matrícula individualizada</strong> no cartório. Ou seja, o cliente compra o apartamento com a vaga garantida, mas tem a enorme vantagem de possuir duas matrículas distintas, o que permite que ele alugue ou venda a vaga separadamente no futuro, gerando altíssima liquidez.
                 </p>
               </div>

               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#452921]"></span>
                   2. Qual a diferença entre Tipo 1, 2 e 3?
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify bg-gray-50 p-3 rounded border border-gray-100">
                   Explique sempre pela <strong>disposição</strong>. Abra a Planta Humanizada na tela. A grande diferença não é só metragem, mas o posicionamento (Sol da Manhã) e o layout (retangular profundo vs quadrado com varanda estendida).
                 </p>
               </div>

               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#452921]"></span>
                   3. O Apartamento já vem mobiliado?
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify bg-gray-50 p-3 rounded border border-gray-100">
                   A unidade privativa é entregue com <strong>acabamentos completos e itens fixos</strong> (bancadas em granito, vasos, cubas e torneiras). Móveis planejados, mobília solta e eletrodomésticos não estão inclusos. Já as <strong>Áreas Comuns (como a Área Gourmet)</strong> serão entregues 100% montadas e decoradas.
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 10</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            PÁGINA 11: INTELIGÊNCIA DE VENDAS (FAQ 2 + ESCASSEZ)
        ======================================================== */}
        <FolhaA5Retrato isDark={false}>
          <div className="w-full h-full p-10 flex flex-col relative bg-white">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#452921] to-[#0a0a0a]"></div>
            
            <div className="mt-6 mb-8 flex items-center gap-3 border-b border-gray-200 pb-4">
              <FontAwesomeIcon icon={faShieldHalved} className="text-[#452921] text-3xl" />
              <div>
                 <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.1em] leading-none`}>Foco e Urgência</h2>
                 <p className="text-[#452921] text-[12px] font-bold uppercase tracking-widest mt-1">Objeções Críticas</p>
              </div>
            </div>

            <div className="flex-1 space-y-6">
               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#452921]"></span>
                   4. Qual a garantia da obra? Tem RI?
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify bg-gray-50 p-3 rounded border border-gray-100">
                   <strong>Sim! O Residencial Alfa possui Alvará (5914/2024) e Registro de Incorporação (RI).</strong> Além disso, conta com <strong>Patrimônio de Afetação</strong> (o dinheiro da obra é blindado por lei e não se mistura com a construtora). Temos também o Projeto do Corpo de Bombeiros (AVCB) 100% aprovado, o que zera o risco de atraso na entrega das chaves por burocracia de habite-se. O cliente sabe exatamente quanto vai pagar até o final.
                 </p>
               </div>

               <div>
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-[#452921]"></span>
                   5. O prazo de entrega (2027) é longo?
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify bg-gray-50 p-3 rounded border border-gray-100">
                   <strong>Requadre a percepção de tempo:</strong> É exatamente o tempo necessário para pagar 40% do imóvel em parcelas suaves, enquanto o patrimônio valoriza brutalmente antes da entrega das chaves. O prazo segue o cronograma físico-financeiro oficial da viabilidade.
                 </p>
               </div>

               <div className="bg-gray-50 p-4 rounded-xl border border-gray-300 mt-4 shadow-sm">
                 <h3 className="text-[13px] font-extrabold text-gray-900 mb-2 uppercase flex items-center gap-2">
                   <FontAwesomeIcon icon={faExclamationTriangle} className="text-[#452921]" />
                   A Pior Objeção: "Vou pensar"
                 </h3>
                 <p className="text-[12px] text-gray-600 leading-[1.6] text-justify">
                   Falta de urgência mata vendas. Se o cliente disser <em>"Vou analisar e dou retorno"</em>, aplique o <strong>Gatilho da Escassez</strong>. Mostre a Tabela com as unidades <strong>Reservadas (Amarelas)</strong> e lembre-o: o INCC reajusta mensalmente. Pensar por 3 meses significa pagar milhares de reais mais caro pelo mesmo ativo.
                 </p>
               </div>
            </div>
            
            <div className="text-center mt-auto pt-4 border-t border-gray-100">
               <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest">Manual do Corretor • Página 11</p>
            </div>
          </div>
        </FolhaA5Retrato>

        {/* ========================================================
            CONTRACAPA: FECHAMENTO
        ======================================================== */}
        <FolhaA5Retrato isDark={false} isLast={true}>
          <div className="w-full h-full bg-white relative flex flex-col items-center justify-center p-10 text-center border-t-[8px] border-[#452921]">
            
            <FontAwesomeIcon icon={faHeadset} className="text-[#452921] text-5xl mb-8" />
            
            <h2 className={`${roboto.className} text-2xl font-light text-gray-900 uppercase tracking-[0.15em] leading-none mb-6`}>
              Precisa de Apoio?
            </h2>
            
            <p className="text-gray-600 text-[12px] mb-12 leading-[1.6] max-w-[280px]">
              Dúvidas ou Suporte Estratégico? A equipe do Studio 57 está pronta para auxiliar você em fechamentos difíceis e simulações complexas.
            </p>

            <div className="bg-gray-50 border border-gray-200 p-6 rounded-xl w-full max-w-[320px] mb-16 shadow-sm">
              <p className="text-[12px] text-[#452921] font-bold uppercase tracking-widest mb-3">WhatsApp Oficial de Vendas</p>
              <p className="text-xl font-bold text-gray-900 tracking-widest">+55 33 9819-2119</p>
            </div>

            <div className="absolute bottom-8 flex flex-col items-center w-full px-10">
               <img
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG"
                  alt="Studio 57 Logo"
                  className="w-[120px] h-auto object-contain mb-4 opacity-80"
                />
               <p className="text-[12px] uppercase tracking-[0.4em] text-[#452921] font-bold mb-6">Boas Vendas!</p>
               
               <div className="text-[9px] text-gray-500 text-center space-y-1 w-full border-t border-gray-200 pt-4">
                 <p className="uppercase tracking-widest font-bold text-gray-400 mb-1">Studio 57 Incorporações Ltda</p>
                 <p>CNPJ: 41.464.589/0001-66</p>
                 <p>Av. Rio Doce, 1825, Loja A • Ilha dos Araújos • Gov. Valadares/MG</p>
               </div>
            </div>

          </div>
        </FolhaA5Retrato>

      </div> 
    </div>
  );
}

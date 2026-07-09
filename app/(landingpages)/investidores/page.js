// Caminho: app/(landingpages)/investidores/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartLine, 
  faUsers, 
  faBuilding, 
  faPrint, 
  faArrowTrendUp,
  faServer,
  faEnvelope,
  faGlobe,
  faFilePdf,
  faCircleCheck
} from '@fortawesome/free-solid-svg-icons';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  display: 'swap',
});

export default function RelatorioInvestidores() {
  const [html2pdf, setHtml2pdf] = useState(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const relatorioRef = useRef(null);

  // Importação dinâmica do html2pdf.js para evitar quebra no Server-Side Rendering (SSR)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('html2pdf.js').then((module) => {
        setHtml2pdf(() => module.default);
      });
    }
  }, []);

  const handleDownloadPdf = async () => {
    if (!html2pdf || !relatorioRef.current) return;
    setGerandoPdf(true);

    try {
      const opt = {
        margin: 0,
        filename: 'Relatorio_Viabilidade_Elo57.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollY: 0,
          windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'css', before: '.page-break' }
      };

      await html2pdf().set(opt).from(relatorioRef.current).save();
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div className={`${montserrat.className} bg-gray-950 min-h-screen py-10 print:py-0 print:bg-white text-gray-800 antialiased`}>
      {/* Estilos para emulação A4 no monitor com fundo preto e quebras de página na impressão */}
      <style jsx global>{`
        @media screen {
          .a4-container {
            background-color: #030712; /* Fundo cinza-escuro/preto de alto contraste */
            padding: 20px 0;
          }
          .a4-page {
            width: 210mm;
            height: 297mm;
            padding: 25mm 20mm;
            margin: 40px auto;
            background: white;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); /* Sombra pesada para destacar no fundo escuro */
            border: 1px solid #1f2937;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
          }
        }
        @media print {
          header, footer, nav, .print\\:hidden, .no-print, [class*="MenuPublico"], [class*="PublicLayout_footer"] {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-container {
            background: white !important;
            padding: 0 !important;
          }
          .a4-page {
            width: 210mm !important;
            height: 297mm !important;
            padding: 20mm 20mm !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Barra de Ações Flutuante (Não será impressa) */}
      <div className="max-w-[210mm] mx-auto mb-6 px-4 no-print flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Relatório Executivo Elo 57</h1>
          <p className="text-xs text-gray-400 font-medium">Viabilidade Comercial & Escala Nacional</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={gerandoPdf || !html2pdf}
            className={`${gerandoPdf ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-5 py-3 rounded-xl text-xs font-bold tracking-wider uppercase shadow-md transition-all flex items-center gap-2`}
          >
            <FontAwesomeIcon icon={faFilePdf} /> {gerandoPdf ? 'Gerando PDF...' : 'Salvar Relatório em PDF'}
          </button>
        </div>
      </div>

      {/* Container das Páginas A4 */}
      <div className="a4-container" ref={relatorioRef}>

        {/* ======================================================== */}
        {/* PÁGINA 1: CAPA COMERCIAL PURA */}
        {/* ======================================================== */}
        <div className="a4-page page-break">
          {/* Topo da Capa */}
          <div className="flex justify-between items-center border-b pb-6 border-gray-100">
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-[0.2em] text-black">ELO 57</span>
              <span className="text-[9px] font-bold text-gray-400 tracking-[0.3em] uppercase mt-1">Plataforma de Gestão Imobiliária</span>
            </div>
            <span className="px-3.5 py-1.5 text-[9px] font-bold tracking-widest rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">
              Estudo de Viabilidade
            </span>
          </div>

          {/* Centro da Capa */}
          <div className="my-auto py-12 text-center sm:text-left">
            <span className="text-[10px] font-bold text-blue-600 tracking-[0.35em] uppercase block mb-4">
              ESTUDO SUPREMO DE VIABILIDADE
            </span>
            <h1 className="text-5xl font-black text-black leading-[1.1] mb-6 tracking-tight">
              ELO 57
            </h1>
            <p className="text-xl text-gray-500 font-medium tracking-wide uppercase leading-relaxed max-w-xl">
              A Plataforma Definitiva de Gestão Imobiliária Integrada
            </p>
            <div className="w-16 h-1 bg-black my-8 rounded-full"></div>
            <p className="text-sm text-gray-400 font-medium max-w-md">
              Apresentação executiva detalhando a viabilidade financeira, os custos reais de infraestrutura e o planejamento de escala do produto a curto, médio e longo prazo.
            </p>
          </div>

          {/* Rodapé da Capa */}
          <div className="border-t pt-6 border-gray-100 flex justify-between items-center text-xs font-medium">
            <div>
              <p className="font-bold text-gray-900">Ranniere Campos</p>
              <p className="text-gray-400 text-[10px] mt-0.5">Fundador e Diretor Geral, Elo 57</p>
            </div>
            <div className="text-right">
              <p className="text-gray-900 font-bold">Relatório Executivo</p>
              <p className="text-gray-400 text-[10px] mt-0.5">Julho de 2026</p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PÁGINA 2: PLANEJAMENTO E METAS */}
        {/* ======================================================== */}
        <div className="a4-page page-break">
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-4 mb-10 border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            <span>Seção 01 • Metas e Planejamento</span>
            <span>Elo 57</span>
          </div>

          <div>
            <h2 className="text-3xl font-light text-gray-900 mb-6 tracking-tight">
              Planejamento de <span className="font-black text-black">Metas & Crescimento</span>
            </h2>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-10">
              Desenvolvemos um cronograma de crescimento gradual para o Elo 57. A nossa estratégia comercial divide-se em três marcos cruciais, focando inicialmente na consolidação do produto e partindo para a expansão nacional.
            </p>

            {/* Metas Timeline */}
            <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-150">
              {/* Marco 1 */}
              <div className="flex gap-6 relative items-start">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs z-10 flex-shrink-0">
                  1
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Prazo: Próximos 6 Meses</span>
                  <h3 className="text-base font-bold text-gray-900 mt-1">Marco Inicial: 200 Empresas Clientes</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    Foco na validação comercial do modelo de vendas e atração dos primeiros clientes pagantes em nossa base. Essa meta estabelece o ponto de equilíbrio inicial da empresa.
                  </p>
                </div>
              </div>

              {/* Marco 2 */}
              <div className="flex gap-6 relative items-start">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs z-10 flex-shrink-0">
                  2
                </div>
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Prazo: Primeiro Ano e Meio (18 Meses)</span>
                  <h3 className="text-base font-bold text-gray-900 mt-1">Marco de Tração: 1.000 Empresas Clientes</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    Fase de aceleração e expansão comercial por meio de canais de indicação, marketing digital focado e parcerias com conselhos profissionais.
                  </p>
                </div>
              </div>

              {/* Marco 3 */}
              <div className="flex gap-6 relative items-start">
                <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs z-10 flex-shrink-0">
                  3
                </div>
                <div>
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Prazo: Longo Prazo (3 a 5 Anos)</span>
                  <h3 className="text-base font-bold text-gray-900 mt-1">Marco de Consolidação: 3.000 Empresas Clientes</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    Conquista de 1% do mercado nacional de incorporadoras e construtoras do Brasil, estabelecendo o Elo 57 como a principal referência nacional no setor.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t pt-4 border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            <span>Relatório de Viabilidade Comercial</span>
            <span>Página 2</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PÁGINA 3: CUSTOS DE TI E VALIDAÇÃO */}
        {/* ======================================================== */}
        <div className="a4-page page-break">
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-4 mb-10 border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            <span>Seção 02 • Validação Técnica de TI</span>
            <span>Elo 57</span>
          </div>

          <div>
            <h2 className="text-3xl font-light text-gray-900 mb-3 tracking-tight">
              Validação Operacional & <span className="font-black text-black">Custos de TI</span>
            </h2>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
              Mapeamos os custos de infraestrutura em ambiente real utilizando a incorporadora Studio 57 (Organização 2), que conta com <strong>6 usuários ativos</strong>. Os lançamentos reais de 2026 foram extraídos diretamente do banco de dados.
            </p>

            {/* Cards de Infraestrutura */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-blue-150 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faServer} className="text-xs" />
                </div>
                <h3 className="text-xs font-bold text-gray-900">Netlify Pro</h3>
                <p className="text-lg font-black text-gray-800 mt-1">R$ 225,00</p>
                <span className="text-[9px] text-gray-400 font-bold block mt-0.5">Excedentes e Nuvem</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-blue-150 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faServer} className="text-xs" />
                </div>
                <h3 className="text-xs font-bold text-gray-900">Supabase Pro</h3>
                <p className="text-lg font-black text-gray-800 mt-1">R$ 176,66</p>
                <span className="text-[9px] text-gray-400 font-bold block mt-0.5">Banco de Dados</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-blue-150 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                </div>
                <h3 className="text-xs font-bold text-gray-900">Hostinger</h3>
                <p className="text-lg font-black text-gray-800 mt-1">R$ 29,97</p>
                <span className="text-[9px] text-gray-400 font-bold block mt-0.5">E-mails da Equipe</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-blue-150 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <FontAwesomeIcon icon={faGlobe} className="text-xs" />
                </div>
                <h3 className="text-xs font-bold text-gray-900">Domínios</h3>
                <p className="text-lg font-black text-gray-800 mt-1">R$ 6,24</p>
                <span className="text-[9px] text-gray-400 font-bold block mt-0.5">Proporcional Mensal</span>
              </div>
            </div>

            {/* Tabela de Extratos de Lançamento */}
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Histórico de Lançamentos de TI (2026)</h4>
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150">
                    <th className="px-5 py-3 font-bold text-gray-500">ID</th>
                    <th className="px-5 py-3 font-bold text-gray-500">Descrição no Financeiro</th>
                    <th className="px-5 py-3 font-bold text-gray-500">Vencimento</th>
                    <th className="px-5 py-3 text-right font-bold text-gray-500">Valor (BRL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  <tr>
                    <td className="px-5 py-3 text-gray-400">#18188</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">NETLIFY</td>
                    <td className="px-5 py-3 text-gray-500">11/07/2026</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">R$ -226,50</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-400">#18167</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">SUPABASE</td>
                    <td className="px-5 py-3 text-gray-500">07/07/2026</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">R$ -180,17</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-400">#17873</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">NETLIFY</td>
                    <td className="px-5 py-3 text-gray-500">11/06/2026</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">R$ -216,12</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-400">#17716</td>
                    <td className="px-5 py-3 font-semibold text-gray-800">SUPABASE</td>
                    <td className="px-5 py-3 text-gray-500">07/06/2026</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">R$ -174,00</td>
                  </tr>
                  <tr className="bg-blue-50/15">
                    <td className="px-5 py-3 font-bold text-blue-700" colSpan="3">Custo Fixo Mensal Provedores TI</td>
                    <td className="px-5 py-3 text-right font-black text-blue-700">R$ 437,87</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t pt-4 border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            <span>Relatório de Viabilidade Comercial</span>
            <span>Página 3</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PÁGINA 4: MODELO DE TICKET E SENSIBILIDADE */}
        {/* ======================================================== */}
        <div className="a4-page page-break">
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-4 mb-10 border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            <span>Seção 03 • Modelo Comercial & Ponto de Equilíbrio</span>
            <span>Elo 57</span>
          </div>

          <div>
            <h2 className="text-3xl font-light text-gray-900 mb-3 tracking-tight">
              Modelo Comercial & <span className="font-black text-black">Viabilidade</span>
            </h2>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
              O Elo 57 monetiza através do modelo: plano fixo base por organização cliente (CNPJ) + cobrança adicional por licença de usuário extra cadastrado no sistema.
            </p>

            {/* Grid de Preço */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Plano Pro por Empresa</h3>
                <p className="text-3xl font-black text-gray-900 mt-2">R$ 497,00<span className="text-xs text-gray-400 font-bold tracking-normal">/mês</span></p>
                <span className="text-[10px] text-gray-500 font-medium block mt-1">Inclui a primeira licença de usuário (Master).</span>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600"></div>
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">Valor por Usuário Extra</h3>
                <p className="text-3xl font-black text-gray-900 mt-2">R$ 60,00<span className="text-xs text-gray-400 font-bold tracking-normal">/mês</span></p>
                <span className="text-[10px] text-gray-500 font-medium block mt-1">Licenças de usuários adicionais na organização.</span>
              </div>
            </div>

            {/* Metas 200 Orgs */}
            <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Cenário Projetado: 200 Empresas (800 Usuários)</h3>
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm mb-6 text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-150">
                  <tr className="bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-gray-700">Faturamento Mensal (200 Empresas x R$ 497 + 600 extras x R$ 60)</td>
                    <td className="px-5 py-3 text-right font-black text-gray-900">R$ 135.400,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Impostos sobre Faturamento (Simples Nacional - 6%)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 8.124,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Custos de TI Provedores (Escala a R$ 11,00/usuário)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 8.800,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Custo Fixo Administrativo (Suporte e Custos de Equipe)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 20.000,00</td>
                  </tr>
                  <tr className="bg-green-50/20 font-bold">
                    <td className="px-5 py-3 text-green-700">LUCRO LÍQUIDO OPERACIONAL MENSAL</td>
                    <td className="px-5 py-3 text-right font-black text-green-700">R$ 98.476,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabela de Sensibilidade */}
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sensibilidade de Ponto de Equilíbrio (ADM R$ 20k/mês)</h4>
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm text-[10px]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150 text-gray-500 font-bold">
                    <th className="px-4 py-2">Média de Usuários por Empresa</th>
                    <th className="px-4 py-2">Faturamento Médio por Empresa</th>
                    <th className="px-4 py-2">Margem Líquida por Empresa</th>
                    <th className="px-4 py-2 text-right">Meta de Empresas (Ponto de Equilíbrio)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  <tr>
                    <td className="px-4 py-2 font-bold">1 Usuário (Apenas Master)</td>
                    <td className="px-4 py-2">R$ 497,00</td>
                    <td className="px-4 py-2 font-bold text-gray-800">R$ 456,18</td>
                    <td className="px-4 py-2 text-right font-extrabold text-blue-600">44 Empresas</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold">2 Usuários (1 Extra)</td>
                    <td className="px-4 py-2">R$ 557,00</td>
                    <td className="px-4 py-2 font-bold text-gray-800">R$ 501,58</td>
                    <td className="px-4 py-2 text-right font-extrabold text-blue-600">40 Empresas</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold">3 Usuários (2 Extras)</td>
                    <td className="px-4 py-2">R$ 617,00</td>
                    <td className="px-4 py-2 font-bold text-gray-800">R$ 546,98</td>
                    <td className="px-4 py-2 text-right font-extrabold text-blue-600">37 Empresas</td>
                  </tr>
                  <tr className="bg-blue-50/10 font-bold text-blue-700">
                    <td className="px-4 py-2">4 Usuários (Média Estimada)</td>
                    <td className="px-4 py-2">R$ 677,00</td>
                    <td className="px-4 py-2 text-gray-800">R$ 592,38</td>
                    <td className="px-4 py-2 text-right font-black">34 Empresas</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t pt-4 border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            <span>Relatório de Viabilidade Comercial</span>
            <span>Página 4</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PÁGINA 5: ESCALA NACIONAL E VALUATION */}
        {/* ======================================================== */}
        <div className="a4-page">
          <div>
            {/* Header */}
            <div className="flex justify-between items-center border-b pb-4 mb-10 border-gray-100 text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              <span>Seção 04 • Escala Nacional e Avaliação</span>
              <span>Elo 57</span>
            </div>

            <h2 className="text-3xl font-light text-gray-900 mb-3 tracking-tight">
              Hiper-Escala & <span className="font-black text-black">Valuation Projetado</span>
            </h2>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
              Mapeamos o mercado brasileiro por meio dos conselhos profissionais (CAU/CREA) e bases de CNPJ federais. A nossa meta final representa apenas <strong>1% do Mercado Total</strong> do país.
            </p>

            {/* Gráfico Donut SVG */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 border border-gray-100 rounded-2xl bg-gray-50/40 mb-6">
              <div className="w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#3b82f6" strokeWidth="12" strokeDasharray="47.72 238.64" />
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray="2.38 284" strokeDashoffset="-47.72" />
                </svg>
              </div>
              <div className="space-y-1 text-xs font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-200"></span>
                  <span><strong>Mercado Total:</strong> ~280 mil empresas ativas no Brasil</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span><strong>Mercado Endereçável:</strong> ~55 mil pequenas e médias empresas (20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  <span><strong>Mercado Capturável (Meta 1%):</strong> 3.000 empresas ativas</span>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wider">Resultado Projetado (3.000 Empresas / 12.000 Usuários)</h3>
            <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-sm mb-6 text-xs">
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-150">
                  <tr className="bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-gray-700">Faturamento Mensal Recorrente</td>
                    <td className="px-5 py-3 text-right font-black text-gray-900">R$ 2.031.000,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Impostos (Lucro Presumido - 15%)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 304.650,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Infraestrutura de TI Enterprise (Supabase + Netlify dedicados)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 120.000,00</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-gray-600">(-) Custos de Equipe (Suporte, Engenharia, Vendas e Pró-labore)</td>
                    <td className="px-5 py-3 text-right font-bold text-red-600">-R$ 230.000,00</td>
                  </tr>
                  <tr className="bg-green-50/20 font-bold">
                    <td className="px-5 py-3 text-green-700">LUCRO LÍQUIDO OPERACIONAL MENSAL</td>
                    <td className="px-5 py-3 text-right font-black text-green-700">R$ 1.376.350,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Destaque Financeiro ARR */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Faturamento Anual</span>
                <span className="text-base font-extrabold text-gray-900 mt-1 block">R$ 24,3 Milhões / ano</span>
              </div>
              <div className="bg-green-50/10 border border-green-200 rounded-2xl p-4">
                <span className="text-[10px] text-green-700 font-bold uppercase tracking-wider block">Lucro Líquido Anual</span>
                <span className="text-base font-extrabold text-green-700 mt-1 block">R$ 16,5 Milhões / ano</span>
              </div>
            </div>
          </div>

          {/* Bloco de Destaque Monumental para o Valuation */}
          <div className="p-6 rounded-2xl bg-black border border-gray-800 text-white relative overflow-hidden shadow-2xl mb-4">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1.5 max-w-sm">
                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="animate-pulse" />
                  <span>Avaliação Estimada da Empresa (Valuation)</span>
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed font-semibold">
                  Empresas SaaS com faturamento recorrente previsível e alta lucratividade (67%) são avaliadas no mercado nacional sob múltiplos de <strong>6 a 8 vezes</strong> a sua receita anual recorrente.
                </p>
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Valuation de Mercado</span>
                <span className="text-3xl font-black text-blue-500 block mt-1 tracking-tight">R$ 145M - R$ 195M</span>
                <span className="text-[9px] text-gray-400 font-semibold block mt-0.5">Com 1% do Mercado Nacional</span>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t pt-4 border-gray-100 flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            <span>Relatório de Viabilidade Comercial</span>
            <span>Página 5</span>
          </div>
        </div>

      </div>
    </div>
  );
}

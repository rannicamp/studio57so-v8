// Caminho: app/(landingpages)/sobre-nos/page.js
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHandshake, faPenRuler, faHardHat } from '@fortawesome/free-solid-svg-icons';

// Fontes
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '700', '900'] });
const roboto = Roboto({ subsets: ['latin'], weight: ['100', '300', '400', '500'], variable: '--font-roboto' });

export default function SobreNosPage() {
  return (
    <div className={`${roboto.variable} ${montserrat.className} bg-white text-gray-800`}>
      {/* --- HERO SECTION: MARCA (BLOCO 1) --- */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 flex flex-col items-center justify-center bg-white text-center px-6">
        {/* LOGO DA MARCA */}
        <div className="relative w-48 md:w-64 h-24 mb-8">
          <Image 
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/LOGO-P_1765565958716.PNG" 
            alt="Logo Studio 57" 
            fill 
            className="object-contain"
            priority
          />
        </div>

        {/* Título Principal */}
        <h1 className="font-roboto font-light text-4xl md:text-6xl text-gray-900 uppercase tracking-widest mb-8">
          A Nossa Verdade
        </h1>

        {/* Linha Decorativa Sutil */}
        <div className="w-16 h-[1px] bg-gray-300 mb-8"></div>

        {/* Subtítulo */}
        <p className="font-roboto font-light text-xl md:text-2xl text-gray-500 max-w-2xl leading-relaxed">
          Não construímos apenas empreendimentos.<br/>
          Construímos previsibilidade.
        </p>

      </section>

      {/* --- PRÓLOGO: EXPERTISE COMPLEMENTAR (BLOCO 3) --- */}
      <section className="py-20 md:py-32 border-t border-gray-100 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-sm font-bold tracking-[0.3em] text-blue-600 uppercase">Expertise Complementar</span>
            <h2 className="text-3xl md:text-4xl font-light text-gray-900 mt-4">Tecnologia e Rigor</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
            {/* --- LADO ESQUERDO: RANNIERE --- */}
            <div className="flex flex-col">
              <div className="relative w-full h-[500px] mb-8 overflow-hidden">
                <Image 
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769106573052.png" 
                  alt="Ranniere Campos" 
                  fill
                  className="object-cover object-top transition-transform duration-700 hover:scale-105" 
                />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 uppercase mb-2">Ranniere Campos</h2>
              <p className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-6">Tecnologia e Automação</p>

              <h3 className="text-xl font-light text-gray-500 mb-6 italic font-roboto border-l-2 border-blue-600 pl-4">
                "Inovação digital e pioneirismo em sistemas complexos de projetos."
              </h3>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                <p>
                  Trazendo o pioneirismo na implantação de tecnologia de projetos e automação de processos, Ranniere lidera a inteligência de dados do Studio 57.
                </p>
                <p>
                  Sua atuação é focada em simular digitalmente cada detalhe do empreendimento antes de a obra começar, garantindo precisão e mitigação de riscos financeiros para os investidores.
                </p>
              </div>
            </div>

            {/* --- LADO DIREITO: IGOR --- */}
            <div className="flex flex-col">
              <div className="relative w-full h-[500px] mb-8 overflow-hidden">
                <Image 
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769107378867.png" 
                  alt="Igor Monte Alto" 
                  fill
                  className="object-cover object-top transition-transform duration-700 hover:scale-105" 
                />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 uppercase mb-2">Igor Monte Alto</h2>
              <p className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-6">Gestão e Rigor Técnico</p>

              <h3 className="text-xl font-light text-gray-500 mb-6 italic font-roboto border-l-2 border-blue-600 pl-4">
                "A solidez da gestão de engenharia aplicada ao canteiro de obras."
              </h3>

              <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                <p>
                  Com sólida experiência em gestão de infraestrutura urbana, rigor técnico e execução de obras públicas, Igor responde pelo compliance executivo.
                </p>
                <p>
                  Sua atuação assegura que a precisão técnica idealizada no ambiente virtual seja fielmente transportada para o canteiro de obras físico, garantindo solidez a cada investimento.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-16 text-center max-w-3xl mx-auto">
            <p className="text-xl font-roboto font-light text-gray-600 leading-relaxed">
              O Studio 57 nasceu dessa fusão estratégica: a inovação digital da arquitetura de alta performance aliada à solidez da gestão de engenharia. Um verdadeiro laboratório de soluções imobiliárias focado em viabilidade e resultado.
            </p>
          </div>
        </div>
      </section>

      {/* --- ATO 1: A ORIGEM (BLOCO 2) --- */}
      <section className="py-20 md:py-32 border-t border-gray-100">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Imagem Sócios */}
            <div className="w-full">
              <Image 
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769088852146.png" 
                alt="Sócios Studio 57 - Identidade" 
                width={0}
                height={0}
                sizes="100vw"
                className="w-full h-auto transition-all duration-700" 
              />
            </div>

            {/* Texto */}
            <div className="flex flex-col justify-center h-full">
              <div className="flex items-center space-x-4 mb-6">
                <span className="text-6xl font-thin text-gray-200 font-roboto">01</span>
                <h2 className="text-3xl font-bold text-gray-900 uppercase">A Engenharia do Valor</h2>
              </div>
              <h3 className="text-xl font-light text-blue-600 mb-6 italic font-roboto">
                "Nossa Origem"
              </h3>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                <p>
                  A história do Studio 57 não começou com o desejo de apenas desenhar edifícios, mas com a necessidade de modernizar como eles são feitos. Muito antes do mercado falar sobre inovação, entendemos que o maior risco da construção civil era a falta de controle sobre a informação.
                </p>
                <p>
                  Ainda em 2009, adotamos a tecnologia BIM (Building Information Modeling) de forma pioneira. Não como uma ferramenta de desenho, mas como um simulador de realidade.
                </p>
                <p>
                  Compreendemos cedo uma premissa que guia nossos negócios até hoje: <strong>quem domina a informação e os dados do projeto, domina o custo e o prazo da obra.</strong> Nós passamos a construir o prédio virtualmente, antecipando falhas, eliminando desperdícios e garantindo a viabilidade financeira antes mesmo do primeiro tijolo ser assentado.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- ATO 2: A VERTICALIZAÇÃO (BLOCO 4) --- */}
      <section className="py-20 md:py-32 border-t border-gray-100 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Texto */}
            <div className="order-2 md:order-1 flex flex-col justify-center h-full">
              <div className="flex items-center space-x-4 mb-6">
                <span className="text-6xl font-thin text-gray-200 font-roboto">02</span>
                <h2 className="text-3xl font-bold text-gray-900 uppercase">A Verticalização</h2>
              </div>
              <h3 className="text-xl font-light text-blue-600 mb-6 italic font-roboto">
                "Por que nos tornamos Incorporadores"
              </h3>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                <p>
                  Durante anos, entregamos projetos perfeitamente calculados para o mercado. No entanto, percebemos que o modelo tradicional de terceirização da construção quebrava a cadeia de valor. Projetos altamente eficientes perdiam rentabilidade e qualidade nas mãos de execuções que ignoravam a precisão técnica.
                </p>
                <p>
                  A nossa resposta foi a verticalização. O Studio 57 Arquitetura e Incorporação assumiu o controle total da cadeia produtiva. Deixamos de apenas entregar o "manual de instruções" para assumir a responsabilidade sobre o resultado final. Hoje, eliminamos o abismo entre o projeto e o canteiro de obras. Nós idealizamos, nós incorporamos e nós construímos.
                </p>
                <p className="border-l-2 border-gray-200 pl-4 italic text-gray-400 text-sm">
                  Nessa jornada de evolução, em janeiro de 2024, a Larissa Ventura encerrou seu ciclo no Studio para dedicar-se a outros projetos pessoais. A empresa seguiu firme, honrando o legado construído e focada na sua nova missão.
                </p>
                <p className="font-medium text-gray-900 text-xl border-l-4 border-black pl-4">
                  Para o cliente final, isso significa morar exatamente no que foi sonhado. Para o investidor, significa segurança absoluta. Ao controlar o processo de ponta a ponta, mitigamos os riscos de estouro de orçamento, garantimos os cronogramas e protegemos o capital investido.
                </p>
              </div>
            </div>
            {/* Imagem */}
            <div className="order-1 md:order-2 w-full">
              <Image 
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769093097228.png" 
                alt="Sócios Studio 57 - A Retomada" 
                width={0}
                height={0}
                sizes="100vw"
                className="w-full h-auto transition-all duration-700"
              />
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA FINAL (BLOCO 5) --- */}
      <section className="bg-white text-gray-900 py-20 text-center border-t border-gray-200">
        <div className="container mx-auto px-6 max-w-3xl">
          <FontAwesomeIcon icon={faHandshake} className="text-6xl text-blue-600 mb-8" />
          <h2 className="text-3xl md:text-5xl font-light font-roboto mb-6">
            Nós construímos o que projetamos. E garantimos o que prometemos.
          </h2>
          <p className="text-xl text-gray-500 mb-10 font-roboto font-light">
            Conheça nossos empreendimentos atuais e veja a diferença de comprar de quem controla todo o ciclo de entrega.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link 
              href="/empreendimentosstudio" 
              className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 shadow-xl"
            >
              Conheça nosso modelo de investimento
            </Link>
            <Link 
              href="https://wa.me/5533998192119?text=Olá! Vim pela página Sobre Nós do site e gostaria de falar com um de seus diretores." 
              target="_blank"
              className="bg-white border-2 border-black hover:bg-black hover:text-white text-black font-bold py-4 px-10 rounded-full transition-all uppercase"
            >
              Fale com um de nossos diretores
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
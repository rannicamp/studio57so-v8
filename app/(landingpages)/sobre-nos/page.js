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
      
      {/* --- HERO SECTION: MARCA --- */}
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
            Não é apenas sobre construir prédios.<br/>
            É sobre construir o que prometemos.
        </p>

      </section>

      {/* --- PRÓLOGO: CAMINHOS PARALELOS (LADO A LADO) --- */}
      <section className="py-20 md:py-32 border-t border-gray-100 bg-gray-50">
        <div className="container mx-auto px-6">
            
            <div className="text-center mb-16">
                <span className="text-sm font-bold tracking-[0.3em] text-orange-600 uppercase">Prólogo</span>
                <h2 className="text-3xl md:text-4xl font-light text-gray-900 mt-4">Caminhos Paralelos</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
                
                {/* --- LADO ESQUERDO: RANNIERE (FOTO FINAL) --- */}
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
                    <p className="text-sm text-orange-600 font-bold uppercase tracking-wider mb-6">A Visão Tecnológica</p>

                    <h3 className="text-xl font-light text-gray-500 mb-6 italic font-roboto border-l-2 border-orange-500 pl-4">
                        "Não foi visão de futuro. Foi vontade de ganhar tempo."
                    </h3>
                    
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                        <p>
                            Muita gente conta que começou a usar tecnologia porque teve uma 'visão mística' do futuro. A minha verdade é mais simples: em 2009, no terceiro período da faculdade, um professor me contou um segredo. Ele disse: 
                            <span className="block border-l-2 border-orange-500 pl-4 my-4 italic text-gray-800">
                                "Se você usar essa ferramenta nova chamada BIM, os cortes e fachadas saem automáticos."
                            </span>
                        </p>
                        <p>
                            Na hora, meu lado prático (e, confesso, um pouco preguiçoso de desenhar tudo à mão) falou mais alto. Eu só queria entregar os trabalhos da Univale mais rápido.
                        </p>
                        <p>
                            Mas o que começou como um atalho virou uma obsessão. Enquanto eu usava o software para ganhar tempo, percebi que aquilo não era apenas desenho. Eu estava construindo o prédio de verdade, dentro do computador. Eu via os erros antes deles existirem. Ali, em 2009, muito antes de virar padrão de mercado, eu entendi que <strong>quem domina a informação, domina a obra.</strong>
                        </p>
                    </div>
                </div>

                {/* --- LADO DIREITO: IGOR (FOTO FINAL ATUALIZADA) --- */}
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
                    <p className="text-sm text-orange-600 font-bold uppercase tracking-wider mb-6">A Gestão e o Ensino</p>

                    <h3 className="text-xl font-light text-gray-500 mb-6 italic font-roboto border-l-2 border-orange-500 pl-4">
                        "Do projeto público ao pé no chão."
                    </h3>

                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                        <p>
                            Após uma temporada atuando como arquiteto em Belo Horizonte, retornei a Governador Valadares em 2012 para trabalhar em projetos de infraestrutura urbana e, logo depois, na docência na Univale. Conciliar a complexidade pública com a sala de aula me deu rigor técnico.
                        </p>
                        <p>
                            Porém, em 2020, o cenário mudou. A burocracia pública me cansava e eu queria empreender com velocidade, longe da morosidade dos processos antigos.
                        </p>
                        <p>
                            Meus planos eram fechar a empresa antiga para abrir um novo negócio, com novas ideias. Eu tinha a gestão e a experiência de campo, mas buscava inovação. Precisava de algo que unisse a <strong>técnica da engenharia com a alma da arquitetura.</strong>
                        </p>
                    </div>
                </div>

            </div>
        </div>
      </section>

      {/* --- ATO 1: A FUSÃO (TEXTO PLURALIZADO) --- */}
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
                        <h2 className="text-3xl font-bold text-gray-900 uppercase">A Fusão</h2>
                    </div>
                    <h3 className="text-xl font-light text-orange-600 mb-6 italic font-roboto">
                        "Por que 57? A matemática da criação."
                    </h3>
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                        <p>
                            Em 2017, sabíamos que precisávamos de uma identidade. Eu e a Larissa Ventura decidimos unir forças, mas 'Campos & Ventura' soava como mais um escritório de advocacia, e nós éramos criativos.
                        </p>
                        <p>
                            Olhamos para nossas idades na época. Somamos os números. O resultado foi <strong>57</strong>. Decidimos que seríamos um <strong>Studio</strong> — um laboratório de ideias. Assim nasceu o Studio 57.
                        </p>
                        <p>
                            Mas faltava uma peça chave. Meses depois, reencontramos o <strong>Igor Monte Alto</strong> numa mesa de bar. Ali, entre uma conversa e outra, percebemos que compartilhávamos uma frustração e um sonho.
                        </p>
                        <ul className="space-y-4 bg-white p-6 rounded-sm border-l-2 border-orange-500 shadow-sm">
                            <li className="flex items-start">
                                <FontAwesomeIcon icon={faPenRuler} className="mt-1 mr-3 text-gray-400" />
                                <span>A frustração: ver projetos incríveis serem executados sem o devido cuidado.</span>
                            </li>
                            <li className="flex items-start">
                                <FontAwesomeIcon icon={faHardHat} className="mt-1 mr-3 text-orange-500" />
                                <span className="font-bold text-gray-900">O sonho: parar de apenas desenhar o sonho dos outros e começar a construir o nosso.</span>
                            </li>
                        </ul>
                        <p>
                            Ali, selamos um pacto silencioso. A arquitetura não seria o fim, seria o meio.
                        </p>
                    </div>
                </div>

            </div>
        </div>
      </section>

      {/* --- ATO 2: A RETOMADA --- */}
      <section className="py-20 md:py-32 border-t border-gray-100 bg-gray-50">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Texto */}
                <div className="order-2 md:order-1 flex flex-col justify-center h-full">
                    <div className="flex items-center space-x-4 mb-6">
                        <span className="text-6xl font-thin text-gray-200 font-roboto">02</span>
                        <h2 className="text-3xl font-bold text-gray-900 uppercase">A Retomada</h2>
                    </div>
                    <h3 className="text-xl font-light text-orange-600 mb-6 italic font-roboto">
                        "Paramos de reclamar da obra. Começamos a assinar a obra."
                    </h3>
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-roboto font-light text-justify">
                        <p>
                            Durante anos, vivemos um paradoxo. No escritório, usávamos o BIM para prever cada milímetro, cada tubulação, cada custo. Entregávamos um 'manual de instrução' <strong>completo</strong> para a construção.
                        </p>
                        <p>
                            Mas quando visitávamos a obra, a realidade era outra. Víamos nossos projetos serem descaracterizados por uma execução que ignorava a técnica. Como arquitetos, aquilo doía.
                        </p>
                        <p>
                            Chegou um momento em que tivemos que tomar uma decisão difícil: continuar reclamando ou assumir a responsabilidade. <strong>Decidimos fazer.</strong>
                        </p>
                        <p>
                            O <strong>Studio 57 Arquitetura e Incorporação</strong> nasceu dessa necessidade de controle de qualidade.
                        </p>
                        <p className="border-l-2 border-gray-200 pl-4 italic text-gray-400 text-sm">
                             Nessa jornada de evolução, em janeiro de 2024, a Larissa Ventura encerrou seu ciclo no Studio para dedicar-se a outros projetos pessoais. A empresa seguiu firme, honrando o legado construído e focada na sua nova missão.
                        </p>
                        <p>
                            Hoje, fomos além. Continuamos elaborando a arquitetura completa e coordenando a criação do projeto em sistema BIM, mas agora levamos essa inteligência digital para o canteiro de obras. Eliminamos o 'telefone sem fio' entre o projeto e a execução.
                        </p>
                        <p className="font-medium text-gray-900 text-xl border-l-4 border-black pl-4">
                            Nós construímos o que projetamos. E entregamos exatamente o que você comprou.
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

      {/* --- CTA FINAL --- */}
      <section className="bg-white text-gray-900 py-20 text-center border-t border-gray-200">
        <div className="container mx-auto px-6 max-w-3xl">
            <FontAwesomeIcon icon={faHandshake} className="text-6xl text-orange-500 mb-8" />
            <h2 className="text-3xl md:text-5xl font-light font-roboto mb-6">
                Quer investir com quem garante a entrega?
            </h2>
            <p className="text-xl text-gray-500 mb-10 font-roboto font-light">
                Conheça nossos empreendimentos atuais e veja a diferença de comprar de quem projeta e constrói.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4">
                <Link 
                    href="/empreendimentosstudio" 
                    className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 shadow-xl"
                >
                    Ver Empreendimentos
                </Link>
                <Link 
                    href="https://wa.me/5533998192119?text=Olá! Vim pela página Sobre Nós do site e gostaria de conversar." 
                    target="_blank"
                    className="bg-white border-2 border-black hover:bg-black hover:text-white text-black font-bold py-4 px-10 rounded-full transition-all uppercase"
                >
                    Fale com a gente
                </Link>
            </div>
        </div>
      </section>

    </div>
  );
}
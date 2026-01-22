// Caminho: app/(landingpages)/sobre-nos/page.js
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Montserrat, Roboto } from 'next/font/google';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHardHat, faPenRuler, faHandshake } from '@fortawesome/free-solid-svg-icons';

// Fontes
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '700', '900'] });
const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-roboto' });

export default function SobreNosPage() {
  return (
    <div className={`${roboto.variable} ${montserrat.className} bg-white text-gray-800`}>
      
      {/* --- HERO SECTION: MANIFESTO --- */}
      <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center bg-black text-white overflow-hidden">
        {/* Fundo */}
        <div className="absolute inset-0 z-0 opacity-50">
             <Image 
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759095131611.png" 
                alt="Fundo Studio 57" 
                fill 
                className="object-cover"
                priority
             />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black z-10"></div>
        
        <div className="relative z-20 text-center max-w-4xl px-6">
            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-wider mb-6">
                A Nossa Verdade
            </h1>
            <p className="text-xl md:text-2xl font-light text-gray-300">
                Não é apenas sobre construir prédios.<br/>
                É sobre construir o que prometemos.
            </p>
        </div>
      </section>

      {/* --- ATO 1: A ORIGEM --- */}
      <section className="py-20 md:py-32 border-b border-gray-100">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                
                {/* Imagem Ranniere (Esquerda - Pura e Completa) */}
                <div className="w-full">
                     <Image 
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769086421229.png" 
                        alt="Ranniere Campos" 
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full h-auto" // Foto Pura
                     />
                </div>

                {/* Texto (Direita) */}
                <div className="flex flex-col justify-center h-full">
                    <div className="flex items-center space-x-4 mb-6">
                        <span className="text-6xl font-black text-gray-100">01</span>
                        <h2 className="text-3xl font-bold text-gray-900 uppercase">A Origem</h2>
                    </div>
                    <h3 className="text-xl font-medium text-orange-600 mb-6 italic">
                        "Não foi visão de futuro. Foi vontade de ganhar tempo."
                    </h3>
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-sans text-justify">
                        <p>
                            Muita gente conta que começou a usar tecnologia porque teve uma 'visão mística' do futuro. A minha verdade é mais simples: em 2009, no terceiro período da faculdade, um professor me contou um segredo. Ele disse: 
                            <span className="block border-l-4 border-orange-500 pl-4 my-4 italic text-gray-800">
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
                
            </div>
        </div>
      </section>

      {/* --- ATO 2: A IDENTIDADE --- */}
      <section className="py-20 md:py-32 bg-gray-50 border-b border-gray-100">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                
                {/* Imagem Sócios (Esquerda - Pura e Completa - Foto Ato 2) */}
                <div className="w-full">
                     <Image 
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769088852146.png" 
                        alt="Sócios Studio 57 - Identidade" 
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full h-auto" // Foto Pura
                     />
                </div>

                {/* Texto (Direita) */}
                <div className="flex flex-col justify-center h-full">
                    <div className="flex items-center space-x-4 mb-6">
                        <span className="text-6xl font-black text-gray-200">02</span>
                        <h2 className="text-3xl font-bold text-gray-900 uppercase">A Identidade</h2>
                    </div>
                    <h3 className="text-xl font-medium text-orange-600 mb-6 italic">
                        "Por que 57? A matemática da criação."
                    </h3>
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-sans text-justify">
                        <p>
                            Em 2017, eu sabia que precisava de uma identidade. Eu e a Larissa Ventura decidimos unir forças, mas 'Campos & Ventura' soava como mais um escritório de advocacia, e nós éramos criativos. 
                        </p>
                        <p>
                            Olhamos para nossas idades na época. Somamos os números. O resultado foi <strong>57</strong>. Decidimos que seríamos um <strong>Studio</strong> — um laboratório de ideias. Assim nasceu o Studio 57.
                        </p>
                        <p>
                            Mas faltava uma peça chave. Meses depois, reencontrei o <strong>Igor Monte Alto</strong> numa mesa de bar. Ali, entre uma conversa e outra, percebemos que compartilhávamos uma frustração e um sonho.
                        </p>
                        <ul className="space-y-4 bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
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

      {/* --- ATO 3: A INCORPORAÇÃO --- */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Texto (Esquerda) */}
                <div className="order-2 md:order-1 flex flex-col justify-center h-full">
                    <div className="flex items-center space-x-4 mb-6">
                        <span className="text-6xl font-black text-gray-100">03</span>
                        <h2 className="text-3xl font-bold text-gray-900 uppercase">A Retomada</h2>
                    </div>
                    <h3 className="text-xl font-medium text-orange-600 mb-6 italic">
                        "Paramos de reclamar da obra. Começamos a assinar a obra."
                    </h3>
                    <div className="space-y-6 text-lg text-gray-600 leading-relaxed font-sans text-justify">
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
                        <p className="border-l-4 border-gray-200 pl-4 italic text-gray-500">
                             Nessa jornada de evolução, em janeiro de 2024, a Larissa Ventura encerrou seu ciclo no Studio para dedicar-se a outros projetos pessoais. A empresa seguiu firme, honrando o legado construído e focada na sua nova missão.
                        </p>
                        <p>
                            Hoje, fomos além. Continuamos elaborando a arquitetura completa e coordenando a criação do projeto em sistema BIM, mas agora levamos essa inteligência digital para o canteiro de obras. Eliminamos o 'telefone sem fio' entre o projeto e a execução.
                        </p>
                        <p className="font-bold text-gray-900 text-xl border-l-4 border-black pl-4">
                            Nós construímos o que projetamos. E entregamos exatamente o que você comprou.
                        </p>
                    </div>
                </div>
                
                {/* Imagem Sócios (Direita - Pura e Completa - NOVA FOTO) */}
                <div className="order-1 md:order-2 w-full">
                     <Image 
                        src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/4/IMG_1769093097228.png" 
                        alt="Sócios Studio 57 - A Retomada" 
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full h-auto" // Foto Pura
                     />
                </div>
            </div>
        </div>
      </section>

      {/* --- CTA FINAL --- */}
      <section className="bg-black text-white py-20 text-center">
        <div className="container mx-auto px-6 max-w-3xl">
            <FontAwesomeIcon icon={faHandshake} className="text-6xl text-orange-500 mb-8" />
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Quer investir com quem garante a entrega?
            </h2>
            <p className="text-xl text-gray-400 mb-10 font-sans">
                Conheça nossos empreendimentos atuais e veja a diferença de comprar de quem projeta e constrói.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4">
                <Link 
                    href="/empreendimentosstudio" 
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-10 rounded-full transition-all transform hover:scale-105 shadow-lg shadow-orange-500/20"
                >
                    Ver Empreendimentos
                </Link>
                <Link 
                    href="https://wa.me/5533998192119" 
                    target="_blank"
                    className="bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-4 px-10 rounded-full transition-all"
                >
                    Falar com Ranniere
                </Link>
            </div>
        </div>
      </section>

    </div>
  );
}
'use client';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function CtaSection() {
  
  // Link da imagem (Engenheiro sorrindo com tablet - Placeholder Premium)
  // Caso tenha a imagem gerada salva, faça upload e cole o link aqui.
  const ENGINEER_IMAGE = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop";

  return (
    <section className="snap-start h-screen flex flex-col md:flex-row bg-white relative overflow-hidden">
      
      {/* --- LADO ESQUERDO: TEXTO E CHAMADA --- */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-center px-8 md:px-24 relative z-20 bg-white order-2 md:order-1">
        <div className="max-w-xl">
          <span className="text-[#FF6700] font-bold tracking-widest uppercase text-sm mb-4 block">
            Próximo Passo
          </span>
          
          <h2 className="text-5xl md:text-7xl font-bold mb-8 text-black tracking-tighter leading-[1.1]">
            O futuro da obra<br/>
            começa <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6700] to-orange-500">agora.</span>
          </h2>
          
          <p className="text-xl text-gray-500 mb-12 font-light leading-relaxed">
            Não é apenas sobre software. É sobre ter o controle total nas suas mãos e o sorriso no rosto de quem sabe que a obra está no prazo. 
            Acesse o BIM Manager e experimente o ecossistema <strong>Elo 57</strong>.
          </p>
          
          <Link href="/painel" className="inline-block">
            <button className="group bg-black text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-[#FF6700] hover:text-white transition-all duration-300 flex items-center gap-4 shadow-xl hover:shadow-[#FF6700]/30 hover:-translate-y-1">
              Acessar Sistema
              <FontAwesomeIcon icon={faArrowRight} className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>

        {/* Footer Minimalista */}
        <div className="absolute bottom-8 left-8 md:left-24 text-gray-400 text-xs">
          <p>© {new Date().getFullYear()} Grupo Studio 57. Excelência em cada detalhe.</p>
        </div>
      </div>

      {/* --- LADO DIREITO: IMAGEM HERO --- */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full relative order-1 md:order-2 bg-gray-100">
        <div className="absolute inset-0">
          <img 
            src={ENGINEER_IMAGE} 
            alt="Engenheiro satisfeito utilizando Tablet na obra" 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 ease-in-out"
          />
          {/* Overlay suave para integrar com o branco do lado esquerdo */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent hidden md:block"></div>
          
          {/* Overlay inferior para mobile */}
          <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-white to-transparent md:hidden"></div>
        </div>
      </div>

    </section>
  );
}
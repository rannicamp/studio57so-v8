// Caminho: app/(landingpages)/elo57/components/CtaSection.js
'use client';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function CtaSection({ onOpenForm }) {
  // Imagem do engenheiro na obra
  const ENGINEER_IMAGE = "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop";

  return (
    <section 
      id="cta" 
      className="relative min-h-screen flex flex-col md:flex-row bg-white overflow-hidden"
    >
      {/* --- LADO ESQUERDO: TEXTO E CHAMADA --- */}
      <div className="w-full md:w-1/2 min-h-[50vh] md:min-h-screen flex flex-col justify-center px-6 md:px-24 py-16 md:py-0 relative z-20 bg-white order-2 md:order-1">
        <div className="max-w-xl">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Próximo Passo
          </span>
          <h2 className="text-4xl md:text-7xl font-bold mb-6 text-slate-900 tracking-tighter leading-[1.1]">
            O futuro da obra<br/>
            começa <span className="font-bold text-slate-950">agora.</span>
          </h2>
          <p className="text-base md:text-xl text-slate-500 mb-8 md:mb-12 font-light leading-relaxed">
            Não é apenas sobre software. É sobre ter o controle financeiro total, planejamento físico-financeiro inteligente e segurança operacional em todas as suas SPEs. Faça seu pré-cadastro na Lista de Espera exclusiva e participe do evento de testes do **dia 19 de Agosto**.
          </p>
          <button 
            onClick={onOpenForm}
            className="group bg-slate-950 text-white px-8 py-4.5 md:px-10 md:py-5 rounded-xl font-bold text-base md:text-lg hover:bg-[#f25a2f] hover:text-white transition-all duration-300 flex items-center gap-4 shadow-xl hover:shadow-orange-500/20 hover:-translate-y-0.5 cursor-pointer border-none outline-none"
          >
            Quero Me Cadastrar
            <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4 md:w-5 md:h-5 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Footer Minimalista */}
        <div className="absolute bottom-6 left-6 md:left-24 text-slate-400 text-[10px]">
          <p>© {new Date().getFullYear()} Elo 57. Excelência em cada detalhe.</p>
        </div>
      </div>

      {/* --- LADO DIREITO: IMAGEM HERO --- */}
      <div className="w-full md:w-1/2 h-[40vh] md:h-full relative order-1 md:order-2 bg-slate-100">
        <div className="absolute inset-0">
          <img 
            src={ENGINEER_IMAGE} 
            alt="Engenharia Elo 57" 
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000 ease-in-out"
          />
          {/* Overlay suave para integrar com o branco do lado esquerdo no desktop */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent hidden md:block"></div>
          {/* Overlay inferior para mobile */}
          <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-white to-transparent md:hidden"></div>
        </div>
      </div>

    </section>
  );
}
// Caminho: app/(landingpages)/elo57/components/HeroSection.js
'use client';

import { useState, useEffect } from 'react';

export default function HeroSection({ onOpenForm }) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setMounted(true);

    const targetDate = new Date('2026-08-19T20:00:00');
    
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScrollToDores = () => {
    const el = document.getElementById('dores');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section 
      id="hero" 
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white text-black pt-20"
    >
      {/* Container Centralizado para Marca e Slogan */}
      <div className={`z-10 flex flex-col items-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Banner de Pré-Lançamento com Fonte Personalizada */}
        <div className="mb-4 text-center">
          <p className="text-xs md:text-sm font-semibold text-[#f25a2f] tracking-[0.2em] uppercase">
            PRÉ-LANÇAMENTO: TESTES EM 19 DE AGOSTO
          </p>
        </div>

        {/* Logo Elo 57 - Original (Sem inversão, no tamanho original) */}
        <div className="w-[300px] md:w-[450px] mb-4">
          <img 
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770136280158.png" 
            alt="Elo 57" 
            className="w-full h-auto object-contain" 
          />
        </div>

        {/* Slogan - Alinhado à largura da marca com a linha laranja original */}
        <div className="w-[300px] md:w-[450px] text-center border-t border-[#FF6700] pt-6 mb-6">
          <p className="text-lg md:text-2xl font-light text-gray-500 tracking-[0.15em] uppercase">
            Eficiência em cada detalhe.
          </p>
        </div>

        {/* Descrição Adicionada - Bem elegante e sucinta */}
        <p className="text-sm md:text-base text-slate-500 font-light leading-relaxed max-w-xl text-center px-4 mb-6">
          Muito além de um ERP convencional. O Elo 57 unifica holdings, múltiplas SPEs, canteiros de obras, atendimento inteligente por IA no WhatsApp e orçamento BIM 5D na web. Garanta sua vaga para a fase exclusiva de testes.
        </p>

        {/* Relógio de Contagem Regressiva */}
        <div className="flex gap-4 md:gap-7 mb-8 text-center bg-slate-50/60 backdrop-blur-sm border border-slate-100/70 rounded-2xl px-6 py-4.5 shadow-sm">
          <div>
            <div className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{timeLeft.days}</div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Dias</div>
          </div>
          <div className="text-lg md:text-2xl text-slate-300 font-light flex items-center justify-center">:</div>
          <div>
            <div className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{timeLeft.hours.toString().padStart(2, '0')}</div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Horas</div>
          </div>
          <div className="text-lg md:text-2xl text-slate-300 font-light flex items-center justify-center">:</div>
          <div>
            <div className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{timeLeft.minutes.toString().padStart(2, '0')}</div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Minutos</div>
          </div>
          <div className="text-lg md:text-2xl text-slate-300 font-light flex items-center justify-center">:</div>
          <div>
            <div className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{timeLeft.seconds.toString().padStart(2, '0')}</div>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Segundos</div>
          </div>
        </div>

        {/* Botões de Ação Centralizados */}
        <div className="flex flex-wrap justify-center gap-4 z-20">
          <button 
            onClick={onOpenForm}
            className="px-6 py-3.5 bg-[#f25a2f] hover:bg-[#e04f25] text-white font-semibold rounded-xl shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-center text-sm md:text-base border-none outline-none"
          >
            Fazer Pré-Cadastro
          </button>
          <button 
            onClick={() => {
              const el = document.getElementById('modulos');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-6 py-3.5 bg-white hover:bg-slate-55 text-slate-700 border border-slate-200 hover:border-slate-350 font-semibold rounded-xl shadow-sm hover:shadow transition-all duration-300 cursor-pointer text-center text-sm md:text-base border-none outline-none"
          >
            Conhecer Módulos
          </button>
        </div>

      </div>
      
      {/* Indicador de Scroll Original */}
      <button 
        onClick={handleScrollToDores}
        className="absolute bottom-8 animate-bounce text-[#FF6700] focus:outline-none cursor-pointer"
        aria-label="Rolar para baixo"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </button>
    </section>
  );
}
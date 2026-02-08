'use client';

import { useState, useEffect } from 'react';

export default function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="snap-start relative h-screen flex flex-col items-center justify-center overflow-hidden bg-white text-black">
      
      {/* Container Centralizado para Marca e Slogan */}
      <div className={`z-10 flex flex-col items-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Logo Elo 57 - Original (Sem inversão) */}
        <div className="w-[300px] md:w-[450px] mb-4">
          <img 
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770136280158.png" 
            alt="Elo 57" 
            className="w-full h-auto object-contain" 
          />
        </div>

        {/* Slogan - Alinhado à largura da marca */}
        <div className="w-[300px] md:w-[450px] text-center border-t border-[#FF6700] pt-6">
          <p className="text-lg md:text-2xl font-light text-gray-500 tracking-[0.15em] uppercase">
            Eficiência em cada detalhe.
          </p>
        </div>

      </div>
      
      {/* Background Texture (Opcional: bem sutil no branco) */}
      <div className="absolute inset-0 opacity-5 bg-[url('/images/background-texture.jpg')] bg-cover bg-center pointer-events-none mix-blend-multiply" />
      
      {/* Indicador de Scroll */}
      <div className="absolute bottom-8 animate-bounce text-[#FF6700]">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
      </div>
    </section>
  );
}
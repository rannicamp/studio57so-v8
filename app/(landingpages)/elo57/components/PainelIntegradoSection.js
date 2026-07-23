// Caminho: app/(landingpages)/elo57/components/PainelIntegradoSection.js
'use client';

import { useState, useEffect } from 'react';

export default function PainelIntegradoSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section 
      id="gestao-integrada" 
      className="relative min-h-screen flex flex-col justify-center bg-white px-6 py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto w-full flex flex-col items-center relative z-10">
        
        {/* Cabeçalho da Seção */}
        <div className="text-center mb-12 max-w-3xl">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            A Resposta Operacional
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 tracking-tight leading-tight">
            Gestão integrada e <span className="font-bold text-slate-950">centralizada.</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-500 font-light leading-relaxed">
            Esqueça sistemas desconectados e planilhas paralelas. O Elo 57 unifica as informações financeiras, contatos do CRM, medições e materiais em uma única plataforma integrada e multi-empresas, permitindo decisões em tempo real.
          </p>
        </div>

        {/* Mockup do Laptop de Luxo com Print Real da Dashboard */}
        <div className={`w-full max-w-[840px] flex justify-center transition-all duration-1000 ease-out transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="relative w-full px-4 md:px-0">
            {/* Corpo do Laptop */}
            <div className="relative w-full aspect-[16/10] bg-slate-950 rounded-t-2xl border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden">
              {/* Câmera do Laptop */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                <span className="w-1 h-1 bg-slate-700 rounded-full opacity-60"></span>
              </div>
              
              {/* Tela Real (Imagem Painel) */}
              <div className="w-full h-full bg-slate-900 overflow-hidden relative">
                <img 
                  src="/prints/painel.png" 
                  alt="Painel de Controle Elo 57" 
                  className="w-full h-full object-cover object-top hover:scale-[1.02] transition-transform duration-700" 
                />
                {/* Reflexo na tela */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none"></div>
              </div>
            </div>
            {/* Base do Laptop */}
            <div className="relative w-[108%] -left-[4%] h-5 bg-slate-700 rounded-b-2xl shadow-2xl border-t border-slate-600 flex items-center justify-center">
              {/* Detalhe de abertura da tampa */}
              <div className="w-20 h-2 bg-slate-800 rounded-b-md"></div>
            </div>
            {/* Sombra de apoio */}
            <div className="w-[96%] mx-auto h-6 bg-black/20 blur-lg rounded-full mt-1"></div>
          </div>
        </div>

      </div>
    </section>
  );
}

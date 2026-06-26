// Caminho: app/(landingpages)/elo57/components/CaseSection.js
'use client';

import ViewerBackground from './ViewerBackground';

export default function CaseSection() {
  // O URN DO RESIDENCIAL ALFA (Estrutural)
  const ALFA_URN = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6c3R1ZGlvNTdfYmltX2J1Y2tldF9qYXV0OXdzMDhyanpkb256ZXdhbmp1Zzdia2R2MzJ5dDB1bmRkYTY5eTJ2ZXNlYmMvMjAyNF8wMDBfRVNUUlVUVVJBX0NPUlJFVEEucnZ0';

  return (
    <section 
      id="bim" 
      className="snap-start min-h-screen md:h-screen relative flex flex-col justify-center overflow-hidden bg-white py-16 md:py-0"
    >
      {/* --- CAMADA 1: O BACKGROUND (BIM) --- */}
      <div className="absolute inset-0 z-0">
        <ViewerBackground urn={ALFA_URN} />
      </div>

      {/* --- CAMADA 2: DEGRADÊ --- */}
      {/* from-white (sólido na esquerda p/ texto) -> to-transparent (vazio na direita p/ modelo) */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent z-10 pointer-events-none"></div>

      {/* --- CAMADA 3: CONTEÚDO --- */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center h-full pointer-events-none">
        
        {/* Lado Esquerdo: Texto */}
        <div className="max-w-xl pointer-events-auto">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-4 block">
            Tecnologia BIM 5D
          </span>
          <h2 className="text-4xl md:text-6xl font-light text-slate-900 mb-6 leading-tight tracking-tight">
            Residencial <span className="font-bold text-slate-950">Alfa.</span>
          </h2>
          <p className="text-lg text-slate-700 mb-8 font-light leading-relaxed">
            O invisível que sustenta o visível. O modelo estrutural ao fundo, renderizado em tempo real na web via APS Forge, é a prova de que a engenharia e o orçamento financeiro estão integrados ao milímetro antes do primeiro tijolo ser assentado.
          </p>
          
          <div className="flex gap-8 border-t border-slate-200 pt-8">
            <div>
              <p className="text-4xl font-bold text-slate-900 mb-1">100%</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Compatibilizado</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-slate-900 mb-1">Zero</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Surpresas</p>
            </div>
          </div>
        </div>

        {/* Lado Direito: Cards Flutuantes (Ocultos em mobile pequeno para priorizar modelo BIM) */}
        <div className="relative h-[400px] w-full hidden lg:block pointer-events-auto">
          
          {/* Card 1: Fachada */}
          <div className="absolute top-0 right-0 w-64 h-40 bg-white p-2 shadow-2xl rounded-xl transform rotate-6 hover:rotate-0 transition-transform duration-500 z-10 hover:z-50 hover:scale-105 cursor-pointer border border-slate-100">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png" 
              alt="Fachada Alfa" 
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute bottom-3 left-3 bg-black/90 text-white text-[9px] uppercase font-bold px-3 py-1 rounded-full">Fachada</div>
          </div>

          {/* Card 2: Lazer */}
          <div className="absolute top-32 right-32 w-64 h-40 bg-white p-2 shadow-2xl rounded-xl transform -rotate-3 hover:rotate-0 transition-transform duration-500 z-20 hover:z-50 hover:scale-105 cursor-pointer border border-slate-100">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png" 
              alt="Gourmet Alfa" 
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute bottom-3 left-3 bg-black/90 text-white text-[9px] uppercase font-bold px-3 py-1 rounded-full">Lazer</div>
          </div>

          {/* Card 3: Interior */}
          <div className="absolute top-64 right-8 w-64 h-40 bg-white p-2 shadow-2xl rounded-xl transform rotate-3 hover:rotate-0 transition-transform duration-500 z-30 hover:z-50 hover:scale-105 cursor-pointer border border-slate-100">
            <img 
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759019089329.png" 
              alt="Interior Alfa" 
              className="w-full h-full object-cover rounded-lg"
            />
            <div className="absolute bottom-3 left-3 bg-black/90 text-white text-[9px] uppercase font-bold px-3 py-1 rounded-full">Interior</div>
          </div>

        </div>
      </div>
    </section>
  );
}
// Caminho: app/(landingpages)/elo57/components/OriginSection.js
'use client';

export default function OriginSection() {
  // Imagem Wide
  const bgImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770141108563.jpg";

  return (
    <section 
      id="origem" 
      className="snap-start min-h-screen md:h-screen relative flex items-center overflow-hidden bg-white py-16 md:py-0"
    >
      {/* --- CAMADA 1: Imagem de Fundo --- */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="Manifesto Elo 57"
          className="w-full h-full object-cover opacity-20 grayscale"
        />
      </div>

      {/* --- CAMADA 2: Degradê Branco --- */}
      <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent z-10" />

      {/* --- CAMADA 3: Conteúdo Minimalista --- */}
      <div className="relative z-20 container mx-auto px-6 md:px-24 h-full flex flex-col justify-center">
        <div className="max-w-3xl border-l-2 border-slate-900 pl-6 md:pl-12 py-4">
          
          {/* Título Principal */}
          <h2 className="text-4xl md:text-7xl font-light mb-8 text-slate-900 leading-[1.1] tracking-tighter">
            A Excelência não<br/>aceita omissão.
          </h2>
          
          {/* Subtítulo (O Gancho) */}
          <div className="mb-10">
            <p className="text-lg md:text-3xl text-slate-700 font-extralight leading-relaxed tracking-wide">
              "Para cumprir nossa promessa de <span className="text-slate-950 font-normal">Excelência em cada detalhe</span>, precisamos ser <span className="text-slate-950 font-semibold">Eficientes em cada detalhe</span>."
            </p>
          </div>

          {/* Corpo do Texto */}
          <div className="space-y-6 text-sm md:text-lg text-slate-550 leading-relaxed font-light max-w-xl">
            <p>
              O Studio 57 nasceu e cresceu com uma obsessão pela qualidade técnica e estética. Mas a gestão do mercado de construção civil sempre foi fragmentada: o financeiro não falava com a engenharia, e o BIM ficava restrito a escritórios isolados.
            </p>
            <p>
              Por isso, criamos o Elo 57. Um ecossistema tecnológico completo, onde a beleza do projeto se conecta perfeitamente ao controle milimétrico do canteiro de obras e das contas da empresa.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}

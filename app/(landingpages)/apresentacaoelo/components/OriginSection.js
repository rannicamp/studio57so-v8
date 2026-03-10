export default function OriginSection() {
  // Imagem Wide
  const bgImage = "https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empresa-anexos/8/IMG_1770141108563.jpg";

  return (
    <section className="snap-start h-screen relative flex items-center overflow-hidden bg-black">
      
      {/* --- CAMADA 1: Imagem de Fundo --- */}
      <div className="absolute inset-0 z-0">
        <img 
          src={bgImage} 
          alt="Comparativo: Mesa bagunçada vs Gestão digital Elo 57"
          className="w-full h-full object-cover opacity-60"
        />
      </div>

      {/* --- CAMADA 2: Degradê (Mais suave agora para combinar com a fonte fina) --- */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />

      {/* --- CAMADA 3: Conteúdo Minimalista --- */}
      <div className="relative z-20 container mx-auto px-6 md:px-24 h-full flex flex-col justify-center">
        <div className="max-w-3xl border-l border-[#FF6700]/50 pl-8 md:pl-12 py-4">
          
          {/* Título Principal - Fino e Elegante */}
          <h2 className="text-5xl md:text-7xl font-light mb-10 text-white leading-[1.1] tracking-tighter">
            A Excelência não<br/>aceita omissão.
          </h2>
          
          {/* Subtítulo (O Gancho) */}
          <div className="mb-12">
            <p className="text-xl md:text-3xl text-gray-200 font-extralight leading-relaxed tracking-wide">
              "Para cumprir nossa promessa de <span className="text-white font-normal">Excelência em cada detalhe</span> precisamos ser <span className="text-white font-normal">Eficiêncientes em cada detalhe</span> 
            </p>
          </div>

          {/* Corpo do Texto - Limpo */}
          <div className="space-y-6 text-lg text-gray-400 leading-relaxed font-light max-w-xl">
            <p>
              O Studio 57 cresceu com uma obsessão pela qualidade técnica. Mas o mercado de software era fragmentado: o financeiro não falava com a engenharia, o BIM era isolado da obra.
            </p>
            <p>
              Decidimos criar nosso próprio ecossistema. Onde o design e a execução falam a mesma língua.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}

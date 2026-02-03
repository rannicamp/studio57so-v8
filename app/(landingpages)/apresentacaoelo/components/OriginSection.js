export default function OriginSection() {
  return (
    <section className="snap-start h-screen flex items-center justify-center py-10 px-6 md:px-20 bg-gray-50 text-black">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <span className="text-[#FF6700] font-bold tracking-widest uppercase text-sm mb-2 block">01. A Origem</span>
          <h2 className="text-5xl font-bold mb-8 leading-tight">
            Do Design à Realidade.<br/>
            <span className="text-[#FF6700]">Sem perder o elo.</span>
          </h2>
          <div className="space-y-6 text-xl text-gray-600 leading-relaxed font-light">
            <p>
              No <strong>Studio 57</strong>, nossa obsessão sempre foi a <em>Excelência em cada detalhe</em>. Mas percebemos um abismo entre o que projetávamos e o controle real no canteiro de obras.
            </p>
            <p>
              As soluções de mercado eram fragmentadas. O financeiro não conversava com a engenharia.
            </p>
            <p className="font-medium text-black border-l-4 border-[#FF6700] pl-4">
              Não aceitamos isso. Decidimos construir nossa própria solução.
            </p>
          </div>
        </div>
        <div className="h-[50vh] bg-white rounded-none md:rounded-2xl overflow-hidden shadow-2xl relative border border-gray-200">
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
             <span className="text-center px-4">
               [FOTO: Equipe Studio 57]<br/>
               <span className="text-sm">Ambiente de Criação</span>
             </span>
          </div>
        </div>
      </div>
    </section>
  );
}
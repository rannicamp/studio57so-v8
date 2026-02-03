export default function TechSection() {
  return (
    <section className="snap-start h-screen flex flex-col justify-center py-10 bg-white px-6">
      <div className="max-w-6xl mx-auto w-full">
        <div className="text-center mb-16">
          <span className="text-[#FF6700] font-bold tracking-widest uppercase text-sm">02. A Tecnologia</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6 text-black">Construído com IA, para Gerir com IA</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            O Elo 57 não foi apenas programado. Ele foi acelerado por Inteligência Artificial para entregar em meses o que levaria anos.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <CardIA 
            icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path></svg>}
            title="Análise Preditiva"
            desc="Nossa IA cruza dados financeiros e de obra para encontrar gargalos antes que virem prejuízo."
          />
          <CardIA 
            icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>}
            title="RDO Automático"
            desc="Geração de relatórios diários baseados em fotos e inputs rápidos da equipe de campo."
          />
          <CardIA 
            icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            title="Compliance Total"
            desc="Auditoria automática de notas e processos para garantir segurança jurídica e financeira."
          />
        </div>
      </div>
    </section>
  );
}

function CardIA({ icon, title, desc }) {
  return (
    <div className="bg-gray-50 p-10 rounded-2xl border border-gray-100 hover:shadow-lg hover:-translate-y-2 transition-all duration-500 h-full flex flex-col justify-start">
      <div className="text-[#FF6700] mb-6 bg-white w-20 h-20 rounded-full flex items-center justify-center shadow-sm">{icon}</div>
      <h3 className="text-2xl font-bold mb-4 text-gray-900">{title}</h3>
      <p className="text-gray-600 text-lg leading-relaxed">{desc}</p>
    </div>
  );
}
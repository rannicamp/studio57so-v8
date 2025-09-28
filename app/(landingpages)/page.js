// Caminho do arquivo: app/(landingpages)/page.js
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <>
      <section className="relative h-[60vh] flex items-center justify-center text-white">
        <Image
          src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2070&auto=format&fit=crop"
          alt="Fachada de casa moderna"
          layout="fill"
          objectFit="cover"
          className="z-0"
        />
        <div className="absolute inset-0 bg-black opacity-50"></div>
        <div className="relative z-10 text-center p-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Soluções Completas para o Mercado Imobiliário</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto">Da gestão da sua obra à venda do seu empreendimento, o Studio 57 é o seu parceiro ideal para o sucesso.</p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">Nossos Serviços</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold text-primary mb-4">Gestão de Obras</h3>
              <p>Acompanhamento completo do seu projeto, garantindo prazos, custos e qualidade do início ao fim.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold text-primary mb-4">Venda de Imóveis</h3>
              <p>Estratégias de marketing e uma equipe de vendas especializada para comercializar seu imóvel com agilidade.</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold text-primary mb-4">Lançamentos</h3>
              <p>Planejamento e execução de lançamentos de empreendimentos, conectando seu projeto aos investidores certos.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
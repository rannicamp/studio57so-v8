// Caminho do arquivo: app/(landingpages)/page.js
import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faPuzzlePiece, faBuilding } from '@fortawesome/free-solid-svg-icons';

export default function HomePage() {
  return (
    <>
      {/* 1. SEÇÃO INICIAL (HERO) */}
      <section className="relative min-h-[calc(100vh-74px)] flex items-center justify-center bg-black text-white overflow-hidden">
        {/* O PORQUÊ DESTA MUDANÇA:
            Substituímos a imagem externa por uma imagem de alta qualidade do Residencial Alfa,
            que já está no seu banco de dados, garantindo que usamos apenas seus próprios ativos. */}
        <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png"
            alt="Fachada de empreendimento moderno"
            layout="fill"
            objectFit="cover"
            className="z-0"
            priority
        />
        <div className="absolute inset-0 bg-black opacity-50 z-10"></div>
        <div className="relative z-20 flex flex-col items-center p-4 text-center max-w-4xl mx-auto">
            <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759092334426.PNG" 
                alt="Logo Studio 57 Arquitetura e Incorporação"
                width={400}
                height={100}
                className="mb-8 filter invert"
                priority
            />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Arquitetura Inteligente. Empreendimentos Reais.
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8">
                Utilizamos a metodologia BIM para criar projetos precisos e investimentos imobiliários com máxima segurança e rentabilidade.
            </p>
            <Link href="/empreendimentosstudio" className="bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity text-lg">
                Conheça os Empreendimentos
            </Link>
        </div>
      </section>

      {/* 2. SEÇÃO DE PILARES (SERVIÇOS) */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Nossos Pilares</h2>
          <p className="max-w-3xl mx-auto text-gray-600 mb-12">Da concepção à entrega, oferecemos soluções completas e integradas.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8"><FontAwesomeIcon icon={faCube} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Arquitetura BIM</h3><p className="text-gray-600">Criamos modelos 3D inteligentes que permitem visualizar cada detalhe do projeto antes da construção, garantindo precisão absoluta.</p></div>
            <div className="p-8"><FontAwesomeIcon icon={faPuzzlePiece} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Compatibilização</h3><p className="text-gray-600">Integramos projetos de arquitetura e engenharia para eliminar conflitos, otimizar processos e garantir uma execução de obra sem surpresas.</p></div>
            <div className="p-8"><FontAwesomeIcon icon={faBuilding} className="text-5xl text-primary mb-4" /><h3 className="text-2xl font-bold text-gray-900 mb-2">Incorporação</h3><p className="text-gray-600">Desenvolvemos empreendimentos desde a análise de viabilidade até a entrega final, criando oportunidades de investimento sólidas e rentáveis.</p></div>
          </div>
        </div>
      </section>

      {/* 3. SEÇÃO DO PORTFÓLIO */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">Projetos em Destaque</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="group relative overflow-hidden rounded-lg shadow-lg"><Image src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png" alt="Fachada Residencial Alfa" width={800} height={600} className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"><span className="text-white text-2xl font-bold">Residencial Alfa</span></div></div>
            <div className="group relative overflow-hidden rounded-lg shadow-lg"><Image src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018929039.png" alt="Área Gourmet" width={800} height={600} className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"><span className="text-white text-2xl font-bold">Áreas de Lazer</span></div></div>
          </div>
          <div className="mt-12"><Link href="/empreendimentosstudio" className="inline-block bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity text-lg">Ver Todos os Projetos</Link></div>
        </div>
      </section>
    </>
  );
}
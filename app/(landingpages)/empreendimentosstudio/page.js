// Caminho do arquivo: app/(landingpages)/empreendimentosstudio/page.js
import Link from 'next/link';
import Image from 'next/image';

// O PORQUÊ DESTE CÓDIGO:
// Este é o componente React que estava faltando. Ele cria a estrutura visual da página
// de empreendimentos, exibindo o Residencial Alfa como um item de portfólio clicável,
// resolvendo o erro que impedia a página de carregar.

export default function EmpreendimentosPage() {
  return (
    <div className="bg-white py-16 md:py-24">
      <div className="w-full px-6">
        <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Nossos Empreendimentos</h1>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">Conheça os projetos que refletem nosso compromisso com a inovação, qualidade e rentabilidade.</p>
        </div>
        
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-gray-50 p-8 rounded-lg shadow-lg">
            <div>
                <h2 className="text-3xl font-bold text-primary mb-4">Residencial Alfa</h2>
                <p className="text-gray-600 mb-6">
                    Um novo conceito de viver bem em Governador Valadares. Projetado para oferecer o máximo de conforto, segurança e qualidade de vida para você e sua família, com alto potencial de valorização.
                </p>
                <Link href="/residencialalfa" className="inline-block bg-primary text-white font-bold py-3 px-6 rounded-full hover:opacity-90 transition-opacity">
                    Ver Detalhes do Empreendimento
                </Link>
            </div>
            <div className="relative h-64 md:h-80 rounded-lg overflow-hidden shadow-xl">
                 <Image 
                    src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759018648180.png"
                    alt="Fachada do Residencial Alfa"
                    layout="fill"
                    objectFit="cover"
                 />
            </div>
        </div>

      </div>
    </div>
  );
}
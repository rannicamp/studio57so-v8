// Caminho do arquivo: app/(landingpages)/page.js
import Link from 'next/link';
import Image from 'next/image';

// O PORQUÊ DESTA PÁGINA:
// Esta é a nova home page, reconstruída para ter o mesmo impacto visual
// da primeira seção da página "Residencial Alfa". Usamos um fundo de alto impacto,
// a logo oficial e uma chamada para ação clara, criando uma entrada profissional para o seu site.

export default function HomePage() {
  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center bg-black text-white overflow-hidden">
        {/* Imagem de Fundo */}
        <Image
            src="https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2070&auto=format&fit=crop"
            alt="Fachada de casa moderna"
            layout="fill"
            objectFit="cover"
            className="z-0"
            priority
        />
        {/* Sobreposição para escurecer a imagem e dar contraste */}
        <div className="absolute inset-0 bg-black opacity-50 z-10"></div>

        {/* Conteúdo Central */}
        <div className="relative z-20 flex flex-col items-center p-4 text-center">
            <Image
                src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/logo/logo-studio57-preto.png" 
                alt="Logo Studio 57"
                width={120}
                height={120}
                className="mb-8 filter invert" // 'filter invert' torna a logo preta em branca
            />
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
                Soluções Completas para o Mercado Imobiliário
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-8">
                Da gestão da sua obra à venda do seu empreendimento, o Studio 57 é o seu parceiro ideal para o sucesso.
            </p>
            <Link href="/empreendimentosstudio" className="bg-primary text-white font-bold py-3 px-8 rounded-full hover:opacity-90 transition-opacity text-lg">
                Conheça os Empreendimentos
            </Link>
        </div>
    </section>
  );
}
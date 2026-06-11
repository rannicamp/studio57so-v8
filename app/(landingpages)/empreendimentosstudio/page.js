// Caminho do arquivo: app/(landingpages)/empreendimentosstudio/page.js
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Montserrat, Roboto } from 'next/font/google';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
});

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['100', '300', '400', '500', '700'],
  variable: '--font-roboto',
});

const empreendimentos = [
  {
    nome: 'Residencial Alfa',
    status: 'EM EXECUÇÃO',
    statusColor: 'bg-green-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759098853021.png',
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/IMG_1759008548201.png',
    descricao: 'Apartamentos de 49 e 58m² no Alto Esplanada. Planejado para oferecer conforto e alta rentabilidade com valorização garantida em uma das regiões mais nobres de Governador Valadares.',
    caracteristicas: ['2 Quartos (1 Suíte)', 'Varanda Gourmet', 'Vaga de Garagem', 'Lazer Completo'],
    link: '/residencialalfa'
  },
  {
    nome: 'Beta Suítes',
    status: 'PRÉ-LANÇAMENTO',
    statusColor: 'bg-blue-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/beta_sunset_fachada.jpeg',
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/5/anexos/1777578206822_BETA_LOGO_BRANCA.png',
    descricao: 'Suítes inteligentes de 28 a 32m² no Alto Esplanada. Desenvolvido sob medida para investidores focados em renda passiva recorrente por meio de locações de curta ou longa temporada.',
    caracteristicas: ['Suítes Inteligentes', 'Piscina de Borda Infinita', 'Rooftop Gourmet', 'Lavanderia Compartilhada'],
    link: '/betasuites'
  },
  {
    nome: 'Refúgio Braúnas',
    status: 'CONCLUÍDO',
    statusColor: 'bg-[#2c5234]',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/IMG_1760619077139.png',
    logoUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/6/LOGO-P_1760619039077.png',
    descricao: 'Lotes amplos a partir de 1.000m² integrados à natureza, localizados a apenas 10 minutos do centro. Infraestrutura asfáltica completa, calçadas prontas, rede de água e luz.',
    caracteristicas: ['Lotes de 1.000m²', 'Segurança & Portaria', 'Infraestrutura Pronta', 'Contato com a Natureza'],
    link: '/refugiobraunas'
  },
  {
    nome: 'Residencial Pero Vaz',
    status: 'PRONTO PARA MORAR',
    statusColor: 'bg-indigo-600',
    imagemUrl: 'https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/10/IMG_1778095649407.jpeg',
    logoUrl: null, // Não possui marca
    descricao: 'Apartamento térreo no Jardim Vera Cruz com excelente distribuição de espaço e área privativa externa. A oportunidade perfeita de moradia imediata ou investimento de baixo custo.',
    caracteristicas: ['2 Quartos amplos', 'Área privativa externa', 'Cozinha americana', 'Pronto para morar'],
    link: '/perovaz'
  }
];

export default function EmpreendimentosPage() {
  return (
    <div className={`${roboto.variable} ${montserrat.className} bg-white min-h-screen py-20 md:py-32`}>
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* Cabeçalho */}
        <div className="text-center mb-16 md:mb-24">
          <span className="text-xs font-bold tracking-[0.3em] text-[#f25a2f] uppercase block mb-2">Nosso Portfólio</span>
          <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight">
            Projetos <strong className="font-bold">Studio 57</strong>
          </h1>
          <p className="text-lg text-gray-500 mt-4 max-w-2xl mx-auto font-roboto font-light leading-relaxed">
            Construímos valor, design de alta performance e mitigação de riscos. Conheça nossos empreendimentos ativos e encontre a melhor oportunidade para morar ou investir.
          </p>
        </div>

        {/* Grid de Empreendimentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {empreendimentos.map((emp, index) => (
            <div 
              key={index}
              className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-[#f25a2f]/30 transition-all duration-500 group hover:shadow-2xl hover:scale-[1.01]"
            >
              {/* Imagem do Empreendimento */}
              <div className="relative h-64 md:h-72 w-full overflow-hidden">
                <Image
                  src={emp.imagemUrl}
                  alt={emp.nome}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                
                {/* Overlay preto translúcido sobre a imagem */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors duration-300"></div>

                {/* Renderização do Logo/Marca por cima da imagem */}
                {emp.logoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center p-12">
                    <div className="relative w-full h-full max-w-[200px] max-h-[90px]">
                      <Image
                        src={emp.logoUrl}
                        alt={`Logo ${emp.nome}`}
                        fill
                        className="object-contain drop-shadow-xl filter brightness-0 invert opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                      />
                    </div>
                  </div>
                )}

                {/* Badge de Status */}
                <span className={`absolute top-4 right-4 ${emp.statusColor} text-white text-[9px] md:text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full shadow-md z-10`}>
                  {emp.status}
                </span>
              </div>

              {/* Informações */}
              <div className="p-6 md:p-8 flex flex-col flex-grow">
                <h2 className="text-2xl font-bold text-gray-900 mb-3 uppercase tracking-wide group-hover:text-[#f25a2f] transition-colors">
                  {emp.nome}
                </h2>
                <p className="text-gray-600 text-sm md:text-base mb-6 leading-relaxed flex-grow text-justify font-roboto font-light">
                  {emp.descricao}
                </p>

                {/* Características em Badges Pequenas */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {emp.caracteristicas.map((car, idx) => (
                    <span 
                      key={idx}
                      className="bg-white border border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
                    >
                      {car}
                    </span>
                  ))}
                </div>

                {/* Botão de Link */}
                <Link 
                  href={emp.link}
                  className="block w-full text-center bg-black hover:bg-[#f25a2f] text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 uppercase tracking-wider text-xs shadow-md"
                >
                  Conhecer Empreendimento
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
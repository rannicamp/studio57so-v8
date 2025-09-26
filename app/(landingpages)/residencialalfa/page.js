'use client'; 
import { useState } from 'react';
import FormularioDeContato from './FormularioDeContato';
import Image from 'next/image';
import { Roboto } from 'next/font/google';

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

// --- Componentes de Ícones (Exemplo) ---
const IconeLocalizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>;
const IconeValorizacao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0115 15v3h1zM4.75 12.094A5.973 5.973 0 004 15v3H3v-3a3.005 3.005 0 01-.25-1.094z"></path></svg>;
const IconeRentabilidade = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.293 3.293a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V16a1 1 0 11-2 0V5.414L5.707 8.707a1 1 0 01-1.414-1.414l4-4z"></path></svg>;
const IconeCasa = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>;
const IconeCoracao = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>;
const IconePiscina = () => <svg fill="currentColor" viewBox="0 0 20 20" className="w-8 h-8"><path d="M10 3a1 1 0 011 1v1.155a3.994 3.994 0 012.382 1.43 1 1 0 01-1.414 1.414A1.994 1.994 0 0010.5 6.586V8a1 1 0 01-2 0V6.586a1.994 1.994 0 00-1.468.413 1 1 0 01-1.414-1.414A3.994 3.994 0 018 5.155V4a1 1 0 011-1z"></path><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zM5.222 10.26a1 1 0 010 1.414 4 4 0 005.656 0 1 1 0 111.414-1.414 6 6 0 01-8.484 0 1 1 0 011.414 0z" clipRule="evenodd"></path></svg>;

export default function ResidencialAlfaPage() {
  const [view, setView] = useState('investidor'); // 'investidor' ou 'morador'
  const darkGrayColor = '#374151';

  return (
    <div className={`${roboto.className} bg-white text-gray-800 font-sans`}>
      
      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 1 ======================= */}
      {/* =================================================================== */}
      <section className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-no-repeat bg-right-bottom z-0"
          style={{
            backgroundImage: "url('https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/capa%20vazia2.png')",
            backgroundSize: 'cover',
          }}
        ></div>
        <div className="absolute inset-0 bg-black opacity-20 z-10"></div>
        <div className="absolute bottom-0 left-0 w-[45%] max-w-xs sm:max-w-sm md:w-1/3 md:max-w-md z-20">
          <Image
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/tatisemfundo.png"
            alt="Tati, especialista do Residencial Alfa"
            width={600}
            height={900}
            className="w-full h-auto"
            priority
          />
        </div>
        <div className="relative z-30 flex flex-col items-center p-4 w-full pt-16 sm:pt-0">
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none mb-8">
            {/* ##### INÍCIO DA ALTERAÇÃO ##### */}
            <Image
              src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/empreendimento-anexos/1/OUT_1758896374993.png"
              alt="Logo Residencial Alfa"
              width={500}
              height={200}
              className="w-full max-w-xs md:max-w-md"
              priority
            />
            {/* ##### FIM DA ALTERAÇÃO ##### */}
          </div>
          <div className="bg-gray-800/50 rounded-full p-1 flex items-center">
            <button
              onClick={() => setView('investidor')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'investidor' ? 'bg-gray-700 text-white' : 'text-white'}`}
            >
              Sou Investidor
            </button>
            <button
              onClick={() => setView('morador')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${view === 'morador' ? 'bg-gray-700 text-white' : 'text-white'}`}
            >
              Quero Morar
            </button>
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 1 ======================== */}
      {/* =================================================================== */}


      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 2 ======================= */}
      {/* =================================================================== */}
      {view === 'investidor' && (
        <>
          <section className="py-16 md:py-24 bg-white">
            <div className="container mx-auto px-4 text-left">
              <h2 className="text-xl md:text-2xl font-semibold uppercase tracking-wider text-gray-500 mb-6" style={{ letterSpacing: '0.05em' }}>
                Transforme seu dinheiro em Renda Passiva
              </h2>
              <p className="text-4xl md:text-6xl font-bold text-gray-900 mb-4" style={{ letterSpacing: '0.02em' }}>
                <span className="whitespace-nowrap">Até <span style={{ color: darkGrayColor }}>R$ 4.144,25/mês</span></span>
              </p>
              <p className="max-w-3xl mb-12 text-gray-600" style={{ letterSpacing: '0.03em' }}>
                Com aluguel temporário no Residencial Alfa, em um cenário de alta ocupação (70%). Uma oportunidade única de investimento com retorno rápido e seguro.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeLocalizacao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Localização Estratégica</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Próximo ao Centro, UFJF e hospitais. O ponto mais desejado para aluguéis de curta e longa duração.</p>
                </div>
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeRentabilidade /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Demanda Elevada</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Governador Valadares recebe em média 13 mil turistas por mês, garantindo alta taxa de ocupação.</p>
                </div>
                <div className="p-6 bg-gray-100 rounded-lg shadow-sm">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeValorizacao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Valorização Garantida</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Invista no Alto Esplanada, o bairro com maior potencial de valorização da cidade, e veja seu patrimônio crescer.</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {view === 'morador' && (
        <>
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900" style={{ letterSpacing: '0.02em' }}>Um Novo Conceito de Viver Bem</h2>
                <p className="mb-4 text-gray-700" style={{ letterSpacing: '0.03em' }}>
                  O Residencial Alfa foi pensado em cada detalhe para oferecer o máximo de conforto, segurança e qualidade de vida para você e sua família.
                </p>
                <p className="text-gray-700" style={{ letterSpacing: '0.03em' }}>
                  Desfrute de uma vista privilegiada para a Ibituruna, excelente ventilação natural e a conveniência de estar perto de tudo que você precisa.
                </p>
              </div>
              <div>
                <Image src="/image_47b441.png" alt="Área de Lazer do Residencial Alfa" width={500} height={350} className="rounded-lg shadow-xl mx-auto"/>
              </div>
            </div>
          </section>

          <section className="bg-gray-50 py-16 md:py-24">
            <div className="container mx-auto px-4 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900" style={{ letterSpacing: '0.02em' }}>Diferenciais que Transformam seu Dia a Dia</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconePiscina /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Lazer Completo</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Piscina, área gourmet e tudo que você precisa para relaxar e se divertir sem sair de casa.</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeCasa /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Conforto e Sofisticação</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>Apartamentos com plantas inteligentes e acabamento de alto padrão, pensados para o seu bem-estar.</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-lg">
                  <div className="mb-4" style={{ color: darkGrayColor }}><IconeCoracao /></div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900" style={{ letterSpacing: '0.04em' }}>Qualidade de Vida</h3>
                  <p className="text-gray-600" style={{ letterSpacing: '0.03em' }}>More em um bairro tranquilo, seguro e com fácil acesso a tudo que a cidade oferece de melhor.</p>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 2 ======================== */}
      {/* =================================================================== */}


      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 3 ======================= */}
      {/* =================================================================== */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="md:order-2">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900" style={{ letterSpacing: '0.02em' }}>Projetado para seu Conforto</h2>
              <p className="mb-6 text-gray-700" style={{ letterSpacing: '0.03em' }}>
                Apartamentos de 49 m² e 58 m² com plantas inteligentes que otimizam cada espaço, oferecendo o máximo de conforto e funcionalidade.
              </p>
              <ul className="list-disc list-inside mb-6 space-y-2 text-gray-700" style={{ letterSpacing: '0.03em' }}>
                <li>2 Quartos</li>
                <li>1 Banheiro</li>
                <li>Varanda</li>
                <li>Cozinha</li>
                <li>Área de Serviço</li>
              </ul>
            </div>
             <div className="md:order-1">
                <Image 
                  src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/planta%20humanizada%20aps.png" 
                  alt="Planta Humanizada do Apartamento Alfa" 
                  width={500} 
                  height={500} 
                  className="rounded-lg shadow-xl mx-auto cursor-pointer" 
                />
                <p className="text-center text-sm mt-2 text-gray-500" style={{ letterSpacing: '0.03em' }}>Clique na imagem para ampliar</p>
            </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 3 ======================== */}
      {/* =================================================================== */}


      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 4 ======================= */}
      {/* =================================================================== */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">Localização Privilegiada</h2>
          <p className="max-w-2xl mx-auto mb-8 text-gray-600">
            Encontre o Residencial Alfa no coração do Alto Esplanada, um bairro que combina tranquilidade e acesso rápido aos principais pontos da cidade.
          </p>
          <div className="w-full h-96 rounded-lg shadow-xl overflow-hidden border">
            <iframe 
              src="http://googleusercontent.com/maps.google.com/5"
              width="100%" 
              height="100%" 
              style={{ border: 0 }} 
              allowFullScreen="" 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 4 ======================== */}
      {/* =================================================================== */}


      {/* =================================================================== */}
      {/* ======================= INÍCIO DA DOBRA 5 ======================= */}
      {/* =================================================================== */}
      <section id="contato" className="bg-gray-800 text-white py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ letterSpacing: '0.02em' }}>Gostou? Dê o primeiro passo para realizar seu sonho.</h2>
          <p className="mb-8 max-w-2xl mx-auto text-gray-300" style={{ letterSpacing: '0.03em' }}>
            Preencha o formulário abaixo e nossa equipe entrará em contato para oferecer uma consultoria exclusiva e sem compromisso.
          </p>
          <div className="max-w-xl mx-auto">
            <FormularioDeContato />
          </div>
        </div>
      </section>
      {/* =================================================================== */}
      {/* ========================= FIM DA DOBRA 5 ======================== */}
      {/* =================================================================== */}
      

      {/* =================================================================== */}
      {/* =========================== INÍCIO DO RODAPÉ ========================== */}
      {/* =================================================================== */}
      <footer className="bg-black text-white py-6">
        <div className="container mx-auto px-4 text-center text-gray-400" style={{ letterSpacing: '0.03em' }}>
          <p>© {new Date().getFullYear()} Studio 57. Todos os direitos reservados.</p>
          <p className="text-sm mt-1">Residencial Alfa - Registro de Incorporação: Nº 24.920/R-08</p>
        </div>
      </footer>
      {/* =================================================================== */}
      {/* ============================ FIM DO RODAPÉ ========================== */}
      {/* =================================================================== */}

      
      {/* BALÃO DA IA STELLA - COM MENSAGEM PRÉ-CARREGADA */}
      <a 
        href="https://wa.me/553398192119?text=Oi%2C%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20Residencial%20Alfa"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 transform hover:scale-110 transition-transform duration-300"
        aria-label="Converse com a Stella no WhatsApp"
      >
        <div className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center">
          <Image 
            src="https://vhuvnutzklhskkwbpxdz.supabase.co/storage/v1/object/public/materiais-alfa/stella.jpeg" 
            alt="Converse com a Stella" 
            width={64}
            height={64}
            className="w-full h-full rounded-full object-cover"
          />
        </div>
      </a>
    </div>
  );
}
// Caminho do arquivo: app/(landingpages)/elo57/obrigado/page.js
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function PaginaObrigadoElo57() {
  const primaryColor = '#111827'; // Slate escuro / Preto

  return (
    <div 
      className="h-screen flex flex-col items-center justify-center text-white text-center p-6"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="animate-bounce mb-6">
        <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-[#f25a2f]" />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-md">Pré-cadastro Realizado!</h1>
      
      <p className="text-lg md:text-xl max-w-2xl mb-12 text-slate-300 font-light leading-relaxed">
        Suas informações foram salvas em nosso CRM com sucesso. Você está oficialmente na nossa **Lista de Espera** e receberá em breve o e-mail de confirmação e as novidades para o evento de teste de pré-lançamento do **dia 19 de Agosto**.
      </p>

      <Link href="/elo57">
        <div className="bg-[#f25a2f] hover:bg-[#e04f25] py-4 px-10 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-xl cursor-pointer uppercase tracking-wider text-white">
          Voltar para o Elo 57
        </div>
      </Link>
    </div>
  );
}

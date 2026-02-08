// Caminho do arquivo: app/(landingpages)/refugiobraunas/obrigado/page.js
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function PaginaObrigado() {
  // O Verde da identidade visual do Refúgio Braúnas
  const primaryColor = '#2c5234';

  return (
    <div 
        className="h-screen flex flex-col items-center justify-center text-white text-center p-4"
        style={{ backgroundColor: primaryColor }} // Fundo Verde
    >
      <div className="animate-bounce mb-6">
        <FontAwesomeIcon icon={faCheckCircle} className="text-6xl text-green-300/80" />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold mb-4 drop-shadow-md">Obrigado!</h1>
      
      <p className="text-lg md:text-xl max-w-2xl mb-12 text-green-50 font-light">
        Recebemos suas informações com sucesso. Assim que estiver disponível enviaremos uma mensagem para você.
      </p>

      {/* Botão Branco para contrastar com o fundo Verde */}
      <Link href="/">
        <div
            className="bg-white hover:bg-green-50 py-4 px-10 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-xl cursor-pointer uppercase tracking-wider"
            style={{ color: primaryColor }}
        >
          Voltar para o Início
        </div>
      </Link>
    </div>
  );
}
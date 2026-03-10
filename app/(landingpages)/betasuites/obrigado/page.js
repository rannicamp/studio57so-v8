// Caminho: app/(landingpages)/betasuites/obrigado/page.js
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle } from '@fortawesome/free-solid-svg-icons';

export default function ObrigadoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-center p-6 font-sans">
      
      <div className="mb-6 text-orange-500 animate-bounce">
        <FontAwesomeIcon icon={faCheckCircle} className="text-6xl" />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Obrigado!</h1>
      
      <p className="text-xl text-gray-300 max-w-md mx-auto leading-relaxed">
        Seu interesse no <strong className="text-orange-500">Beta Suítes</strong> foi registrado com sucesso.
      </p>
      
      <p className="mt-4 text-gray-400 max-w-md mx-auto">
        Nossa equipe de especialistas entrará em contato em breve para apresentar as condições exclusivas de pré-lançamento.
      </p>
      
      <Link 
        href="/betasuites" 
        className="mt-10 inline-block bg-orange-500 text-white font-bold py-3 px-8 rounded-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg uppercase tracking-wider"
      >
          Voltar para o Início
      </Link>
      
    </div>
  );
}
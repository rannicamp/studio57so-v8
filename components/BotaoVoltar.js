// components/BotaoVoltar.js
'use client'; // ESSENCIAL: Isso diz ao Next.js que é um Componente de Cliente

import { useRouter } from 'next/navigation'; // Importa o hook de roteamento do App Router
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function BotaoVoltar() {
  const router = useRouter();

  // Função que será chamada ao clicar no botão
  const handleVoltar = () => {
    router.back(); // Navega para a página anterior no histórico do navegador
  };

  return (
    <button
      onClick={handleVoltar}
      className="mb-4 inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200"
      aria-label="Voltar para a página anterior"
    >
      <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-4 w-4" />
      Voltar
    </button>
  );
}
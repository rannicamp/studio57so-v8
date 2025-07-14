"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVial, faSpinner, faPaperPlane } from '@fortawesome/free-solid-svg-icons';


export default function HomePage() {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);

  const handleFileChange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
          setFile(e.target.files[0]);
          setApiResponse(null);
      }
  };

  const handleTestSubmit = async () => {
      // O endpoint /api/debug-env não precisa de um arquivo.
      // O teste com arquivo está no contexto de outra API, não nesta.
      // Então, removemos a validação de 'file' e o envio de 'formData'.

      setIsLoading(true);
      setApiResponse(null);

      try {
          // Chama a API de debug com o método GET, que é o que ela espera
          const response = await fetch('/api/debug-env', {
              method: 'GET', // <--- CORREÇÃO AQUI: Mudado para GET
              // body: formData, // <--- REMOVIDO: Não precisamos enviar um corpo para uma requisição GET
          });
          const result = await response.json();
          setApiResponse(result);
      } catch (error) {
          setApiResponse({
              sucesso: false,
              passo: "Erro de Conexão com a API",
              mensagem: error.message
          });
      } finally {
          setIsLoading(false);
      }
  };


  return (
    <main className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard de Teste</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto border space-y-4">
        <h2 className="text-xl font-semibold mb-3 text-gray-800 flex items-center justify-center gap-2">
            <FontAwesomeIcon icon={faVial} />
            Teste de Upload e Salvamento de Anexo
        </h2>

        {/* Removido o input de arquivo, pois o teste /api/debug-env não o utiliza.
            Este teste é apenas para verificar as variáveis de ambiente.
            O teste de upload de anexo real é feito via chat do WhatsApp.
        */}
        <p className="text-sm text-gray-600">Este teste verifica se as variáveis de ambiente do servidor estão configuradas corretamente.</p>
        
        <button
            onClick={handleTestSubmit}
            disabled={isLoading} // Removida a dependência de 'file' aqui também
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold text-lg"
        >
            <FontAwesomeIcon icon={isLoading ? faSpinner : faPaperPlane} spin={isLoading} />
            {isLoading ? 'Executando Teste...' : 'Iniciar Teste e Ver Resultado'}
        </button>

      </div>
      
      {apiResponse && (
        <div className="bg-gray-800 text-white p-6 rounded-lg shadow-inner max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold mb-3 border-b border-gray-600 pb-2 text-left">Resultado da API de Depuração:</h3>
            <pre className="text-sm whitespace-pre-wrap text-left">
              <code>{JSON.stringify(apiResponse, null, 2)}</code>
            </pre>
        </div>
      )}

    </main>
  );
}
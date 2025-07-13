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
      if (!file) {
          alert("Por favor, selecione um arquivo para testar.");
          return;
      }
      setIsLoading(true);
      setApiResponse(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
          // Chama a API de debug com o método POST
          const response = await fetch('/api/debug-env', {
              method: 'POST',
              body: formData,
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

        <div>
            <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-1 text-left">
                1. Selecione um arquivo de teste
            </label>
            <input 
                id="file-input"
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 hover:file:bg-blue-100"
            />
        </div>
        
        <button
            onClick={handleTestSubmit}
            disabled={!file || isLoading}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold text-lg"
        >
            <FontAwesomeIcon icon={isLoading ? faSpinner : faPaperPlane} spin={isLoading} />
            {isLoading ? 'Executando Teste...' : '2. Iniciar Teste e Ver Resultado'}
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
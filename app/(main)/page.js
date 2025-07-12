"use client";

import { useState } from 'react';

export default function HomePage() {
  const [apiResponse, setApiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    setIsLoading(true);
    setApiResponse('Enviando...');

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '5533991912291',
          type: 'text',
          text: 'Teste final com logging detalhado. 🚀'
        }),
      });

      const result = await response.json();
      
      // Transforma o objeto de resposta em uma string formatada para fácil leitura
      const formattedResponse = JSON.stringify(result, null, 2);
      
      setApiResponse(formattedResponse);

    } catch (error) {
      setApiResponse(`FALHA NA REQUISIÇÃO: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="text-center space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard de Teste</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto border">
        <h2 className="text-xl font-semibold mb-3 text-gray-800">Teste de Envio e Salvamento</h2>
        <button 
          onClick={handleSendMessage}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 w-full disabled:bg-gray-400"
        >
          {isLoading ? 'Enviando...' : 'Enviar Mensagem e Ver Resposta'}
        </button>
        {apiResponse && (
            <div className="mt-4 text-left">
              <label className="font-semibold">Resposta da API:</label>
              <pre className="bg-gray-100 p-4 rounded-md text-xs whitespace-pre-wrap">
                <code>{apiResponse}</code>
              </pre>
            </div>
        )}
      </div>
    </main>
  );
}
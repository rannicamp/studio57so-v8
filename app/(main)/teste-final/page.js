"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVial, faSpinner, faPlay } from '@fortawesome/free-solid-svg-icons';

export default function TesteFinalPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState(null);

    const handleTestSubmit = async () => {
        setIsLoading(true);
        setApiResponse(null);

        try {
            const response = await fetch('/api/final-test', { method: 'POST' });
            // Não importa o status, tentamos ler a resposta como JSON
            const result = await response.json();
            setApiResponse(result);
        } catch (error) {
            // Se falhar até para ler o JSON, significa que a resposta veio vazia.
            setApiResponse({
                sucesso: false,
                etapa: "Conexão com a API",
                mensagem: "Falha crítica. A API retornou uma resposta vazia ou inválida, provavelmente por um erro fatal no servidor. Verifique os logs da Vercel.",
                detalhe_tecnico: error.toString()
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
                    <FontAwesomeIcon icon={faVial} />
                    Teste Final de Conexão com Banco
                </h1>
                <p className="text-gray-600 mt-2">
                    Esta página executa o teste mais simples possível: uma única tentativa de salvar um registro no banco de dados usando a chave de serviço.
                </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border space-y-4">
                <button
                    onClick={handleTestSubmit}
                    disabled={isLoading}
                    className="w-full bg-red-600 text-white px-6 py-3 rounded-md shadow-sm hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold text-lg"
                >
                    <FontAwesomeIcon icon={isLoading ? faSpinner : faPlay} spin={isLoading} />
                    {isLoading ? 'Executando Teste...' : 'Iniciar Teste Definitivo'}
                </button>
            </div>

            {apiResponse && (
                <div className={`p-6 rounded-lg shadow-inner ${apiResponse.sucesso ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'}`}>
                    <h3 className="text-xl font-semibold mb-3 border-b border-gray-600 pb-2">Resultado Detalhado:</h3>
                    <pre className="text-sm whitespace-pre-wrap">
                        <code>{JSON.stringify(apiResponse, null, 2)}</code>
                    </pre>
                </div>
            )}
        </div>
    );
}
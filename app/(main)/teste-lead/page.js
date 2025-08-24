"use client";

import { useState, useEffect } from 'react';
import { useLayout } from '../../../../contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVial, faSpinner, faPlayCircle } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';

export default function TesteLeadPage() {
    const { setPageTitle } = useLayout();
    const [isLoading, setIsLoading] = useState(false);
    const [apiResponse, setApiResponse] = useState(null);

    useEffect(() => {
        setPageTitle("Página de Teste de Leads");
    }, [setPageTitle]);

    const handleTestSubmit = async () => {
        setIsLoading(true);
        setApiResponse(null);

        try {
            // Este fetch chama a API de simulação que criamos no Passo 1
            const response = await fetch('/api/test-lead', { method: 'POST' });
            const result = await response.json();
            setApiResponse(result);
        } catch (error) {
            setApiResponse({
                success: false,
                error: `Falha crítica ao chamar a API de teste: ${error.message}`
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
                    Simulador de Recebimento de Leads
                </h1>
                <p className="text-gray-600 mt-2">
                    Clique no botão abaixo para simular a chegada de um novo lead do Facebook/Instagram com dados de teste.
                </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md border space-y-4">
                <button
                    onClick={handleTestSubmit}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold text-lg"
                >
                    <FontAwesomeIcon icon={isLoading ? faSpinner : faPlayCircle} spin={isLoading} />
                    {isLoading ? 'Enviando Lead de Teste...' : 'Gerar e Enviar Lead de Teste'}
                </button>
            </div>

            {apiResponse && (
                <div className={`p-6 rounded-lg shadow-inner ${apiResponse.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <h3 className="text-xl font-semibold mb-3 border-b pb-2">Resultado da Simulação:</h3>
                    <pre className="text-sm whitespace-pre-wrap">
                        <code>{JSON.stringify(apiResponse, null, 2)}</code>
                    </pre>
                    {apiResponse.success && (
                        <div className="mt-4 text-center">
                            <Link href="/crm" className="bg-green-700 text-white font-bold py-2 px-6 rounded-md hover:bg-green-800">
                                Ir para o Funil de Vendas para ver o resultado &rarr;
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
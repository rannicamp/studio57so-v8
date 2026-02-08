"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BelvoWidget({ disabled }) {
    const [loading, setLoading] = useState(false);

    const handleConnect = async () => {
        setLoading(true);
        const toastId = toast.loading("A preparar conexão bancária segura...");

        try {
            const response = await fetch('/api/belvo/token', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Falha ao gerar acesso');

            // URL do Hosted Widget com parâmetros de inicialização
            const belvoUrl = `https://widget.belvo.io/?access_token=${data.access}&locale=pt&integration_type=openfinance&country_codes=BR`;

            // Redireciona para o ambiente seguro da Belvo
            window.location.href = belvoUrl;

        } catch (error) {
            console.error(error);
            toast.error(`Erro: ${error.message}`, { id: toastId });
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleConnect}
            disabled={disabled || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition-all shadow-md"
        >
            {loading ? (
                <> <FontAwesomeIcon icon={faSpinner} spin /> A Redirecionar... </>
            ) : (
                <> <FontAwesomeIcon icon={faBuildingColumns} /> Conectar Banco </>
            )}
        </button>
    );
}
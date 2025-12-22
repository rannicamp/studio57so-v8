"use client";

import { useState } from 'react';
import Script from 'next/script';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BelvoWidget({ onSuccess, onExit, disabled }) {
    const [loading, setLoading] = useState(false);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    const handleLaunch = async () => {
        if (!scriptLoaded || typeof window.belvo === 'undefined') {
            return toast.error("O sistema bancário ainda está carregando. Aguarde 2 segundos.");
        }

        setLoading(true);

        try {
            // 1. Busca o Token no nosso Backend (usando as chaves salvas no banco)
            const response = await fetch('/api/belvo/token', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao gerar token de acesso');
            }

            // 2. Configura e Abre o Widget
            const belvo = window.belvo.createWidget(
                data.access, // O token de acesso que veio do backend
                {
                    locale: 'pt',
                    country_codes: ['BR'],
                    callback: (link, institution) => {
                        setLoading(false);
                        if (onSuccess) onSuccess(link, institution);
                    },
                    onExit: (data) => {
                        setLoading(false);
                        if (onExit) onExit(data);
                    },
                    onEvent: (data) => console.log('Belvo Event:', data)
                }
            );

            belvo.build(); // Abre a janela

        } catch (error) {
            console.error(error);
            toast.error(`Erro: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <>
            <Script 
                src="https://cdn.belvo.io/belvo-widget-1-stable.js"
                strategy="lazyOnload"
                onLoad={() => {
                    console.log("Belvo Script Carregado!");
                    setScriptLoaded(true);
                }}
                onError={() => toast.error("Erro ao carregar script bancário. Verifique seu bloqueador de anúncios.")}
            />

            <button 
                onClick={handleLaunch}
                disabled={disabled || loading || !scriptLoaded}
                className={`flex-1 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border ${
                    !scriptLoaded 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' 
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                }`}
            >
                {loading ? (
                    <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Abrindo Banco...
                    </>
                ) : !scriptLoaded ? (
                    <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Carregando Sistema...
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon={faLink} />
                        Conectar Banco
                    </>
                )}
            </button>
        </>
    );
}
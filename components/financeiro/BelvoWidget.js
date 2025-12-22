"use client";

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSpinner, faCheck } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BelvoWidget({ onSuccess, onExit, disabled }) {
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const intervalRef = useRef(null);

    // Radar para detectar a Belvo
    useEffect(() => {
        // Se já existe, marca como pronto
        if (typeof window !== 'undefined' && window.belvo) {
            setReady(true);
            return;
        }

        // Se não, verifica a cada 500ms
        intervalRef.current = setInterval(() => {
            if (window.belvo) {
                console.log("✅ Belvo detectada pelo Radar!");
                setReady(true);
                clearInterval(intervalRef.current);
            }
        }, 500);

        // Limpeza (para não deixar o radar rodando pra sempre)
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const handleLaunch = async () => {
        if (!ready) {
            // Tenta forçar uma última verificação
            if (window.belvo) {
                setReady(true);
            } else {
                return toast.warning("O sistema bancário está terminando de carregar. Aguarde um instante...");
            }
        }

        setLoading(true);

        try {
            // 1. Busca o Token
            const response = await fetch('/api/belvo/token', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao gerar token de acesso');
            }

            // 2. Abre o Widget
            const belvo = window.belvo.createWidget(
                data.access,
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
                    onEvent: (data) => {
                        console.log('Belvo Event:', data);
                    }
                }
            );

            belvo.build();

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
            />

            <button 
                onClick={handleLaunch}
                disabled={disabled || loading || !ready}
                className={`flex-1 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border ${
                    !ready 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' 
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                }`}
            >
                {loading ? (
                    <> <FontAwesomeIcon icon={faSpinner} spin /> Abrindo... </>
                ) : !ready ? (
                    <> <FontAwesomeIcon icon={faSpinner} spin /> Carregando... </>
                ) : (
                    <> <FontAwesomeIcon icon={faLink} /> Conectar Banco </>
                )}
            </button>
        </>
    );
}
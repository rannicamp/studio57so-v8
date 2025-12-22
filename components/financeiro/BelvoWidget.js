"use client";

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faSpinner, faCheck, faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BelvoWidget({ onSuccess, onExit, disabled }) {
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const intervalRef = useRef(null);

    // Radar para detectar a Belvo
    useEffect(() => {
        if (typeof window !== 'undefined' && window.belvo) {
            setReady(true);
            return;
        }

        intervalRef.current = setInterval(() => {
            if (window.belvo) {
                console.log("✅ Belvo detectada pelo Radar!");
                setReady(true);
                clearInterval(intervalRef.current);
            }
        }, 500);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const handleLaunch = async () => {
        if (!ready) {
            if (window.belvo) {
                setReady(true);
            } else {
                return toast.warning("O sistema bancário está terminando de carregar. Aguarde um instante...");
            }
        }

        setLoading(true);

        try {
            // 1. Busca o Token no Backend
            const response = await fetch('/api/belvo/token', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erro ao gerar token de acesso');
            }

            // 2. Abre o Widget com as configurações OFDA (Baseado na documentação)
            const belvo = window.belvo.createWidget(
                data.access,
                {
                    // Configurações Visuais e de Comportamento
                    locale: 'pt', // Força Português
                    country_codes: ['BR'], // Apenas Brasil
                    
                    // --- O PULO DO GATO (Configurações OFDA) ---
                    integration_type: 'openfinance', // Essencial para o token que geramos funcionar!
                    institution_types: ['retail', 'business'], // Mostra bancos PF e PJ
                    access_mode: 'recurrent', // Link recorrente (padrão)
                    
                    // Callbacks
                    callback: (link, institution) => {
                        setLoading(false);
                        console.log('Sucesso Belvo:', link, institution);
                        if (onSuccess) onSuccess(link, institution);
                    },
                    onExit: (data) => {
                        setLoading(false);
                        console.log('Saída Belvo:', data);
                        if (onExit) onExit(data);
                    },
                    onEvent: (data) => {
                        console.log('Evento Belvo:', data);
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
                        : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm'
                }`}
            >
                {loading ? (
                    <> <FontAwesomeIcon icon={faSpinner} spin /> Abrindo... </>
                ) : !ready ? (
                    <> <FontAwesomeIcon icon={faSpinner} spin /> Carregando... </>
                ) : (
                    <> <FontAwesomeIcon icon={faBuildingColumns} /> Conectar Banco </>
                )}
            </button>
        </>
    );
}
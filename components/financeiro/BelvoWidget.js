"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBuildingColumns } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function BelvoWidget({ disabled }) {
    const [loading, setLoading] = useState(false);

    const handleOpenHostedWidget = async () => {
        setLoading(true);
        // Toast de carregamento que não some sozinho até a página mudar
        toast.loading("Iniciando ambiente seguro do banco...", { duration: 10000 });

        try {
            // 1. Pede o Token
            const response = await fetch('/api/belvo/token', { method: 'POST' });
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Erro ao iniciar');

            // 2. Monta a URL Segura da Belvo
            const belvoUrl = `https://widget.belvo.io/?access_token=${data.access}&locale=pt&institution_types=retail,business&integration_type=openfinance&institutions=ofmockbank_br_retail`;

            // 3. Redirecionamento Completo (Navegação)
            // Isso evita 100% dos bloqueios de navegador
            window.location.href = belvoUrl;

        } catch (error) {
            console.error(error);
            toast.dismiss(); // Remove o loading se der erro
            toast.error(`Erro: ${error.message}`);
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleOpenHostedWidget}
            disabled={disabled || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-blue-700 shadow-sm"
        >
            {loading ? (
                <> <FontAwesomeIcon icon={faSpinner} spin /> Redirecionando... </>
            ) : (
                <> <FontAwesomeIcon icon={faBuildingColumns} /> Conectar Banco </>
            )}
        </button>
    );
}
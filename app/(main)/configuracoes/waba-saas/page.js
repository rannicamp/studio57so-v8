'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { faCheckCircle, faSpinner, faPlug, faShieldAlt } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function WabaSaasConfigPage() {
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [configStatus, setConfigStatus] = useState('disconnected'); // loading, connected, disconnected
    const [integrationData, setIntegrationData] = useState(null);

    const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '1518358099511142';

    useEffect(() => {
        // Inicializa SDK Assíncrono
        window.fbAsyncInit = function () {
            window.FB.init({
                appId: fbAppId,
                cookie: true,
                xfbml: true,
                version: 'v22.0'
            });
            setIsSdkLoaded(true);
            console.log("Facebook SDK Inicializado com sucesso!");
        };
    }, [fbAppId]);

    const handleConnectWhatsApp = () => {
        if (!isSdkLoaded) {
            toast.error("Processando comunicação com a Meta. Tente novamente em alguns segundos.");
            return;
        }

        setIsConnecting(true);

        window.FB.login((response) => {
            if (response.authResponse) {
                const tempToken = response.authResponse.accessToken;
                exchangeTokenWithBackend(tempToken);
            } else {
                toast.error("O processo de aprovação foi cancelado.");
                setIsConnecting(false);
            }
        }, {
            scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
            extras: { feature: 'whatsapp_embedded_signup' }
        });
    };

    const exchangeTokenWithBackend = async (shortLivedToken) => {
        try {
            toast.loading("Aprovação detectada! Construindo roteamento e tecendo banco de dados...", { id: 'oauth-toast' });
            
            const res = await fetch('/api/meta/waba-oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: shortLivedToken })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "A API da Meta recusou a configuração.");
            }

            toast.success("WhatsApp conectado com sucesso aos servidores da Elo 57!", { id: 'oauth-toast' });
            setConfigStatus('connected');
            setIntegrationData(data);
        } catch (error) {
            console.error(error);
            toast.error(error.message, { id: 'oauth-toast' });
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto animate-in fade-in duration-300">
            <Script
                src="https://connect.facebook.net/pt_BR/sdk.js"
                strategy="lazyOnload"
                crossOrigin="anonymous"
                onLoad={() => setIsSdkLoaded(true)}
            />

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-[#25D366]" />
                    WhatsApp Corporativo (Múltiplas Operações)
                </h1>
                <p className="text-gray-500 mt-2">
                    Conecte o número de WhatsApp oficial da sua empresa sem precisar de programação. Nós faremos o vínculo criptografado usando os servidores oficias da Meta.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
                {configStatus === 'loading' && (
                    <div className="flex flex-col items-center gap-4 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin size="3x" />
                        <p>Inspecionando banco de dados...</p>
                    </div>
                )}

                {configStatus === 'connected' && (
                    <div className="flex flex-col items-center w-full gap-4 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500 mb-2 shadow-sm border-4 border-white ring-2 ring-green-100">
                            <FontAwesomeIcon icon={faCheckCircle} size="3x" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Conectado e Operacional!</h2>
                        <p className="text-gray-500 max-w-md">
                            O seu WhatsApp Business agora é operado pela Inteligência do nosso sistema.
                        </p>

                        {/* Detalhes da Integração (Debug amigável) */}
                        {integrationData && (
                            <div className="w-full max-w-md text-left bg-gray-50 border border-gray-100 rounded-lg p-4 mt-4 shadow-inner">
                                <ul className="text-sm font-medium text-gray-600 space-y-2">
                                    <li><strong className="text-gray-800">Telefone Conectado:</strong> {integrationData.phone?.display_phone_number || "Número não informado"}</li>
                                    <li><strong className="text-gray-800">Selo de Qualidade:</strong> {integrationData.phone?.verified_name || "Mapeado com Sucesso"}</li>
                                    <li className="mt-2 text-xs text-gray-400">Roteamento WABA: {integrationData.waba?.id}</li>
                                </ul>
                            </div>
                        )}

                        <button 
                            className="mt-6 px-6 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 font-semibold rounded-lg transition-colors border shadow-sm"
                            onClick={() => {
                                setConfigStatus('disconnected');
                                setIntegrationData(null);
                            }}
                        >
                            Resetar Credenciais / Vincular Novo Número
                        </button>
                    </div>
                )}

                {configStatus === 'disconnected' && (
                    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                        <div className="w-20 h-20 bg-[#25D366]/10 rounded-full flex items-center justify-center text-[#25D366] mb-2 relative">
                            <FontAwesomeIcon icon={faPlug} size="2x" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Nenhum Número Oficial Vinculado</h2>
                        <p className="text-gray-500 max-w-md mb-6">
                            Você precisa ter uma página no Facebook e uma conta comercial (Instagram ou Business Manager) para autorizar envios oficiais da API em nome do seu telefone de trabalho.
                        </p>
                        
                        <button
                            onClick={handleConnectWhatsApp}
                            disabled={!isSdkLoaded || isConnecting}
                            className="flex items-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-[#1877F2]/60 text-white font-bold py-4 px-8 rounded-xl shadow-[0_4px_14px_0_rgba(24,119,242,0.39)] hover:shadow-[0_6px_20px_rgba(24,119,242,0.23)] transition-all active:scale-95 duration-200"
                        >
                            {isConnecting ? (
                                <FontAwesomeIcon icon={faSpinner} spin />
                            ) : (
                                <FontAwesomeIcon icon={faShieldAlt} />
                            )}
                            {isConnecting ? "Validando Segurança..." : "Autorizar Integração da Meta"}
                        </button>

                        <p className="text-xs text-gray-400 font-medium mt-4 max-w-[280px] text-center bg-gray-50 border p-3 rounded-lg border-dashed">
                            Um Pop-Up seguro da Meta® será aberto solicitando a autorização ao nosso Aplicativo Verificado.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { MessageCircle, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function WabaSaasTestPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Na arquitetura, definimos o APP WABA Oficial (o mesmo aprovado na Meta)
    const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID_WA || '1459952825742829';

    useEffect(() => {
        window.fbAsyncInit = function () {
            window.FB.init({
                appId: fbAppId,
                cookie: true,
                xfbml: true,
                version: 'v21.0'
            });
            console.log("[WABA SaaS Lab] Facebook SDK Inicializado!");
        };
    }, [fbAppId]);

    const handleConnectClick = () => {
        if (typeof window === 'undefined' || !window.FB) {
            toast.error("O Facebook SDK ainda não carregou.");
            return;
        }

        setLoading(true);

        window.FB.login((response) => {
            if (response.authResponse) {
                const accessToken = response.authResponse.accessToken;
                toast.success("Token OAUTH recebido! Trocando no Backend...");
                
                trocarTokenNoServidor(accessToken);
            } else {
                setLoading(false);
                toast.error("Login cancelado ou não concluído.");
            }
        }, {
            // As permissões rigorosas que habilitamos na Meta
            scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
            extras: { feature: 'whatsapp_embedded_signup' }
        });
    };

    const trocarTokenNoServidor = async (accessToken) => {
        try {
            // Usamos a flag test=true para indicar no backend que estamos injetando isto no laboratório
            const res = await fetch('/api/meta/waba-oauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken, isTestMode: true })
            });
            
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Erro na troca de token local');
            
            setResult(data);
            toast.success("Integração WABA completa! Dados retornados com sucesso.");
        } catch (error) {
            console.error(error);
            toast.error(`Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto animate-in fade-in duration-300">
            <Script
                src="https://connect.facebook.net/pt_BR/sdk.js"
                strategy="lazyOnload"
                crossOrigin="anonymous"
            />
            
            <div className="bg-white border rounded-3xl p-10 shadow-sm text-center">
                <div className="w-20 h-20 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#25D366]/30 mx-auto mb-6">
                    <MessageCircle size={36} strokeWidth={2} />
                </div>
                
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Laboratório WABA SaaS</h1>
                <p className="text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
                    Central isolada de desenvolvimento para integrar o Embedded Signup da Meta. 
                    Esta página fará a troca do Token Oauth temporário pelo Long-Lived e atrelará o Phone_Number_Id no BD.
                </p>

                {!result ? (
                    <button
                        onClick={handleConnectClick}
                        disabled={loading}
                        className="bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 px-8 rounded-xl flex flex-row items-center gap-3 justify-center w-full max-w-sm mx-auto transition-transform active:scale-95 disabled:opacity-50 shadow-md"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <><MessageCircle size={24} /> Simular Login Meta <ArrowRight size={20} /></>}
                    </button>
                ) : (
                    <div className="text-left bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-6 relative overflow-hidden animate-in zoom-in-95">
                        <div className="absolute top-0 right-0 p-4">
                            <CheckCircle size={32} className="text-[#25D366]" />
                        </div>
                        <h3 className="font-bold text-lg mb-4 text-[#25D366]">Sucesso! Resposta do Backend (/api/meta/waba-oauth):</h3>
                        <pre className="text-xs font-mono bg-gray-900 text-green-400 p-4 rounded-xl overflow-x-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                        
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => setResult(null)}
                                className="text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                Resetar e Tentar Novamente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

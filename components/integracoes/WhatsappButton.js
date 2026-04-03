'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { MessageCircle, RefreshCw, CheckCircle, LogOut, ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function WhatsappButton({ initialData, organizacaoId }) {
 const router = useRouter();
 const supabase = createClient();

 const [isConnected, setIsConnected] = useState(!!initialData);
 const [loading, setLoading] = useState(false);

 // O ID do App de WhatsApp (Vem do seu .env.local: 2052352668968564)
 const fbAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID_WA;

 // Inicializa o Facebook SDK assim que o script terminar de baixar
 useEffect(() => {
 window.fbAsyncInit = function () {
 window.FB.init({
 appId: fbAppId,
 cookie: true,
 xfbml: true,
 version: 'v21.0' // ou v22.0, dependendo da versão mais recente que a Meta liberou
 });
 console.log("[WhatsApp] Facebook SDK Inicializado com sucesso!");
 };
 }, [fbAppId]);

 const handleConnect = () => {
 // Verifica se o SDK do Facebook já terminou de carregar
 if (typeof window === 'undefined' || !window.FB) {
 toast.error("O Facebook ainda está carregando. Aguarde um segundo e tente novamente.");
 return;
 }

 setLoading(true);

 // Dispara o Pop-up Mágico do Facebook (Embedded Signup)
 window.FB.login((response) => {
 if (response.authResponse) {
 const accessToken = response.authResponse.accessToken;

 toast.loading("Configurando seu WhatsApp...", { id: 'wa-connect' });

 // Manda o token temporário para o nosso "Negociador" no backend
 fetch('/api/whatsapp/conectar', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ accessToken, organizacaoId })
 })
 .then(res => res.json())
 .then(data => {
 if (data.error) throw new Error(data.error);

 toast.success("WhatsApp conectado com sucesso!", { id: 'wa-connect' });
 setIsConnected(true);
 router.refresh();
 })
 .catch(err => {
 console.error(err);
 toast.error(`Erro: ${err.message}`, { id: 'wa-connect' });
 })
 .finally(() => {
 setLoading(false);
 });

 } else {
 setLoading(false);
 toast.error("Você cancelou a conexão.");
 }
 }, {
 // As permissões rigorosas necessárias para o WhatsApp Business
 scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
 extras: { feature: 'whatsapp_embedded_signup' }
 });
 };

 const handleDisconnect = async () => {
 if (!confirm("Tem certeza? O Elo 57 deixará de enviar e receber mensagens deste número.")) return;

 setLoading(true);
 try {
 const { error } = await supabase
 .from('configuracoes_whatsapp')
 .delete()
 .eq('organizacao_id', organizacaoId);

 if (error) throw error;

 toast.success('WhatsApp desconectado!');
 setIsConnected(false);
 router.refresh();
 } catch (error) {
 toast.error('Erro ao desconectar WhatsApp.');
 } finally {
 setLoading(false);
 }
 };

 return (
 <>
 {/* INJEÇÃO DO SDK DO FACEBOOK (Carrega silenciosamente sem travar a tela) */}
 <Script
 src="https://connect.facebook.net/pt_BR/sdk.js"
 strategy="lazyOnload"
 crossOrigin="anonymous"
 />

 <div className={`border rounded-2xl p-8 shadow-sm transition-all h-full flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300 delay-75 ${isConnected ? 'bg-emerald-50/50 border-emerald-200 hover:shadow-md' : 'bg-white hover:shadow-lg hover:border-emerald-200 hover:-translate-y-1'}`}>
 <div>
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
 <MessageCircle size={26} strokeWidth={2} />
 </div>
 <div>
 <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#25D366] transition-colors">WhatsApp API</h3>
 <p className="text-sm text-gray-500">Conexão Oficial da Meta</p>
 </div>
 </div>
 {isConnected && (
 <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border border-emerald-200">
 <CheckCircle size={14} /> ATIVO
 </div>
 )}
 </div>

 {isConnected ? (
 <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm text-center mb-6">
 <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 block">Status do Número</span>
 <div className="font-bold text-gray-800 text-sm mt-1 px-2">
 Prontinho! Número e Webhook configurados e operando.
 </div>
 </div>
 ) : (
 <p className="text-sm text-gray-600 mb-6 leading-relaxed">
 Acesse a nova API Oficial com 1 clique. Nós configuramos servidor, webhook e chaves para você enviar e receber mensagens livremente!
 </p>
 )}
 </div>

 <div className="mt-auto pt-6 border-t border-gray-100/50">
 {isConnected ? (
 <button
 onClick={handleDisconnect}
 disabled={loading}
 className="w-full py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-sm focus:ring-4 focus:ring-red-100 disabled:opacity-50"
 >
 {loading ? <RefreshCw className="animate-spin" size={18} /> : <><LogOut size={18} /> Desconectar Número</>}
 </button>
 ) : (
 <button
 onClick={handleConnect}
 disabled={loading}
 className="w-full py-3 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-emerald-500/30 hover:shadow-lg focus:ring-4 focus:ring-emerald-100 disabled:opacity-50 active:scale-[0.98]"
 >
 {loading ? <RefreshCw className="animate-spin" size={18} /> : <>Conectar WhatsApp <ArrowRight size={18} /></>}
 </button>
 )}
 </div>
 </div>
 </>
 );
}
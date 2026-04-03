'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Facebook, RefreshCw, CheckCircle, LogOut, ArrowRight } from 'lucide-react';

export default function FacebookButton({ isConnected, accountName }) {
 const router = useRouter();
 const [loading, setLoading] = useState(false);

 // Conectar: Pede a URL ao servidor e redireciona o usuário (Abre janela ANTES do fetch para o navegador não bloquear)
 const handleConnect = async () => {
 setLoading(true);

 // Abre uma janela vazia instantaneamente no CLICK (Bypass no Popup Blocker)
 const width = 600;
 const height = 700;
 const left = (window.screen.width / 2) - (width / 2);
 const top = (window.screen.height / 2) - (height / 2);
 const authWindow = window.open('about:blank', 'MetaAuth', `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`);

 try {
 const res = await fetch('/api/meta/conectar');
 const data = await res.json();

 if (data.url && authWindow) {
 // Injeta a URL do Facebook na janela em branco que já foi permitida pelo navegador
 authWindow.location.href = data.url;

 // Ouve a resposta do Popup (Success ou Error)
 const messageHandler = (event) => {
 if (event.data === 'fb_oauth_success') {
 window.removeEventListener('message', messageHandler);
 router.push('/configuracoes/integracoes?step=select_page&success=true');
 router.refresh(); // Tira o cache para a tela reagir à nova data do banco!!!
 } else if (event.data === 'fb_oauth_error') {
 window.removeEventListener('message', messageHandler);
 alert('A conexão falhou ou foi cancelada. Tente novamente.');
 setLoading(false);
 }
 };

 window.addEventListener('message', messageHandler);
 } else {
 if (authWindow) authWindow.close();
 alert('Erro ao iniciar conexão com servidor.');
 setLoading(false);
 }
 } catch (error) {
 if (authWindow) authWindow.close();
 console.error(error);
 alert('Erro de conexão com o servidor.');
 setLoading(false);
 }
 };

 // Desconectar: Chama a API para limpar o banco
 const handleDisconnect = async () => {
 if (!confirm("Tem certeza? Os leads pararão de ser sincronizados.")) return;

 setLoading(true);
 try {
 const res = await fetch('/api/meta/conectar', { method: 'DELETE' });
 if (res.ok) {
 window.location.reload(); // Força a tela inteira a limpar o cache do Next.js
 } else {
 throw new Error('Falha ao desconectar');
 }
 } catch (error) {
 alert(error.message);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className={`border rounded-2xl p-8 shadow-sm transition-all h-full flex flex-col justify-between animate-in fade-in zoom-in-95 duration-300 ${isConnected ? 'bg-indigo-50/50 border-indigo-200 hover:shadow-md' : 'bg-white hover:shadow-lg hover:border-blue-200 hover:-translate-y-1'}`}>
 <div>
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-[#1877F2] rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
 <Facebook size={26} fill="currentColor" strokeWidth={1} />
 </div>
 <div>
 <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#1877F2] transition-colors">Meta Ads</h3>
 <p className="text-sm text-gray-500">Facebook & Instagram</p>
 </div>
 </div>
 {isConnected && (
 <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm border border-indigo-200">
 <CheckCircle size={14} /> CONECTADO
 </div>
 )}
 </div>

 {isConnected ? (
 <div className="space-y-4 mb-6">
 <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm text-center">
 <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1 block">Gerenciador Ativo</span>
 <div className="font-bold text-gray-800 text-lg truncate px-2" title={accountName || 'Gerenciador de Negócios'}>
 {accountName || 'Gerenciador Padrão'}
 </div>
 </div>
 </div>
 ) : (
 <p className="text-sm text-gray-600 mb-6 leading-relaxed">
 Conecte sua conta Meta para importar Leads automaticamente e gerenciar suas campanhas de tráfego diretamente pelo Elo 57.
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
 {loading ? <RefreshCw className="animate-spin" size={18} /> : <><LogOut size={18} /> Desconectar Conta</>}
 </button>
 ) : (
 <button
 onClick={handleConnect}
 disabled={loading}
 className="w-full py-3 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-blue-500/30 hover:shadow-lg focus:ring-4 focus:ring-blue-100 disabled:opacity-50 active:scale-[0.98]"
 >
 {loading ? <RefreshCw className="animate-spin" size={18} /> : <>Conectar Facebook <ArrowRight size={18} /></>}
 </button>
 )}
 </div>
 </div>
 );
}
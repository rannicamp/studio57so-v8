'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Facebook, CheckCircle, RefreshCw, MessageCircle } from 'lucide-react';

function MetaSetupWizardContent({ organizacaoId }) {
 const router = useRouter();
 const searchParams = useSearchParams();

 const [step, setStep] = useState(0); // 0: Fechado, 1: Página, 2: AdAccount, 3: WhatsApp
 const [loading, setLoading] = useState(false);

 // Dados carregados das APIs
 const [pages, setPages] = useState([]);
 const [adAccounts, setAdAccounts] = useState([]);
 const [wabas, setWabas] = useState([]);

 useEffect(() => {
 const queryStep = searchParams.get('step');
 if (queryStep === 'select_page') {
 iniciarFluxo(1);
 }
 }, [searchParams]);

 const iniciarFluxo = async (passo) => {
 setStep(passo);
 setLoading(true);
 try {
 if (passo === 1) {
 const res = await fetch('/api/meta/pages');
 const data = await res.json();
 if (data.pages) setPages(data.pages);
 } else if (passo === 2) {
 const res = await fetch('/api/meta/ad-accounts');
 const data = await res.json();
 if (data.accounts) setAdAccounts(data.accounts);
 } else if (passo === 3) {
 const res = await fetch('/api/meta/whatsapp-discover');
 const data = await res.json();
 if (data.data) setWabas(data.data);
 }
 } catch (error) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const salvarPagina = async (page) => {
 setLoading(true);
 try {
 await fetch('/api/meta/pages', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 page_id: page.id,
 page_name: page.name,
 page_access_token: page.access_token
 })
 });
 iniciarFluxo(2); // Avança pra Ads
 } finally {
 setLoading(false);
 }
 };

 const salvarAdAccount = async (accountInfo) => {
 setLoading(true);
 try {
 await fetch('/api/meta/ad-accounts', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ad_account_id: accountInfo.id })
 });
 iniciarFluxo(3); // A MÁGICA: Avança pro Auto-Discover do Whats!
 } finally {
 setLoading(false);
 }
 };

 const salvarWhatsApp = async (waba) => {
 setLoading(true);
 try {
 const res = await fetch('/api/meta/whatsapp-discover', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 waba_id: waba.waba_id,
 phone_number_id: waba.phone_number_id
 })
 });

 if (res.ok) {
 alert(`✅ WhatsApp (${waba.display_phone}) conectado com sucesso!`);
 fecharWizard();
 } else {
 alert('Erro ao vincular o WhatsApp no banco de dados.');
 }
 } finally {
 setLoading(false);
 }
 };

 const pularPasso = (proximo) => {
 if (proximo === 'end') {
 fecharWizard();
 } else {
 iniciarFluxo(proximo);
 }
 };

 const fecharWizard = () => {
 setStep(0);
 router.push('/configuracoes/integracoes');
 router.refresh();
 };

 if (step === 0) return null;

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
 <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

 {/* Header (Muda conforme o passo) */}
 <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
 <div className="flex items-center gap-3">
 {step === 3 ? (
 <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-sm">
 <MessageCircle size={20} />
 </div>
 ) : (
 <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center text-white shadow-sm">
 <Facebook size={20} />
 </div>
 )}
 <div>
 <h2 className="text-xl font-bold text-gray-800">
 {step === 1 && 'Vincular Página'}
 {step === 2 && 'Vincular Gerenciador'}
 {step === 3 && 'WhatsApp Detectado!'}
 </h2>
 <p className="text-sm text-gray-500">
 Passo {step} de 3
 </p>
 </div>
 </div>
 </div>

 {/* Conteúdo Carregando */}
 {loading ? (
 <div className="flex-1 p-12 flex flex-col items-center justify-center text-gray-400">
 <RefreshCw className="animate-spin mb-4" size={32} />
 <p className="animate-pulse font-medium">Sincronizando com o Meta...</p>
 </div>
 ) : (
 <div className="p-6 overflow-y-auto flex-1">

 {/* PASSO 1: PÁGINAS */}
 {step === 1 && (
 <div className="space-y-4">
 <p className="text-gray-600 mb-4">Qual Página do Facebook/Instagram captará os leads?</p>
 {pages.length === 0 ? <p className="text-center p-4">Nenhuma página encontrada.</p> : null}
 {pages.map(page => (
 <button
 key={page.id}
 onClick={() => salvarPagina(page)}
 className="w-full text-left flex items-center gap-4 p-4 border rounded-xl hover:border-[#1877F2] hover:bg-blue-50 transition-all group"
 >
 <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden shrink-0">
 {page.picture ? <img src={page.picture} alt="" className="w-full h-full object-cover" /> : <Facebook className="w-full h-full p-2 text-gray-400" />}
 </div>
 <div className="flex-1">
 <div className="font-bold text-gray-800 group-hover:text-[#1877F2]">{page.name}</div>
 <div className="text-xs text-gray-400 font-mono">ID: {page.id}</div>
 </div>
 <div className="text-[#1877F2] opacity-0 group-hover:opacity-100 transition-opacity">
 <CheckCircle size={20} />
 </div>
 </button>
 ))}
 </div>
 )}

 {/* PASSO 2: CONTAS DE ANÚNCIO */}
 {step === 2 && (
 <div className="space-y-4">
 <p className="text-gray-600 mb-4">Escolha a conta de anúncios para os relatórios.</p>
 {adAccounts.length === 0 ? <p className="text-center p-4">Nenhuma conta encontrada.</p> : null}
 {adAccounts.map(acc => (
 <button
 key={acc.id}
 onClick={() => salvarAdAccount(acc)}
 className="w-full text-left flex items-center justify-between p-4 border rounded-xl hover:border-[#1877F2] hover:bg-blue-50 transition-all group"
 >
 <div>
 <div className="font-bold text-gray-800 flex items-center gap-2">
 {acc.name}
 {acc.status === 'Ativa' ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full">Ativa</span> : null}
 </div>
 <div className="text-xs text-gray-400 font-mono mt-1">ID: {acc.id}</div>
 </div>
 <div className="text-[#1877F2] opacity-0 group-hover:opacity-100 transition-opacity">
 <CheckCircle size={20} />
 </div>
 </button>
 ))}
 </div>
 )}

 {/* PASSO 3: WHATSAPP AUTO-DISCOVER */}
 {step === 3 && (
 <div className="space-y-4">
 {wabas.length > 0 && (
 <div className="bg-green-50 p-4 rounded-xl border border-green-100 mb-6">
 <h3 className="text-green-800 font-bold mb-1">Que legal! 🚀</h3>
 <p className="text-sm text-green-700">Encontramos contas de WhatsApp Oficial vinculadas ao seu Gerenciador de Negócios.</p>
 </div>
 )}

 {wabas.length === 0 ? (
 <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100">
 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <MessageCircle size={28} className="text-gray-400" />
 </div>
 <h3 className="font-bold text-gray-800 mb-2">Quase lá!</h3>
 <p className="text-gray-500 mb-6 text-sm">O seu Facebook foi conectado, mas não encontramos nenhum WhatsApp Cloud API Oficial vinculado ao seu Business Manager atual.</p>
 <button onClick={() => pularPasso('end')} className="px-6 py-2.5 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition-colors w-full">
 Concluir Integração
 </button>
 </div>
 ) : (
 wabas.map((waba, index) => (
 <div key={index} className="border-2 border-green-100 bg-white rounded-xl p-5 hover:border-green-400 hover:shadow-md transition-all">
 <div className="flex justify-between items-start mb-4">
 <div>
 <div className="text-xs text-gray-400 font-mono mb-1">{waba.business_manager}</div>
 <div className="font-bold text-xl text-gray-800">{waba.display_phone}</div>
 <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
 <CheckCircle size={14} className="text-green-500" /> {waba.verified_name}
 </div>
 </div>
 </div>
 <button
 onClick={() => salvarWhatsApp(waba)}
 className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
 >
 <MessageCircle size={18} /> Ativar Atendimento
 </button>
 </div>
 ))
 )}
 </div>
 )}

 </div>
 )}

 {/* Footer Controls */}
 <div className="p-4 border-t flex justify-end bg-gray-50 shrink-0">
 <button
 onClick={() => pularPasso(step === 3 ? 'end' : step + 1)}
 className="text-gray-500 hover:text-gray-800 text-sm font-medium px-4 py-2"
 >
 {step === 3 ? 'Pular WhatsApp' : 'Pular Etapa'}
 </button>
 </div>

 </div>
 </div>
 );
}

export default function MetaSetupWizard(props) {
 return (
 <Suspense fallback={null}>
 <MetaSetupWizardContent {...props} />
 </Suspense>
 );
}

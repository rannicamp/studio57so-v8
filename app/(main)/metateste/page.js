'use client';
import { useState, useEffect } from 'react';

export default function MetaTestePage() {
 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [msg, setMsg] = useState('');

 useEffect(() => {
 carregarDados();
 }, []);

 const carregarDados = async () => {
 setLoading(true);
 try {
 // 1. Busca as Contas (Nova API)
 const resContas = await fetch('/api/meta/ad-accounts');
 const dataContas = await resContas.json();

 if (dataContas.error) throw new Error(dataContas.error);

 // Monta o "esqueleto" de dados que a tela de teste espera
 let currentState = {
 // A nova API chama o ID com 'act_' apenas de 'id', então mapeamos para 'id_formatado'
 ad_accounts: (dataContas.accounts || []).map(acc => ({ ...acc, id_formatado: acc.id })),
 conta_atual: dataContas.selected_account_id,
 data: { campaigns: [], adsets: [], ads: [] }
 };

 // 2. Se tiver conta selecionada, busca as Campanhas e Anúncios das outras APIs
 if (dataContas.selected_account_id) {
 const [resCampaigns, resAds] = await Promise.all([
 fetch('/api/meta/campaigns'),
 fetch('/api/meta/ads')
 ]);

 if (resCampaigns.ok && resAds.ok) {
 const campaignsData = await resCampaigns.json();
 const adsData = await resAds.json();

 currentState.data.campaigns = campaignsData.campaigns || [];
 currentState.data.adsets = campaignsData.adsets || [];
 currentState.data.ads = adsData.data || [];
 }
 }

 setData(currentState);
 } catch (err) {
 alert(err.message || 'Erro ao buscar dados');
 } finally {
 setLoading(false);
 }
 };

 const salvarConta = async (id_formatado) => {
 if(!confirm('Usar esta conta para gerenciar Leads e Anúncios?')) return;
 const res = await fetch('/api/meta/ad-accounts', {
 method: 'POST', headers: { 'Content-Type': 'application/json' }, // <-- Isso previne erros no backend
 body: JSON.stringify({ ad_account_id: id_formatado })
 });
 if (res.ok) {
 setMsg('✅ Conta Salva! Buscando estrutura de anúncios...');
 setTimeout(() => {
 setMsg('');
 carregarDados();
 }, 1500);
 } else {
 alert('Erro ao salvar');
 }
 };

 if (loading && !data) return <div className="p-10 text-xl font-bold text-blue-600 animate-pulse">📡 Carregando dados do Facebook...</div>;

 return (
 <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
 <div className="flex justify-between items-center">
 <h1 className="text-3xl font-bold text-gray-800">📊 Raio-X da Conta de Anúncios</h1>
 <button onClick={carregarDados} className="text-sm text-blue-600 hover:underline">Atualizar Dados</button>
 </div>
 {msg && <div className="bg-green-100 p-4 rounded text-green-800 font-bold border border-green-400 animate-bounce">{msg}</div>}

 {/* 1. SELEÇÃO DE CONTA */}
 <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
 <h2 className="text-lg font-bold mb-4 text-gray-700">1. Conta de Anúncios Conectada</h2>
 <div className="flex gap-4 overflow-x-auto pb-2">
 {data?.ad_accounts?.map(conta => (
 <div key={conta.id} onClick={() => data.conta_atual !== conta.id_formatado && salvarConta(conta.id_formatado)}
 className={`flex-shrink-0 cursor-pointer p-4 border rounded-lg min-w-[250px] transition-all ${
 data.conta_atual === conta.id_formatado ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'hover:bg-gray-50 border-gray-300'
 }`}>
 <div className="font-bold text-gray-800">{conta.name}</div>
 <div className="text-xs text-gray-500 font-mono mb-2">{conta.id_formatado}</div>
 <div className="flex justify-between items-center">
 <span className="text-xs bg-gray-200 px-2 py-1 rounded">{conta.currency}</span>
 {data.conta_atual === conta.id_formatado && <span className="text-green-600 font-bold text-xs">✔ ATIVA</span>}
 </div>
 </div>
 ))}
 </div>
 </div>

 {!data?.conta_atual ? (
 <div className="p-10 text-center text-gray-500 bg-white rounded border border-dashed">
 Selecione uma conta acima para ver os dados.
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 {/* 2. CAMPANHAS */}
 <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-blue-500">
 <h3 className="font-bold text-lg mb-4 text-blue-800 flex items-center gap-2">📢 Campanhas <span className="text-xs bg-blue-100 px-2 rounded-full">{data?.data?.campaigns?.length}</span></h3>
 <div className="space-y-3">
 {data?.data?.campaigns?.map(c => (
 <div key={c.id} className="border p-3 rounded text-sm hover:shadow-md transition-shadow">
 <div className="font-semibold text-gray-800">{c.name}</div>
 <div className="flex justify-between mt-2 text-xs">
 <span className={`px-2 py-0.5 rounded ${c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
 <span className="text-gray-400">{c.objective}</span>
 </div>
 </div>
 ))}
 {data?.data?.campaigns?.length === 0 && <p className="text-sm text-gray-400 italic">Nenhuma campanha recente.</p>}
 </div>
 </div>

 {/* 3. CONJUNTOS (AD SETS) */}
 <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-purple-500">
 <h3 className="font-bold text-lg mb-4 text-purple-800 flex items-center gap-2">🎯 Conjuntos <span className="text-xs bg-purple-100 px-2 rounded-full">{data?.data?.adsets?.length}</span></h3>
 <div className="space-y-3">
 {data?.data?.adsets?.map(a => (
 <div key={a.id} className="border p-3 rounded text-sm hover:shadow-md transition-shadow">
 <div className="font-semibold text-gray-800">{a.name}</div>
 <div className="flex justify-between mt-2 text-xs">
 <span className={`px-2 py-0.5 rounded ${a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span>
 <span className="font-mono bg-yellow-50 px-1 border border-yellow-100 rounded text-yellow-700">{a.budget}</span>
 </div>
 </div>
 ))}
 {data?.data?.adsets?.length === 0 && <p className="text-sm text-gray-400 italic">Nenhum conjunto recente.</p>}
 </div>
 </div>

 {/* 4. ANÚNCIOS (ADS) */}
 <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-pink-500">
 <h3 className="font-bold text-lg mb-4 text-pink-800 flex items-center gap-2">🎨 Anúncios <span className="text-xs bg-pink-100 px-2 rounded-full">{data?.data?.ads?.length}</span></h3>
 <div className="space-y-3">
 {data?.data?.ads?.map(ad => (
 <div key={ad.id} className="border p-3 rounded text-sm hover:shadow-md transition-shadow flex gap-3">
 {ad.thumbnail ? (
 <img src={ad.thumbnail} alt="Ad" className="w-16 h-16 object-cover rounded bg-gray-200" />
 ) : (
 <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">Sem Foto</div>
 )}
 <div className="flex-1">
 <div className="font-semibold text-gray-800 line-clamp-2">{ad.title || ad.name}</div>
 <div className="mt-2 text-xs">
 <span className={`px-2 py-0.5 rounded ${ad.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{ad.status}</span>
 </div>
 </div>
 </div>
 ))}
 {data?.data?.ads?.length === 0 && <p className="text-sm text-gray-400 italic">Nenhum anúncio recente.</p>}
 </div>
 </div>

 </div>
 )}
 </div>
 );
}
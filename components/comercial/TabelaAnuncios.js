"use client";

import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faSort, faSortUp, faSortDown, faPowerOff, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(val || 0);
const formatDecimal = (val) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

const StatusBadge = ({ status }) => {
 const config = {
 ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo', dot: 'bg-green-500' },
 PAUSED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pausado', dot: 'bg-yellow-500' },
 ARCHIVED: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Arquivado', dot: 'bg-gray-400' },
 };
 const style = config[status] || { bg: 'bg-gray-50', text: 'text-gray-500', label: status || 'Desconhecido', dot: 'bg-gray-400' };

 return (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
 {style.label}
 </span>
 );
};

const FrequenciaBadge = ({ frequencia }) => {
 const val = Number(frequencia) || 0;
 let style = { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', title: 'Sem dados' };

 if (val > 0 && val < 1.8) {
 style = { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', title: '🔴 Baixa Lembrança: O imóvel é uma compra complexa. Se a pessoa viu apenas 1 vez, ela provavelmente não fixou o nome do empreendimento.' };
 } else if (val >= 1.8 && val < 2.5) {
 style = { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', title: '🟡 Fase de Aquecimento: Você está começando a ser notado, mas ainda corre o risco de ser ignorado.' };
 } else if (val >= 2.5 && val <= 4.5) {
 style = { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', title: '🟢 Ponto de Conversão (Ideal): A pessoa viu o anúncio o suficiente para sentir confiança e clicar para saber mais.' };
 } else if (val > 4.5 && val <= 6.0) {
 style = { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', title: '🟡 Início de Saturação: O público já viu seu anúncio várias vezes. Se ele não virou lead até agora, talvez o criativo esteja cansativo.' };
 } else if (val > 6.0) {
 style = { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', title: '🔴 Fadiga de Anúncio: Você está gastando dinheiro para mostrar a mesma imagem para quem já decidiu não clicar. Hora de trocar.' };
 }

 return (
 <span
 title={style.title}
 className={`inline-block px-2 py-1 rounded text-xs font-bold border cursor-help transition-colors ${style.bg} ${style.text} ${style.border}`}
 >
 {formatDecimal(val)}
 </span>
 );
};

export default function TabelaAnuncios({ ads, filters }) {
 const queryClient = useQueryClient();
 const [sortConfig, setSortConfig] = useState({ key: 'spend', direction: 'desc' });
 const [loadingAdId, setLoadingAdId] = useState(null); // Para mostrar o spinner no botão exato que foi clicado

 // =========================================================================
 // A MÁGICA DA MUTAÇÃO: Atualizar Status
 // =========================================================================
 const mutationToggleStatus = useMutation({
 mutationFn: async ({ adId, newStatus }) => {
 const res = await fetch('/api/meta/ads/status', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ adId, status: newStatus }),
 });
 if (!res.ok) throw new Error('Erro ao atualizar no Meta');
 return res.json();
 },
 onMutate: ({ adId }) => {
 setLoadingAdId(adId);
 },
 onSuccess: (data, variables) => {
 toast.success(`Anúncio ${variables.newStatus === 'ACTIVE' ? 'ativado' : 'pausado'} com sucesso!`);
 // Isso avisa ao motor principal para buscar os dados atualizados!
 queryClient.invalidateQueries({ queryKey: ['meta-ads'] });
 },
 onError: () => {
 toast.error('Erro ao tentar mudar o status do anúncio. Verifique sua conexão.');
 },
 onSettled: () => {
 setLoadingAdId(null);
 }
 });

 const handleToggleStatus = (ad) => {
 // Se estiver arquivado, nós não deixamos mexer para evitar erros no Meta
 if (ad.status === 'ARCHIVED') {
 toast.warning('Anúncios arquivados não podem ser alterados.');
 return;
 }

 const newStatus = ad.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
 mutationToggleStatus.mutate({ adId: ad.id, newStatus });
 };

 const filteredAds = useMemo(() => {
 if (!ads) return [];
 return ads.filter(ad => {
 if (filters?.searchTerm) {
 const term = filters.searchTerm.toLowerCase();
 const matchName = ad.name?.toLowerCase().includes(term);
 const matchCampaign = ad.campaign_name?.toLowerCase().includes(term);
 if (!matchName && !matchCampaign) return false;
 }
 if (filters?.status && filters.status.length > 0) {
 if (!filters.status.includes(ad.status)) return false;
 }
 if (filters?.campaignIds && filters.campaignIds.length > 0) {
 if (!filters.campaignIds.includes(ad.campaign_id)) return false;
 }
 if (filters?.adsetIds && filters.adsetIds.length > 0) {
 if (!filters.adsetIds.includes(ad.adset_id)) return false;
 }
 return true;
 });
 }, [ads, filters]);

 const sortedAds = useMemo(() => {
 let sortableItems = [...filteredAds];
 if (sortConfig.key) {
 sortableItems.sort((a, b) => {
 const aValue = Number(a[sortConfig.key]) || 0;
 const bValue = Number(b[sortConfig.key]) || 0;

 if (aValue < bValue) {
 return sortConfig.direction === 'asc' ? -1 : 1;
 }
 if (aValue > bValue) {
 return sortConfig.direction === 'asc' ? 1 : -1;
 }
 return 0;
 });
 }
 return sortableItems;
 }, [filteredAds, sortConfig]);

 const handleSort = (key) => {
 let direction = 'desc';
 if (sortConfig.key === key && sortConfig.direction === 'desc') {
 direction = 'asc';
 }
 setSortConfig({ key, direction });
 };

 const renderSortIcon = (key) => {
 if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="ml-1 text-gray-300" />;
 return sortConfig.direction === 'asc'
 ? <FontAwesomeIcon icon={faSortUp} className="ml-1 text-blue-500" />
 : <FontAwesomeIcon icon={faSortDown} className="ml-1 text-blue-500" />;
 };

 if (!sortedAds || sortedAds.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-10 text-center min-h-[30vh] animate-in fade-in zoom-in duration-300">
 <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 max-w-sm w-full mx-auto shadow-sm flex flex-col items-center">
 <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-gray-400">
 <FontAwesomeIcon icon={faImage} className="text-3xl opacity-80" />
 </div>
 <h3 className="text-lg font-bold text-gray-800 mb-1">Nenhum Anúncio</h3>
 <p className="text-sm text-gray-500 px-4">Os filtros atuais não retornaram nenhum criativo para esta conta.</p>
 </div>
 </div>
 );
 }

 return (
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-gray-50 select-none">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Criativo / Anúncio</th>
 <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status / Ação</th>

 <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('spend')}>
 Gasto {renderSortIcon('spend')}
 </th>

 <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('reach')}>
 Alcance {renderSortIcon('reach')}
 </th>

 <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('impressions')}>
 Impressões {renderSortIcon('impressions')}
 </th>

 <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('frequencia')}>
 Frequência {renderSortIcon('frequencia')}
 </th>

 <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('clicks')}>
 Cliques {renderSortIcon('clicks')}
 </th>

 <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('leads')}>
 Leads {renderSortIcon('leads')}
 </th>

 <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('cost_per_lead')}>
 CPL {renderSortIcon('cost_per_lead')}
 </th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-200">
 {sortedAds.map((ad) => (
 <tr key={ad.id} className="hover:bg-gray-50 transition-colors">
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 border overflow-hidden flex items-center justify-center">
 {ad.thumbnail_url ? (
 <img src={ad.thumbnail_url} alt="Thumbnail" className="h-full w-full object-cover" />
 ) : (
 <FontAwesomeIcon icon={faImage} className="text-gray-300" />
 )}
 </div>
 <div className="flex flex-col">
 <span className="text-sm font-bold text-gray-800 line-clamp-1" title={ad.name}>{ad.name}</span>
 <span className="text-xs text-gray-500 line-clamp-1" title={ad.campaign_name}>{ad.campaign_name}</span>
 </div>
 </div>
 </td>

 {/* STATUS E BOTÃO DE LIGAR/DESLIGAR */}
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center gap-2">
 <StatusBadge status={ad.status} />
 {ad.status !== 'ARCHIVED' && (
 <button
 onClick={() => handleToggleStatus(ad)}
 disabled={loadingAdId === ad.id}
 title={ad.status === 'ACTIVE' ? 'Pausar Anúncio' : 'Ativar Anúncio'}
 className={`p-1.5 rounded-md transition-colors ${ad.status === 'ACTIVE'
 ? 'text-red-500 hover:bg-red-50'
 : 'text-green-500 hover:bg-green-50'
 } disabled:opacity-50`}
 >
 {loadingAdId === ad.id ? (
 <FontAwesomeIcon icon={faSpinner} spin />
 ) : (
 <FontAwesomeIcon icon={faPowerOff} />
 )}
 </button>
 )}
 </div>
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-700">
 {formatCurrency(ad.spend)}
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
 {formatNumber(ad.reach)}
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
 {formatNumber(ad.impressions)}
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-center">
 <FrequenciaBadge frequencia={ad.frequencia} />
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
 {formatNumber(ad.clicks)}
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-center">
 <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold text-sm border border-blue-100">
 {ad.leads}
 </span>
 </td>

 <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-gray-700">
 {formatCurrency(ad.cost_per_lead)}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}
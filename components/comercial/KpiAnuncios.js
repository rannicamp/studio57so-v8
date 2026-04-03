"use client";

import { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullhorn, faChartLine, faCoins, faUsers } from '@fortawesome/free-solid-svg-icons';

export default function KpiAnuncios({ data, isLoading }) {
 // A MÁGICA DOS CÁLCULOS: Somamos os dados de todos os anúncios
 const kpis = useMemo(() => {
 if (!data || data.length === 0) return { totalGasto: 0, totalLeads: 0, cpl: 0, anunciosAtivos: 0 };

 const ativos = data.filter(ad => ad.status === 'ACTIVE');
 const totalGasto = data.reduce((sum, ad) => sum + (parseFloat(ad.spend) || 0), 0);
 const totalLeads = data.reduce((sum, ad) => sum + (parseInt(ad.leads) || 0), 0);

 return {
 totalGasto,
 totalLeads,
 cpl: totalLeads > 0 ? totalGasto / totalLeads : 0,
 anunciosAtivos: ativos.length
 };
 }, [data]);

 const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

 if (isLoading) {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {[1, 2, 3, 4].map(i => <div key={i} className="bg-gray-100 h-24 rounded-xl animate-pulse border border-gray-200"></div>)}
 </div>
 );
 }

 const cards = [
 { title: "Total Gasto", value: formatBRL(kpis.totalGasto), icon: faCoins, color: "text-blue-600", bg: "bg-blue-50" },
 { title: "Total de Leads", value: kpis.totalLeads.toLocaleString('pt-BR'), icon: faUsers, color: "text-green-600", bg: "bg-green-50" },
 { title: "Custo por Lead (CPL)", value: formatBRL(kpis.cpl), icon: faChartLine, color: "text-purple-600", bg: "bg-purple-50" },
 { title: "Anúncios Ativos", value: kpis.anunciosAtivos, icon: faBullhorn, color: "text-blue-600", bg: "bg-blue-600" },
 ];

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {cards.map((card, idx) => (
 <div key={idx} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
 <div className={`p-4 rounded-xl ${card.bg} ${card.color}`}>
 <FontAwesomeIcon icon={card.icon} size="lg" />
 </div>
 <div>
 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{card.title}</span>
 <h3 className="text-2xl font-bold text-gray-800">{card.value}</h3>
 </div>
 </div>
 ))}
 </div>
 );
}
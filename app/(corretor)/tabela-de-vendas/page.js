// app/(corretor)/tabela-de-vendas/page.js
'use client'

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBuilding } from '@fortawesome/free-solid-svg-icons';

import TabelaVendaCorretorAba from '@/components/comercial/TabelaVendaCorretorAba';

async function fetchEmpreendimentosAtivos(organizacaoId) {
 if (!organizacaoId) return [];
 const supabase = createClient();
 // Pegamos apenas os empreendimentos marcados como públicos para comercialização
 const { data, error } = await supabase
 .from('empreendimentos')
 .select('id, nome')
 .eq('listado_para_venda', true)
 .order('nome', { ascending: true });

 if (error) {
 throw new Error(error.message);
 }
 return data;
}

export default function TabelaVendasCorretor() {
 const { user, isUserLoading } = useLayout();
 const organizacaoId = user?.organizacao_id;
 const [activeTab, setActiveTab] = useState(null);

 const {
 data: empreendimentos,
 isLoading: isLoadingEmps,
 isError,
 error,
 } = useQuery({
 queryKey: ['corretorEmpreendimentosTabs', organizacaoId],
 queryFn: () => fetchEmpreendimentosAtivos(organizacaoId),
 enabled: !!organizacaoId,
 });

 const isLoading = isUserLoading || isLoadingEmps;

 // React Query no Next as vezes precisa de UseEffect pra garantir fallback assincrono da activeTab inicial
 useEffect(() => {
 if (empreendimentos?.length > 0 && !activeTab) {
 setActiveTab(empreendimentos[0].id);
 }
 }, [empreendimentos, activeTab]);

 if (isLoading) {
 return (
 <div className="flex justify-center items-center min-h-[50vh]">
 <FontAwesomeIcon
 icon={faSpinner}
 className="text-blue-600 text-5xl"
 spin
 />
 </div>
 );
 }

 if (isError) {
 return (
 <div className="text-center py-10 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mx-4 mt-8 shadow-sm">
 <strong className="font-bold">Erro de comunicação!</strong>
 <span className="block sm:inline"> {error.message}</span>
 </div>
 );
 }

 if (!empreendimentos || empreendimentos.length === 0) {
 return (
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
 <h1 className="text-3xl font-bold text-gray-800 mb-6 font-display">Tabelas de Vendas</h1>
 <div className="bg-white p-12 text-center rounded-xl border border-gray-100 shadow-sm mt-8">
 <FontAwesomeIcon icon={faBuilding} className="text-6xl text-gray-200 mb-4" />
 <h3 className="text-xl font-bold text-gray-700">Calma lá!</h3>
 <p className="text-gray-500 mt-2 text-lg">Nenhum empreendimento ativo foi liberado para venda nestes parâmetros.</p>
 </div>
 </div>
 );
 }

 return (
 <div className="max-w-[1600px] mx-auto pb-12 w-full animate-fade-in relative">
 <div className="bg-white shadow-sm border-b sticky top-0 z-10 px-6 py-4 flex flex-col items-center xl:flex-row xl:justify-between gap-6">
 <div className="flex items-center gap-3 w-full xl:w-auto">
 <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center hidden sm:flex">
 <FontAwesomeIcon icon={faBuilding} className="text-blue-600 text-xl" />
 </div>
 <h1 className="text-2xl font-bold text-gray-800 tracking-tight !my-0">Tabela de Vendas</h1>
 </div>
 {/* O Super Sistema de Abas Horizontais */}
 <div className="w-full xl:flex-grow flex justify-start xl:justify-end overflow-hidden custom-scrollbar pb-1">
 <div className="flex bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/50 shadow-inner w-full sm:w-auto h-auto min-w-min overflow-x-auto snap-x">
 {empreendimentos.map(emp => (
 <button
 key={emp.id}
 onClick={() => setActiveTab(emp.id)}
 className={`
 whitespace-nowrap px-6 py-2.5 rounded-lg font-bold text-[13px] uppercase tracking-wider transition-all duration-300 snap-center
 ${activeTab === emp.id ? 'bg-white text-blue-700 shadow-md ring-1 ring-black/5 transform scale-100' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50 transform scale-95 origin-center'
 }
 `}
 >
 {emp.nome}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* A Magia de Injeção das Consultas no Componente Rico Acontece Aqui */}
 <div className="px-4 sm:px-6 w-full">
 {activeTab && (
 <TabelaVendaCorretorAba key={`tab-render-${activeTab}`} // O key obriga a montagem de um componente 100% fresco ao tocar a aba para blindar viciamento de estado
 empreendimentoId={activeTab} organizacaoId={organizacaoId} />
 )}
 </div>
 </div>
 );
}
// components/relatorios/financeiro/RelatorioDREContainer.js
"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useRelatorioDRE } from '@/hooks/financeiro/useRelatorioDRE';
import FiltroFinanceiro from '@/components/financeiro/FiltroFinanceiro';
import FinanceiroDRE from '@/components/relatorios/financeiro/FinanceiroDRE';
import {
 startOfMonth, endOfMonth, format, addMonths, subMonths, isSameMonth
} from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faChevronLeft, faChevronRight, faCalendarAlt, faFilter
} from '@fortawesome/free-solid-svg-icons';

// Função para buscar dados auxiliares (Categorias, Contas, etc.) - Igual a do Dashboard
async function fetchAuxiliaryData(organizacao_id) {
 const supabase = createClient();
 if (!organizacao_id) return { empresas: [], contas: [], categorias: [], empreendimentos: [], allContacts: [] };

 const [empresasRes, contasRes, categoriasRes, empreendimentosRes, contatosRes] = await Promise.all([
 supabase.from('cadastro_empresa').select('*').eq('organizacao_id', organizacao_id).order('nome_fantasia'),
 supabase.from('contas_financeiras').select('*').eq('organizacao_id', organizacao_id).order('nome'),
 supabase.from('categorias_financeiras').select('*').in('organizacao_id', [organizacao_id, 1]).order('nome'),
 supabase.from('empreendimentos').select('*').eq('organizacao_id', organizacao_id).order('nome'),
 supabase.from('contatos').select('id, nome, razao_social').eq('organizacao_id', organizacao_id).order('nome')
 ]);

 return {
 empresas: empresasRes.data || [],
 contas: contasRes.data || [],
 categorias: categoriasRes.data || [],
 empreendimentos: empreendimentosRes.data || [],
 allContacts: contatosRes.data || []
 };
}

export default function RelatorioDREContainer() {
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const [dataBase, setDataBase] = useState(new Date());
 const [mostrarFiltros, setMostrarFiltros] = useState(false);

 const [filtrosAvancados, setFiltrosAvancados] = useState({
 empresaIds: [],
 startDate: '',
 endDate: '',
 useCompetencia: false
 });

 const { data: auxData } = useQuery({
 queryKey: ['financeiro_aux_data_dre', organizacaoId],
 queryFn: () => fetchAuxiliaryData(organizacaoId),
 enabled: !!organizacaoId,
 staleTime: 300000
 });

 const menuMeses = useMemo(() => {
 const meses = [];
 for (let i = -2; i <= 2; i++) { meses.push(addMonths(dataBase, i)); }
 return meses;
 }, [dataBase]);

 const filtrosHook = useMemo(() => {
 const temDataEspecifica = filtrosAvancados.startDate && filtrosAvancados.endDate;
 return {
 organizacaoId: organizacaoId,
 ...filtrosAvancados
 };
 }, [dataBase, organizacaoId, filtrosAvancados]);

 // O Hook Estrela com a contabilidade do DRE
 const { dadosDRE, isLoading } = useRelatorioDRE(filtrosHook);

 const navegarMes = (mes) => setDataBase(mes);
 const proximoMes = () => navegarMes(addMonths(dataBase, 1));
 const anteriorMes = () => navegarMes(subMonths(dataBase, 1));
 const irParaHoje = () => {
 setDataBase(new Date());
 const anoAtual = new Date().getFullYear();
 setFiltrosAvancados(prev => ({ ...prev, startDate: `${anoAtual}-01-01`, endDate: `${anoAtual}-12-31` }));
 };

 return (
 <div className="space-y-6 animate-fade-in pb-10">
 {/* === HEADER E NAVEGAÇÃO === */}
 <div className="flex flex-col gap-4 print:hidden">
 <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 px-2">
 <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
 <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
 Demonstração de Resultados (DRE)
 </h2>

 <div className="flex gap-2">
 <button
 onClick={() => setMostrarFiltros(!mostrarFiltros)}
 className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${mostrarFiltros ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
 >
 <FontAwesomeIcon icon={faFilter} />
 Filtros
 </button>
 <button
 onClick={irParaHoje}
 className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
 >
 <FontAwesomeIcon icon={faCalendarAlt} /> Ano Atual
 </button>
 </div>
 </div>

 {/* FILTROS SIMPLIFICADOS PARA DRE */}
 {mostrarFiltros && (
 <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-slide-down flex flex-col md:flex-row gap-4 max-w-3xl">
 <div className="flex-1">
 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa Referência</label>
 <select
 className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow outline-none bg-gray-50"
 value={filtrosAvancados.empresaIds?.[0] || ''}
 onChange={(e) => setFiltrosAvancados(p => ({ ...p, empresaIds: e.target.value ? [e.target.value] : [] }))}
 >
 <option value="">Todas as Empresas</option>
 {auxData?.empresas?.map(emp => (
 <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
 ))}
 </select>
 </div>
 
 <div className="w-full md:w-48">
 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ano de Exercício</label>
 <input
 type="number"
 className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow outline-none font-medium text-gray-700 bg-gray-50"
 placeholder="Ex: 2026"
 value={filtrosAvancados.startDate ? filtrosAvancados.startDate.substring(0, 4) : ''}
 onChange={(e) => {
 const ano = e.target.value;
 if (ano.length === 4) {
 setFiltrosAvancados(p => ({ ...p, startDate: `${ano}-01-01`, endDate: `${ano}-12-31` }));
 } else {
 setFiltrosAvancados(p => ({ ...p, startDate: '', endDate: '' }));
 }
 }}
 />
 </div>
 </div>
 )}

 </div>

 {/* TABELA CONTÁBIL DO DRE */}
 <FinanceiroDRE dadosDRE={dadosDRE} isLoading={isLoading} />
 </div>
 );
}

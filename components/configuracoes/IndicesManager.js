// components/configuracoes/IndicesManager.js
'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/utils/supabase/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faBoxOpen, faCalendarAlt, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useLayout } from '@/contexts/LayoutContext'
import { buscarUltimoIndice } from '@/utils/bcbApi'

export default function IndicesManager() {
 const supabase = createClient()
 const { user } = useLayout()
 // A tela agora é estritamente apenas leitura para todos os usuários, a automação (Cron) cuida do cadastro.
 const canEdit = false;

 const [selectedIndice, setSelectedIndice] = useState('INCC')

 // BUSCA LISTA DE ÍNDICES NO BANCO
 const { data: indicesRaw, isLoading, isError } = useQuery({
 queryKey: ['indicesGovernamentais', selectedIndice],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('indices_governamentais')
 .select('*')
 .eq('nome_indice', selectedIndice)
 .order('data_referencia', { ascending: false })
 if (error) throw new Error(error.message)
 return data || []
 }
 })

 // CALCULA O ACUMULADO 12 MESES E A TAXA ANUAL EQUIVALENTE NO FRONTEND
 const indices = useMemo(() => {
 if (!indicesRaw) return [];
 return indicesRaw.map((item, index, array) => {
 // Pega o item atual e os 11 anteriores (como a lista é DESC)
 const ultimos12 = array.slice(index, index + 12);
 let acumulado = 1.0;
 for (const hist of ultimos12) {
 acumulado *= (1 + (hist.valor_mensal / 100));
 }
 const taxaAcumulada = ((acumulado - 1) * 100).toFixed(4);

 // Taxa Anual Equivalente via juros compostos: (1 + taxa_mensal/100)^12 - 1
 // Esta taxa é parecida com a "SELIC Meta" que o jornal anuncia (em % ao ano)
 const taxaAnualEquivalente = (Math.pow(1 + item.valor_mensal / 100, 12) - 1) * 100;
 return {
 ...item,
 taxa_acumulada_12m: parseFloat(taxaAcumulada),
 qtd_meses_base: ultimos12.length,
 taxa_anual_equivalente: parseFloat(taxaAnualEquivalente.toFixed(4))
 };
 });
 }, [indicesRaw]);

 // Índices que têm a coluna extra de "Taxa Anual Equivalente" (Meta)
 const exibirColunaAnual = ['SELIC', 'CDI'].includes(selectedIndice);

 // AS FUNÇÕES DE MUTATION (SYNC E DELETE) FORAM REMOVIDAS POIS O GATILHO AGORA É AUTOMÁTICO VIA CRON JOB.

 const formatarDataRef = (dataIso) => {
 if(!dataIso) return '--'
 const date = new Date(dataIso + 'T12:00:00') // evita fuso
 return format(date, "MMMM 'de' yyyy", { locale: ptBR })
 }

 return (
 <div className="space-y-6">
 <div className="flex flex-col mb-6 gap-2">
 <div className="flex items-center gap-3">
 <h2 className="text-3xl font-bold text-gray-800">Índices Financeiros</h2>
 </div>
 <p className="text-gray-500 font-medium">Histórico mensal de inflação (IPCA, IGP-M, INCC) para correção de tabelas de venda e simuladores.</p>
 </div>

 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
 <div className="flex flex-wrap gap-2 bg-gray-100 p-1.5 rounded-lg max-w-full">
 {['IPCA', 'INPC', 'IGP-M', 'IGP-DI', 'INCC', 'IPC-FIPE', 'SELIC', 'CDI', 'TR'].map(indice => (
 <button key={indice}
 onClick={() => setSelectedIndice(indice)} className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all ${selectedIndice === indice ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
 >
 {indice}
 </button>
 ))}
 </div>
 </div>

 {/* Listagem */}
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
 {isLoading ? (
 <div className="text-center py-10"><FontAwesomeIcon icon={faSpinner} className="text-blue-500 text-3xl" spin /></div>
 ) : !indices || indices.length === 0 ? (
 <div className="bg-white p-12 text-center w-full">
 <div className="w-16 h-16 bg-blue-50 rounded-full flex mx-auto items-center justify-center mb-4 text-blue-400">
 <FontAwesomeIcon icon={faBoxOpen} className="text-2xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-800 mb-1">Nenhum registro de {selectedIndice}</h3>
 <p className="text-xs font-medium text-gray-500 mb-4">{canEdit ? 'Clique em Sincronizar para buscar dados do BCB.' : 'O sistema central ainda não populou este índice.'}</p>
 </div>
 ) : (
 <table className="min-w-full divide-y divide-gray-200">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mês Fiscal</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome do Índice</th>
 <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Variação Mensal</th>
 {exibirColunaAnual && (
 <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
 Equiv. Anual
 <span className="ml-1 text-[10px] normal-case text-gray-400 font-medium">(como o jornal)</span>
 </th>
 )}
 <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acumulado 12 Meses</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 bg-white">
 {indices.map((item) => (
 <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
 <FontAwesomeIcon icon={faCalendarAlt} />
 </div>
 <div>
 <p className="text-sm font-bold text-gray-900">{item.mes_ano}</p>
 <p className="text-xs font-medium text-gray-500 capitalize">{formatarDataRef(item.data_referencia)}</p>
 </div>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex flex-col gap-1">
 <span className="w-min px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-100">
 {item.nome_indice}
 </span>
 {item.descricao && (
 <span className="text-[10px] text-gray-400 font-medium truncate max-w-[200px] xl:max-w-xs block" title={item.descricao}>
 {item.descricao}
 </span>
 )}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-right">
 <span className={`text-sm font-extrabold ${item.valor_mensal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
 {item.valor_mensal > 0 ? '+' : ''}{item.valor_mensal}%
 </span>
 <p className="text-[10px] text-gray-400 font-medium mt-0.5">ao mês</p>
 </td>
 {exibirColunaAnual && (
 <td className="px-6 py-4 whitespace-nowrap text-right">
 <span className={`text-sm font-extrabold ${item.taxa_anual_equivalente < 0 ? 'text-red-600' : 'text-blue-600'}`}>
 {item.taxa_anual_equivalente > 0 ? '+' : ''}{item.taxa_anual_equivalente.toFixed(2)}%
 </span>
 <p className="text-[10px] text-gray-400 font-medium mt-0.5">ao ano</p>
 </td>
 )}
 <td className="px-6 py-4 whitespace-nowrap text-right">
 <div className="flex flex-col items-end gap-0.5">
 <span className={`text-sm font-extrabold ${item.taxa_acumulada_12m < 0 ? 'text-red-600' : 'text-blue-700'}`}>
 {item.taxa_acumulada_12m > 0 ? '+' : ''}{item.taxa_acumulada_12m.toFixed(4)}%
 </span>
 {item.qtd_meses_base < 12 && (
 <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded-md border border-amber-200" title={`Cálculo baseado apenas nos ${item.qtd_meses_base} meses parciais históricos disponíveis.`}>
 Base {item.qtd_meses_base}m
 </span>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 </div>
 )
}

// components/contratos/ExtratoFinanceiroCliente.js
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
 faSpinner, faCheckCircle, faClock, faPrint,
 faSave, faChartLine, faInfoCircle, faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

// ─── Formatações ─────────────────────────────────────────────
const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
const formatDoc = (doc) => {
 if (!doc) return '-';
 const n = doc.replace(/\D/g, '');
 return n.length > 11
 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
 : n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

// ─── Periodicidade ────────────────────────────────────────────
const OPCOES_PERIODO = [
 { value: 'mensal', label: 'Mensal', meses: 1 },
 { value: 'bimestral', label: 'Bimestral', meses: 2 },
 { value: 'trimestral', label: 'Trimestral', meses: 3 },
 { value: 'semestral', label: 'Semestral', meses: 6 },
 { value: 'anual', label: 'Anual', meses: 12 },
];

// ─── Queries ──────────────────────────────────────────────────
const fetchLancamentos = async (supabase, contratoId, organizacaoId) => {
 if (!contratoId || !organizacaoId) return [];
 const { data, error } = await supabase
 .from('lancamentos')
 .select('*, categoria:categorias_financeiras(*), conta:contas_financeiras(*)')
 .eq('contrato_id', contratoId)
 .eq('organizacao_id', organizacaoId)
 .order('data_vencimento', { ascending: true });
 if (error) throw new Error('Falha ao buscar o histórico financeiro.');
 return data || [];
};

const fetchIndicesGov = async (supabase, nomeIndice) => {
 if (!nomeIndice) return [];
 const { data } = await supabase
 .from('indices_governamentais')
 .select('data_referencia, valor_mensal')
 .eq('nome_indice', nomeIndice)
 .order('data_referencia', { ascending: true });
 return data || [];
};

const fetchNomesIndices = async (supabase) => {
 const { data } = await supabase
 .from('indices_governamentais')
 .select('nome_indice')
 .order('nome_indice');
 if (!data) return [];
 return [...new Set(data.map(d => d.nome_indice))];
};

// ─── Motor de Cálculo ─────────────────────────────────────────
//
// Regra:
// - "Trimestral" → aniversário na 3ª, 6ª, 9ª... parcela (por ORDINAL, não por data)
// - No aniversário: acumula índice dos N meses anteriores à data da parcela
// - Aplica sobre saldo devedor APÓS pagamento da parcela aniversário
// - Divide pela quantidade de parcelas RESTANTES (após o aniversário)
// - O split acumula a cada novo período
//
// Colunas:
// saldo_devedor → saldo após esta parcela
// indice_mes → % do índice neste mês
// correcao_evento → total da correção (só no mês aniversário)
// correcao_split → split por parcela (nas parcelas seguintes)
//
function calcularCorrecoes({ lancamentos, indicesMap, periodoMeses, valorTotal }) {
 const n = lancamentos.length;
 if (!indicesMap || periodoMeses === 0 || n === 0) {
 return lancamentos.map(l => ({ ...l, saldo_devedor: null, indice_mes: null, correcao_evento: null, correcao_split: null }));
 }

 // Passo 1: saldo devedor progressivo (cada parcela paga reduz o saldo)
 let runSaldo = parseFloat(valorTotal) || 0;
 const comSaldo = lancamentos.map(l => {
 if (l.tipo === 'Receita' && (l.status === 'Pago' || l.status === 'Conciliado')) {
 runSaldo -= parseFloat(l.valor) || 0;
 }
 return { ...l, saldo_devedor: Math.max(0, runSaldo) };
 });

 // Passo 2: detectar aniversários por ORDINAL da parcela
 // Aniversário = (idx + 1) % periodoMeses === 0
 // Ex: trimestral → parcela 3 (idx=2), 6 (idx=5), 9 (idx=8)...
 let splitAcumulado = 0;

 return comSaldo.map((l, idx) => {
 const numeroParcela = idx + 1;
 const dataVenc = l.data_vencimento ? new Date(l.data_vencimento + 'T00:00:00Z') : null;

 // Índice do mês deste vencimento
 let indice_mes = null;
 if (dataVenc) {
 const chave = `${dataVenc.getUTCFullYear()}-${String(dataVenc.getUTCMonth() + 1).padStart(2, '0')}`;
 indice_mes = indicesMap[chave] ?? null;
 }

 let correcao_evento = null;

 // Mês aniversário?
 if (dataVenc && numeroParcela % periodoMeses === 0) {
 // Acumula índice dos N meses (mês atual + N-1 anteriores)
 let taxaAcumulada = 0;
 for (let m = 0; m < periodoMeses; m++) {
 const d = new Date(dataVenc.getTime());
 d.setUTCMonth(d.getUTCMonth() - m);
 const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
 taxaAcumulada += indicesMap[chave] ?? 0;
 }

 if (taxaAcumulada > 0) {
 const totalCorrecao = l.saldo_devedor * (taxaAcumulada / 100);
 const restantes = n - idx - 1; // parcelas após esta

 if (restantes > 0 && totalCorrecao > 0) {
 correcao_evento = totalCorrecao;
 splitAcumulado += totalCorrecao / restantes;
 }
 }
 }

 return {
 ...l,
 indice_mes,
 correcao_evento, // só no aniversário
 correcao_split: splitAcumulado > 0 ? splitAcumulado : null, // nas seguintes
 };
 });
}

// ═════════════════════════════════════════════════════════════
export default function ExtratoFinanceiroCliente({ contratoId, contrato }) {
 const supabase = createClient();
 const { user } = useAuth();
 const organizacaoId = user?.organizacao_id;
 const queryClient = useQueryClient();

 const [indiceEscolhido, setIndiceEscolhido] = useState(contrato?.indice_reajuste || '');
 const [periodoEscolhido, setPeriodoEscolhido] = useState(contrato?.periodo_correcao || 'anual');

 useEffect(() => {
 if (contrato?.indice_reajuste) setIndiceEscolhido(contrato.indice_reajuste);
 if (contrato?.periodo_correcao) setPeriodoEscolhido(contrato.periodo_correcao);
 }, [contrato?.indice_reajuste, contrato?.periodo_correcao]);

 // ─── Queries ─────────────────────────────────────────────
 const { data: lancamentos = [], isLoading, isError, error } = useQuery({
 queryKey: ['extratoFinanceiroCliente', contratoId, organizacaoId],
 queryFn: () => fetchLancamentos(supabase, contratoId, organizacaoId),
 enabled: !!contratoId && !!organizacaoId,
 });

 const { data: nomesIndices = [] } = useQuery({
 queryKey: ['nomesIndicesGov'],
 queryFn: () => fetchNomesIndices(supabase),
 staleTime: 1000 * 60 * 60,
 });

 const { data: dadosIndice = [] } = useQuery({
 queryKey: ['indicesGov', indiceEscolhido],
 queryFn: () => fetchIndicesGov(supabase, indiceEscolhido),
 enabled: !!indiceEscolhido,
 staleTime: 1000 * 60 * 60,
 });

 // ─── Salvar configuração ──────────────────────────────────
 const { mutate: salvarConfig, isPending: isSaving } = useMutation({
 mutationFn: async () => {
 const { error } = await supabase
 .from('contratos')
 .update({ indice_reajuste: indiceEscolhido || null, periodo_correcao: periodoEscolhido })
 .eq('id', contratoId).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Configuração de correção salva!');
 queryClient.invalidateQueries({ queryKey: ['contrato', contratoId, organizacaoId] });
 },
 onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
 });

 // ─── Cálculos ─────────────────────────────────────────────
 const indicesMap = useMemo(() => {
 const map = {};
 dadosIndice.forEach(d => {
 if (d.data_referencia) {
 const dt = new Date(d.data_referencia + 'T00:00:00Z');
 const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
 map[chave] = parseFloat(d.valor_mensal) || 0;
 }
 });
 return map;
 }, [dadosIndice]);

 const periodoMeses = OPCOES_PERIODO.find(o => o.value === periodoEscolhido)?.meses || 12;

 const lancamentosComCorrecao = useMemo(() => {
 if (!indiceEscolhido || lancamentos.length === 0) {
 return lancamentos.map(l => ({ ...l, saldo_devedor: null, indice_mes: null, correcao_evento: null, correcao_split: null }));
 }
 return calcularCorrecoes({ lancamentos, indicesMap, periodoMeses, valorTotal: contrato?.valor_final_venda || 0 });
 }, [lancamentos, indicesMap, periodoMeses, indiceEscolhido, contrato?.valor_final_venda]);

 // ─── Totais ───────────────────────────────────────────────
 const totalPago = lancamentos
 .filter(l => (l.status === 'Pago' || l.status === 'Conciliado') && l.tipo === 'Receita')
 .reduce((acc, l) => acc + (l.valor || 0), 0);
 const totalPendente = lancamentos
 .filter(l => l.status === 'Pendente' && l.tipo === 'Receita')
 .reduce((acc, l) => acc + (l.valor || 0), 0);
 const totalCorrecoes = lancamentosComCorrecao
 .filter(l => l.correcao_evento > 0)
 .reduce((acc, l) => acc + (l.correcao_evento || 0), 0);

 // ─── Dados para impressão ─────────────────────────────────
 const cliente = contrato?.contato || {};
 const conjuge = contrato?.conjuge;
 const empreendimento = contrato?.empreendimento || {};
 const listaProdutos = contrato?.produtos || [];
 const displayUnidades = listaProdutos.map(p => p.unidade ? `${p.unidade} ${p.tipo ? `(${p.tipo})` : ''}` : p.tipo || 'Unidade').join(', ') || 'Geral';
 const enderecoCliente = [cliente.address_street, cliente.address_number, cliente.neighborhood, cliente.city, cliente.state].filter(Boolean).join(', ');

 if (isLoading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" /> Carregando...</div>;
 if (isError) return <div className="text-red-500 p-4">Erro: {error.message}</div>;

 return (
 <>
 {/* ── VISÃO DE TELA ─────────────────────────────────── */}
 <div className="space-y-6 animate-fade-in print:hidden">

 {/* Cabeçalho */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
 <h3 className="text-xl font-extrabold text-gray-800 tracking-tight flex items-center gap-2">
 <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Extrato Financeiro
 </h3>
 <button onClick={() => window.print()} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
 <FontAwesomeIcon icon={faPrint} /> Imprimir
 </button>
 </div>

 {/* KPIs */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { label: 'Total Recebido', value: totalPago, color: 'green', bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100' },
 { label: 'Pendente', value: totalPendente, color: 'yellow', bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100' },
 { label: 'Saldo Devedor', value: parseFloat(contrato?.valor_final_venda || 0) - totalPago, color: 'blue', bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
 { label: 'Total Correções', value: totalCorrecoes, color: 'amber', bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
 ].map(({ label, value, bar, text, bg }) => (
 <div key={label} className={`p-4 rounded-2xl border relative overflow-hidden ${bg}`}>
 <div className={`absolute top-0 left-0 w-1 h-full ${bar}`}></div>
 <span className="text-[10px] text-gray-500 uppercase font-extrabold tracking-widest block mb-1">{label}</span>
 <div className={`text-2xl font-extrabold ${text}`}>{formatCurrency(value)}</div>
 </div>
 ))}
 </div>

 {/* ── Painel de Configuração ── */}
 <div className="p-5 border border-gray-200 rounded-2xl bg-white shadow-sm relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
 <div className="flex flex-col md:flex-row md:items-end gap-4">
 <div className="flex items-center gap-2 mr-2 shrink-0">
 <FontAwesomeIcon icon={faChartLine} className="text-indigo-500" />
 <span className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">Correção Monetária</span>
 </div>
 <div className="flex flex-col md:flex-row gap-3 flex-1">
 <div className="flex-1">
 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Índice</label>
 <select value={indiceEscolhido} onChange={e => setIndiceEscolhido(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:ring-1 focus:ring-indigo-400 outline-none">
 <option value="">— Sem correção —</option>
 {nomesIndices.map(nome => <option key={nome} value={nome}>{nome}</option>)}
 </select>
 </div>
 <div className="flex-1">
 <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Periodicidade</label>
 <select value={periodoEscolhido} onChange={e => setPeriodoEscolhido(e.target.value)} disabled={!indiceEscolhido} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:ring-1 focus:ring-indigo-400 outline-none disabled:opacity-40">
 {OPCOES_PERIODO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 </div>
 <div className="flex items-end">
 <button onClick={() => salvarConfig()} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:bg-gray-300 transition-colors">
 <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} spin={isSaving} /> Salvar
 </button>
 </div>
 </div>
 </div>
 {indiceEscolhido && (
 <div className="mt-3 text-xs text-indigo-600 bg-indigo-50 rounded-xl px-3 py-2 flex items-center gap-2">
 <FontAwesomeIcon icon={faInfoCircle} />
 <span>
 Correção <strong>{periodoEscolhido}</strong> pelo <strong>{indiceEscolhido}</strong>.
 O aniversário ocorre a cada <strong>{periodoMeses}</strong> parcela(s) — ex: {periodoMeses}ª, {periodoMeses * 2}ª, {periodoMeses * 3}ª...
 </span>
 </div>
 )}
 </div>

 {/* ── Tabela Principal ── */}
 <div className="overflow-x-auto border border-gray-100 rounded-2xl shadow-inner scrollbar-hide">
 <table className="min-w-full divide-y divide-gray-100 text-sm">
 <thead className="bg-gray-50/80">
 <tr>
 <th className="px-4 py-3 text-left font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Vencimento</th>
 <th className="px-4 py-3 text-left font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Descrição</th>
 <th className="px-4 py-3 text-right font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Valor</th>
 <th className="px-4 py-3 text-right font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Saldo Devedor</th>
 {indiceEscolhido && <>
 <th className="px-4 py-3 text-right font-extrabold text-[10px] text-indigo-500 uppercase tracking-widest">{indiceEscolhido} Mês</th>
 <th className="px-4 py-3 text-right font-extrabold text-[10px] text-amber-600 uppercase tracking-widest">Total Correção</th>
 <th className="px-4 py-3 text-right font-extrabold text-[10px] text-blue-600 uppercase tracking-widest">+ por Parcela</th>
 </>}
 <th className="px-4 py-3 text-center font-extrabold text-[10px] text-gray-500 uppercase tracking-widest">Status</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-50">
 {lancamentosComCorrecao.map(l => {
 const isPago = l.status === 'Pago' || l.status === 'Conciliado';
 const statusDisplay = isPago ? 'Pago' : l.status;
 const statusColor = isPago ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
 const valorColor = l.tipo === 'Receita' ? 'text-green-600' : 'text-red-500';
 const temEvento = (l.correcao_evento || 0) > 0;
 const temSplit = (l.correcao_split || 0) > 0;

 return (
 <tr key={l.id} className={`hover:bg-blue-50/30 transition-colors ${temEvento ? 'bg-amber-50 border-l-2 border-amber-500' : temSplit ? 'border-l-2 border-amber-100' : ''}`}>
 <td className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{formatDate(l.data_vencimento)}</td>
 <td className="px-4 py-3 font-semibold text-gray-800">
 {l.descricao}
 <div className="text-xs font-medium text-gray-400 mt-0.5">{l.categoria?.nome}</div>
 </td>
 <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${valorColor}`}>{formatCurrency(l.valor)}</td>
 <td className="px-4 py-3 text-right text-gray-500 text-sm whitespace-nowrap">
 {l.saldo_devedor !== null ? formatCurrency(l.saldo_devedor) : <span className="text-gray-200">—</span>}
 </td>
 {indiceEscolhido && <>
 {/* Índice do Mês */}
 <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
 {l.indice_mes !== null
 ? <span className="font-semibold text-indigo-600">{l.indice_mes.toFixed(4)}%</span>
 : <span className="text-gray-200">—</span>}
 </td>
 {/* Total da Correção — só no mês aniversário */}
 <td className="px-4 py-3 text-right whitespace-nowrap">
 {temEvento
 ? <span className="font-extrabold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg text-xs">{formatCurrency(l.correcao_evento)}</span>
 : <span className="text-gray-200 text-xs">—</span>}
 </td>
 {/* Split por Parcela — distribuído nas parcelas seguintes */}
 <td className="px-4 py-3 text-right whitespace-nowrap">
 {temSplit
 ? <span className="font-bold text-blue-600 text-xs">+ {formatCurrency(l.correcao_split)}</span>
 : <span className="text-gray-200 text-xs">—</span>}
 </td>
 </>}
 <td className="px-4 py-3 text-center">
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${statusColor}`}>
 <FontAwesomeIcon icon={isPago ? faCheckCircle : faClock} />
 {statusDisplay}
 </span>
 </td>
 </tr>
 );
 })}
 {lancamentos.length === 0 && (
 <tr>
 <td colSpan={indiceEscolhido ? 8 : 5} className="text-center py-10 text-gray-400 font-medium">
 Nenhum lançamento encontrado para este contrato.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 {indiceEscolhido && (
 <p className="text-xs text-gray-400 px-1">
 🟡 <strong>Total Correção:</strong> valor calculado no mês aniversário (índice acumulado × saldo devedor).
 🟠 <strong>+ por Parcela:</strong> split distribuído pelas parcelas restantes após cada aniversário — acumula a cada novo período.
 </p>
 )}
 </div>

 {/* ── VISÃO DE IMPRESSÃO ────────────────────────────── */}
 <div id="printable-extrato" className="hidden print:block font-serif text-black s57-print-area print:p-8 text-[11px]">

 <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-center">
 <div>
 <h1 className="text-xl font-bold uppercase tracking-wide">Extrato Financeiro</h1>
 <p className="text-xs text-gray-600">Emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
 </div>
 <div className="text-right">
 <h2 className="font-bold text-base">{empreendimento.nome || 'Studio 57'}</h2>
 {indiceEscolhido && <p className="text-xs">Correção: {indiceEscolhido} — {periodoEscolhido}</p>}
 </div>
 </div>

 <div className="grid grid-cols-2 gap-8 mb-6 text-xs border p-3 rounded">
 <div>
 <h3 className="font-bold border-b mb-2 uppercase text-gray-700">Dados do Cliente</h3>
 <p><strong>Nome:</strong> {cliente.nome || cliente.razao_social}</p>
 <p><strong>CPF/CNPJ:</strong> {formatDoc(cliente.cpf || cliente.cnpj)}</p>
 <p><strong>Endereço:</strong> {enderecoCliente || 'Não informado'}</p>
 {conjuge && <p><strong>Cônjuge:</strong> {conjuge.nome}</p>}
 </div>
 <div>
 <h3 className="font-bold border-b mb-2 uppercase text-gray-700">Dados da Compra</h3>
 <p><strong>Empreendimento:</strong> {empreendimento.nome}</p>
 <p><strong>Unidades:</strong> {displayUnidades}</p>
 <p><strong>Contrato Nº:</strong> {contrato?.numero_contrato || contrato?.id}</p>
 <p><strong>Data Venda:</strong> {formatDate(contrato?.data_venda)}</p>
 <p><strong>Valor Total:</strong> {formatCurrency(contrato?.valor_final_venda)}</p>
 </div>
 </div>

 <div className="mb-4 bg-gray-50 border p-2 flex justify-end gap-6 text-xs">
 <div>Total Recebido: <strong>{formatCurrency(totalPago)}</strong></div>
 <div>Pendente: <strong>{formatCurrency(totalPendente)}</strong></div>
 <div>Saldo Devedor: <strong>{formatCurrency(parseFloat(contrato?.valor_final_venda || 0) - totalPago)}</strong></div>
 {totalCorrecoes > 0 && <div>Total Correções: <strong>{formatCurrency(totalCorrecoes)}</strong></div>}
 </div>

 <table className="w-full text-xs border-collapse border border-gray-300">
 <thead>
 <tr className="bg-gray-200">
 <th className="border border-gray-300 px-2 py-1 text-left w-24">Vencimento</th>
 <th className="border border-gray-300 px-2 py-1 text-left w-24">Pagamento</th>
 <th className="border border-gray-300 px-2 py-1 text-left">Descrição</th>
 <th className="border border-gray-300 px-2 py-1 text-right w-24">Valor</th>
 <th className="border border-gray-300 px-2 py-1 text-right w-28">Saldo Devedor</th>
 {indiceEscolhido && <>
 <th className="border border-gray-300 px-2 py-1 text-right w-20">{indiceEscolhido}</th>
 <th className="border border-gray-300 px-2 py-1 text-right w-24">Total Correção</th>
 <th className="border border-gray-300 px-2 py-1 text-right w-24">+ por Parcela</th>
 </>}
 <th className="border border-gray-300 px-2 py-1 text-center w-20">Status</th>
 </tr>
 </thead>
 <tbody>
 {lancamentosComCorrecao.map((l, idx) => {
 const isPago = l.status === 'Pago' || l.status === 'Conciliado';
 const temEvento = (l.correcao_evento || 0) > 0;
 const temSplit = (l.correcao_split || 0) > 0;
 return (
 <tr key={l.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${temEvento ? 'bg-amber-50' : ''}`}>
 <td className="border border-gray-300 px-2 py-1">{formatDate(l.data_vencimento)}</td>
 <td className="border border-gray-300 px-2 py-1">{l.data_pagamento ? formatDate(l.data_pagamento) : '-'}</td>
 <td className="border border-gray-300 px-2 py-1">{l.descricao}{l.parcela_info && <span className="text-xs ml-1">({l.parcela_info})</span>}</td>
 <td className="border border-gray-300 px-2 py-1 text-right">{formatCurrency(l.valor)}</td>
 <td className="border border-gray-300 px-2 py-1 text-right text-gray-500">{l.saldo_devedor !== null ? formatCurrency(l.saldo_devedor) : '-'}</td>
 {indiceEscolhido && <>
 <td className="border border-gray-300 px-2 py-1 text-right">{l.indice_mes !== null ? `${l.indice_mes.toFixed(4)}%` : '-'}</td>
 <td className={`border border-gray-300 px-2 py-1 text-right font-bold ${temEvento ? 'text-amber-700' : ''}`}>{temEvento ? formatCurrency(l.correcao_evento) : '-'}</td>
 <td className={`border border-gray-300 px-2 py-1 text-right font-bold ${temSplit ? 'text-blue-600' : ''}`}>{temSplit ? `+ ${formatCurrency(l.correcao_split)}` : '-'}</td>
 </>}
 <td className="border border-gray-300 px-2 py-1 text-center font-bold uppercase">{isPago ? 'Pago' : l.status}</td>
 </tr>
 );
 })}
 </tbody>
 </table>

 <div className="mt-16 pt-8 border-t border-black flex justify-between text-xs">
 <div className="text-center w-1/3"><div className="border-t border-black w-full mb-2"></div><p>{empreendimento.nome}</p></div>
 <div className="text-center w-1/3"><div className="border-t border-black w-full mb-2"></div><p>{cliente.nome || cliente.razao_social}</p></div>
 </div>
 </div>
 </>
 );
}
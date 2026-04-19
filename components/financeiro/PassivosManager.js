"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faChartLine, faChartBar, faScaleBalanced, faExclamationTriangle, faPlus, faChevronDown, faChevronUp, faCheck, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import AtivoFormModal from './AtivoFormModal';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export default function PassivosManager({ contas }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { user, hasPermission } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const contasPatrimoniais = useMemo(() => {
 if (!contas) return [];
 return contas.filter(c => c.tipo === 'Conta de Passivo');
 }, [contas]);

 const contasAgrupadas = useMemo(() => {
 const grupos = {};
 contasPatrimoniais.forEach(c => {
 const tipo = c.tipo || 'Outros';
 if (!grupos[tipo]) grupos[tipo] = [];
 grupos[tipo].push(c);
 });
 return Object.entries(grupos).map(([tipo, listaContas]) => ({
 tipo,
 contas: listaContas.sort((a, b) => a.nome.localeCompare(b.nome))
 }));
 }, [contasPatrimoniais]);

 const [contaSelecionadaId, setContaSelecionadaId] = useState('');
 const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingLancamento, setEditingLancamento] = useState(null);
 const [expandedId, setExpandedId] = useState(null);
 const dropdownContaRef = useRef(null);

 useEffect(() => {
 const handleClickOutside = (e) => {
 if (dropdownContaRef.current && !dropdownContaRef.current.contains(e.target)) {
 setIsDropdownContaOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const contaSelecionada = contasPatrimoniais.find(c => c.id == contaSelecionadaId);

 const { data: lancamentos = [], isLoading, isError, error } = useQuery({
 queryKey: ['passivos', contaSelecionadaId, organizacaoId],
 queryFn: async () => {
 if (!organizacaoId) return [];

 let query = supabase
 .from('lancamentos')
 .select(`
 *,
 categoria:categorias_financeiras(nome),
 contrato:contratos(id, numero_contrato),
 conta:contas_financeiras(nome)
 `)
 .eq('organizacao_id', organizacaoId)
 .eq('tipo', 'Passivo')
 .order('data_transacao', { ascending: false });

 if (contaSelecionadaId) {
 query = query.eq('conta_id', contaSelecionadaId);
 }

 const { data: ativos, error } = await query;
 if (error) throw new Error(error.message);
 if (!ativos?.length) return [];

 // 2. Busca despesas (pagamentos) vinculadas a estes passivos
 const ativosIds = ativos.map(a => a.id);
 const { data: receitas } = await supabase
 .from('lancamentos')
 .select('id, descricao, valor, data_transacao, status, lancamento_ativo_id')
 .eq('organizacao_id', organizacaoId)
 .eq('tipo', 'Despesa')
 .in('lancamento_ativo_id', ativosIds);

 // 3. Agrupa receitas (despesas) por ativo
 const receitasPorAtivo = {};
 (receitas || []).forEach(r => {
 if (!receitasPorAtivo[r.lancamento_ativo_id]) receitasPorAtivo[r.lancamento_ativo_id] = [];
 receitasPorAtivo[r.lancamento_ativo_id].push(r);
 });

 // 4. Mescla: adiciona realizado e saldo a cada ativo
 return ativos.map(a => {
 const receitasVinculadas = receitasPorAtivo[a.id] || [];
 const realizado = receitasVinculadas
 .filter(r => r.status === 'Pago')
 .reduce((s, r) => s + Math.abs(parseFloat(r.valor || 0)), 0);
 const totalReceitas = receitasVinculadas
 .reduce((s, r) => s + Math.abs(parseFloat(r.valor || 0)), 0);
 return {
 ...a,
 receitasVinculadas,
 realizado,
 totalReceitas,
 saldo: parseFloat(a.valor || 0) + realizado, // Saldo Devedor Real
 };
 });
 },
 enabled: !!organizacaoId,
 });

 const { data: kpisGlobais } = useQuery({
 queryKey: ['patrimonio-kpis', organizacaoId],
 queryFn: async () => {
 const { data: patrimonio } = await supabase
 .from('lancamentos')
 .select('id, tipo, valor')
 .eq('organizacao_id', organizacaoId)
 .in('tipo', ['Ativo', 'Passivo']);

 if (!patrimonio?.length) return { totalAtivos: 0, totalPassivos: 0, liquido: 0 };
 const ids = patrimonio.map(p => p.id);

 const { data: vinculos } = await supabase
 .from('lancamentos')
 .select('lancamento_ativo_id, tipo, valor')
 .eq('organizacao_id', organizacaoId)
 .eq('status', 'Pago')
 .in('tipo', ['Receita', 'Despesa'])
 .in('lancamento_ativo_id', ids);

 const realizadoMap = {};
 (vinculos || []).forEach(v => {
 if (!realizadoMap[v.lancamento_ativo_id]) realizadoMap[v.lancamento_ativo_id] = 0;
 // Soma o volume financeiro absoluto pago/recebido
 realizadoMap[v.lancamento_ativo_id] += Math.abs(parseFloat(v.valor || 0));
 });

 let totalAtivos = 0;
 let totalPassivos = 0;

 patrimonio.forEach(p => {
 const realizado = realizadoMap[p.id] || 0;
 const originalValue = parseFloat(p.valor || 0);

 if (p.tipo === 'Ativo') {
 totalAtivos += (originalValue - realizado); // Ativo diminui com o que já recebeu
 } else if (p.tipo === 'Passivo') {
 totalPassivos += (originalValue + realizado); // Passivo (negativo) aumenta (em direção ao zero) com o que já pagou
 }
 });

 return { totalAtivos, totalPassivos, liquido: totalAtivos + totalPassivos };
 },
 enabled: !!organizacaoId,
 });

 const handleDelete = async (id) => {
 if (!window.confirm('Excluir este registro patrimonial?')) return;
 const { error } = await supabase.from('lancamentos').delete().eq('id', id);
 if (error) { toast.error('Erro ao excluir'); return; }
 toast.success('Registro excluído');
 queryClient.invalidateQueries({ queryKey: ['patrimonio'] });
 queryClient.invalidateQueries({ queryKey: ['patrimonio-kpis'] });
 };

 const handleEdit = (lancamento) => {
 setEditingLancamento(lancamento);
 setIsModalOpen(true);
 };

 const handleNew = () => {
 setEditingLancamento(null);
 setIsModalOpen(true);
 };

 if (contasPatrimoniais.length === 0) {
 return (
 <div className="py-16 flex flex-col items-center text-center">
 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400">
 <FontAwesomeIcon icon={faScaleBalanced} className="text-2xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-700 mb-1">Nenhuma conta patrimonial cadastrada</h3>
 <p className="text-xs text-gray-500 font-medium max-w-xs">
 Vá em <strong>Contas</strong>, crie uma conta do tipo <strong>"Conta de Passivo"</strong>.
 </p>
 </div>
 );
 }

 const liquido = kpisGlobais?.liquido || 0;

 return (
 <div className="space-y-5">
 {/* KPIs */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
 <div className="flex items-center justify-between mb-2">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Ativos</p>
 <div className="w-8 h-8 bg-green-50 rounded-md flex items-center justify-center text-green-600">
 <FontAwesomeIcon icon={faChartLine} size="sm" />
 </div>
 </div>
 <p className="text-xl font-bold text-gray-800">{formatCurrency(kpisGlobais?.totalAtivos)}</p>
 </div>
 <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
 <div className="flex items-center justify-between mb-2">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Passivos</p>
 <div className="w-8 h-8 bg-red-50 rounded-md flex items-center justify-center text-red-600">
 <FontAwesomeIcon icon={faChartBar} size="sm" />
 </div>
 </div>
 <p className="text-xl font-bold text-gray-800">{formatCurrency(kpisGlobais?.totalPassivos)}</p>
 </div>
 <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
 <div className="flex items-center justify-between mb-2">
 <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Patrimônio Líquido</p>
 <div className={`w-8 h-8 rounded-md flex items-center justify-center ${liquido >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
 <FontAwesomeIcon icon={faScaleBalanced} size="sm" />
 </div>
 </div>
 <p className={`text-xl font-bold ${liquido >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(liquido)}</p>
 </div>
 </div>

 {/* Toolbar: Seletor de Conta + Botão Novo */}
 <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
 {/* Dropdown de Conta */}
 <div className="relative flex-1" ref={dropdownContaRef}>
 <button
 onClick={() => setIsDropdownContaOpen(o => !o)}
 className="w-full flex items-center justify-between gap-3 bg-gray-50 border border-gray-300 hover:border-blue-400 rounded-md px-4 py-2.5 transition-colors"
 >
 <div className="text-left overflow-hidden">
 {contaSelecionada ? (
 <>
 <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">{contaSelecionada.tipo}</p>
 <p className="text-sm font-semibold text-gray-800 truncate">{contaSelecionada.nome}</p>
 </>
 ) : (
 <>
 <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">Global</p>
 <p className="text-sm font-semibold text-gray-800 truncate">Todas as Contas (Panorama Geral)</p>
 </>
 )}
 </div>
 <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 transition-transform flex-shrink-0 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
 </button>

 {isDropdownContaOpen && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
 <div className="p-2 border-b border-gray-100">
 <button
 onClick={() => { setContaSelecionadaId(''); setIsDropdownContaOpen(false); }}
 className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors text-left ${!contaSelecionadaId ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
 >
 <span className="text-sm font-bold text-gray-800">Todas as Contas</span>
 {!contaSelecionadaId && <FontAwesomeIcon icon={faCheck} className="text-blue-600 text-xs flex-shrink-0" />}
 </button>
 </div>
 {contasAgrupadas.map(grupo => (
 <div key={grupo.tipo} className="p-2">
 <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">{grupo.tipo}</h4>
 {grupo.contas.map(conta => {
 const isSelected = conta.id == contaSelecionadaId;
 return (
 <button
 key={conta.id}
 onClick={() => { setContaSelecionadaId(conta.id); setIsDropdownContaOpen(false); }}
 className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 mb-0.5 transition-colors text-left ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}
 >
 <span className="text-sm font-medium">{conta.nome}</span>
 {isSelected && <FontAwesomeIcon icon={faCheck} className="text-blue-600 text-xs flex-shrink-0" />}
 </button>
 );
 })}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Botão Novo */}
 <button
 onClick={handleNew}
 className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700 disabled:bg-gray-300 transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap"
 >
 <FontAwesomeIcon icon={faPlus} />
 Registrar Patrimônio
 </button>
 </div>

 {/* Tabela */}
 <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="min-w-full divide-y divide-gray-100 text-sm">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-8"></th>
 <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Data</th>
 <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
 <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Conta / Tipo</th>
 <th className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Contrato</th>
 <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Valor Original</th>
 <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Realizado</th>
 <th className="px-4 py-3 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Saldo</th>
 <th className="px-4 py-3 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider w-24">Ações</th>
 </tr>
 </thead>
 <tbody className="bg-white divide-y divide-gray-100">
 {isLoading ? (
 <tr><td colSpan="7" className="text-center py-10 text-gray-400">
 <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Carregando...
 </td></tr>
 ) : isError ? (
 <tr><td colSpan="7" className="text-center py-10 text-red-500">
 <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />{error.message}
 </td></tr>
 ) : lancamentos.length === 0 ? (
 <tr><td colSpan="7">
 <div className="py-16 flex flex-col items-center text-center">
 <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-400">
 <FontAwesomeIcon icon={faPlus} className="text-2xl" />
 </div>
 <h3 className="text-sm font-bold text-gray-700 mb-1">Nenhum registro patrimonial</h3>
 <p className="text-xs text-gray-500 font-medium">Clique em "Registrar Patrimônio" para adicionar.</p>
 </div>
 </td></tr>
 ) : lancamentos.map(l => {
 const contratoLabel = l.contrato?.numero_contrato ? `Nº ${l.contrato.numero_contrato}` : (l.contrato_id ? `#${l.contrato_id}` : null);
 const isExpanded = expandedId === l.id;
 const temReceitas = l.receitasVinculadas?.length > 0;
 const saldo = l.saldo ?? parseFloat(l.valor || 0);
 return (
 <>
 <tr key={l.id} className="hover:bg-blue-50/20 transition-colors group">
 {/* Expandir */}
 <td className="px-2 py-3 text-center">
 {temReceitas ? (
 <button onClick={() => setExpandedId(isExpanded ? null : l.id)}
 className="text-gray-400 hover:text-blue-600 p-1 transition-colors">
 <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} className="text-xs" />
 </button>
 ) : <span className="text-gray-200 text-xs">—</span>}
 </td>
 <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{formatDate(l.data_transacao)}</td>
 <td className="px-4 py-3 font-semibold text-gray-700">{l.descricao}</td>
 <td className="px-4 py-3 flex flex-col gap-1 items-start">
 {l.conta?.nome && <span className="text-[10px] font-bold text-gray-500 uppercase">{l.conta.nome}</span>}
 <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border bg-red-50 text-red-700 border-red-200 inline-block`}>
 {l.tipo}
 </span>
 </td>
 <td className="px-4 py-3">
 {contratoLabel ? (
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
 {contratoLabel}
 </span>
 ) : <span className="text-gray-400">—</span>}
 </td>
 <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">{formatCurrency(l.valor)}</td>
 <td className="px-4 py-3 text-right whitespace-nowrap">
 {l.realizado > 0 ? (
 <span className="font-bold text-green-700">{formatCurrency(l.realizado)}</span>
 ) : <span className="text-gray-400">—</span>}
 </td>
 <td className="px-4 py-3 text-right whitespace-nowrap">
 <span className={`font-bold ${saldo >= 0 ? 'text-gray-400' : saldo > parseFloat(l.valor || 0) ? 'text-amber-700' : 'text-gray-800'}`}>
 {formatCurrency(saldo)}
 </span>
 </td>
 <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
 <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => handleEdit(l)} title="Editar"
 className="text-blue-500 hover:text-blue-700 p-2 transition-colors">
 <FontAwesomeIcon icon={faEdit} />
 </button>
 <button onClick={() => handleDelete(l.id)} title="Excluir"
 className="text-red-500 hover:text-red-700 p-2 transition-colors">
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </div>
 </td>
 </tr>
 {/* Linha expandida: receitas vinculadas */}
 {isExpanded && temReceitas && (
 <tr key={`${l.id}-receitas`}>
 <td colSpan="9" className="px-0 py-0 bg-red-50/50 border-b border-red-100">
 <div className="px-8 py-2">
 <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Despesas vinculadas (amortização da dívida)</p>
 <table className="w-full text-xs">
 <tbody>
 {l.receitasVinculadas.map(r => (
 <tr key={r.id} className="border-b border-red-100 last:border-0">
 <td className="py-1.5 text-gray-500 whitespace-nowrap w-28">{formatDate(r.data_transacao)}</td>
 <td className="py-1.5 text-gray-700 font-medium">{r.descricao}</td>
 <td className="py-1.5 text-center">
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Pago'
 ? 'bg-green-100 text-green-700'
 : 'bg-amber-100 text-amber-700'
 }`}>{r.status}</span>
 </td>
 <td className="py-1.5 text-right font-bold text-red-700 whitespace-nowrap">{formatCurrency(r.valor)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </td>
 </tr>
 )}
 </>
 );
 })}

 </tbody>
 {lancamentos.length > 0 && (
 <tfoot className="bg-gray-50 border-t-2 border-gray-200">
 <tr>
 <td colSpan="5" className="px-4 py-3 text-right font-bold text-gray-600 text-sm">Total da Conta:</td>
 <td className="px-4 py-3 text-right font-bold text-gray-800 text-sm whitespace-nowrap">
 {formatCurrency(lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0))}
 </td>
 <td className="px-4 py-3 text-right font-bold text-gray-800 text-sm whitespace-nowrap">
 {formatCurrency(lancamentos.reduce((s, l) => s + (l.realizado || 0), 0))}
 </td>
 <td className="px-4 py-3 text-right font-bold text-gray-800 text-sm whitespace-nowrap">
 {formatCurrency(lancamentos.reduce((s, l) => s + (l.saldo !== undefined ? l.saldo : parseFloat(l.valor || 0)), 0))}
 </td>
 <td />
 </tr>
 </tfoot>
 )}
 </table>
 </div>
 </div>

 <AtivoFormModal
 isOpen={isModalOpen}
 onClose={() => { setIsModalOpen(false); setEditingLancamento(null); }}
 onSuccess={() => {
 queryClient.invalidateQueries({ queryKey: ['patrimonio'] });
 queryClient.invalidateQueries({ queryKey: ['patrimonio-kpis'] });
 }}
 contasPatrimoniais={contasPatrimoniais}
 initialData={editingLancamento}
 defaultTipo="Passivo"
 />
 </div>
 );
}
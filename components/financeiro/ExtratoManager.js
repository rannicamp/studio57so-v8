"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faArrowUp, faArrowDown, faAngleRight, faTrash, faHandHoldingDollar, faCheckCircle, faExclamationTriangle, faFileAlt, faChevronDown, faChevronRight, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';
import OfxUploader from './OfxUploader';
import PanelConciliacaoOFX from './PanelConciliacaoOFX';
import { v4 as uuidv4 } from 'uuid'; // Para gerar o ID do Borderô

const formatCurrency = (value) => {
 if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function ExtratoManager({ contas, empresas }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { user, hasPermission } = useAuth();
 const organizacaoId = user?.organizacao_id;

 const contasAgrupadas = useMemo(() => {
 if (!contas) return [];
 const contasFiltradas = contas.filter(c => c.tipo !== 'Cartão de Crédito');

 // Agrupa por Empresa -> Tipo
 const empresas = {};
 contasFiltradas.forEach(c => {
 const empresaNome = c.empresa?.nome_fantasia || c.empresa?.razao_social || 'Contas Base (Sem Empresa Vínculada)';
 const tipoNome = c.tipo || 'Outros';

 if (!empresas[empresaNome]) empresas[empresaNome] = {};
 if (!empresas[empresaNome][tipoNome]) empresas[empresaNome][tipoNome] = [];

 empresas[empresaNome][tipoNome].push(c);
 });

 // Transforma o dicionário em array pronto para o render
 return Object.entries(empresas).map(([empresa, tipos]) => ({
 empresa,
 tipos: Object.entries(tipos).map(([tipo, listaContas]) => ({
 tipo,
 contas: listaContas.sort((a, b) => a.nome.localeCompare(b.nome))
 })).sort((a, b) => a.tipo.localeCompare(b.tipo))
 })).sort((a, b) => a.empresa.localeCompare(b.empresa));
 }, [contas]);

 // Estados
 const [contaSelecionadaId, setContaSelecionadaId] = useState('');

 useEffect(() => {
 const savedId = typeof window !== 'undefined' ? localStorage.getItem('studio57_last_conta_id') : null;
 let startId = contasAgrupadas?.[0]?.tipos?.[0]?.contas?.[0]?.id || '';
 if (savedId && contas && contas.some(c => c.id == savedId)) {
 startId = savedId;
 }
 if (!contaSelecionadaId && startId) {
 setContaSelecionadaId(startId);
 }
 }, [contas, contasAgrupadas, contaSelecionadaId]);

 const handleSelectConta = (id) => {
 setContaSelecionadaId(id);
 if (typeof window !== 'undefined') localStorage.setItem('studio57_last_conta_id', id);
 setIsDropdownContaOpen(false);
 };
 const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
 const dropdownContaRef = useRef(null);

 useEffect(() => {
 const handleClickOutside = (event) => {
 if (dropdownContaRef.current && !dropdownContaRef.current.contains(event.target)) {
 setIsDropdownContaOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const [mesSelecionado, setMesSelecionado] = useState(startOfMonth(new Date())); // Padrão: Mês atual
 const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [ofxPainelAberto, setOfxPainelAberto] = useState(false);
 const [arquivoOfxExpandido, setArquivoOfxExpandido] = useState(null); // id do arq selecionado
 const [modoConciliacaoMes, setModoConciliacaoMes] = useState(null); // ativa o painel duplo e esconde extrato
 const [selectedIds, setSelectedIds] = useState([]); // Array de IDs selecionados para Borderô

 const contaSelecionada = contas?.find(c => c.id == contaSelecionadaId);

 // Query: Busca a data do lançamento mais antigo da conta para definir o início do histórico
 const { data: dataInicioConta } = useQuery({
 queryKey: ['extrato_data_inicio', contaSelecionadaId, organizacaoId],
 queryFn: async () => {
 if (!contaSelecionadaId || !organizacaoId) return null;
 const { data, error } = await supabase
 .from('lancamentos')
 .select('data_pagamento')
 .eq('conta_id', Number(contaSelecionadaId))
 .eq('organizacao_id', organizacaoId)
 .in('status', ['Pago', 'Conciliado'])
 .order('data_pagamento', { ascending: true })
 .limit(1);
 if (error) throw error;
 return data?.[0]?.data_pagamento || null; // Retorna a data mais antiga como string YYYY-MM-DD
 },
 enabled: !!contaSelecionadaId && !!organizacaoId
 });

 // Gera a lista de meses dinamicamente: do mês atual até o mês do lançamento mais antigo
 const mesesDisponiveis = useMemo(() => {
 const meses = [];
 const hoje = new Date();
 // Se não tiver data de início (sem lançamentos ainda), mostra apenas mês atual
 if (!dataInicioConta) {
 meses.push(startOfMonth(hoje));
 return meses;
 }
 const mesInicio = startOfMonth(parseISO(dataInicioConta));
 let cursor = startOfMonth(hoje);
 // Gera todos os meses de hoje até o mês do primeiro lançamento
 while (cursor >= mesInicio) {
 meses.push(cursor);
 cursor = subMonths(cursor, 1);
 }
 return meses;
 }, [dataInicioConta]);

 // Queries
 const { data: extratoData, isLoading } = useQuery({
 queryKey: ['extrato', contaSelecionadaId, mesSelecionado.toISOString(), organizacaoId],
 queryFn: async () => {
 if (!contaSelecionadaId || !organizacaoId) return null;

 const startDate = format(startOfMonth(mesSelecionado), 'yyyy-MM-dd');
 const endDate = format(endOfMonth(mesSelecionado), 'yyyy-MM-dd');

 // 1. Busca Saldo Anterior RPC
 const { data: saldoAnteriorAux, error: saldoError } = await supabase.rpc('calcular_saldo_anterior', {
 p_conta_id: Number(contaSelecionadaId),
 p_data_inicio: startDate,
 p_organizacao_id: organizacaoId
 });
 if (saldoError) throw saldoError;

 const saldoAnterior = saldoAnteriorAux || 0;

 // 2. Busca Lançamentos Oficiais do Mês (C/ Paginação Robusta para Contas Volumosas)
 let lancamentos = [];
 let from = 0;
 const step = 999;
 let hasMore = true;

 while (hasMore) {
 const { data, error: lancamentosError } = await supabase
 .from('lancamentos')
 .select('*, favorecido:contatos!favorecido_contato_id(*), categoria:categorias_financeiras(*), anexos:lancamentos_anexos(*)')
 .eq('conta_id', Number(contaSelecionadaId))
 .eq('organizacao_id', organizacaoId)
 .gte('data_pagamento', startDate)
 .lte('data_pagamento', endDate)
 .in('status', ['Pago', 'Conciliado'])
 .order('data_pagamento', { ascending: true })
 .order('created_at', { ascending: true })
 .range(from, from + step);

 if (lancamentosError) throw lancamentosError;

 if (!data || data.length === 0) {
 hasMore = false;
 } else {
 lancamentos = [...lancamentos, ...data];
 if (data.length < (step + 1)) hasMore = false;
 else from += step + 1;
 }
 }

 // 3. Agrupamento de Borderô (agrupamento_id) e Totais
 let saldoCorrente = saldoAnterior;
 let totalEntradas = 0;
 let totalSaidas = 0;

 const borderosMap = {};
 const itensFinais = [];

 (lancamentos || []).forEach(lanc => {
 const valorAbsoluto = Math.abs(Number(lanc.valor));
 const entrada = lanc.tipo === 'Receita' ? valorAbsoluto : 0;
 const saida = lanc.tipo === 'Despesa' ? valorAbsoluto : 0;
 saldoCorrente += entrada - saida;
 totalEntradas += entrada;
 totalSaidas += saida;

 const status_exibicao = lanc.fitid_banco ? 'Conciliado' : lanc.status;
 const l = { ...lanc, entrada, saida, saldo_acumulado: saldoCorrente, status_exibicao };

 // Lógica de agrupar Borderô
 if (l.agrupamento_id) {
 if (!borderosMap[l.agrupamento_id]) {
 // Cria o "Pai Fictício" do Borderô na primeira vez que achar um filho
 const paiFicticio = {
 id: l.agrupamento_id, // Usamos o proprio agrupamento_id como chave do pai
 isBordero: true,
 isExpanded: false,
 agrupamento_id: l.agrupamento_id,
 descricao: 'Borderô de Lançamentos',
 tipo: l.tipo, // Assume o tipo do primeiro filho
 valorTotal: 0,
 data_pagamento: l.data_pagamento, // Usa a data do primeiro filho encontrado
 filhos: [],
 saldo_acumulado: 0, // Será atualizado depois status_exibicao: 'Misto'
 };
 borderosMap[l.agrupamento_id] = paiFicticio;
 itensFinais.push(paiFicticio); // O pai entra na lista principal
 }
 // Adiciona o filho e soma o total
 borderosMap[l.agrupamento_id].filhos.push(l);
 borderosMap[l.agrupamento_id].valorTotal += valorAbsoluto;
 borderosMap[l.agrupamento_id].saldo_acumulado = l.saldo_acumulado; // Saldo da linha pai reflete o saldo após todos passarem
 } else {
 // Lançamento normal sem borderô
 itensFinais.push(l);
 }
 });

 // Atualiza status e descrição dos Borderôs
 Object.values(borderosMap).forEach(b => {
 b.descricao = `Borderô - ${b.filhos.length} lançamentos (${b.tipo === 'Despesa' ? 'Pagamentos' : 'Recebimentos'})`;
 const todosConciliados = b.filhos.every(f => f.status_exibicao === 'Conciliado');
 const algumConciliado = b.filhos.some(f => f.status_exibicao === 'Conciliado');
 if (todosConciliados) b.status_exibicao = 'Conciliado';
 else if (algumConciliado) b.status_exibicao = 'Parcial';
 else b.status_exibicao = 'Pendente';

 // Se o Pai é Despesa, a saída total dele é o valorTotal
 if (b.tipo === 'Despesa') { b.saida = b.valorTotal; b.entrada = 0; }
 else { b.entrada = b.valorTotal; b.saida = 0; }
 });

 return {
 saldoAnterior,
 entradas: totalEntradas,
 saidas: totalSaidas,
 saldoFinal: saldoCorrente,
 itens: itensFinais
 };
 },
 enabled: !!contaSelecionadaId && !!mesSelecionado && !!organizacaoId
 });

 // Query: TODOS os Arquivos OFX da conta (filtragem por mes feita localmente no card)
 const { data: arquivosOfxMes } = useQuery({
 queryKey: ['ofx_arquivos', contaSelecionadaId, organizacaoId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('banco_arquivos_ofx')
 .select('*')
 .eq('conta_id', Number(contaSelecionadaId))
 .eq('organizacao_id', organizacaoId)
 .order('periodo_inicio', { ascending: false });

 if (error) throw error;
 return data || [];
 },
 enabled: !!contaSelecionadaId && !!organizacaoId
 });

 // Query: Transaçoes do Arquivo OFX selecionado (drilldown)
 const { data: ofxTransacoes, isLoading: isLoadingOfxTransacoes } = useQuery({
 queryKey: ['ofx_transacoes', arquivoOfxExpandido],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('banco_transacoes_ofx')
 .select('*')
 .eq('arquivo_id', arquivoOfxExpandido)
 .order('data_transacao', { ascending: true });
 if (error) throw error;
 return data || [];
 },
 enabled: !!arquivoOfxExpandido
 });

 // Exclusão usa useMutation para integrar com o cache
 const exclusaoMutation = useMutation({
 mutationFn: async (id) => {
 const { error } = await supabase
 .from('lancamentos')
 .delete()
 .eq('id', id)
 .eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Lançamento excluído com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); // Invalida caso exista
 },
 onError: (err) => {
 toast.error(`Erro ao excluir: ${err.message}`);
 }
 });

 const handleDelete = (e, item) => {
 e.stopPropagation(); // Evita abrir o sidebar se clicar no botão de apagar
 if (window.confirm(`Deseja realmente excluir o lançamento "${item.descricao}"?`)) {
 exclusaoMutation.mutate(item.id);
 }
 };

 // Exclusão de Arquivos OFX (Limpa transações orfãs via banco)
 const exclusaoOfxMutation = useMutation({
 mutationFn: async (arquivoId) => {
 const { error } = await supabase
 .from('banco_arquivos_ofx')
 .delete()
 .eq('id', arquivoId)
 .eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Arquivo OFX e suas transações excluídos!');
 setArquivoOfxExpandido(null);
 queryClient.invalidateQueries({ queryKey: ['ofx_arquivos'] });
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 },
 onError: (err) => {
 toast.error(`Erro ao excluir arquivo OFX: ${err.message}`);
 }
 });

 const handleDeleteOfx = (e, arq) => {
 e.stopPropagation();
 if (window.confirm(`Deseja realmente excluir o arquivo "${arq.nome_arquivo}"? Todas as suas transações serão apagadas da base.`)) {
 exclusaoOfxMutation.mutate(arq.id);
 }
 };

 // --- LÓGICA DE BORDERÔ / SELEÇÃO MÚLTIPLA ---
 const toggleSelectAll = () => {
 if (!extratoData || extratoData.itens.length === 0) return;
 if (selectedIds.length === extratoData.itens.length) {
 setSelectedIds([]); // Desmarca tudo
 } else {
 setSelectedIds(extratoData.itens.map(i => i.id)); // Marca tudo
 }
 };

 const toggleSelectRow = (e, id) => {
 e.stopPropagation();
 setSelectedIds(prev =>
 prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
 );
 };

 // Mutation: Criar Borderô
 const criarBorderoMutation = useMutation({
 mutationFn: async () => {
 if (selectedIds.length < 2) throw new Error("Selecione pelo menos 2 lançamentos para agrupar.");
 const novoBorderoId = uuidv4();
 const { error } = await supabase
 .from('lancamentos')
 .update({ agrupamento_id: novoBorderoId })
 .in('id', selectedIds)
 .eq('organizacao_id', organizacaoId);

 if (error) throw error;
 return selectedIds.length;
 },
 onSuccess: (qtde) => {
 toast.success(`${qtde} Lançamentos agrupados com sucesso!`);
 setSelectedIds([]);
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 },
 onError: (err) => {
 toast.error(`Erro ao criar borderô: ${err.message}`);
 }
 });

 const handleCriarBordero = () => {
 if (window.confirm(`Tem certeza que deseja agrupar ${selectedIds.length} lançamentos em um único Borderô?`)) {
 criarBorderoMutation.mutate();
 }
 };

 const [expandedBorderos, setExpandedBorderos] = useState({}); // Controla quais borderôs estao abertos

 const toggleBordero = (e, borderoId) => {
 e.stopPropagation();
 setExpandedBorderos(prev => ({ ...prev, [borderoId]: !prev[borderoId] }));
 };

 const desagruparBorderoCompletoMutation = useMutation({
 mutationFn: async (borderoId) => {
 const { error } = await supabase
 .from('lancamentos')
 .update({ agrupamento_id: null })
 .eq('agrupamento_id', borderoId)
 .eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Borderô desfeito com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 }
 });

 const desagruparIndividualMutation = useMutation({
 mutationFn: async (lancamentoId) => {
 const { error } = await supabase
 .from('lancamentos')
 .update({ agrupamento_id: null })
 .eq('id', lancamentoId)
 .eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Lançamento removido do borderô!');
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 }
 });

 const handleDesagruparBordero = (e, borderoId) => {
 e.stopPropagation();
 if (window.confirm("Deseja realmente desfazer este Borderô? Os lançamentos continuarão existindo separadamente.")) {
 desagruparBorderoCompletoMutation.mutate(borderoId);
 }
 };

 const handleRemoverDoBordero = (e, lancamentoId) => {
 e.stopPropagation();
 if (window.confirm("Retirar este lançamento específico do Borderô?")) {
 desagruparIndividualMutation.mutate(lancamentoId);
 }
 };

 const handleRowClick = (item) => {
 if (item.isBordero) {
 // Se clica no borderô e nao for no chevrom, também expande
 setExpandedBorderos(prev => ({ ...prev, [item.id]: !prev[item.id] }));
 } else {
 setLancamentoSelecionado(item);
 setIsSidebarOpen(true);
 }
 };

 return (
 <div className="space-y-6 animate-fadeIn">
 {/* CABEÇALHO UNIFICADO DE CONTA (Estilo Nubank) */}
 <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
 <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:block">
 <FontAwesomeIcon icon={faLandmark} size="lg" />
 </div>
 <div className="flex-1 w-full">
 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Conta</label>
 <div className="relative w-full xl:w-2/3" ref={dropdownContaRef}>
 <button
 onClick={() => setIsDropdownContaOpen(!isDropdownContaOpen)}
 className="w-full text-left bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
 >
 {contaSelecionada ? (
 <div className="flex flex-col">
 <span className="font-bold text-sm text-gray-800">{contaSelecionada.nome}</span>
 <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5 flex flex-wrap gap-1 items-center">
 <span>{contaSelecionada.empresa?.nome_fantasia || 'Sem Empresa'} • {contaSelecionada.tipo}</span>
 {(contaSelecionada.agencia || contaSelecionada.numero_conta) && (
 <>
 <span className="hidden sm:inline">|</span>
 <span className="font-mono text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">Ag: {contaSelecionada.agencia || '-'} / Cc: {contaSelecionada.numero_conta || '-'}</span>
 </>
 )}
 </span>
 </div>
 ) : (
 <span className="text-gray-500 text-sm font-semibold">-- Selecione uma conta --</span>
 )}
 <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
 </button>

 {isDropdownContaOpen && (
 <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[450px] overflow-y-auto custom-scrollbar p-1 origin-top animate-fadeIn">
 {contasAgrupadas.map(gEmpresa => (
 <div key={gEmpresa.empresa} className="p-2">
 <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2 pl-1">{gEmpresa.empresa}</h3>

 <div className="space-y-3">
 {gEmpresa.tipos.map(gTipo => (
 <div key={gTipo.tipo} className="space-y-1">
 <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5 pl-2 mb-1">
 <span className="w-1 h-1 rounded-full bg-indigo-300"></span>
 {gTipo.tipo}
 </h4>

 <div className="flex flex-col gap-1 w-full">
 {gTipo.contas.map(c => {
 const isSelected = contaSelecionadaId === c.id;
 return (
 <button
 key={c.id}
 onClick={() => handleSelectConta(c.id)}
 className={`text-left flex items-start justify-between p-2.5 rounded-lg border transition-all duration-200 ${isSelected ? 'bg-indigo-50/80 border-indigo-200 shadow-sm' : 'border-transparent bg-transparent hover:bg-gray-50'}`}
 >
 <div className="flex flex-col flex-1 pr-2">
 <span className={`font-bold text-[13px] leading-tight ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{c.nome}</span>
 <span className="flex flex-col xs:flex-row xs:items-center gap-1 mt-0.5 text-[9px] text-gray-400">
 {c.instituicao && <span className="font-sans uppercase">{c.instituicao}</span>}
 {(c.agencia || c.numero_conta) && (
 <span className="font-mono bg-gray-100 text-gray-500 px-1 rounded truncate">Ag: {c.agencia || '-'} / Cc: {c.numero_conta || '-'}</span>
 )}
 </span>
 </div>
 {isSelected && <FontAwesomeIcon icon={faCheck} className="text-indigo-500 text-[10px] mt-0.5" />}
 </button>
 );
 })}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>

 {contaSelecionada && (
 <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">

 <div className="hidden sm:block">
 <OfxUploader
 organizacaoId={organizacaoId}
 contas={contas}
 onUploadSuccess={() => {
 queryClient.invalidateQueries({ queryKey: ['extrato'] });
 }}
 />
 </div>
 {contaSelecionada.limite_cheque_especial > 0 && (
 <div className="bg-red-50 p-2 md:p-3 rounded-lg border border-red-100 flex items-center gap-3">
 <div className="bg-red-100 p-2 rounded-full text-red-600 hidden md:block">
 <FontAwesomeIcon icon={faHandHoldingDollar} />
 </div>
 <div className="text-right sm:text-left">
 <p className="text-[10px] md:text-xs text-red-700 uppercase font-semibold">Cheque Especial</p>
 <p className="text-sm md:text-lg font-bold text-red-600">
 {formatCurrency(contaSelecionada.limite_cheque_especial)}
 </p>
 </div>
 </div>
 )}

 <div className="bg-gray-50 p-2 md:p-3 rounded-lg border">
 <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold">Saldo Atual na Conta</p>
 <p className="text-sm md:text-lg font-bold text-gray-700">
 {formatCurrency(contaSelecionada.saldo_inicial || 0)}
 {/* O saldo atual exato hoje pode ser complexo, por enquanto mantendo como no modal original que não possuia esse dado. */}
 </p>
 </div>
 </div>
 )}
 </div>

 {/* CONTEÚDO: Grid 1/4 - 3/4 */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

 {/* LADO ESQUERDO: Seletor de Meses */}
 <div className="lg:col-span-1 space-y-3">
 <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Período de Referência</h3>
 <div className="bg-white border text-sm rounded-lg flex flex-col shadow-sm overflow-y-auto max-h-[600px] custom-scrollbar">
 {mesesDisponiveis.map((mes, idx) => {
 const isSelected = isSameMonth(mes, mesSelecionado);
 const isCurrentMonth = isSameMonth(mes, new Date());
 const mesKey = mes.toISOString();
 const ofxDesteMes = (arquivosOfxMes || []).filter(a => {
 if (!a.periodo_inicio || !a.periodo_fim) return false;
 const startDate = format(startOfMonth(mes), 'yyyy-MM-dd');
 const endDate = format(endOfMonth(mes), 'yyyy-MM-dd');
 return a.periodo_inicio <= endDate && a.periodo_fim >= startDate;
 });
 const ofxAberto = ofxPainelAberto === mesKey;

 return (
 <div key={idx} className={`border-b last:border-0 transition-all border-l-4 ${isSelected ? 'border-l-blue-500' : 'border-l-transparent'}`}>
 {/* Linha principal do mês */}
 <div className={`flex items-center ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
 <button
 onClick={() => { setMesSelecionado(mes); setModoConciliacaoMes(null); setArquivoOfxExpandido(null); setSelectedIds([]); }}
 className="flex-1 text-left p-4"
 >
 <div className={`font-bold capitalize ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
 {format(mes, 'MMMM', { locale: ptBR })} <span className="font-normal opacity-70">{format(mes, 'yyyy')}</span>
 </div>
 {isCurrentMonth && (
 <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide mt-1 inline-block
 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
 Atual
 </span>
 )}
 </button>

 {/* Botão de Conciliar - Ativa a Direita */}
 {ofxDesteMes.length > 0 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setMesSelecionado(mes);
 setModoConciliacaoMes(mesKey);
 }}
 className={`mr-2 px-3 py-1.5 transition-all text-xs font-bold rounded-lg border flex items-center gap-1 shadow-sm
 ${modoConciliacaoMes === mesKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
 title={`Conciliar Lançamentos de ${format(mes, 'MMMM', { locale: ptBR })}`}
 >
 <FontAwesomeIcon icon={faHandHoldingDollar} />
 <span className="hidden sm:inline">Conciliar</span>
 </button>
 )}

 {/* Seta do OFX (Para apenas visualizar e deletar arquivos) */}
 {ofxDesteMes.length > 0 && (
 <button
 onClick={(e) => { e.stopPropagation(); setOfxPainelAberto(ofxAberto ? null : mesKey); setArquivoOfxExpandido(null); }}
 className={`pr-3 pl-2 py-4 transition-colors flex items-center gap-1 text-[10px] font-bold border-l
 ${ofxAberto ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
 title="Ver arquivos OFX deste mês"
 >
 <FontAwesomeIcon icon={faFileAlt} />
 <span>{ofxDesteMes.length}</span>
 <FontAwesomeIcon icon={ofxAberto ? faChevronDown : faChevronRight} />
 </button>
 )}
 </div>

 {/* Expansão dos Arquivos OFX (Apenas Gerenciamento Visual agora) */}
 {ofxAberto && (
 <div className="bg-indigo-50/60 border-t border-indigo-100 px-3 py-2 flex flex-col gap-1.5">
 {ofxDesteMes.map(arq => (
 <div
 key={arq.id}
 className={`w-full group rounded-lg border transition-all flex items-stretch overflow-hidden bg-white/70 border-indigo-100 hover:border-indigo-300`}
 >
 <div className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 min-w-0">
 <FontAwesomeIcon icon={faFileAlt} className={`flex-shrink-0 text-xs text-indigo-300`} />
 <div className="min-w-0 flex-1">
 <p className="font-bold text-gray-800 truncate text-[11px]" title={arq.nome_arquivo}>{arq.nome_arquivo}</p>
 <p className="text-[9px] text-gray-400">
 {arq.periodo_inicio ? format(parseISO(arq.periodo_inicio), 'dd/MM/yy') : '?'} → {arq.periodo_fim ? format(parseISO(arq.periodo_fim), 'dd/MM/yy') : '?'}
 </p>
 </div>
 </div>
 <button
 onClick={(e) => handleDeleteOfx(e, arq)}
 className="px-3 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-transparent group-hover:border-indigo-100"
 title="Apagar arquivo OFX do banco"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* LADO DIREITO: Extrato ou Painel de Conciliação */}
 <div className="lg:col-span-3">

 {modoConciliacaoMes ? (
 // === MODO CONCILIADOR: DUAL PANEL (Novo Componente) ===
 <PanelConciliacaoOFX
 contaId={contaSelecionadaId}
 mesSelecionado={modoConciliacaoMes}
 isCartaoCredito={contaSelecionada?.tipo === 'Cartão de Crédito'}
 arquivosOfxIds={(arquivosOfxMes || [])
 .filter(a => {
 const mesAlvo = new Date(modoConciliacaoMes);
 const startDate = format(startOfMonth(mesAlvo), 'yyyy-MM-dd');
 const endDate = format(endOfMonth(mesAlvo), 'yyyy-MM-dd');
 return a.periodo_inicio <= endDate && a.periodo_fim >= startDate;
 })
 .map(arq => arq.id)}
 onClosePanel={() => setModoConciliacaoMes(null)}
 />
 ) : isLoading ? (
 <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
 <p className="text-gray-500 mt-2">Carregando movimentações do mês...</p>
 </div>
 ) : extratoData ? (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
 {/* Resumo do Mês (TopBar) */}
 <div className="p-6 border-b bg-white">
 <h2 className="text-xl font-bold text-gray-800 capitalize mb-4">
 Movimentações de {format(mesSelecionado, 'MMMM / yyyy', { locale: ptBR })}
 </h2>

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
 <p className="text-[10px] font-bold text-gray-500 uppercase">Saldo Anterior</p>
 <p className="text-sm font-semibold text-gray-800 mt-1" title="Balanço inicial no começo deste mês">
 {formatCurrency(extratoData.saldoAnterior)}
 </p>
 </div>
 <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm">
 <p className="text-[10px] font-bold text-green-700 uppercase"><FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Entradas (No Mês)</p>
 <p className="text-sm font-semibold text-green-700 mt-1">+{formatCurrency(extratoData.entradas)}</p>
 </div>
 <div className="bg-red-50 p-3 rounded-lg border border-red-100 shadow-sm">
 <p className="text-[10px] font-bold text-red-700 uppercase"><FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Saídas (No Mês)</p>
 <p className="text-sm font-semibold text-red-700 mt-1">-{formatCurrency(extratoData.saidas)}</p>
 </div>
 <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-sm">
 <p className="text-[10px] font-bold text-blue-700 uppercase">Saldo Final (No Período)</p>
 <p className={`text-sm font-bold mt-1 ${extratoData.saldoFinal < 0 ? 'text-red-600' : 'text-blue-800'}`}>
 {formatCurrency(extratoData.saldoFinal)}
 </p>
 </div>
 </div>
 </div>

 {/* Barra de Ação Flutuante (Borderô) */}
 {selectedIds.length > 0 && (
 <div className="bg-indigo-600 text-white p-3 flex items-center justify-between animate-fadeIn sticky top-0 z-10 shadow-md">
 <div className="flex items-center gap-3">
 <span className="bg-indigo-800 text-xs font-bold px-2 py-1 rounded-full">{selectedIds.length} selecionados</span>
 <span className="text-sm font-medium">Lançamentos prontos para ação em lote.</span>
 </div>
 <div className="flex gap-2">
 <button
 onClick={() => setSelectedIds([])}
 className="text-indigo-200 hover:text-white px-3 py-1.5 text-xs font-bold transition-colors"
 >
 Cancelar
 </button>
 <button
 onClick={handleCriarBordero}
 disabled={selectedIds.length < 2 || criarBorderoMutation.isPending}
 className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
 >
 {criarBorderoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> : null}
 Agrupar em Borderô
 </button>
 </div>
 </div>
 )}

 {/* Lista de Movimentações */}
 <div className="divide-y divide-gray-100">
 {extratoData.itens.length === 0 ? (
 <div className="p-8 text-center text-gray-500">
 Nenhuma movimentação identificada para o período.
 </div>
 ) : (
 extratoData.itens.map(item => {

 // RENDERIZAÇÃO DE LINHA FILHO NORMAL
 const renderRowNormal = (l, isFilho = false) => (
 <div
 key={l.id}
 onClick={() => handleRowClick(l)}
 className={`p-4 cursor-pointer transition-colors flex items-center justify-between group ${selectedIds.includes(l.id) ? 'bg-indigo-50/50 hover:bg-indigo-50 border-l-4 border-l-indigo-400' :
 l.isOfxStandalone ? 'bg-orange-50 hover:bg-orange-100 border-l-4 border-l-orange-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
 ${isFilho ? 'pl-12 bg-gray-50/50 border-t border-dashed' : ''}
 `}
 >
 {/* Checkbox (Apenas se NAO for filho ou standalone OFX no momento) */}
 {!isFilho && !l.isOfxStandalone && (
 <div className="flex-shrink-0 pr-4 pl-1" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={selectedIds.includes(l.id)}
 onChange={(e) => toggleSelectRow(e, l.id)}
 className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer transition-all"
 />
 </div>
 )}

 {/* Se for filho, da um espacinho no lugar do checkbox */}
 {isFilho && <div className="flex-shrink-0 w-8 flex justify-center text-gray-300"><FontAwesomeIcon icon={faAngleRight} className="text-[10px]" /></div>}

 {/* Data */}
 <div className="flex-shrink-0 w-16 text-center">
 <div className={`text-sm font-bold ${l.isOfxStandalone ? 'text-orange-600' : 'text-gray-700'}`}>
 {format(parseISO(l.data_pagamento), 'dd')}
 </div>
 <div className={`text-[10px] uppercase font-semibold ${l.isOfxStandalone ? 'text-orange-600' : 'text-gray-400'}`}>
 {format(parseISO(l.data_pagamento), 'MMM', { locale: ptBR })}
 </div>
 {l.isOfxStandalone && (
 <div className="text-[10px] text-orange-600 mt-1" title="Apenas no OFX">
 <FontAwesomeIcon icon={faExclamationTriangle} /> OFX
 </div>
 )}
 </div>

 {/* Descrição e Infos */}
 <div className="flex-1 px-4 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <p className={`text-sm font-bold truncate ${l.isOfxStandalone ? 'text-blue-600' : 'text-gray-800'}`} title={l.descricao}>
 {l.descricao}
 </p>
 {l.status_exibicao === 'Conciliado' && (
 <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" title="Lançamento Conciliado">
 <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
 Conciliado
 </span>
 )}
 {l.isOfxStandalone && (
 <span className="text-[9px] bg-blue-600 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" title="Transação orfã. Adicione no sistema para conciliar.">
 Pendente Oficialização
 </span>
 )}
 </div>
 <p className="text-[11px] text-gray-500 truncate">
 {l.isOfxStandalone
 ? 'Lançamento presente apenas no extrato bancário'
 : `${l.categoria?.nome || 'Sem Categoria'}${l.favorecido?.nome ? ` • ${l.favorecido.nome}` : ''}`
 }
 </p>
 </div>

 {/* Valores e Saldo */}
 <div className="flex-shrink-0 flex items-center gap-6 pr-4">
 {/* Coluna 1: Valor */}
 <div className="text-right min-w-[90px]">
 {l.tipo === 'Receita' ? (
 <p className="text-sm font-bold text-green-600">+{formatCurrency(l.entrada)}</p>
 ) : (
 <p className="text-sm font-bold text-gray-800">-{formatCurrency(l.saida)}</p>
 )}
 </div>

 {/* Coluna 2: Saldo */}
 {!isFilho && (
 <div className="text-right min-w-[90px] border-l border-gray-100 pl-4 hidden sm:block">
 <p className="text-[9px] text-gray-400 font-semibold uppercase mb-0.5">Saldo</p>
 <p className={`text-xs font-bold ${l.saldo_acumulado < 0 ? 'text-red-500' : 'text-gray-500'}`}>
 {formatCurrency(l.saldo_acumulado)}
 </p>
 </div>
 )}
 </div>

 {/* Ações / Ícone Sidebar */}
 <div className="flex-shrink-0 flex items-center gap-2 text-gray-300 group-hover:text-blue-500 transition-colors">
 {isFilho ? (
 <button
 onClick={(e) => handleRemoverDoBordero(e, l.id)}
 className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-600 rounded-full transition-all"
 title="Desvincular do Borderô"
 >
 <p className="text-[10px] font-bold uppercase">Sair</p>
 </button>
 ) : (
 hasPermission('financeiro', 'pode_excluir') && (
 <button
 onClick={(e) => handleDelete(e, l)}
 className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
 title="Excluir Lançamento"
 >
 <FontAwesomeIcon icon={faTrash} size="sm" />
 </button>
 )
 )}
 <FontAwesomeIcon icon={faAngleRight} />
 </div>
 </div>
 );

 // RENDERIZAÇÃO DE LINHA PAI (BORDERÔ)
 if (item.isBordero) {
 const isExpanded = expandedBorderos[item.id];
 return (
 <div key={item.id} className="flex flex-col">
 <div
 onClick={(e) => toggleBordero(e, item.id)}
 className="p-4 cursor-pointer transition-colors flex items-center justify-between group hover:bg-indigo-50/30 border-l-4 border-l-indigo-600 bg-white"
 >
 {/* SETA (Expandir/Retrair) */}
 <div className="flex-shrink-0 pr-4 pl-1 w-10 text-center">
 <FontAwesomeIcon
 icon={faChevronRight}
 className={`text-indigo-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
 />
 </div>

 {/* Data do Primeiro Filho */}
 <div className="flex-shrink-0 w-16 text-center">
 <div className="text-sm font-bold text-indigo-900">
 {format(parseISO(item.data_pagamento), 'dd')}
 </div>
 <div className="text-[10px] uppercase font-semibold text-indigo-400">
 {format(parseISO(item.data_pagamento), 'MMM', { locale: ptBR })}
 </div>
 </div>

 {/* Descrição e Infos do Pai */}
 <div className="flex-1 px-4 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <p className="text-sm font-extrabold truncate text-indigo-900" title={item.descricao}>
 {item.descricao}
 </p>
 {item.status_exibicao === 'Conciliado' && (
 <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" title="Lote todo Conciliado">
 <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
 Lote Ok
 </span>
 )}
 {item.status_exibicao === 'Parcial' && (
 <span className="flex-shrink-0 text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
 Baixa Parcial
 </span>
 )}
 </div>
 <p className="text-[11px] text-indigo-400 font-semibold truncate">
 Clique para ver as origens detalhadas
 </p>
 </div>

 {/* Valores e Saldo do Borderô Inteiro */}
 <div className="flex-shrink-0 flex items-center gap-6 pr-4">
 {/* Coluna 1: Valor Máximo Somado */}
 <div className="text-right min-w-[90px]">
 {item.tipo === 'Receita' ? (
 <p className="text-sm font-bold text-green-600">+{formatCurrency(item.entrada)}</p>
 ) : (
 <p className="text-sm font-black text-indigo-900">-{formatCurrency(item.saida)}</p>
 )}
 </div>

 {/* Coluna 2: Saldo Agrupado */}
 <div className="text-right min-w-[90px] border-l border-indigo-100 pl-4 hidden sm:block">
 <p className="text-[9px] text-indigo-300 font-semibold uppercase mb-0.5">Saldo</p>
 <p className={`text-xs font-bold ${item.saldo_acumulado < 0 ? 'text-red-500' : 'text-gray-500'}`}>
 {formatCurrency(item.saldo_acumulado)}
 </p>
 </div>
 </div>

 {/* AÇÕES BORDERÔ */}
 <div className="flex-shrink-0 flex items-center gap-2 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={(e) => handleDesagruparBordero(e, item.id)}
 className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded text-[10px] font-bold uppercase shadow-sm"
 title="Desfazer grupo"
 >
 Desagrupar
 </button>
 </div>
 </div>

 {/* LINHAS FILHAS (ABERTAS OU FECHADAS) */}
 {isExpanded && (
 <div className="flex flex-col bg-gray-50/30">
 {item.filhos.map(filho => renderRowNormal(filho, true))}
 </div>
 )}
 </div>
 );
 }

 // Renderiza linha normal se não for Borderô
 return renderRowNormal(item);
 })
 )}
 </div>
 </div>
 ) : null}
 </div>
 </div>

 {/* Visualizador de Detalhes (Sidebar) */}
 <LancamentoDetalhesSidebar
 open={isSidebarOpen}
 onClose={() => setIsSidebarOpen(false)}
 lancamento={lancamentoSelecionado}
 />
 </div>
 );
}

"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faArrowUp, faArrowDown, faAngleRight, faTrash, faHandHoldingDollar, faCheckCircle, faExclamationTriangle, faFileAlt, faChevronDown, faChevronRight, faTimes, faCheck, faMagic, faEye, faExpand, faFolderOpen, faExchangeAlt, faSearch, faSort, faSync, faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';
import PanelConciliacaoCartao from './PanelConciliacaoCartao';
import { v4 as uuidv4 } from 'uuid';
import UppyFileImporter from '@/components/ui/UppyFileImporter';
import FilePreviewModal from '@/components/shared/FilePreviewModal';


// --- GERENCIADOR GLOBAL DE FATURAS E RE-VINCULAÇÃO ---
const FaturasGerenciadorModal = ({ isOpen, onClose, organizacaoId, contasCartao, onPreviewRequest, onReprocessRequest }) => {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const [vinculandoId, setVinculandoId] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [sortBy, setSortBy] = useState('data_envio_desc');

 const { data: arquivosBD, isLoading } = useQuery({
 queryKey: ['todas_faturas_ia', organizacaoId],
 queryFn: async () => {
 const { data, error } = await supabase
 .from('banco_arquivos_ofx')
 .select('*, conta:contas_financeiras(id, nome, numero_conta)')
 .eq('organizacao_id', organizacaoId)
 .in('status', ['Processado IA', 'Falha Leitura', 'Processando...'])
 .order('created_at', { ascending: false });
 if (error) throw error;
 return data || [];
 },
 enabled: isOpen && !!organizacaoId
 });

 const revincularMutation = useMutation({
 mutationFn: async ({ arquivoId, novaContaId }) => {
 const { error: err1 } = await supabase.from('banco_arquivos_ofx').update({ conta_id: novaContaId }).eq('id', arquivoId).eq('organizacao_id', organizacaoId);
 if (err1) throw err1;
 const { error: err2 } = await supabase.from('banco_transacoes_ofx').update({ conta_id: novaContaId }).eq('arquivo_id', arquivoId).eq('organizacao_id', organizacaoId);
 if (err2) throw err2;
 },
 onSuccess: () => {
 toast.success('Fatura e transações movidas para a nova conta com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['todas_faturas_ia'] });
 queryClient.invalidateQueries({ queryKey: ['faturasCartao_extrato'] });
 queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 setVinculandoId(null);
 },
 onError: (err) => {
 toast.error(`Falha ao realocar fatura: ${err.message}`);
 setVinculandoId(null);
 }
 });

 if (!isOpen) return null;

 // Processar filtros em Client Side (evitando chamadas à API)
 let processedArquivos = [...(arquivosBD || [])];
 // 1. Pesquisa
 if (searchTerm) {
 const lowerTerm = searchTerm.toLowerCase();
 processedArquivos = processedArquivos.filter(arq => (arq.nome_arquivo && arq.nome_arquivo.toLowerCase().includes(lowerTerm)) ||
 (arq.conta?.nome && arq.conta.nome.toLowerCase().includes(lowerTerm))
 );
 }
 // 2. Ordenação
 processedArquivos.sort((a, b) => {
 if (sortBy === 'data_envio_desc') return new Date(b.created_at) - new Date(a.created_at);
 if (sortBy === 'data_envio_asc') return new Date(a.created_at) - new Date(b.created_at);
 if (sortBy === 'nome_arquivo_asc') return (a.nome_arquivo || '').localeCompare(b.nome_arquivo || '');
 if (sortBy === 'conta_nome_asc') return (a.conta?.nome || '').localeCompare(b.conta?.nome || '');
 return 0;
 });

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
 <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
 {/* Header */}
 <div className="flex justify-between items-center p-5 bg-white border-b">
 <div>
 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
 <FontAwesomeIcon icon={faFolderOpen} className="text-indigo-500" /> Gestão de Faturas Importadas (IA)
 </h2>
 <p className="text-xs text-gray-500 mt-1">Realoque PDFs que a inteligência artificial não conseguiu encontrar o cartão exato.</p>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
 <FontAwesomeIcon icon={faTimes} size="lg" />
 </button>
 </div>
 {/* Barra de Filtros */}
 <div className="bg-gray-50 p-4 border-b flex flex-col md:flex-row gap-3">
 <div className="relative flex-1">
 <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
 <input
 type="text"
 placeholder="Buscar por conta ou nome do arquivo..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
 />
 </div>
 <div className="relative w-full md:w-56 shrink-0">
 <FontAwesomeIcon icon={faSort} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value)}
 className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white cursor-pointer"
 >
 <option value="data_envio_desc">Mais Recentes</option>
 <option value="data_envio_asc">Mais Antigos</option>
 <option value="nome_arquivo_asc">Nome do Arquivo (A-Z)</option>
 <option value="conta_nome_asc">Nome do Cartão/Conta (A-Z)</option>
 </select>
 </div>
 </div>

 {/* Lista */}
 <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
 {isLoading ? (
 <div className="text-center py-10 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
 ) : processedArquivos.length === 0 ? (
 <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-dashed">
 {searchTerm ? 'Nenhuma fatura encontrada na busca.' : 'Nenhuma fatura IA processada.'}
 </div>
 ) : (
 <div className="space-y-3">
 {processedArquivos.map(arq => {
 const isWarning = arq.conta?.nome?.startsWith('⚠️');
 return (
 <div key={arq.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors p-4 flex flex-col md:flex-row gap-4 md:items-center">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <button onClick={() => onPreviewRequest(arq.arquivo_url, arq.nome_arquivo)} className="text-indigo-600 hover:text-indigo-800 font-bold text-sm truncate uppercase tracking-tight" title="Visualizar PDF">
 <FontAwesomeIcon icon={faEye} className="mr-1.5" />{arq.nome_arquivo}
 </button>
 <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-100 uppercase">{format(parseISO(arq.periodo_inicio), 'MMM/yyyy', {locale: ptBR})}</span>
 <span className="text-[9px] text-gray-400 ml-2">{format(parseISO(arq.created_at), 'dd/MM/yy HH:mm')}</span>
 </div>
 <div className="flex items-center gap-1.5 mt-2">
 <span className="text-[10px] uppercase font-bold text-gray-400">Vinculado a: </span>
 <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${isWarning ? 'bg-amber-100 text-amber-800 border-amber-200 border' : (arq.status === 'Falha Leitura' ? 'bg-red-100 text-red-800 border-red-200 border' : 'bg-gray-100 text-gray-600 border-gray-200 border')}`}>
 {arq.conta?.nome || 'Conta Órfã / Falha'}
 </span>
 <button onClick={() => onReprocessRequest(arq)} className="ml-2 text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-sm">
 <FontAwesomeIcon icon={faSync} /> Reprocessar IA
 </button>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {vinculandoId === arq.id ? (
 <div className="flex items-center gap-2 bg-indigo-50 p-1.5 rounded-lg border border-indigo-200 animate-fadeIn">
 <select className="text-[11px] border-none bg-transparent focus:ring-0 text-indigo-900 font-bold cursor-pointer w-48 sm:w-56 outline-none appearance-none"
 onChange={(e) => {
 if(e.target.value) {
 revincularMutation.mutate({ arquivoId: arq.id, novaContaId: e.target.value });
 }
 }}
 disabled={revincularMutation.isPending}
 >
 <option value="">Escolha a conta certa...</option>
 {(contasCartao || []).map(c => (
 <option key={c.id} value={c.id}>{c.nome.replace('⚠️ ', '')} {c.numero_conta ? `(*${c.numero_conta})` : ''}</option>
 ))}
 </select>
 <button onClick={() => setVinculandoId(null)} className="text-gray-400 hover:text-gray-700 px-2" disabled={revincularMutation.isPending}>
 {revincularMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faTimes} />}
 </button>
 </div>
 ) : (
 <button onClick={() => setVinculandoId(arq.id)}
 className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-300 rounded-lg transition-colors flex items-center gap-1.5"
 >
 <FontAwesomeIcon icon={faExchangeAlt} /> Mudar Vínculo
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

const formatCurrency = (value) => {
 if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function ExtratoCartaoManager({ contasCartao }) {
 const supabase = createClient();
 const queryClient = useQueryClient();
 const { user, hasPermission } = useAuth();
 const organizacaoId = user?.organizacao_id;

 // =====================================================================
 // ESTADOS (idênticos ao ExtratoManager, adaptados para cartão)
 // =====================================================================
 const [contaSelecionadaId, setContaSelecionadaId] = useState('');
 const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
 const dropdownContaRef = useRef(null);
 const [faturaSelecionadaVencimento, setFaturaSelecionadaVencimento] = useState('');
 const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [ofxPainelAberto, setOfxPainelAberto] = useState(false);
 const [arquivoOfxExpandido, setArquivoOfxExpandido] = useState(null);
 const [modoConciliacaoMes, setModoConciliacaoMes] = useState(null);
 const [selectedIds, setSelectedIds] = useState([]);
 const [expandedBorderos, setExpandedBorderos] = useState({});
 const [isUppyOpen, setIsUppyOpen] = useState(false);
 const [isExtractingPDF, setIsExtractingPDF] = useState(false);
 const [previewFatura, setPreviewFatura] = useState(null); // { url, nome }
 const [isGerenciadorOpen, setIsGerenciadorOpen] = useState(false);

 // Auto seleção da primeira conta de cartão salva
 useEffect(() => {
 const savedId = typeof window !== 'undefined' ? localStorage.getItem('studio57_last_conta_cartao_id') : null;
 let startId = contasCartao?.filter(c => !c.conta_pai_id)?.[0]?.id || contasCartao?.[0]?.id || '';
 if (savedId && contasCartao && contasCartao.some(c => c.id == savedId)) {
 startId = savedId;
 }
 if (!contaSelecionadaId && startId) {
 setContaSelecionadaId(startId);
 }
 }, [contasCartao, contaSelecionadaId]);

 // =====================================================================
 // LISTENER REALTIME: Escuta o término do processamento em background (IA)
 // =====================================================================
 useEffect(() => {
 if (!organizacaoId) return;

 const channel = supabase.channel('banco_arquivos_cartao_ia')
 .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'banco_arquivos_ofx',
 filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
 const { new: newRec, old: oldRec } = payload;
 if (oldRec.status === 'Processando...' && newRec.status === 'Processado IA') {
 toast.success(`✨ A Fatura Mágica "${newRec.nome_arquivo}" foi processada pela IA!`);
 queryClient.invalidateQueries({ queryKey: ['todas_faturas_ia'] });
 queryClient.invalidateQueries({ queryKey: ['faturasCartao_extrato'] });
 queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 queryClient.invalidateQueries({ queryKey: ['contasCartao'] });
 } else if (oldRec.status === 'Processando...' && newRec.status === 'Falha Leitura') {
 toast.error(`⚠️ Falha na Nuvem ao ler a fatura "${newRec.nome_arquivo}". A fatura ficou no Gerenciador.`);
 queryClient.invalidateQueries({ queryKey: ['todas_faturas_ia'] });
 }
 })
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [organizacaoId, supabase, queryClient]);

 const handleSelectConta = (id) => {
 setContaSelecionadaId(id);
 if (typeof window !== 'undefined') localStorage.setItem('studio57_last_conta_cartao_id', id);
 setIsDropdownContaOpen(false);
 setFaturaSelecionadaVencimento(''); // reseta ao trocar cartão
 };

 useEffect(() => {
 const handleClickOutside = (event) => {
 if (dropdownContaRef.current && !dropdownContaRef.current.contains(event.target)) {
 setIsDropdownContaOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const contaSelecionada = contasCartao?.find(c => c.id == contaSelecionadaId);

 // =====================================================================
 // QUERY: FATURAS DO CARTÃO (equivale a "mesesDisponiveis" no extrato)
 // =====================================================================
 const { data: faturas = [], isLoading: isFaturasLoading } = useQuery({
 queryKey: ['faturasCartao_extrato', contaSelecionadaId, organizacaoId],
 queryFn: async () => {
 if (!contaSelecionadaId || !organizacaoId) return [];

 const conta = contasCartao?.find(c => c.id == contaSelecionadaId);
 const diaFech = conta?.dia_fechamento_fatura;
 const diaPag = conta?.dia_pagamento_fatura;

 if (diaFech && diaPag) {
 const hoje = new Date();
 let dataBase = new Date(hoje);
 if (hoje.getDate() >= diaFech) dataBase.setMonth(dataBase.getMonth() + 1);

 const upserts = [];
 for (let offset = -6; offset <= 2; offset++) {
 const d = new Date(dataBase);
 d.setMonth(d.getMonth() + offset);
 const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 let dataVenc, dataFech;
 if (diaPag <= diaFech) {
 const next = new Date(d);
 next.setMonth(next.getMonth() + 1);
 dataVenc = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(diaPag).padStart(2, '0')}`;
 dataFech = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(diaFech).padStart(2, '0')}`;
 } else {
 dataVenc = `${mesRef}-${String(diaPag).padStart(2, '0')}`;
 dataFech = `${mesRef}-${String(diaFech).padStart(2, '0')}`;
 }
 upserts.push({ conta_id: Number(contaSelecionadaId), mes_referencia: mesRef, data_fechamento: dataFech, data_vencimento: dataVenc, organizacao_id: organizacaoId });
 }
 await supabase.from('faturas_cartao').upsert(upserts, { onConflict: 'conta_id,mes_referencia', ignoreDuplicates: true });
 }

 const { data: faturasDB, error } = await supabase
 .from('faturas_cartao')
 .select('*')
 .eq('conta_id', contaSelecionadaId)
 .order('data_vencimento', { ascending: true }); // Crescente para calc cascata

 if (error) throw error;

 // Busca TODOS os lançamentos da conta de cartão para montarmos os balanços
 const { data: lancsData } = await supabase
 .from('lancamentos')
 .select('fatura_id, valor, tipo, categoria_id, categorias_financeiras(nome)')
 .eq('conta_id', contaSelecionadaId)
 .eq('organizacao_id', organizacaoId);

 const lancsPorFatura = {};
 (lancsData || []).forEach(l => {
 if (!l.fatura_id) return;
 // Tratar retorno relacional do Supabase (Array ou Objeto)
 let nomeCat = '';
 if (l.categorias_financeiras) {
 nomeCat = (Array.isArray(l.categorias_financeiras) ? l.categorias_financeiras[0]?.nome : l.categorias_financeiras.nome) || '';
 }

 const isPagamento = l.categoria_id === 370 || nomeCat.toLowerCase().includes('pagamento de fatura');
 if (!lancsPorFatura[l.fatura_id]) {
 lancsPorFatura[l.fatura_id] = { gastos: 0, pagamentos: 0 };
 }
 const v = Math.abs(Number(l.valor) || 0);
 if (isPagamento) {
 if (l.tipo === 'Receita') lancsPorFatura[l.fatura_id].pagamentos += v;
 else if (l.tipo === 'Despesa') lancsPorFatura[l.fatura_id].pagamentos -= v;
 } else {
 if (l.tipo === 'Despesa') lancsPorFatura[l.fatura_id].gastos += v;
 if (l.tipo === 'Receita') lancsPorFatura[l.fatura_id].gastos -= v;
 }
 });

 let saldoRolado = 0;
 const faturasCresc = (faturasDB || []).map(f => {
 const ag = lancsPorFatura[f.id] || { gastos: 0, pagamentos: 0 };
 const saldoAnterior = saldoRolado;
 const saldoAtual = saldoAnterior + ag.gastos - ag.pagamentos;
 saldoRolado = saldoAtual;

 return {
 ...f,
 saldoAnterior,
 gastosMes: ag.gastos,
 pgmtosMes: ag.pagamentos,
 saldoAtual
 };
 });

 // Cachoeira Retroativa (Waterfall de Dívida)
 // Se o usuário paga faturas mais tarde, o pagamento limpa as faturas passadas primeiro (LIFO de crédito).
 let remainingDebt = Math.max(0, saldoRolado);

 const faturasEnriquecidas = faturasCresc.reverse().map(f => {
 let isPaga = true;

 // Se houver dívida global pendente escorrendo pra trás, a fatura atual absorve essa dívida baseada nos gastos que ela causou.
 if (remainingDebt > 0.05) {
 isPaga = false; // A dívida global ainda a afeta
 remainingDebt -= f.gastosMes; }

 // Proteção: Se a foto congelada da fatura NAQUELA época já era <= 0, ela está inquestionavelmente paga.
 if (f.saldoAtual <= 0.05) {
 isPaga = true;
 }

 return {
 ...f,
 isPaga
 };
 });

 return faturasEnriquecidas;
 },
 enabled: !!contaSelecionadaId && !!organizacaoId
 });

 // Auto seleciona a fatura atual (aberta ou mais recente)
 useEffect(() => {
 if (faturas.length > 0 && !faturaSelecionadaVencimento) {
 const hoje = startOfDay(new Date());
 const faturaAtiva = faturas.find(f => !isBefore(parseISO(f.data_vencimento), hoje)) || faturas[0];
 setFaturaSelecionadaVencimento(faturaAtiva.data_vencimento);
 }
 }, [faturas, faturaSelecionadaVencimento]);

 const faturaAtiva = faturas.find(f => f.data_vencimento === faturaSelecionadaVencimento);

 // =====================================================================
 // QUERY: EXTRATO DA FATURA (equivale à query 'extrato' do ExtratoManager)
 // busca lançamentos da fatura_id, calcula totais e agrupa borderôs
 // =====================================================================
 const { data: extratoData, isLoading } = useQuery({
 queryKey: ['extrato_cartao', contaSelecionadaId, faturaSelecionadaVencimento, organizacaoId],
 queryFn: async () => {
 if (!contaSelecionadaId || !organizacaoId || !faturaAtiva) return null;

 const { data: lancamentos, error } = await supabase
 .from('lancamentos')
 .select('*, favorecido:contatos!favorecido_contato_id(*), categoria:categorias_financeiras(*), anexos:lancamentos_anexos(*)')
 .eq('conta_id', Number(contaSelecionadaId))
 .eq('organizacao_id', organizacaoId)
 .eq('fatura_id', faturaAtiva.id)
 .order('data_transacao', { ascending: true })
 .order('data_vencimento', { ascending: true })
 .order('created_at', { ascending: true });

 if (error) throw error;

 // Agrupamento de Borderô e Totais (idêntico ao ExtratoManager)
 let totalDespesas = 0;
 let totalCreditos = 0;

 const borderosMap = {};
 const itensFinais = [];

 (lancamentos || []).forEach(lanc => {
 const valorAbsoluto = Math.abs(Number(lanc.valor));
 const entrada = lanc.tipo === 'Receita' ? valorAbsoluto : 0;
 const saida = lanc.tipo === 'Despesa' ? valorAbsoluto : 0;

 // Regra de Ouro: Pagamento de Fatura de Cartão (ID 370) entra na listagem visual,
 // mas NÃO é somado nos KPIs de "Créditos/Estornos" para não zerar o card "Total da Fatura" que o usuário quer enxergar.
 const isPagamentoCartao = lanc.categoria_id === 370 || (lanc.categoria?.nome && typeof lanc.categoria.nome === 'string' && lanc.categoria.nome.toLowerCase().includes('pagamento de fatura'));
 if (!isPagamentoCartao) {
 totalDespesas += saida;
 totalCreditos += entrada;
 }

 const status_exibicao = lanc.fitid_banco ? 'Conciliado' : lanc.status;
 const l = { ...lanc, entrada, saida, status_exibicao };

 if (l.agrupamento_id) {
 if (!borderosMap[l.agrupamento_id]) {
 const dataRef = l.data_transacao || l.data_vencimento;
 const paiFicticio = {
 id: l.agrupamento_id,
 isBordero: true,
 isExpanded: false,
 agrupamento_id: l.agrupamento_id,
 descricao: 'Borderô de Lançamentos',
 tipo: l.tipo,
 valorTotal: 0,
 data_pagamento: dataRef,
 filhos: [],
 saldo_acumulado: 0,
 status_exibicao: 'Misto'
 };
 borderosMap[l.agrupamento_id] = paiFicticio;
 itensFinais.push(paiFicticio);
 }
 borderosMap[l.agrupamento_id].filhos.push(l);
 borderosMap[l.agrupamento_id].valorTotal += valorAbsoluto;
 } else {
 itensFinais.push(l);
 }
 });

 Object.values(borderosMap).forEach(b => {
 b.descricao = `Borderô - ${b.filhos.length} lançamentos (${b.tipo === 'Despesa' ? 'Pagamentos' : 'Recebimentos'})`;
 const todosConciliados = b.filhos.every(f => f.status_exibicao === 'Conciliado');
 const algumConciliado = b.filhos.some(f => f.status_exibicao === 'Conciliado');
 if (todosConciliados) b.status_exibicao = 'Conciliado';
 else if (algumConciliado) b.status_exibicao = 'Parcial';
 else b.status_exibicao = 'Pendente';

 if (b.tipo === 'Despesa') { b.saida = b.valorTotal; b.entrada = 0; }
 else { b.entrada = b.valorTotal; b.saida = 0; }
 });

 return {
 entradas: totalCreditos,
 saidas: totalDespesas,
 saldoFatura: totalDespesas - totalCreditos,
 itens: itensFinais
 };
 },
 enabled: !!contaSelecionadaId && !!organizacaoId && !!faturaAtiva
 });

 // =====================================================================
 // QUERY: ARQUIVOS OFX/IA DA CONTA E FILHOS
 // =====================================================================
 const { data: arquivosOfxMes } = useQuery({
 queryKey: ['ofx_arquivos_cartao', contaSelecionadaId, organizacaoId],
 queryFn: async () => {
 const childContas = contasCartao?.filter(c => c.conta_pai_id === contaSelecionadaId) || [];
 const accountIds = [contaSelecionadaId, ...childContas.map(c => c.id)].filter(Boolean);

 const { data, error } = await supabase
 .from('banco_arquivos_ofx')
 .select('*')
 .in('conta_id', accountIds)
 .eq('organizacao_id', organizacaoId)
 .order('periodo_inicio', { ascending: false });
 if (error) throw error;
 return data || [];
 },
 enabled: !!contaSelecionadaId && !!organizacaoId
 });

 // =====================================================================
 // MUTATIONS (idênticas ao ExtratoManager)
 // =====================================================================
 const exclusaoMutation = useMutation({
 mutationFn: async (id) => {
 const { error } = await supabase.from('lancamentos').delete().eq('id', id).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Lançamento excluído com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 },
 onError: (err) => toast.error(`Erro ao excluir: ${err.message}`)
 });

 const handleDelete = (e, item) => {
 e.stopPropagation();
 if (window.confirm(`Deseja realmente excluir o lançamento "${item.descricao}"?`)) {
 exclusaoMutation.mutate(item.id);
 }
 };

 const exclusaoOfxMutation = useMutation({
 mutationFn: async (arquivoId) => {
 // Garante que todas as transações importadas pela IA sejam excluídas primeiro
 await supabase.from('banco_transacoes_ofx').delete().eq('arquivo_id', arquivoId).eq('organizacao_id', organizacaoId);

 const { error } = await supabase.from('banco_arquivos_ofx').delete().eq('id', arquivoId).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Arquivo IA e suas transações excluídos!');
 setArquivoOfxExpandido(null);
 queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 },
 onError: (err) => toast.error(`Erro ao excluir arquivo: ${err.message}`)
 });

 const handleDeleteOfx = (e, arq) => {
 e.stopPropagation();
 if (window.confirm(`Deseja realmente excluir o arquivo "${arq.nome_arquivo}"? Todas as suas transações serão apagadas da base.`)) {
 exclusaoOfxMutation.mutate(arq.id);
 }
 };

 // =====================================================================
 // BORDERÔ (idêntico ao ExtratoManager)
 // =====================================================================
 const toggleSelectAll = () => {
 if (!extratoData || extratoData.itens.length === 0) return;
 if (selectedIds.length === extratoData.itens.length) {
 setSelectedIds([]);
 } else {
 setSelectedIds(extratoData.itens.map(i => i.id));
 }
 };

 const toggleSelectRow = (e, id) => {
 e.stopPropagation();
 setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
 };

 const criarBorderoMutation = useMutation({
 mutationFn: async () => {
 if (selectedIds.length < 2) throw new Error("Selecione pelo menos 2 lançamentos para agrupar.");
 const novoBorderoId = uuidv4();
 const { error } = await supabase.from('lancamentos').update({ agrupamento_id: novoBorderoId }).in('id', selectedIds).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 return selectedIds.length;
 },
 onSuccess: (qtde) => {
 toast.success(`${qtde} Lançamentos agrupados com sucesso!`);
 setSelectedIds([]);
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 },
 onError: (err) => toast.error(`Erro ao criar borderô: ${err.message}`)
 });

 const handleCriarBordero = () => {
 if (window.confirm(`Tem certeza que deseja agrupar ${selectedIds.length} lançamentos em um único Borderô?`)) {
 criarBorderoMutation.mutate();
 }
 };

 const toggleBordero = (e, borderoId) => {
 e.stopPropagation();
 setExpandedBorderos(prev => ({ ...prev, [borderoId]: !prev[borderoId] }));
 };

 const desagruparBorderoCompletoMutation = useMutation({
 mutationFn: async (borderoId) => {
 const { error } = await supabase.from('lancamentos').update({ agrupamento_id: null }).eq('agrupamento_id', borderoId).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Borderô desfeito com sucesso!');
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
 }
 });

 const desagruparIndividualMutation = useMutation({
 mutationFn: async (lancamentoId) => {
 const { error } = await supabase.from('lancamentos').update({ agrupamento_id: null }).eq('id', lancamentoId).eq('organizacao_id', organizacaoId);
 if (error) throw error;
 },
 onSuccess: () => {
 toast.success('Lançamento removido do borderô!');
 queryClient.invalidateQueries({ queryKey: ['extrato_cartao'] });
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
 setExpandedBorderos(prev => ({ ...prev, [item.id]: !prev[item.id] }));
 } else {
 setLancamentoSelecionado(item);
 setIsSidebarOpen(true);
 }
 };

 // =====================================================================
 // IMPORTAÇÃO DE PDF VIA IA E REPROCESSAMENTO
 // =====================================================================
 const handleReprocessPdf = async (arq) => {
 if (!arq.arquivo_url) {
 toast.error("Este documento não possui um arquivo PDF físico armazenado.");
 return;
 }
 setIsGerenciadorOpen(false);
 const toastId = toast.loading("Baixando PDF do cofre...");
 try {
 const res = await fetch(arq.arquivo_url);
 if (!res.ok) throw new Error("Acesso negado ao arquivo no Storage.");
 const blob = await res.blob();
 const file = new File([blob], arq.nome_arquivo || "fatura.pdf", { type: "application/pdf" });
 toast.success("Download concluído! Iniciando IA...", { id: toastId });
 await handlePdfUpload([file], arq.id);
 } catch (e) {
 toast.error(`Falha no Download: ${e.message}`, { id: toastId });
 }
 };

 const handlePdfUpload = async (files, arqBaseId = null) => {
 setIsUppyOpen(false);
 const fileArray = Array.isArray(files) ? files : [files];
 if (fileArray.length === 0) return;

 // Recuperar sessão do usuário logado para vinculação de notificações de background
 const { data: sessionData } = await supabase.auth.getSession();
 const usuarioId = sessionData?.session?.user?.id;

 // O processo agora é assíncrono. O spinner de loading do botão pode girar rápido
 // e logo liberar a tela, mas mantemos o toast informativo.
 const toastId = toast.loading(arqBaseId ? `Enviando fatura para reprocessar na Nuvem...` : `Enviando ${fileArray.length} fatura(s) para a Inteligência Artificial...`);

 for (let i = 0; i < fileArray.length; i++) {
 const file = fileArray[i];
 // --- 1. UPLOAD E PERSISTÊNCIA INICIAL ---
 let currentArqId = arqBaseId;
 let arquivoUrl = null;
 const safeDataVenc = faturaSelecionadaVencimento || new Date().toISOString().split('T')[0];
 const safeContaId = contaSelecionadaId || null;
 const nomeArq = file.name || `Fatura_Cartao_Venc_${safeDataVenc}.pdf`;

 if (!currentArqId) {
 const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9.-]/g, '_') : 'fatura.pdf';
 const storagePath = `faturas-cartao/${organizacaoId}/fallback_${Date.now()}_${safeName}`;
 const { error: uploadError } = await supabase.storage.from('documentos-financeiro').upload(storagePath, file, { contentType: 'application/pdf', upsert: true });
 if (!uploadError) {
 const { data: urlData } = supabase.storage.from('documentos-financeiro').getPublicUrl(storagePath);
 arquivoUrl = urlData?.publicUrl || null;
 } else {
 console.warn("Falha no upload do Storage:", uploadError.message);
 }

 const { data: arqHeader, error: arqError } = await supabase.from('banco_arquivos_ofx').insert({
 organizacao_id: organizacaoId, conta_id: safeContaId,
 nome_arquivo: nomeArq, status: 'Processando...', periodo_inicio: safeDataVenc, periodo_fim: safeDataVenc,
 arquivo_url: arquivoUrl
 }).select('*').single();

 if (arqHeader) currentArqId = arqHeader.id;
 } else {
 // Em Reprocessamento: Apaga rastro velho pra reescrever limpo
 await supabase.from('banco_transacoes_ofx').delete().eq('arquivo_id', currentArqId);
 const { data: oldArq } = await supabase.from('banco_arquivos_ofx')
 .update({ status: 'Processando...' }).eq('id', currentArqId).select('arquivo_url').single();
 if (oldArq) arquivoUrl = oldArq.arquivo_url;
 }

 // --- 2. COMUNICAÇÃO FIRE-AND-FORGET COM A API ---
 try {
 // Sem "await" propositalmente. Envia pra fila e libera a interface!
 fetch('/api/cartoes/extrair-fatura', { method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 arquivoId: currentArqId,
 arquivoUrl: arquivoUrl,
 organizacaoId: organizacaoId,
 contaSelecionadaId: safeContaId,
 usuarioId: usuarioId
 })
 }).catch(e => console.error("Falha silenciosa de rede:", e));
 } catch (err) {
 console.error(`Falha ao despachar o Worker da IA para ${file.name}:`, err);
 toast.error(`Falha de rede ao contatar a IA para ${file.name}.`);
 await supabase.from('banco_arquivos_ofx').update({ status: 'Falha Leitura' }).eq('id', currentArqId);
 }
 }
 // Tela liberada!
 toast.success(`📤 Sucesso! A fatura está na nuvem. Você será avisado magicamente quando a IA terminar!`, { id: toastId, duration: 6000 });
 queryClient.invalidateQueries({ queryKey: ['todas_faturas_ia'] });
 queryClient.invalidateQueries({ queryKey: ['ofx_arquivos_cartao'] });
 };

 // =====================================================================
 // RENDER
 // =====================================================================
 // =====================================================================
 // Lógica para encontrar quem é a "Fatura Atual" (A que recebe as transações de hoje)
 // =====================================================================
 const getFaturaAtualId = () => {
 if (!faturas || faturas.length === 0) return null;
 const faturasAbertas = faturas.filter(f => f.data_fechamento && !isBefore(parseISO(f.data_fechamento), startOfDay(new Date())));
 if (faturasAbertas.length > 0) {
 // Como faturas é ordenado DESC, a fatura aberta mais próxima de fechar é o último elemento deste sub-array
 return faturasAbertas[faturasAbertas.length - 1].id;
 }
 return faturas[0]?.id; // Fallback
 };
 const idFaturaAtualOficial = getFaturaAtualId();

 return (
 <>
 {/* VISUALIZADOR PDF DA FATURA (PADRÃO OURO) */}
 <FilePreviewModal
 anexo={previewFatura ? {
 public_url: previewFatura.url,
 nome_arquivo: previewFatura.nome,
 caminho_arquivo: previewFatura.nome
 } : null}
 onClose={() => setPreviewFatura(null)}
 />
 {previewFatura && (
 <div className="fixed inset-0 bg-black/50 z-[100]" onClick={() => setPreviewFatura(null)} />
 )}

 <FaturasGerenciadorModal isOpen={isGerenciadorOpen} onClose={() => setIsGerenciadorOpen(false)} organizacaoId={organizacaoId} contasCartao={contasCartao} onPreviewRequest={(url, nome) => setPreviewFatura({ url, nome })}
 onReprocessRequest={(arq) => handleReprocessPdf(arq)}
 />

 <div className="space-y-6 animate-fadeIn">
 {/* CABEÇALHO UNIFICADO (idêntico ao ExtratoManager) */}
 <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
 <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:block">
 <FontAwesomeIcon icon={faLandmark} size="lg" />
 </div>
 <div className="flex-1 w-full">
 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Cartão de Crédito</label>
 <div className="relative w-full xl:w-2/3" ref={dropdownContaRef}>
 <button
 onClick={() => setIsDropdownContaOpen(!isDropdownContaOpen)}
 className="w-full text-left bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
 >
 {contaSelecionada ? (
 <div className="flex flex-col">
 <span className="font-bold text-sm text-gray-800">{contaSelecionada.nome}</span>
 <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
 {contaSelecionada.empresa?.nome_fantasia || 'Sem Empresa'} • {contaSelecionada.tipo}
 {contaSelecionada.numero_conta && ` • Final ${contaSelecionada.numero_conta}`}
 </span>
 </div>
 ) : (
 <span className="text-gray-500 text-sm font-semibold">-- Selecione um cartão --</span>
 )}
 <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
 </button>

 {isDropdownContaOpen && (
 <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[350px] overflow-y-auto p-1 origin-top animate-fadeIn">
 {(contasCartao || []).filter(c => !c.conta_pai_id).map(c => {
 const isSelected = contaSelecionadaId === c.id;
 const isIncompleta = c.nome?.startsWith('⚠️');
 const nomeExibicao = c.nome?.replace('⚠️ ', '') || c.nome;
 return (
 <button
 key={c.id}
 onClick={() => handleSelectConta(c.id)}
 className={`w-full text-left flex items-start justify-between p-2.5 rounded-lg border transition-all duration-200 ${
 isIncompleta
 ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
 : isSelected
 ? 'bg-indigo-50/80 border-indigo-200 shadow-sm'
 : 'border-transparent bg-transparent hover:bg-gray-50'
 }`}
 >
 <div className="flex flex-col flex-1 pr-2 min-w-0">
 <div className="flex items-center gap-1.5">
 <span className={`font-bold text-[13px] leading-tight truncate ${isSelected ? 'text-indigo-900' : isIncompleta ? 'text-amber-900' : 'text-gray-700'}`}>
 {nomeExibicao}
 </span>
 {isIncompleta && (
 <span className="flex-shrink-0 text-[8px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
 Incompleta
 </span>
 )}
 </div>
 <span className="text-[9px] text-gray-400 mt-0.5">
 {isIncompleta ? '⚠️ Criada pela IA — preencha os dados pendentes' : `${c.empresa?.nome_fantasia || ''}${c.numero_conta ? ` • Final ${c.numero_conta}` : ''}`}
 </span>
 </div>
 {isSelected && !isIncompleta && <FontAwesomeIcon icon={faCheck} className="text-indigo-500 text-[10px] mt-0.5" />}
 </button>
 );
 })}
 </div>
 )}
 </div>
 </div>

 {contaSelecionada && (
 <div className="text-right flex flex-col md:flex-row items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">
 <div className="flex gap-2 w-full md:w-auto">
 <button
 onClick={() => setIsGerenciadorOpen(true)}
 className="flex-1 md:flex-none items-center justify-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
 title="Visualizar todos os uploads de faturas"
 >
 <FontAwesomeIcon icon={faFolderOpen} className="text-gray-500" />
 <span className="hidden sm:inline">Gestão de </span>Arquivos
 </button>
 <button
 onClick={() => setIsUppyOpen(true)}
 disabled={isExtractingPDF}
 className="flex-1 md:flex-none items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-60"
 >
 {isExtractingPDF ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faMagic} />}
 Importar Fatura (IA)
 </button>
 </div>

 {/* Cards de Totais da Fatura */}
 {extratoData && (
 <>
 <div className="bg-red-50 p-2 md:p-3 rounded-lg border border-red-100 shadow-sm">
 <p className="text-[10px] md:text-xs text-red-700 uppercase font-semibold">
 <FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Despesas (Fatura)
 </p>
 <p className="text-sm md:text-lg font-bold text-red-600">-{formatCurrency(extratoData.saidas)}</p>
 </div>
 <div className="bg-green-50 p-2 md:p-3 rounded-lg border border-green-100 shadow-sm">
 <p className="text-[10px] md:text-xs text-green-700 uppercase font-semibold">
 <FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Créditos (Fatura)
 </p>
 <p className="text-sm md:text-lg font-bold text-green-600">+{formatCurrency(extratoData.entradas)}</p>
 </div>
 <div className="bg-blue-50 p-2 md:p-3 rounded-lg border border-blue-200 shadow-sm">
 <p className="text-[10px] md:text-xs text-blue-700 uppercase font-semibold">Total da Fatura</p>
 <p className="text-sm md:text-lg font-bold text-blue-800">{formatCurrency(extratoData.saldoFatura)}</p>
 </div>
 </>
 )}
 </div>
 )}
 </div>

 {/* CONTEÚDO: Grid 1/4 - 3/4 (idêntico ao ExtratoManager) */}
 <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

 {/* LADO ESQUERDO: Seletor de Faturas (troca de Meses) */}
 <div className="lg:col-span-1 space-y-3">
 <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Faturas do Cartão</h3>
 <div className="bg-white border text-sm rounded-lg flex flex-col shadow-sm max-h-[75vh] overflow-y-auto custom-scrollbar">
 {isFaturasLoading ? (
 <div className="p-6 text-center"><FontAwesomeIcon icon={faSpinner} spin className="text-blue-400" /></div>
 ) : faturas.length === 0 ? (
 <div className="p-4 text-center text-gray-400 text-xs">Nenhuma fatura encontrada para este cartão.</div>
 ) : (
 faturas.map((fatura, idx) => {
 const isSelected = fatura.data_vencimento === faturaSelecionadaVencimento;
 const hoje = startOfDay(new Date());
 const dataVenc = parseISO(fatura.data_vencimento);
 const isAtrasada = isBefore(dataVenc, hoje);
 const faturaKey = fatura.data_vencimento;
 const isFaturaAtual = fatura.id === idFaturaAtualOficial;
 const isInFuturo = !isAtrasada && !isFaturaAtual;

 // Arquivos IA para esta fatura (compara pelo periodo_inicio)
 const arquivosFatura = (arquivosOfxMes || []).filter(a => a.periodo_inicio === fatura.data_vencimento);
 const ofxAberto = ofxPainelAberto === faturaKey;

 return (
 <div key={idx} className={`border-b last:border-0 transition-all border-l-4 ${isSelected ? 'border-l-blue-600' : 'border-l-transparent'} ${isFaturaAtual && !isSelected ? 'border-l-blue-400' : ''}`}>
 <div className={`flex items-center ${isSelected ? 'bg-blue-50' : (isFaturaAtual ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-white hover:bg-gray-50')}`}>
 <button
 onClick={() => { setFaturaSelecionadaVencimento(fatura.data_vencimento); setModoConciliacaoMes(null); setArquivoOfxExpandido(null); setSelectedIds([]); }}
 className="flex-1 text-left p-4"
 >
 <div className={`font-bold capitalize ${isSelected ? 'text-blue-700' : (isFaturaAtual ? 'text-blue-600' : 'text-gray-700')}`}>
 Venc. {format(parseISO(fatura.data_vencimento), 'dd/MM/yyyy')}
 </div>
 <div className="mt-1 flex gap-1 flex-wrap">
 {isAtrasada && !fatura.isPaga ? (
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-red-50 text-red-700 border border-red-200 uppercase">Atrasada</span>
 ) : isFaturaAtual ? (
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase">Atual (Aberta)</span>
 ) : (
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-gray-50 text-gray-500 border border-gray-200 uppercase">
 {isInFuturo && !fatura.isPaga ? 'Futura' : 'Anterior'}
 </span>
 )}
 {fatura.isPaga && (
 <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase flex items-center gap-1 shadow-sm">
 <FontAwesomeIcon icon={faCheckCircle} /> Paga
 </span>
 )}
 {arquivosFatura.length > 0 && (
 <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide bg-purple-100 text-purple-700">
 <FontAwesomeIcon icon={faMagic} className="mr-1" />IA
 </span>
 )}
 </div>
 </button>

 {/* Botão Conciliar (aparece quando tem arquivo IA) */}
 {arquivosFatura.length > 0 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setFaturaSelecionadaVencimento(fatura.data_vencimento);
 setModoConciliacaoMes(faturaKey);
 }}
 className={`mr-2 px-3 py-1.5 transition-all text-xs font-bold rounded-lg border flex items-center gap-1 shadow-sm
 ${modoConciliacaoMes === faturaKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
 title="Conciliar esta fatura"
 >
 <FontAwesomeIcon icon={faHandHoldingDollar} />
 <span className="hidden sm:inline">Conciliar</span>
 </button>
 )}

 {/* Seta de arquivos IA */}
 {arquivosFatura.length > 0 && (
 <button
 onClick={(e) => { e.stopPropagation(); setOfxPainelAberto(ofxAberto ? null : faturaKey); setArquivoOfxExpandido(null); }}
 className={`pr-3 pl-2 py-4 transition-colors flex items-center gap-1 text-[10px] font-bold border-l
 ${ofxAberto ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
 title="Ver arquivos IA desta fatura"
 >
 <FontAwesomeIcon icon={faFileAlt} />
 <span>{arquivosFatura.length}</span>
 <FontAwesomeIcon icon={ofxAberto ? faChevronDown : faChevronRight} />
 </button>
 )}
 </div>

 {/* Expansão dos Arquivos IA */}
 {ofxAberto && (
 <div className="bg-indigo-50/60 border-t border-indigo-100 px-3 py-2 flex flex-col gap-1.5">
 {arquivosFatura.map(arq => (
 <div
 key={arq.id}
 className="w-full group rounded-lg border transition-all flex items-stretch overflow-hidden bg-white/70 border-indigo-100 hover:border-indigo-300 hover:shadow-sm"
 >
 {/* Clique no card abre o PDF */}
 <button
 className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 min-w-0 hover:bg-indigo-50/50 transition-colors"
 onClick={(e) => {
 e.stopPropagation();
 if (arq.arquivo_url) {
 // URL pública completa salva diretamente
 setPreviewFatura({ url: arq.arquivo_url, nome: arq.nome_arquivo });
 } else {
 toast.info('PDF não disponível para visualização. Reimporte a fatura para habilitar.');
 }
 }}
 title={arq.arquivo_url ? 'Clique para visualizar o PDF' : 'PDF não disponível (reimporte para habilitar)'}
 >
 <FontAwesomeIcon
 icon={arq.arquivo_url ? faEye : faFileAlt}
 className={`flex-shrink-0 text-xs ${arq.arquivo_url ? 'text-indigo-500' : 'text-indigo-300'}`}
 />
 <div className="min-w-0 flex-1">
 <p className="font-bold text-gray-800 truncate text-[11px]" title={arq.nome_arquivo}>{arq.nome_arquivo}</p>
 <p className="text-[9px] text-gray-400">
 {arq.arquivo_url ? '👁️ Clique para visualizar' : '📄 Sem preview — reimporte'} • {arq.data_envio ? format(parseISO(arq.data_envio), 'dd/MM/yy HH:mm') : '?'}
 </p>
 </div>
 </button>
 <button
 onClick={(e) => handleDeleteOfx(e, arq)}
 className="px-3 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-transparent group-hover:border-indigo-100"
 title="Apagar arquivo IA do banco"
 >
 <FontAwesomeIcon icon={faTrash} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })
 )}
 </div>
 </div>

 {/* LADO DIREITO: Extrato da Fatura OU Painel de Conciliação */}
 <div className="lg:col-span-3">
 {modoConciliacaoMes ? (
 // MODO CONCILIAÇÃO (troca de PanelConciliacaoOFX por PanelConciliacaoCartao)
 <PanelConciliacaoCartao
 contas={contasCartao}
 initialContaId={contaSelecionadaId}
 faturaVencimento={faturaSelecionadaVencimento}
 onClosePanel={() => setModoConciliacaoMes(null)}
 />
 ) : isLoading ? (
 <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
 <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
 <p className="text-gray-500 mt-2">Carregando lançamentos da fatura...</p>
 </div>
 ) : extratoData ? (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
 {/* Resumo da Fatura (TopBar) */}
 <div className="p-6 border-b bg-white text-gray-800">
 <h2 className="text-xl font-bold text-gray-800 capitalize mb-4">
 Lançamentos da Fatura — Venc. {faturaSelecionadaVencimento ? format(parseISO(faturaSelecionadaVencimento), 'dd/MM/yyyy') : ''}
 </h2>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 <div className="bg-red-50 p-3 rounded-lg border border-red-100 shadow-sm">
 <p className="text-[10px] font-bold text-red-700 uppercase"><FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Despesas (Mês)</p>
 <p className="text-sm font-semibold text-red-700 mt-1">-{formatCurrency(extratoData.saidas)}</p>
 </div>
 <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm">
 <p className="text-[10px] font-bold text-green-700 uppercase"><FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Créditos / Estornos</p>
 <p className="text-sm font-semibold text-green-700 mt-1">+{formatCurrency(extratoData.entradas)}</p>
 </div>
 <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-sm">
 <p className="text-[10px] font-bold text-blue-700 uppercase">Total A Pagar (Acumulado)</p>
 <p className={`text-sm font-bold mt-1 text-blue-800`}>
 {formatCurrency(faturaAtiva?.saldoAtual)}
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
 <button onClick={() => setSelectedIds([])} className="text-indigo-200 hover:text-white px-3 py-1.5 text-xs font-bold transition-colors">Cancelar</button>
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
 <div className="divide-y divide-gray-100 relative">
 {/* Linha Fantasma: Saldo Herdado do Mês Anterior */}
 {faturaAtiva && faturaAtiva.saldoAnterior > 0.05 && (
 <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-100 border-l-4 border-l-blue-500 z-10 transition-colors shadow-sm">
 <div className="flex items-center gap-3">
 <div className="flex-shrink-0 w-8 md:w-16 text-center text-blue-500">
 <FontAwesomeIcon icon={faArrowRightArrowLeft} />
 </div>
 <div className="flex-1">
 <p className="text-xs uppercase font-bold text-blue-700 tracking-wide">Rolagem de Dívida: Saldo Fatura Anterior</p>
 <p className="text-[10px] text-gray-500 mt-0.5">Valor residual não pago repassado para este mês.</p>
 </div>
 </div>
 <div className="text-right flex-shrink-0">
 <p className="text-sm font-bold text-red-600">
 -{formatCurrency(faturaAtiva.saldoAnterior)}
 </p>
 </div>
 {/* Espaçadores vazios para simular as colunas no mobile/desktop iguais à row comum */}
 <div className="hidden sm:block flex-shrink-0 w-16 invisible"></div>
 </div>
 )}

 {extratoData.itens.length === 0 ? (
 <div className="p-8 text-center text-gray-500">
 Nenhuma movimentação encontrada nesta fatura.
 </div>
 ) : (
 extratoData.itens.map(item => {
 // RENDERIZAÇÃO DE LINHA NORMAL (idêntico ao ExtratoManager)
 const renderRowNormal = (l, isFilho = false) => (
 <div
 key={l.id}
 onClick={() => handleRowClick(l)}
 className={`p-4 cursor-pointer transition-colors flex items-center justify-between group ${selectedIds.includes(l.id) ? 'bg-indigo-50/50 hover:bg-indigo-50 border-l-4 border-l-indigo-400' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}
 ${isFilho ? 'pl-12 bg-gray-50/50 border-t border-dashed' : ''}
 `}
 >
 {!isFilho && (
 <div className="flex-shrink-0 pr-4 pl-1" onClick={(e) => e.stopPropagation()}>
 <input
 type="checkbox"
 checked={selectedIds.includes(l.id)}
 onChange={(e) => toggleSelectRow(e, l.id)}
 className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
 />
 </div>
 )}
 {isFilho && <div className="flex-shrink-0 w-8 flex justify-center text-gray-300"><FontAwesomeIcon icon={faAngleRight} className="text-[10px]" /></div>}

 {/* Data */}
 <div className="flex-shrink-0 w-16 text-center">
 <div className="text-sm font-bold text-gray-700">
 {format(parseISO(l.data_transacao || l.data_vencimento), 'dd')}
 </div>
 <div className="text-[10px] uppercase font-semibold text-gray-400">
 {format(parseISO(l.data_transacao || l.data_vencimento), 'MMM', { locale: ptBR })}
 </div>
 </div>

 {/* Descrição */}
 <div className="flex-1 px-4 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <p className="text-sm font-bold truncate text-gray-800" title={l.descricao}>{l.descricao}</p>
 {l.status_exibicao === 'Conciliado' && (
 <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
 <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />Conciliado
 </span>
 )}
 </div>
 <p className="text-[11px] text-gray-500 truncate">
 {l.categoria?.nome || 'Sem Categoria'}{l.favorecido?.nome ? ` • ${l.favorecido.nome}` : ''}
 </p>
 </div>

 {/* Valores */}
 <div className="flex-shrink-0 flex items-center gap-6 pr-4">
 <div className="text-right min-w-[90px]">
 {l.tipo === 'Receita' ? (
 <p className="text-sm font-bold text-green-600">+{formatCurrency(l.entrada)}</p>
 ) : (
 <p className="text-sm font-bold text-gray-800">-{formatCurrency(l.saida)}</p>
 )}
 </div>
 </div>

 {/* Ações */}
 <div className="flex-shrink-0 flex items-center gap-2 text-gray-300 group-hover:text-blue-500 transition-colors">
 {isFilho ? (
 <button onClick={(e) => handleRemoverDoBordero(e, l.id)} className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-all" title="Desvincular do Borderô">
 <p className="text-[10px] font-bold uppercase">Sair</p>
 </button>
 ) : (
 hasPermission('financeiro', 'pode_excluir') && (
 <button onClick={(e) => handleDelete(e, l)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all" title="Excluir Lançamento">
 <FontAwesomeIcon icon={faTrash} size="sm" />
 </button>
 )
 )}
 <FontAwesomeIcon icon={faAngleRight} />
 </div>
 </div>
 );

 // RENDERIZAÇÃO DE BORDERÔ PAI (idêntico ao ExtratoManager)
 if (item.isBordero) {
 const isExpanded = expandedBorderos[item.id];
 return (
 <div key={item.id} className="flex flex-col">
 <div
 onClick={(e) => toggleBordero(e, item.id)}
 className="p-4 cursor-pointer transition-colors flex items-center justify-between group hover:bg-indigo-50/30 border-l-4 border-l-indigo-600 bg-white"
 >
 <div className="flex-shrink-0 pr-4 pl-1 w-10 text-center">
 <FontAwesomeIcon icon={faChevronRight} className={`text-indigo-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
 </div>
 <div className="flex-shrink-0 w-16 text-center">
 <div className="text-sm font-bold text-indigo-900">
 {format(parseISO(item.data_pagamento), 'dd')}
 </div>
 <div className="text-[10px] uppercase font-semibold text-indigo-400">
 {format(parseISO(item.data_pagamento), 'MMM', { locale: ptBR })}
 </div>
 </div>
 <div className="flex-1 px-4 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <p className="text-sm font-extrabold truncate text-indigo-900">{item.descricao}</p>
 {item.status_exibicao === 'Conciliado' && (
 <span className="flex-shrink-0 text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
 <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />Lote Ok
 </span>
 )}
 {item.status_exibicao === 'Parcial' && (
 <span className="flex-shrink-0 text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Baixa Parcial</span>
 )}
 </div>
 <p className="text-[11px] text-indigo-400 font-semibold truncate">Clique para ver as origens detalhadas</p>
 </div>
 <div className="flex-shrink-0 flex items-center gap-6 pr-4">
 <div className="text-right min-w-[90px]">
 {item.tipo === 'Receita' ? (
 <p className="text-sm font-bold text-green-600">+{formatCurrency(item.entrada)}</p>
 ) : (
 <p className="text-sm font-black text-indigo-900">-{formatCurrency(item.saida)}</p>
 )}
 </div>
 </div>
 <div className="flex-shrink-0 flex items-center gap-2 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={(e) => handleDesagruparBordero(e, item.id)} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded text-[10px] font-bold uppercase shadow-sm" title="Desfazer grupo">
 Desagrupar
 </button>
 </div>
 </div>
 {isExpanded && (
 <div className="flex flex-col bg-gray-50/30">
 {item.filhos.map(filho => renderRowNormal(filho, true))}
 </div>
 )}
 </div>
 );
 }

 return renderRowNormal(item);
 })
 )}
 </div>
 </div>
 ) : null}
 </div>
 </div>

 {/* MODAL DE UPLOAD DE PDF (usa UppyFileImporter nativo do sistema) */}
 <UppyFileImporter
 isOpen={isUppyOpen}
 onClose={() => setIsUppyOpen(false)}
 onFileSelected={(files) => handlePdfUpload(files)}
 title="Importar Fatura PDF via IA"
 allowedFileTypes={['.pdf']}
 multiple={true}
 note="Selecione ou arraste 1 ou mais PDFs de faturas. A IA identifica automaticamente o cartão e o mês de cada fatura."
 />

 {/* SIDEBAR DE DETALHES (idêntico ao ExtratoManager) */}
 <LancamentoDetalhesSidebar
 open={isSidebarOpen}
 onClose={() => setIsSidebarOpen(false)}
 lancamento={lancamentoSelecionado}
 />
 </div>
 </>
 );
}

// app/(main)/pedidos/page.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/pedidos/ComprasKanban';
import PedidoItensTable from '../../../components/pedidos/PedidoItensTable'; import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBoxOpen, faClock, faHourglassHalf, faClipboardList, faPlus, faTimes, faThLarge, faList, faDollarSign, faFileInvoiceDollar, faSearch, faFilter
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/shared/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PedidoForm from '@/components/pedidos/PedidoForm';
import FiltroPedidos, { initialFilterState } from '../../../components/pedidos/FiltroPedidos';
import { enviarNotificacao } from '@/utils/notificacoes';
import { useDebounce } from 'use-debounce';

// Chave para persistência no LocalStorage
const PEDIDOS_UI_STATE_KEY = 'STUDIO57_PEDIDOS_UI_STATE_V1';

// Função auxiliar para ler cache com segurança
const getCachedUiState = () => {
 if (typeof window === 'undefined') return null;
 try {
 const saved = localStorage.getItem(PEDIDOS_UI_STATE_KEY);
 return saved ? JSON.parse(saved) : null;
 } catch (e) {
 return null;
 }
};

// Componente TabButton
const TabButton = ({ tabName, label, icon, activeTab, onClick }) => (
 <button onClick={() => onClick(tabName)} className={`
 whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
 ${activeTab === tabName ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}
 `}
 >
 <FontAwesomeIcon icon={icon} />
 {label}
 </button>
);

const fetchPainelData = async (supabase, organizacaoId, empreendimentoId) => {
 if (!organizacaoId) throw new Error("Organização não identificada.");

 // 1. Solicitantes
 const { data: solData, error: solError } = await supabase
 .from('usuarios')
 .select('id, nome, sobrenome')
 .eq('organizacao_id', organizacaoId)
 .order('nome');
 if (solError) throw new Error(`Falha ao carregar solicitantes: ${solError.message}`);

 // 2. Fases do Pedido (NOVO!) 🚀
 const { data: fasesData, error: fasesError } = await supabase
 .from('pedidos_fases')
 .select('*')
 .in('organizacao_id', [organizacaoId, 1, 2])
 .order('ordem', { ascending: true });
 if (fasesError) throw new Error(`Falha ao carregar fases: ${fasesError.message}`);

 let fasesFiltradas = [];
 if (fasesData && fasesData.length > 0) {
    const fasesOrg = fasesData.filter(f => f.organizacao_id === organizacaoId);
    if (fasesOrg.length > 0) {
        fasesFiltradas = fasesOrg;
    } else {
        const fasesMatriz = fasesData.filter(f => f.organizacao_id === 1);
        if (fasesMatriz.length > 0) fasesFiltradas = fasesMatriz;
        else fasesFiltradas = fasesData.filter(f => f.organizacao_id === 2);
        
        // --- SEED AUTOMÁTICO DA MATRIZ ---
        // Se a organização está usando o fallback, vamos persistir (clonar) essas fases para ela,
        // garantindo que ela seja dona de suas colunas e possa editá-las depois.
        if (fasesFiltradas.length > 0) {
            const novasFases = fasesFiltradas.map(f => ({
                nome: f.nome,
                slug: f.slug,
                ordem: f.ordem,
                finalizado: f.finalizado,
                organizacao_id: organizacaoId
            }));
            const { data: insertedFases, error: insertError } = await supabase
                .from('pedidos_fases')
                .insert(novasFases)
                .select()
                .order('ordem', { ascending: true });
                
            if (!insertError && insertedFases) {
                fasesFiltradas = insertedFases;
            }
        }
    }
 }

 // 3. Pedidos
 let query = supabase
 .from('pedidos_compra')
 .select(`
 *,
 titulo,
 turno_entrega,
 empreendimentos(nome, empresa_proprietaria_id),
 solicitante:solicitante_id(id, nome),
 itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social), etapa:etapa_id(nome_etapa), subetapa:subetapa_id(nome_subetapa), material:material_id(classificacao)
 ),
 anexos:pedidos_compra_anexos(*),
 lancamentos:lancamentos(id) `)
 .eq('organizacao_id', organizacaoId);

 if (empreendimentoId && empreendimentoId !== 'all') {
 query = query.eq('empreendimento_id', empreendimentoId);
 }
 const { data: pedidosData, error: pedidosError } = await query.order('data_solicitacao', { ascending: false });
 if (pedidosError) throw new Error(`Falha ao carregar pedidos: "${pedidosError.message}"`);

 // Fallback de normalização: Se o pedido não tem fase_id mas tem status em texto, tenta parear
 const pedidosNormalizados = (pedidosData || []).map(p => {
     if (!p.fase_id && p.status) {
         const statusNormalizado = p.status.toLowerCase().trim();
         const faseCorrespondente = fasesFiltradas.find(f => f.nome.toLowerCase().trim() === statusNormalizado);
         if (faseCorrespondente) {
             p.fase_id = faseCorrespondente.id;
             p.status = faseCorrespondente.nome;
         } else if (fasesFiltradas.length > 0) {
             p.fase_id = fasesFiltradas[0].id;
             p.status = fasesFiltradas[0].nome;
         }
     }
     return p;
 });

 // 4. Fornecedores
 const { data: fornData, error: fornError } = await supabase
 .from('contatos')
 .select('id, nome, razao_social, nome_fantasia')
 .eq('organizacao_id', organizacaoId)
 .eq('tipo_contato', 'Fornecedor') .order('nome');
 if (fornError) console.error("Erro ao buscar fornecedores:", fornError);
 // 5. Etapas (Obra)
 const { data: etapaData, error: etapaError } = await supabase
 .from('etapa_obra')
 .select('id, nome_etapa')
 .eq('organizacao_id', organizacaoId)
 .order('nome_etapa');
 if (etapaError) console.error("Erro ao buscar etapas:", etapaError);

 // 6. Subetapas
 const { data: subetapaData, error: subetapaError } = await supabase
 .from('subetapas')
 .select('id, nome_subetapa')
 .eq('organizacao_id', organizacaoId)
 .order('nome_subetapa');
 if (subetapaError) console.error("Erro ao buscar subetapas:", subetapaError);

 return { solicitantes: solData || [], pedidos: pedidosNormalizados,
 fases: fasesFiltradas, // Passando as fases filtradas dinamicamente
 fornecedores: fornData || [],
 etapas: etapaData || [],
 subetapas: subetapaData || []
 };
};

export default function PedidosPage() {
 const { setPageTitle } = useLayout();
 const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
 const { user, hasPermission } = useAuth();
 const canDelete = hasPermission('pedidos', 'pode_excluir'); const organizacaoId = user?.organizacao_id;
 const supabase = useMemo(() => createClient(), []);
 const router = useRouter();
 const queryClient = useQueryClient();

 const cachedState = getCachedUiState();
 const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'kanban');
 const [filters, setFilters] = useState(() => {
 const defaultState = { ...initialFilterState, searchTerm: '' };
 if (cachedState?.filters) {
 return { ...defaultState, ...cachedState.filters };
 }
 return defaultState;
 });

 const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);
 const [debouncedFilters] = useDebounce(filters, 500);

 useEffect(() => {
 if (typeof window !== 'undefined') {
 const stateToSave = { activeTab, filters, showFilters };
 localStorage.setItem(PEDIDOS_UI_STATE_KEY, JSON.stringify(stateToSave));
 }
 }, [activeTab, filters, showFilters]);

 const [kpiData, setKpiData] = useState({ totalPedidos: 0, totalValorPedidos: 0,
 totalNaoPlanejados: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [selectedPedido, setSelectedPedido] = useState(null);
 const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
 const [newPedidoId, setNewPedidoId] = useState(null);

 useEffect(() => { setPageTitle('Painel de Compras'); }, [setPageTitle]);

 const { data, isLoading, isError, error } = useQuery({
 queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
 queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
 enabled: !!organizacaoId,
 staleTime: 1000 * 60 * 5,
 refetchOnWindowFocus: true,
 });

 const pedidos = data?.pedidos || [];
 const fases = data?.fases || []; // Recebendo as fases
 const solicitantes = data?.solicitantes || [];
 const fornecedores = data?.fornecedores || [];
 const etapas = data?.etapas || [];
 const subetapas = data?.subetapas || [];

 // --- LÓGICA DE FILTRAGEM ---
 const filteredPedidosKanban = useMemo(() => {
 return pedidos.filter(pedido => {
 const itens = pedido.itens || [];
 if (debouncedFilters.dataSolicitacaoStart && pedido.data_solicitacao < debouncedFilters.dataSolicitacaoStart) return false;
 if (debouncedFilters.dataSolicitacaoEnd && pedido.data_solicitacao > debouncedFilters.dataSolicitacaoEnd) return false;
 if (debouncedFilters.dataEntregaStart && pedido.data_entrega_prevista < debouncedFilters.dataEntregaStart) return false;
 if (debouncedFilters.dataEntregaEnd && pedido.data_entrega_prevista > debouncedFilters.dataEntregaEnd) return false;
 if (debouncedFilters.status.length > 0 && !debouncedFilters.status.includes(pedido.status)) return false;
 if (debouncedFilters.empreendimentoIds.length > 0 && !debouncedFilters.empreendimentoIds.includes(pedido.empreendimento_id)) return false;
 if (debouncedFilters.solicitanteIds.length > 0 && !debouncedFilters.solicitanteIds.includes(pedido.solicitante_id)) return false;
 const hasItemFilters = debouncedFilters.fornecedorIds.length > 0 || debouncedFilters.etapaIds.length > 0 || debouncedFilters.subetapaIds.length > 0 || debouncedFilters.tipoOperacao.length > 0 || debouncedFilters.classificacao?.length > 0;
 if (hasItemFilters && itens.length === 0) return false;
 if (hasItemFilters) {
 const match = itens.some(item => {
 const matchFornecedor = debouncedFilters.fornecedorIds.length === 0 || debouncedFilters.fornecedorIds.includes(item.fornecedor_id);
 const matchEtapa = debouncedFilters.etapaIds.length === 0 || debouncedFilters.etapaIds.includes(item.etapa_id);
 const matchSubetapa = debouncedFilters.subetapaIds.length === 0 || debouncedFilters.subetapaIds.includes(item.subetapa_id);
 const matchTipo = debouncedFilters.tipoOperacao.length === 0 || debouncedFilters.tipoOperacao.includes(item.tipo_operacao);
 return matchFornecedor && matchEtapa && matchSubetapa && matchTipo;
 });
 if (!match) return false;
 }
 const term = debouncedFilters.searchTerm?.toLowerCase() || '';
 if (term.trim() !== '') {
 const tituloMatch = pedido.titulo?.toLowerCase().includes(term);
 const idMatch = pedido.id.toString().includes(term);
 const itemMatch = itens.some(item => item.descricao_item?.toLowerCase().includes(term));
 if (!tituloMatch && !idMatch && !itemMatch) return false;
 }
 return true;
 });
 }, [pedidos, debouncedFilters]);

 // --- CÁLCULO DE KPIS (Mantido simplificado) ---
 useEffect(() => {
 const calculateKpis = async () => {
 const localFilteredPedidos = filteredPedidosKanban;
 const cutoffDate = new Date('2025-11-12T23:59:59'); let totalValorPedidos = 0;
 let totalNaoPlanejados = 0; for (const pedido of localFilteredPedidos) {
 if (pedido.itens && Array.isArray(pedido.itens)) {
 for (const item of pedido.itens) totalValorPedidos += parseFloat(item.custo_total_real) || 0;
 }
 const dataSolicitacao = new Date(pedido.data_solicitacao);
 if ((!pedido.lancamentos || pedido.lancamentos.length === 0) && pedido.status !== 'Cancelado' && dataSolicitacao > cutoffDate) {
 totalNaoPlanejados++;
 }
 }
 if (localFilteredPedidos.length === 0) {
 setKpiData({ totalPedidos: 0, totalValorPedidos: 0, totalNaoPlanejados: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
 return;
 }
 const comPendencia = localFilteredPedidos.filter(p => p.status === 'Entregue' && (!p.anexos || p.anexos.length === 0 || !p.anexos.some(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal')))).length;
 setKpiData(prev => ({ ...prev, totalPedidos: localFilteredPedidos.length, totalValorPedidos: totalValorPedidos, totalNaoPlanejados: totalNaoPlanejados, pedidosComPendencia: comPendencia }));
 };
 if (pedidos.length > 0) calculateKpis();
 }, [filteredPedidosKanban, pedidos.length]);

 const createPedidoMutation = useMutation({
 mutationFn: async () => {
 if (!user || !user.id || !organizacaoId) throw new Error('Usuário ou Organização não autenticados.');
 if (!selectedEmpreendimento || selectedEmpreendimento === 'all') throw new Error('Selecione um empreendimento específico.');
 
 // Utiliza a primeira fase dinâmica já carregada (respeitando o fallback da Matriz)
 const faseInicial = fases[0];
 const novoPedido = {
 titulo: 'Nova Solicitação (Rascunho)', status: faseInicial?.nome || 'Solicitação',
 fase_id: faseInicial?.id,
 solicitante_id: user.id,
 organizacao_id: organizacaoId, empreendimento_id: selectedEmpreendimento,
 data_solicitacao: new Date().toISOString(),
 };
 const { data, error } = await supabase.from('pedidos_compra').insert(novoPedido).select('id').single();
 if (error) throw new Error(`Erro do Supabase: ${error.message}`);
 return data;
 },
 onSuccess: async (data) => {
 toast.success('Nova solicitação criada!');
 await enviarNotificacao({
 userId: user.id, titulo: "📝 Novo Pedido Criado",
 mensagem: `O pedido #${data.id} foi iniciado por você.`,
 link: `/pedidos`, organizacaoId: organizacaoId, canal: 'operacional' });
 setNewPedidoId(data.id);
 setIsNewOrderModalOpen(true);
 queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
 },
 onError: (error) => toast.error(`Falha ao criar solicitação: ${error.message}`)
 });

 const deleteCanceledMutation = useMutation({
 mutationFn: async (pedidoIds) => {
 if (!pedidoIds || pedidoIds.length === 0) throw new Error("Nenhum pedido para excluir.");
 const { error } = await supabase.rpc('delete_pedidos_cancelados', { pedido_ids: pedidoIds });
 if (error) throw error;
 return pedidoIds.length;
 },
 onSuccess: (count) => {
 toast.success(`${count} pedidos excluídos!`);
 queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
 },
 onError: (error) => toast.error(`Falha ao excluir pedidos: ${error.message}`)
 });

 const mutationOptions = {
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
      toast.success(message);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`)
 };

 const createColumnMutation = useMutation({
    mutationFn: async (name) => {
      const { error } = await supabase.from('pedidos_fases').insert({
        nome: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
        ordem: fases.length + 1,
        organizacao_id: organizacaoId,
        finalizado: false
      });
      if (error) throw error;
      return "Fase criada com sucesso!";
    },
    ...mutationOptions
 });

 const editColumnMutation = useMutation({
    mutationFn: async ({ columnId, newName }) => {
      const { error } = await supabase.from('pedidos_fases').update({ nome: newName }).eq('id', columnId).eq('organizacao_id', organizacaoId);
      if (error) throw error;
      return "Fase renomeada!";
    },
    ...mutationOptions
 });

 const reorderColumnsMutation = useMutation({
    mutationFn: async (cols) => {
      const updates = cols.map(c => supabase.from('pedidos_fases').update({ ordem: c.ordem }).eq('id', c.id));
      await Promise.all(updates);
      return "Ordem das fases salva!";
    },
    ...mutationOptions
 });

 const deleteColumnMutation = useMutation({
    mutationFn: async (columnIdToDelete) => {
      const hasPedidos = pedidos.some(p => p.fase_id === columnIdToDelete);
      if (hasPedidos) throw new Error("A fase ainda tem pedidos! Mova-os antes de excluir.");
      const { error } = await supabase.from('pedidos_fases').delete().eq('id', columnIdToDelete);
      if (error) throw error;
      return "Fase excluída!";
    },
    ...mutationOptions
 });

 return (
 <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
 <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
 <div className="flex flex-col">
 <h1 className="text-2xl font-bold text-gray-800 uppercase">
 Painel de Compras {selectedEmpreendimento && selectedEmpreendimento !== 'all' && <span className="ml-2 text-blue-600">- {empreendimentos.find(e => e.id == selectedEmpreendimento)?.nome}</span>
 }
 </h1>
 </div>

 <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
 <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
 <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
 </div>
 <input type="text" placeholder="Buscar pedido, item, ID..." value={filters.searchTerm} onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
 />
 </div>

 <button onClick={() => setShowFilters(!showFilters)} className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
 <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} /> Filtros
 </button>

 <div className="h-8 w-px bg-gray-300 mx-1 hidden md:block"></div>

 <button onClick={() => createPedidoMutation.mutate()} disabled={createPedidoMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200">
 {createPedidoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> : <FontAwesomeIcon icon={faPlus} className="mr-2" />} Novo Pedido
 </button>
 </div>
 </div>

 {showFilters && (
 <FiltroPedidos filters={filters} setFilters={setFilters} solicitantes={solicitantes} empreendimentos={empreendimentos} fornecedores={fornecedores} etapas={etapas} subetapas={subetapas} />
 )}

 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
 <KpiCard title="Pedidos" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
 <KpiCard title="Valor Total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalValorPedidos)} icon={faDollarSign} color="green" />
 <KpiCard title="Pend. Financeiro" value={kpiData.totalNaoPlanejados} icon={faFileInvoiceDollar} color="yellow" />
 <KpiCard title="Pendências NF" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
 <KpiCard title="T.M. Cotação" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="purple" />
 <KpiCard title="T.M. Entrega" value={kpiData.tempoMedioEntrega} icon={faClock} color="orange" />
 </div>

 <div className="bg-white rounded-lg shadow-md overflow-hidden">
 <div className="border-b border-gray-200 bg-gray-50/50">
 <nav className="-mb-px flex space-x-6 px-4">
 <TabButton tabName="kanban" label="Visão Kanban" icon={faThLarge} activeTab={activeTab} onClick={setActiveTab} />
 <TabButton tabName="itens" label="Visão de Itens" icon={faList} activeTab={activeTab} onClick={setActiveTab} />
 </nav>
 </div>

 <div className="p-4 min-h-[400px]">
 {isLoading ? (
 <div className="flex justify-center items-center py-20"><FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500"/></div>
 ) : isError ? (
 <div className="text-center text-red-500 py-10">Erro: {error.message}</div>
 ) : (
 <>
 {activeTab === 'kanban' ? (
 <ComprasKanban
 pedidos={filteredPedidosKanban}
 fases={fases} // <-- AQUI ESTÁ A MÁGICA: Passando as fases dinâmicas
 onCardClick={(p) => { setSelectedPedido(p); setIsSidebarOpen(true); }}
 onDeleteAllCanceled={(ids) => deleteCanceledMutation.mutate(ids)}
 canDelete={canDelete}
 isDeleting={deleteCanceledMutation.isPending}
 onCreateColumn={(name) => createColumnMutation.mutate(name)}
 onEditColumn={(id, name) => editColumnMutation.mutate({ columnId: id, newName: name })}
 onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
 onReorderColumns={(cols) => reorderColumnsMutation.mutate(cols)}
 />
 ) : (
 <PedidoItensTable pedidos={filteredPedidosKanban} onCardClick={(p) => { setSelectedPedido(p); setIsSidebarOpen(true); }} />
 )}
 </>
 )}
 </div>
 </div>

 {isNewOrderModalOpen && newPedidoId && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
 <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative">
 <button onClick={() => { setIsNewOrderModalOpen(false); setNewPedidoId(null); queryClient.invalidateQueries({ queryKey: ['painelCompras'] }); }} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 p-2 rounded-full z-10">
 <FontAwesomeIcon icon={faTimes} />
 </button>
 <div className="p-2"><PedidoForm pedidoId={newPedidoId} /></div>
 </div>
 </div>
 )}

 <PedidoDetalhesSidebar
 pedido={selectedPedido}
 isOpen={isSidebarOpen}
 onClose={() => { setIsSidebarOpen(false); setSelectedPedido(null); }}
 onUpdate={() => { queryClient.invalidateQueries({ queryKey: ['painelCompras'] }); if (selectedPedido) queryClient.invalidateQueries({ queryKey: ['pedido', selectedPedido.id] }); }}
 solicitantes={solicitantes}
 empreendimentos={empreendimentos}
 onEditCompleto={(p) => { setNewPedidoId(p.id); setIsNewOrderModalOpen(true); setIsSidebarOpen(false); }}
 />
 </div>
 );
}
// app/(main)/pedidos/page.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/ComprasKanban';
import PedidoItensTable from '../../../components/pedidos/PedidoItensTable'; 
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faBoxOpen, faClock, faHourglassHalf, faClipboardList, 
    faPlus, faTimes, faThLarge, faList, faDollarSign, faTrash,
    faFileInvoiceDollar, faSearch, faFilter
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PedidoForm from '@/components/PedidoForm';
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

// Componente TabButton (Definido fora para evitar erros de escopo)
const TabButton = ({ tabName, label, icon, activeTab, onClick }) => (
    <button 
        onClick={() => onClick(tabName)} 
        className={`
            whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
            ${activeTab === tabName 
                ? 'border-blue-500 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}
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

    // 2. Pedidos
    let query = supabase
        .from('pedidos_compra')
        .select(`
            *,
            titulo,
            turno_entrega,
            empreendimentos(nome, empresa_proprietaria_id),
            solicitante:solicitante_id(id, nome),
            itens:pedidos_compra_itens(*, 
                fornecedor:fornecedor_id(nome, razao_social), 
                etapa:etapa_id(nome_etapa), 
                subetapa:subetapa_id(nome_subetapa)
            ),
            anexos:pedidos_compra_anexos(*),
            lancamentos:lancamentos(id) 
        `)
        .eq('organizacao_id', organizacaoId);

    if (empreendimentoId && empreendimentoId !== 'all') {
        query = query.eq('empreendimento_id', empreendimentoId);
    }
    const { data: pedidosData, error: pedidosError } = await query.order('data_solicitacao', { ascending: false });
    if (pedidosError) throw new Error(`Falha ao carregar pedidos: "${pedidosError.message}"`);

    // 3. Fornecedores
    const { data: fornData, error: fornError } = await supabase
        .from('contatos')
        .select('id, nome, razao_social, nome_fantasia')
        .eq('organizacao_id', organizacaoId)
        .eq('tipo_contato', 'Fornecedor') 
        .order('nome');
    if (fornError) console.error("Erro ao buscar fornecedores:", fornError);
    
    // 4. Etapas
    const { data: etapaData, error: etapaError } = await supabase
        .from('etapa_obra')
        .select('id, nome_etapa')
        .eq('organizacao_id', organizacaoId)
        .order('nome_etapa');
    if (etapaError) console.error("Erro ao buscar etapas:", etapaError);

    // 5. Subetapas
    const { data: subetapaData, error: subetapaError } = await supabase
        .from('subetapas')
        .select('id, nome_subetapa')
        .eq('organizacao_id', organizacaoId)
        .order('nome_subetapa');
    if (subetapaError) console.error("Erro ao buscar subetapas:", subetapaError);

    return { 
        solicitantes: solData || [], 
        pedidos: pedidosData || [],
        fornecedores: fornData || [],
        etapas: etapaData || [],
        subetapas: subetapaData || []
    };
};

export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const { user, hasPermission } = useAuth();
    const canDelete = hasPermission('pedidos', 'pode_excluir'); 
    const organizacaoId = user?.organizacao_id;
    
    // MEMOIZAÇÃO CRÍTICA DO CLIENTE SUPABASE
    const supabase = useMemo(() => createClient(), []);
    
    const router = useRouter();
    const queryClient = useQueryClient();

    // --- ESTADO COM PERSISTÊNCIA ---
    const cachedState = getCachedUiState();
    
    const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'kanban');
    
    // CORREÇÃO: Garante que searchTerm sempre existe no estado inicial
    const [filters, setFilters] = useState(() => {
        const defaultState = { ...initialFilterState, searchTerm: '' };
        if (cachedState?.filters) {
            return { ...defaultState, ...cachedState.filters };
        }
        return defaultState;
    });

    const [showFilters, setShowFilters] = useState(cachedState?.showFilters || false);
    
    // Debounce para performance e persistência
    const [debouncedFilters] = useDebounce(filters, 500);

    // Salvar estado ao alterar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stateToSave = { activeTab, filters, showFilters };
            localStorage.setItem(PEDIDOS_UI_STATE_KEY, JSON.stringify(stateToSave));
        }
    }, [activeTab, filters, showFilters]);

    // Outros Estados (não persistidos)
    const [kpiData, setKpiData] = useState({ 
        totalPedidos: 0, 
        totalValorPedidos: 0,
        totalNaoPlanejados: 0, 
        tempoMedioCotacao: 'N/A', 
        tempoMedioEntrega: 'N/A', 
        pedidosComPendencia: 0 
    });
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
    const [newPedidoId, setNewPedidoId] = useState(null);

    useEffect(() => { setPageTitle('Painel de Compras'); }, [setPageTitle]);

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
        queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
    });

    const pedidos = data?.pedidos || [];
    const solicitantes = data?.solicitantes || [];
    const fornecedores = data?.fornecedores || [];
    const etapas = data?.etapas || [];
    const subetapas = data?.subetapas || [];

    // --- LÓGICA DE FILTRAGEM ---
    const filteredPedidosKanban = useMemo(() => {
        return pedidos.filter(pedido => {
            const itens = pedido.itens || [];
            // Filtros de Data
            if (debouncedFilters.dataSolicitacaoStart && pedido.data_solicitacao < debouncedFilters.dataSolicitacaoStart) return false;
            if (debouncedFilters.dataSolicitacaoEnd && pedido.data_solicitacao > debouncedFilters.dataSolicitacaoEnd) return false;
            if (debouncedFilters.dataEntregaStart && pedido.data_entrega_prevista < debouncedFilters.dataEntregaStart) return false;
            if (debouncedFilters.dataEntregaEnd && pedido.data_entrega_prevista > debouncedFilters.dataEntregaEnd) return false;
            
            // Filtros de Seleção Multipla
            if (debouncedFilters.status.length > 0 && !debouncedFilters.status.includes(pedido.status)) return false;
            if (debouncedFilters.empreendimentoIds.length > 0 && !debouncedFilters.empreendimentoIds.includes(pedido.empreendimento_id)) return false;
            if (debouncedFilters.solicitanteIds.length > 0 && !debouncedFilters.solicitanteIds.includes(pedido.solicitante_id)) return false;
            
            // Filtros de Itens (Complexos)
            const hasItemFilters = debouncedFilters.fornecedorIds.length > 0 || debouncedFilters.etapaIds.length > 0 || debouncedFilters.subetapaIds.length > 0 || debouncedFilters.tipoOperacao.length > 0;
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
            
            // Busca Global (Search Term) - CORREÇÃO DE SEGURANÇA
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

    // --- CÁLCULO DE KPIS ---
    useEffect(() => {
        const calculateKpis = async () => {
            const localFilteredPedidos = filteredPedidosKanban;
            const cutoffDate = new Date('2025-11-12T23:59:59'); // Data de corte mantida

            let totalValorPedidos = 0;
            let totalNaoPlanejados = 0; 

            for (const pedido of localFilteredPedidos) {
                if (pedido.itens && Array.isArray(pedido.itens)) {
                    for (const item of pedido.itens) {
                        totalValorPedidos += parseFloat(item.custo_total_real) || 0;
                    }
                }

                const dataSolicitacao = new Date(pedido.data_solicitacao);
                if (
                    (!pedido.lancamentos || pedido.lancamentos.length === 0) && 
                    pedido.status !== 'Cancelado' && 
                    dataSolicitacao > cutoffDate 
                ) {
                    totalNaoPlanejados++;
                }
            }

            if (localFilteredPedidos.length === 0) {
                 setKpiData({ totalPedidos: 0, totalValorPedidos: 0, totalNaoPlanejados: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
                 return;
            }

            const comPendencia = localFilteredPedidos.filter(p => p.status === 'Entregue' && (!p.anexos || p.anexos.length === 0 || !p.anexos.some(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal')))).length;
            const idsFiltrados = localFilteredPedidos.map(p => p.id);
            if (!supabase || idsFiltrados.length === 0) {
                 setKpiData(prev => ({ ...prev, totalPedidos: localFilteredPedidos.length, totalValorPedidos: totalValorPedidos, totalNaoPlanejados: totalNaoPlanejados, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: comPendencia }));
                 return;
             }

            let historicos = [];
            try {
                const { data: histData, error: histError } = await supabase.from('pedidos_compra_status_historico').select('pedido_compra_id, status_novo, data_mudanca').in('pedido_compra_id', idsFiltrados);
                if (histError) { throw histError; }
                historicos = histData || [];
            } catch (error) {
                console.error("Erro ao buscar histórico para KPIs:", error);
                setKpiData(prev => ({ ...prev, totalPedidos: localFilteredPedidos.length, totalValorPedidos: totalValorPedidos, totalNaoPlanejados: totalNaoPlanejados, tempoMedioCotacao: 'Erro', tempoMedioEntrega: 'Erro', pedidosComPendencia: comPendencia }));
                return;
            }

            let totalDiasCotacao = 0, countCotacao = 0, totalDiasEntrega = 0, countEntrega = 0;
            const historicosPorPedido = historicos.reduce((acc, h) => { acc[h.pedido_compra_id] = acc[h.pedido_compra_id] || []; acc[h.pedido_compra_id].push(h); acc[h.pedido_compra_id].sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca)); return acc; }, {});
            for (const pedido of localFilteredPedidos) {
                const h = historicosPorPedido[pedido.id] || [];
                const dataSolicitacao = pedido.data_solicitacao ? new Date(pedido.data_solicitacao) : null;
                const dataCotacaoObj = h.find(item => item.status_novo === 'Em Cotação');
                const dataCotacao = dataCotacaoObj ? new Date(dataCotacaoObj.data_mudanca) : null;
                const dataRealizadoObj = h.find(item => item.status_novo === 'Realizado');
                const dataRealizado = dataRealizadoObj ? new Date(dataRealizadoObj.data_mudanca) : null;
                const dataEntregueObj = h.find(item => item.status_novo === 'Entregue');
                const dataEntregue = dataEntregueObj ? new Date(dataEntregueObj.data_mudanca) : null;
                if (dataSolicitacao && dataCotacao && dataCotacao >= dataSolicitacao) {
                     const diffTime = dataCotacao.getTime() - dataSolicitacao.getTime();
                     if (!isNaN(diffTime)) { totalDiasCotacao += diffTime / (1000 * 60 * 60 * 24); countCotacao++; }
                }
                if (dataRealizado && dataEntregue && dataEntregue >= dataRealizado) {
                     const diffTime = dataEntregue.getTime() - dataRealizado.getTime();
                     if (!isNaN(diffTime)) { totalDiasEntrega += diffTime / (1000 * 60 * 60 * 24); countEntrega++; }
                }
            }
            
            setKpiData({
                totalPedidos: localFilteredPedidos.length,
                totalValorPedidos: totalValorPedidos,
                totalNaoPlanejados: totalNaoPlanejados, 
                tempoMedioCotacao: countCotacao > 0 ? `${(totalDiasCotacao / countCotacao).toFixed(1)} dias` : 'N/A',
                tempoMedioEntrega: countEntrega > 0 ? `${(totalDiasEntrega / countEntrega).toFixed(1)} dias` : 'N/A',
                pedidosComPendencia: comPendencia,
            });
        };
        // Dependência corrigida para evitar loops
        if (pedidos.length > 0) calculateKpis();
    }, [filteredPedidosKanban, supabase, pedidos.length]);

    const createPedidoMutation = useMutation({
        mutationFn: async () => {
            if (!user || !user.id || !organizacaoId) { throw new Error('Usuário ou Organização não autenticados.'); }
            if (!selectedEmpreendimento || selectedEmpreendimento === 'all') { throw new Error('Selecione um empreendimento específico.'); }
            const novoPedido = {
                titulo: 'Nova Solicitação (Rascunho)', status: 'Solicitação', solicitante_id: user.id,
                organizacao_id: organizacaoId, empreendimento_id: selectedEmpreendimento,
                data_solicitacao: new Date().toISOString(),
            };
            const { data, error } = await supabase.from('pedidos_compra').insert(novoPedido).select('id').single();
            if (error) { throw new Error(`Erro do Supabase: ${error.message}`); }
            return data;
        },
        onSuccess: async (data) => {
            toast.success('Nova solicitação criada! Preencha os detalhes agora.');
            await enviarNotificacao({
                userId: user.id,
                titulo: "📝 Novo Pedido Criado",
                mensagem: `O pedido #${data.id} foi iniciado por você. Não esqueça de adicionar os itens!`,
                link: `/pedidos`,
                organizacaoId: organizacaoId,
                canal: 'operacional' 
            });
            setNewPedidoId(data.id);
            setIsNewOrderModalOpen(true);
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] });
        },
        onError: (error) => toast.error(`Falha ao criar solicitação: ${error.message}`)
    });

    const deleteCanceledMutation = useMutation({
        mutationFn: async (pedidoIds) => {
            if (!pedidoIds || pedidoIds.length === 0) { throw new Error("Nenhum pedido para excluir."); }
            const { error } = await supabase.rpc('delete_pedidos_cancelados', { pedido_ids: pedidoIds });
            if (error) throw error;
            return pedidoIds.length;
        },
        onSuccess: (count) => {
            toast.success(`${count} ${count === 1 ? 'pedido' : 'pedidos'} cancelados foram excluídos!`);
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] });
        },
        onError: (error) => toast.error(`Falha ao excluir pedidos: ${error.message}`)
    });

    const handleDeleteAllCanceled = (pedidoIds) => { deleteCanceledMutation.mutate(pedidoIds); };
    const handleCardClick = (pedido) => { setSelectedPedido(pedido); setIsSidebarOpen(true); };
    const handleCloseSidebar = () => { setIsSidebarOpen(false); setSelectedPedido(null); };
    const handleCloseNewOrderModal = () => {
        setIsNewOrderModalOpen(false);
        setNewPedidoId(null);
        queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] });
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6 bg-gray-50 min-h-screen">
            
            {/* CABEÇALHO UNIFICADO */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-gray-800 uppercase">
                        Painel de Compras 
                        {selectedEmpreendimento && selectedEmpreendimento !== 'all' && 
                            <span className="ml-2 text-blue-600">- {empreendimentos.find(e => e.id == selectedEmpreendimento)?.nome}</span>
                        }
                    </h1>
                </div>

                <div className="flex flex-wrap gap-2 items-center w-full xl:w-auto">
                    {/* Busca Global */}
                    <div className="relative flex-grow xl:flex-grow-0 min-w-[250px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Buscar pedido, item, ID..." 
                            value={filters.searchTerm} 
                            onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))} 
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        />
                    </div>

                    {/* Botão Filtros */}
                    <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`border font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition duration-200 ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        title="Filtros Avançados"
                    >
                        <FontAwesomeIcon icon={faFilter} className={showFilters ? "text-blue-500 mr-2" : "text-gray-500 mr-2"} />
                        Filtros
                    </button>

                    <div className="h-8 w-px bg-gray-300 mx-1 hidden md:block"></div>

                    {/* Botão Novo */}
                    <button 
                        onClick={() => createPedidoMutation.mutate()} 
                        disabled={createPedidoMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center transition duration-200"
                    >
                        {createPedidoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> : <FontAwesomeIcon icon={faPlus} className="mr-2" />} 
                        Novo Pedido
                    </button>
                </div>
            </div>

            {/* Painel de Filtros (Acima dos KPIs) */}
            {showFilters && (
                <FiltroPedidos
                    filters={filters}
                    setFilters={setFilters}
                    solicitantes={solicitantes}
                    empreendimentos={empreendimentos}
                    fornecedores={fornecedores}
                    etapas={etapas}
                    subetapas={subetapas}
                />
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                 <KpiCard title="Pedidos" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
                 <KpiCard title="Valor Total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalValorPedidos)} icon={faDollarSign} color="green" />
                 <KpiCard title="Pend. Financeiro" value={kpiData.totalNaoPlanejados} icon={faFileInvoiceDollar} color="yellow" />
                 <KpiCard title="Pendências NF" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
                 <KpiCard title="T.M. Cotação" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="purple" />
                 <KpiCard title="T.M. Entrega" value={kpiData.tempoMedioEntrega} icon={faClock} color="orange" />
            </div>

            {/* Conteúdo Principal (Kanban/Lista) */}
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
                                    onCardClick={handleCardClick}
                                    onDeleteAllCanceled={handleDeleteAllCanceled}
                                    canDelete={canDelete}
                                    isDeleting={deleteCanceledMutation.isPending}
                                />
                            ) : (
                                <PedidoItensTable
                                    pedidos={filteredPedidosKanban}
                                    onCardClick={handleCardClick}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modais */}
            {isNewOrderModalOpen && newPedidoId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative">
                        <button onClick={handleCloseNewOrderModal} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 bg-gray-100 p-2 rounded-full z-10">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                        <div className="p-2"><PedidoForm pedidoId={newPedidoId} /></div>
                    </div>
                </div>
            )}

            <PedidoDetalhesSidebar
                pedido={selectedPedido}
                isOpen={isSidebarOpen}
                onClose={handleCloseSidebar}
                onUpdate={() => { 
                    queryClient.invalidateQueries({ queryKey: ['painelCompras'] });
                    if (selectedPedido) queryClient.invalidateQueries({ queryKey: ['pedido', selectedPedido.id] });
                }}
                solicitantes={solicitantes}
                empreendimentos={empreendimentos}
                onEditCompleto={(p) => { setNewPedidoId(p.id); setIsNewOrderModalOpen(true); setIsSidebarOpen(false); }}
            />
        </div>
    );
}
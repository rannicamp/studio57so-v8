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
    faFileInvoiceDollar // <-- ÍCONE PARA O NOVO KPI
} from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PedidoForm from '@/components/PedidoForm';
import FiltroPedidos, { initialFilterState } from '../../../components/pedidos/FiltroPedidos';

// ======================= FUNÇÃO DE BUSCA (Carregamento Mágico) =======================
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
            lancamentos(id) 
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
        .eq('tipo', 'Fornecedor')
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
// ====================================================================================


export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const { user, hasPermission } = useAuth();
    const canDelete = hasPermission('pedidos', 'pode_excluir'); 
    const organizacaoId = user?.organizacao_id;
    const [activeTab, setActiveTab] = useState('kanban');
    
    const [filters, setFilters] = useState(() => {
        if (typeof window !== 'undefined') {
            const cachedFilters = localStorage.getItem('pedidosCurrentFilters');
            if (cachedFilters) { return JSON.parse(cachedFilters); }
        }
        return initialFilterState;
    });

    // =================================================================================
    // KPI DE VALOR TOTAL ADICIONADO AO ESTADO INICIAL
    // =================================================================================
    const [kpiData, setKpiData] = useState({ 
        totalPedidos: 0, 
        totalValorPedidos: 0,
        totalNaoPlanejados: 0, // <-- NOVO KPI
        tempoMedioCotacao: 'N/A', 
        tempoMedioEntrega: 'N/A', 
        pedidosComPendencia: 0 
    });
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedPedido, setSelectedPedido] = useState(null);
    const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
    const [newPedidoId, setNewPedidoId] = useState(null);

    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => { setPageTitle('Painel de Compras'); }, [setPageTitle]);

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
        queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
    });

    useEffect(() => {
        let isRefetching = false;
        if (queryClient.getQueryState(['painelCompras', organizacaoId, selectedEmpreendimento])?.isFetching && !isLoading) isRefetching = true;
        if (!isFetching && !isLoading && data && isRefetching) {
            const timer = setTimeout(() => {
                toast.info('Página atualizada!', { description: 'Novos dados foram carregados.', duration: 2000 });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isFetching, isLoading, data, queryClient, organizacaoId, selectedEmpreendimento]);

    const pedidos = data?.pedidos || [];
    const solicitantes = data?.solicitantes || [];
    const fornecedores = data?.fornecedores || [];
    const etapas = data?.etapas || [];
    const subetapas = data?.subetapas || [];

    const filteredPedidosKanban = useMemo(() => {
        return pedidos.filter(pedido => {
            const itens = pedido.itens || [];
            if (filters.dataSolicitacaoStart && pedido.data_solicitacao < filters.dataSolicitacaoStart) return false;
            if (filters.dataSolicitacaoEnd && pedido.data_solicitacao > filters.dataSolicitacaoEnd) return false;
            if (filters.dataEntregaStart && pedido.data_entrega_prevista < filters.dataEntregaStart) return false;
            if (filters.dataEntregaEnd && pedido.data_entrega_prevista > filters.dataEntregaEnd) return false;
            if (filters.status.length > 0 && !filters.status.includes(pedido.status)) return false;
            if (filters.empreendimentoIds.length > 0 && !filters.empreendimentoIds.includes(pedido.empreendimento_id)) return false;
            if (filters.solicitanteIds.length > 0 && !filters.solicitanteIds.includes(pedido.solicitante_id)) return false;
            const hasItemFilters = filters.fornecedorIds.length > 0 || filters.etapaIds.length > 0 || filters.subetapaIds.length > 0 || filters.tipoOperacao.length > 0;
            if (hasItemFilters && itens.length === 0) return false;
            if (hasItemFilters) {
                const match = itens.some(item => {
                    const matchFornecedor = filters.fornecedorIds.length === 0 || filters.fornecedorIds.includes(item.fornecedor_id);
                    const matchEtapa = filters.etapaIds.length === 0 || filters.etapaIds.includes(item.etapa_id);
                    const matchSubetapa = filters.subetapaIds.length === 0 || filters.subetapaIds.includes(item.subetapa_id);
                    const matchTipo = filters.tipoOperacao.length === 0 || filters.tipoOperacao.includes(item.tipo_operacao);
                    return matchFornecedor && matchEtapa && matchSubetapa && matchTipo;
                });
                if (!match) return false;
            }
            if (filters.searchTerm.trim() !== '') {
                const term = filters.searchTerm.toLowerCase();
                const tituloMatch = pedido.titulo?.toLowerCase().includes(term);
                const idMatch = pedido.id.toString().includes(term);
                const itemMatch = itens.some(item => item.descricao_item?.toLowerCase().includes(term));
                if (!tituloMatch && !idMatch && !itemMatch) return false;
            }
            return true;
        });
    }, [pedidos, filters]);

    // =================================================================================
    // LÓGICA DO KPI DE VALOR TOTAL ADICIONADA AQUI
    // =================================================================================
    useEffect(() => {
        const calculateKpis = async () => {
            const localFilteredPedidos = filteredPedidosKanban;
            
            let totalValorPedidos = 0;
            let totalNaoPlanejados = 0; // <-- NOVO KPI

            for (const pedido of localFilteredPedidos) {
                if (pedido.itens && Array.isArray(pedido.itens)) {
                    for (const item of pedido.itens) {
                        totalValorPedidos += parseFloat(item.custo_total_real) || 0;
                    }
                }
                // Se não tem lançamentos OU a lista está vazia, E o pedido não está cancelado
                if ((!pedido.lancamentos || pedido.lancamentos.length === 0) && pedido.status !== 'Cancelado') {
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
                totalNaoPlanejados: totalNaoPlanejados, // <-- NOVO VALOR AQUI
                tempoMedioCotacao: countCotacao > 0 ? `${(totalDiasCotacao / countCotacao).toFixed(1)} dias` : 'N/A',
                tempoMedioEntrega: countEntrega > 0 ? `${(totalDiasEntrega / countEntrega).toFixed(1)} dias` : 'N/A',
                pedidosComPendencia: comPendencia,
            });
        };
        if (pedidos && supabase) {
             calculateKpis();
        }
    }, [filteredPedidosKanban, supabase]);


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
        onSuccess: (data) => {
            toast.success('Nova solicitação criada! Preencha os detalhes agora.');
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

    const TabButton = ({ tabName, label, icon }) => (
        <button 
            onClick={() => setActiveTab(tabName)} 
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

    return (
        <div className="space-y-6">
            {isNewOrderModalOpen && newPedidoId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative">
                        <button onClick={handleCloseNewOrderModal} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10 bg-white rounded-full p-1 shadow-sm" title="Fechar e Salvar">
                            <FontAwesomeIcon icon={faTimes} size="lg" />
                        </button>
                        <div className="p-2"> <PedidoForm pedidoId={newPedidoId} /> </div>
                    </div>
                </div>
            )}

            <PedidoDetalhesSidebar
                pedido={selectedPedido}
                isOpen={isSidebarOpen}
                onClose={handleCloseSidebar}
                onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] });
                    if (selectedPedido) {
                        queryClient.invalidateQueries({ queryKey: ['pedido', selectedPedido.id] });
                    }
                }}
                solicitantes={solicitantes}
                empreendimentos={empreendimentos}
                onEditCompleto={(pedidoToEdit) => {
                    setNewPedidoId(pedidoToEdit.id);
                    setIsNewOrderModalOpen(true);
                    setIsSidebarOpen(false);
                }}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-semibold">
                    {empreendimentos.find(e => e.id == selectedEmpreendimento)?.nome || 'Todos os Empreendimentos'}
                </h2>
                <button
                    onClick={() => createPedidoMutation.mutate()}
                    disabled={createPedidoMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 w-full md:w-auto flex items-center justify-center gap-2 font-medium"
                >
                    {createPedidoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPlus} />}
                    Novo Pedido
                </button>
            </div>

            {/* =================================================================================
             * GRID DE KPIS ATUALIZADO PARA 6 COLUNAS
             * ================================================================================= */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                 <KpiCard title="Pedidos (Filtro)" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
                 <KpiCard 
                    title="Valor Total (Filtro)" 
                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpiData.totalValorPedidos)} 
                    icon={faDollarSign} 
                    color="green" 
                 />
                 {/* =================================================================================
                  * NOVO KPI CARD ADICIONADO AQUI
                  * ================================================================================= */}
                 <KpiCard 
                    title="Pendentes Financeiro" 
                    value={kpiData.totalNaoPlanejados} 
                    icon={faFileInvoiceDollar} 
                    color="yellow" 
                 />
                 <KpiCard title="Pendências NF" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
                 <KpiCard title="T.M. Cotação" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="purple" />
                 <KpiCard title="T.M. Entrega" value={kpiData.tempoMedioEntrega} icon={faClock} color="orange" />
            </div>

            <FiltroPedidos
                filters={filters}
                setFilters={setFilters}
                solicitantes={solicitantes}
                empreendimentos={empreendimentos}
                fornecedores={fornecedores}
                etapas={etapas}
                subetapas={subetapas}
            />

            <div className="border-b border-gray-200 bg-white shadow-sm rounded-t-lg">
                <nav className="-mb-px flex space-x-6 px-4" aria-label="Tabs">
                    <TabButton tabName="kanban" label="Visão Kanban" icon={faThLarge} />
                    <TabButton tabName="itens" label="Visão de Itens (Materiais)" icon={faList} />
                </nav>
            </div>

            {isFetching && !isLoading && (
                 <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>Atualizando dados...</span>
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-10">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-600" />
                    <p className="mt-2">Carregando painel...</p>
                </div>
            ) : isError ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Erro ao carregar dados!</strong>
                    <span className="block sm:inline"> {error.message}</span>
                </div>
            ) : (
                <div className={
                    activeTab === 'kanban' 
                        ? 'rounded-b-lg'
                        : 'bg-white p-4 rounded-lg shadow rounded-t-none border-t-0'
                }>
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
                </div>
            )}
        </div>
    );
}
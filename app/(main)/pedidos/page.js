// app/(main)/pedidos/page.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/ComprasKanban';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBoxOpen, faClock, faHourglassHalf, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
    // ***** INÍCIO DA CORREÇÃO *****
    // O 'porquê': Corrigido para buscar 'nome_etapa' da tabela 'etapa_obra',
    // pois a coluna 'nome' não existe nela, conforme esquema do banco.
    let query = supabase
        .from('pedidos_compra')
        .select(`
            *,
            titulo,
            turno_entrega,
            empreendimentos(nome, empresa_proprietaria_id),
            solicitante:solicitante_id(id, nome),
            itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social), etapa:etapa_id(nome_etapa)),
            anexos:pedidos_compra_anexos(*)
        `)
        .eq('organizacao_id', organizacaoId);
    // ***** FIM DA CORREÇÃO *****

    if (empreendimentoId && empreendimentoId !== 'all') {
        query = query.eq('empreendimento_id', empreendimentoId);
    }

    const { data: pedidosData, error: pedidosError } = await query.order('data_solicitacao', { ascending: false });
    if (pedidosError) {
        console.error("Erro detalhado ao carregar pedidos:", pedidosError);
        throw new Error(`Falha ao carregar pedidos: "${pedidosError.message}"`);
    }

    return { solicitantes: solData || [], pedidos: pedidosData || [] };
};
// ====================================================================================


export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitante, setSelectedSolicitante] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [kpiData, setKpiData] = useState({ totalPedidos: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedPedido, setSelectedPedido] = useState(null);

    const supabase = createClient();
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        setPageTitle('Painel de Compras');
    }, [setPageTitle]);

    // ======================= useQuery (Carregamento Mágico) =======================
    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
        queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
    });

    // Efeito para a notificação de atualização (Carregamento Mágico)
    useEffect(() => {
        let isRefetching = false;
        // Verifica se está buscando E se não é o carregamento inicial
        if (queryClient.getQueryState(['painelCompras', organizacaoId, selectedEmpreendimento])?.isFetching && !isLoading) {
            isRefetching = true;
        }

        // Mostra notificação apenas se a re-busca terminou (isFetching=false), não era o loading inicial,
        // temos dados (data) E identificamos que era uma re-busca (isRefetching).
        if (!isFetching && !isLoading && data && isRefetching) {
            const timer = setTimeout(() => {
                toast.info('Página atualizada!', {
                    description: 'Novos dados foram carregados.',
                    duration: 2000,
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isFetching, isLoading, data, queryClient, organizacaoId, selectedEmpreendimento]); // Monitora todas as dependências relevantes
    // ==============================================================================


    const pedidos = data?.pedidos || [];
    const solicitantes = data?.solicitantes || [];

    // useMemo para filtrar pedidos (para o KANBAN)
    const filteredPedidosKanban = useMemo(() => {
        return pedidos.filter(pedido => {
            // Filtro por Solicitante
            if (selectedSolicitante && pedido.solicitante?.id?.toString() !== selectedSolicitante) return false;

            // Filtro por Data (usando string YYYY-MM-DD para evitar fuso)
            try {
                const pedidoDateStr = pedido.data_solicitacao?.split('T')[0];
                if (startDate && (!pedidoDateStr || startDate > pedidoDateStr)) return false;
                if (endDate && (!pedidoDateStr || endDate < pedidoDateStr)) return false;
            } catch (e) { console.error("Erro datas filtro Kanban:", e); return false; }

            // Filtro por Termo de Busca (no título OU nos itens)
             if (searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase();
                const tituloMatch = pedido.titulo?.toLowerCase().includes(term);
                // Garante que 'pedido.itens' existe e é um array antes de usar 'some'
                const itemMatch = Array.isArray(pedido.itens) && pedido.itens.some(item => item.descricao_item?.toLowerCase().includes(term));
                if (!tituloMatch && !itemMatch) return false;
            }
            return true; // Se passou por todos os filtros, inclui o pedido
        });
    }, [pedidos, searchTerm, selectedSolicitante, startDate, endDate]);

    // useEffect dos KPIs
    useEffect(() => {
        const calculateKpis = async () => {
            const localFilteredPedidos = filteredPedidosKanban;

            if (localFilteredPedidos.length === 0) {
                 setKpiData({ totalPedidos: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
                 return;
            }

            const comPendencia = localFilteredPedidos.filter(p =>
                p.status === 'Entregue' &&
                (!p.anexos || p.anexos.length === 0 || !p.anexos.some(a => a.descricao && a.descricao.toLowerCase().includes('nota fiscal')))
            ).length;

            const idsFiltrados = localFilteredPedidos.map(p => p.id);
            if (!supabase || idsFiltrados.length === 0) {
                 setKpiData(prev => ({ ...prev, totalPedidos: localFilteredPedidos.length, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: comPendencia }));
                 return;
             }

            let historicos = [];
            try {
                const { data: histData, error: histError } = await supabase
                    .from('pedidos_compra_status_historico')
                    .select('pedido_compra_id, status_novo, data_mudanca')
                    .in('pedido_compra_id', idsFiltrados);
                if (histError) { throw histError; }
                historicos = histData || [];
            } catch (error) {
                console.error("Erro ao buscar histórico para KPIs:", error);
                setKpiData(prev => ({ ...prev, totalPedidos: localFilteredPedidos.length, tempoMedioCotacao: 'Erro', tempoMedioEntrega: 'Erro', pedidosComPendencia: comPendencia }));
                return;
            }

            let totalDiasCotacao = 0, countCotacao = 0, totalDiasEntrega = 0, countEntrega = 0;
            const historicosPorPedido = historicos.reduce((acc, h) => {
                acc[h.pedido_compra_id] = acc[h.pedido_compra_id] || [];
                acc[h.pedido_compra_id].push(h);
                acc[h.pedido_compra_id].sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca));
                return acc;
             }, {});

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
                    const diffTime = dataCotacao.getTime() - dataSolicitacao.getTime(); // Use getTime() for milliseconds
                    if (!isNaN(diffTime)) { // Check if diffTime is a valid number
                        totalDiasCotacao += diffTime / (1000 * 60 * 60 * 24);
                        countCotacao++;
                    }
                }
                if (dataRealizado && dataEntregue && dataEntregue >= dataRealizado) {
                     const diffTime = dataEntregue.getTime() - dataRealizado.getTime(); // Use getTime()
                     if (!isNaN(diffTime)) { // Check validity
                        totalDiasEntrega += diffTime / (1000 * 60 * 60 * 24);
                        countEntrega++;
                    }
                }
            }

            setKpiData({
                totalPedidos: localFilteredPedidos.length,
                tempoMedioCotacao: countCotacao > 0 ? `${(totalDiasCotacao / countCotacao).toFixed(1)} dias` : 'N/A',
                tempoMedioEntrega: countEntrega > 0 ? `${(totalDiasEntrega / countEntrega).toFixed(1)} dias` : 'N/A',
                pedidosComPendencia: comPendencia,
            });
        };

        if (pedidos && supabase) {
             calculateKpis();
        }

    }, [filteredPedidosKanban, supabase]); // Depende apenas do filtro e do supabase client
    // ========================================================================


    // ======================= useMutation (Criar Pedido) =======================
    const createPedidoMutation = useMutation({
        mutationFn: async () => {
            if (!user || !user.id || !organizacaoId) {
                throw new Error('Usuário ou Organização não autenticados. Faça login novamente.');
            }
            if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
                throw new Error('Por favor, selecione um empreendimento específico antes de criar uma solicitação.');
            }

            const novoPedido = {
                titulo: 'Nova Solicitação (Rascunho)',
                status: 'Solicitação',
                solicitante_id: user.id,
                organizacao_id: organizacaoId,
                empreendimento_id: selectedEmpreendimento,
                data_solicitacao: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('pedidos_compra')
                .insert(novoPedido)
                .select('id')
                .single();

            if (error) {
                console.error("Erro do Supabase ao criar pedido:", error.message);
                throw new Error(`Erro do Supabase: ${error.message}`);
            }
            return data;
        },
        onSuccess: (data) => {
            toast.success('Nova solicitação criada com sucesso!', {
                description: 'Você será redirecionado para editá-la.'
            });
            queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] });
            router.push(`/pedidos/${data.id}`);
        },
        onError: (error) => {
            console.error("Falha na mutation ao criar pedido:", error);
            toast.error(`Falha ao criar solicitação: ${error.message}`);
        }
    });
    // ===================================================================================


    const handleCardClick = (pedido) => {
        setSelectedPedido(pedido);
        setIsSidebarOpen(true);
    };
    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setSelectedPedido(null);
    };

    // JSX Principal
    return (
        <div className="space-y-6">
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
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-semibold">
                    {empreendimentos.find(e => e.id == selectedEmpreendimento)?.nome || 'Todos os Empreendimentos'}
                </h2>
                <button
                    onClick={() => createPedidoMutation.mutate()}
                    disabled={createPedidoMutation.isPending}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 w-full md:w-auto"
                >
                    {createPedidoMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : '+ Nova Solicitação'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <KpiCard title="Pedidos (Filtro)" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
                 <KpiCard title="Pendências NF (Filtro)" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
                 <KpiCard title="Tempo Médio Cotação (Filtro)" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="yellow" />
                 <KpiCard title="Tempo Médio Entrega (Filtro)" value={kpiData.tempoMedioEntrega} icon={faClock} color="green" />
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <input type="text" placeholder="Buscar por título ou item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md lg:col-span-2"/>
                     <select value={selectedSolicitante} onChange={e => setSelectedSolicitante(e.target.value)} className="p-2 border rounded-md">
                         <option value="">Todos Solicitantes</option>
                         {/* Garante que o ID seja string para comparação no filtro */}
                         {solicitantes.map(s => <option key={s.id} value={s.id.toString()}>{s.nome} {s.sobrenome}</option>)}
                     </select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:col-span-4 lg:grid-cols-4 gap-4 items-end">
                     <div>
                         <label className="text-xs">De:</label>
                         <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md w-full" />
                     </div>
                     <div>
                         <label className="text-xs">Até:</label>
                         <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md w-full" />
                     </div>
                 </div>
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
                <div className="bg-white p-4 rounded-lg shadow">
                    <ComprasKanban
                        pedidos={filteredPedidosKanban}
                        // setPedidos não é mais necessário aqui, use invalidateQueries
                        onCardClick={handleCardClick}
                    />
                </div>
            )}
        </div>
    );
}
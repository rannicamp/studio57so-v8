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
// O 'staleTime' e 'refetchOnWindowFocus' fazem a mágica do cache.
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
            empreendimentos(nome), 
            solicitante:solicitante_id(id, nome), 
            itens:pedidos_compra_itens(*, fornecedor:fornecedor_id(nome, razao_social)), 
            anexos:pedidos_compra_anexos(descricao)
        `)
        .eq('organizacao_id', organizacaoId);

    if (empreendimentoId && empreendimentoId !== 'all') {
        query = query.eq('empreendimento_id', empreendimentoId);
    }

    const { data: pedidosData, error: pedidosError } = await query.order('data_solicitacao', { ascending: false });
    if (pedidosError) throw new Error(`Falha ao carregar pedidos: ${pedidosError.message}`);

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
    // staleTime: 1000 * 60 * 5  -> Guarda os dados em cache por 5 minutos
    // refetchOnWindowFocus: true -> Busca atualizações silenciosamente quando volta pra aba
    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
        queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 5, // Cache de 5 minutos (carregamento instantâneo)
        refetchOnWindowFocus: true, // Busca silenciosa ao focar na janela
    });

    // Efeito para a notificação de atualização (Carregamento Mágico)
    useEffect(() => {
        // Se NÃO estava buscando, e AGORA está buscando (em segundo plano), não faz nada.
        // Se ESTAVA buscando (isFetching=true) e agora NÃO ESTÁ (isFetching=false),
        // E NÃO era o carregamento inicial (isLoading=false),
        // então a busca em segundo plano terminou.
        if (!isFetching && !isLoading && data) { // Adicionado 'data' para garantir que não dispare antes da primeira carga
            // Um pequeno delay para não ser intrusivo
            const timer = setTimeout(() => {
                toast.info('Página atualizada!', {
                    description: 'Novos dados foram carregados.',
                    duration: 2000,
                });
            }, 1000); // 1 segundo de delay
            return () => clearTimeout(timer);
        }
    }, [isFetching, isLoading, data]); // Depende do 'data' para evitar disparo inicial
    // ==============================================================================


    const pedidos = data?.pedidos || [];
    const solicitantes = data?.solicitantes || [];

    // useMemo para filtrar pedidos (para o KANBAN)
    // O PORQUÊ: Usei a lógica de filtro corrigida que previne bugs de data/fuso horário
    const filteredPedidosKanban = useMemo(() => {
        return pedidos.filter(pedido => {
            if (selectedSolicitante && pedido.solicitante?.id !== selectedSolicitante) return false;
             try {
                // CORREÇÃO DE DATA (REGRA 5): Trata a data como string para evitar fuso
                const pedidoDate = pedido.data_solicitacao ? new Date(pedido.data_solicitacao + 'T00:00:00') : null;
                const filterStartDate = startDate ? new Date(startDate + 'T00:00:00') : null;
                const filterEndDate = endDate ? new Date(endDate + 'T00:00:00') : null;
                if (filterStartDate && (!pedidoDate || filterStartDate > pedidoDate)) return false;
                if (filterEndDate && (!pedidoDate || filterEndDate < pedidoDate)) return false;
            } catch (e) { console.error("Erro datas filtro Kanban:", e); return false; }
            if (searchTerm.trim() !== '' && !pedido.itens.some(item => item.descricao_item?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
            return true;
        });
    }, [pedidos, searchTerm, selectedSolicitante, startDate, endDate]);

    // useEffect dos KPIs (Refeito para usar o filtro corrigido)
    useEffect(() => {
        const calculateKpis = async () => {
            // Usa os pedidos JÁ filtrados pelo useMemo
            const localFilteredPedidos = filteredPedidosKanban;

            if (pedidos.length === 0 || localFilteredPedidos.length === 0) {
                setKpiData({ totalPedidos: localFilteredPedidos.length, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
                return;
            }

            // Calcula pendências baseado nos pedidos filtrados
            const comPendencia = localFilteredPedidos.filter(p => p.status === 'Realizado' && (!p.anexos || !p.anexos.some(a => a.descricao === 'Nota Fiscal'))).length;

            // Busca histórico APENAS dos IDs filtrados
            const idsFiltrados = localFilteredPedidos.map(p => p.id);
            if (!supabase) { console.warn("Supabase client não disponível."); return; }

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

            // Lógica de cálculo de médias (usa localFilteredPedidos)
            let totalDiasCotacao = 0, countCotacao = 0, totalDiasEntrega = 0, countEntrega = 0;
            const historicosPorPedido = historicos.reduce((acc, h) => { acc[h.pedido_compra_id] = acc[h.pedido_compra_id] || []; acc[h.pedido_compra_id].push(h); acc[h.pedido_compra_id].sort((a,b) => new Date(a.data_mudanca) - new Date(b.data_mudanca)); return acc; }, {});

            for (const pedido of localFilteredPedidos) { // Itera sobre os filtrados
                const h = historicosPorPedido[pedido.id] || [];
                const dataSolicitacao = pedido.data_solicitacao ? new Date(pedido.data_solicitacao) : null;
                const dataCotacaoObj = h.find(item => item.status_novo === 'Em Cotação');
                const dataCotacao = dataCotacaoObj ? new Date(dataCotacaoObj.data_mudanca) : null;
                const dataEntregueObj = h.find(item => item.status_novo === 'Entregue');
                const dataEntregue = dataEntregueObj ? new Date(dataEntregueObj.data_mudanca) : null;
                const dataRealizadoObj = h.find(item => item.status_novo === 'Realizado');
                const dataRealizado = dataRealizadoObj ? new Date(dataRealizadoObj.data_mudanca) : null;

                if (dataSolicitacao && dataCotacao && dataCotacao >= dataSolicitacao) {
                    const diffTime = dataCotacao - dataSolicitacao; totalDiasCotacao += diffTime / (1000 * 60 * 60 * 24); countCotacao++;
                }
                if (dataRealizado && dataEntregue && dataEntregue >= dataRealizado) {
                    const diffTime = dataEntregue - dataRealizado; totalDiasEntrega += diffTime / (1000 * 60 * 60 * 24); countEntrega++;
                }
            }

            // Atualiza o estado
            setKpiData({
                totalPedidos: localFilteredPedidos.length, // KPI baseado nos filtros
                tempoMedioCotacao: countCotacao > 0 ? `${(totalDiasCotacao / countCotacao).toFixed(1)} dias` : 'N/A',
                tempoMedioEntrega: countEntrega > 0 ? `${(totalDiasEntrega / countEntrega).toFixed(1)} dias` : 'N/A',
                pedidosComPendencia: comPendencia,
            });
        };

        // Roda a função SE tivermos os dados dos pedidos E o supabase client
        if (pedidos && supabase) {
             calculateKpis();
        }

    }, [filteredPedidosKanban, pedidos, supabase]); // Depende do filtro corrigido
    // ========================================================================


    // ======================= useMutation (CORREÇÃO DA RLS + STATUS) =======================
    // O PORQUÊ: Mudamos o status para 'Solicitação' para ser mais correto.
    // O restante da lógica de RLS (enviar IDs) permanece.
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
                status: 'Solicitação', // <-- CORREÇÃO: Status inicial correto
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


    // Funções handleCardClick e handleCloseSidebar (sem alterações)
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
                isOpen={isSidebarOpen} // Prop corrigida para 'isOpen'
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
                 {/* Títulos dos KPIs corrigidos para (Filtro) */}
                 <KpiCard title="Pedidos (Filtro)" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
                 <KpiCard title="Pedidos com Pendências (Filtro)" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
                 <KpiCard title="Tempo Médio Cotação (Filtro)" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="yellow" />
                 <KpiCard title="Tempo Médio Entrega (Filtro)" value={kpiData.tempoMedioEntrega} icon={faClock} color="green" />
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <input type="text" placeholder="Buscar por item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md lg:col-span-2"/>
                     <select value={selectedSolicitante} onChange={e => setSelectedSolicitante(e.target.value)} className="p-2 border rounded-md">
                         <option value="">Todos Solicitantes</option>
                         {solicitantes.map(s => <option key={s.id} value={s.id}>{s.nome} {s.sobrenome}</option>)}
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

            {/* Spinner de atualização silenciosa (Carregamento Mágico) */}
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
                <p className="text-center text-red-500">{error.message}</p>
            ) : (
                <ComprasKanban
                    pedidos={filteredPedidosKanban} // Passa os pedidos filtrados pelo useMemo
                    setPedidos={() => queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] })}
                    onCardClick={handleCardClick}
                />
            )}
        </div>
    );
}
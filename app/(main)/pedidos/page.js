// app/(main)/pedidos/page.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/ComprasKanban';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { useAuth } from '@/contexts/AuthContext'; // 1. Importar o hook de autenticação
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBoxOpen, faClock, faHourglassHalf, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // 2. Importar hooks do React Query
import { toast } from 'sonner';

// O PORQUÊ: Centralizamos toda a lógica de busca de dados em uma única função assíncrona.
// Isso limpa o componente e permite que o React Query gerencie o estado de forma eficiente.
const fetchPainelData = async (supabase, organizacaoId, empreendimentoId) => {
    if (!organizacaoId) throw new Error("Organização não identificada.");

    // Busca de Solicitantes (usuários)
    const { data: solData, error: solError } = await supabase
        .from('usuarios')
        .select('id, nome, sobrenome')
        .eq('organizacao_id', organizacaoId)
        .order('nome');
    if (solError) throw new Error(`Falha ao carregar solicitantes: ${solError.message}`);

    // Query base para Pedidos
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
        .eq('organizacao_id', organizacaoId); // <-- Filtro de segurança principal

    if (empreendimentoId && empreendimentoId !== 'all') {
        query = query.eq('empreendimento_id', empreendimentoId);
    }

    const { data: pedidosData, error: pedidosError } = await query.order('data_solicitacao', { ascending: false });
    if (pedidosError) throw new Error(`Falha ao carregar pedidos: ${pedidosError.message}`);

    return { solicitantes: solData || [], pedidos: pedidosData || [] };
};

export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const { user } = useAuth(); // 3. Obter o usuário logado
    const organizacaoId = user?.organizacao_id; // 4. Obter o ID da organização

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

    // O PORQUÊ: Substituímos useState/useEffect por useQuery para buscar todos os dados da página.
    // Ele gerencia loading, erros e cache automaticamente. A query é refeita se o empreendimento ou organização mudar.
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento],
        queryFn: () => fetchPainelData(supabase, organizacaoId, selectedEmpreendimento),
        enabled: !!organizacaoId, // Só executa a busca quando o ID da organização estiver disponível.
    });

    const pedidos = data?.pedidos || [];
    const solicitantes = data?.solicitantes || [];

    const filteredPedidos = useMemo(() => {
        // A lógica de filtro do lado do cliente permanece a mesma.
        return pedidos.filter(pedido => {
            if (selectedSolicitante && pedido.solicitante?.id !== selectedSolicitante) return false;
            const pedidoDate = new Date(pedido.data_solicitacao);
            if (startDate && new Date(startDate) > pedidoDate) return false;
            if (endDate && new Date(endDate) < pedidoDate) return false;
            if (searchTerm.trim() !== '' && !pedido.itens.some(item => item.descricao_item?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;
            return true;
        });
    }, [pedidos, searchTerm, selectedSolicitante, startDate, endDate]);

    useEffect(() => {
        // Lógica de cálculo de KPIs mantida, mas agora usa os dados do useQuery.
        const calculateKpis = async () => {
            if (filteredPedidos.length === 0) {
                setKpiData({ totalPedidos: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
                return;
            }

            const comPendencia = filteredPedidos.filter(p => p.status === 'Realizado' && !p.anexos.some(a => a.descricao === 'Nota Fiscal')).length;

            const { data: historicos, error } = await supabase
                .from('pedidos_compra_status_historico')
                .select('pedido_compra_id, status_novo, data_mudanca')
                .in('pedido_compra_id', filteredPedidos.map(p => p.id));
            
            if (error) { console.error("Erro ao buscar histórico para KPIs", error); return; }
            
            // ... (resto da lógica de cálculo dos KPIs permanece idêntica)
            let totalDiasCotacao = 0, countCotacao = 0, totalDiasEntrega = 0, countEntrega = 0;
            const historicosPorPedido = historicos.reduce((acc, h) => {
                if (!acc[h.pedido_compra_id]) acc[h.pedido_compra_id] = [];
                acc[h.pedido_compra_id].push(h);
                return acc;
            }, {});

            for (const pedido of filteredPedidos) {
                const h = historicosPorPedido[pedido.id] || [];
                const dataRealizado = new Date(pedido.data_solicitacao);
                const dataCotacao = h.find(item => item.status_novo === 'Em Cotação')?.data_mudanca;
                const dataEntregue = h.find(item => item.status_novo === 'Entregue')?.data_mudanca;
                if (dataRealizado && dataCotacao) { const diffTime = new Date(dataCotacao) - dataRealizado; totalDiasCotacao += diffTime / (1000 * 60 * 60 * 24); countCotacao++; }
                if (dataCotacao && dataEntregue) { const diffTime = new Date(dataEntregue) - new Date(dataCotacao); totalDiasEntrega += diffTime / (1000 * 60 * 60 * 24); countEntrega++; }
            }
            
            setKpiData({
                totalPedidos: filteredPedidos.length,
                tempoMedioCotacao: countCotacao > 0 ? `${(totalDiasCotacao / countCotacao).toFixed(1)} dias` : 'N/A',
                tempoMedioEntrega: countEntrega > 0 ? `${(totalDiasEntrega / countEntrega).toFixed(1)} dias` : 'N/A',
                pedidosComPendencia: comPendencia,
            });
        };
        calculateKpis();
    }, [filteredPedidos, supabase]);

    // O PORQUÊ: A criação de um novo pedido agora usa useMutation para ser mais robusta e segura.
    const createPedidoMutation = useMutation({
        mutationFn: async () => {
            if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
                throw new Error('Por favor, selecione um empreendimento específico para criar um novo pedido.');
            }
            if (!organizacaoId || !user?.id) {
                throw new Error('Usuário ou Organização não autenticada.');
            }

            const { data: newPedido, error } = await supabase
                .from('pedidos_compra')
                .insert({
                    empreendimento_id: selectedEmpreendimento,
                    solicitante_id: user.id,
                    organizacao_id: organizacaoId, // <-- Ponto de segurança na escrita!
                    status: 'Pedido Realizado'
                })
                .select()
                .single();

            if (error) throw error;
            return newPedido;
        },
        onSuccess: (newPedido) => {
            toast.success(`Novo pedido #${newPedido.id} criado!`);
            router.push(`/pedidos/${newPedido.id}`);
        },
        onError: (err) => {
            toast.error(`Erro ao criar pedido: ${err.message}`);
        }
    });

    const handleCardClick = (pedido) => {
        setSelectedPedido(pedido);
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
        setSelectedPedido(null);
    };

    return (
        <div className="space-y-6">
            <PedidoDetalhesSidebar 
                open={isSidebarOpen}
                onClose={handleCloseSidebar}
                pedido={selectedPedido}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] })}
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
                <KpiCard title="Pedidos no Período" value={kpiData.totalPedidos} icon={faBoxOpen} color="blue" />
                <KpiCard title="Pedidos com Pendências" value={kpiData.pedidosComPendencia} icon={faClipboardList} color="red" />
                <KpiCard title="Tempo Médio de Cotação" value={kpiData.tempoMedioCotacao} icon={faHourglassHalf} color="yellow" />
                <KpiCard title="Tempo Médio de Entrega" value={kpiData.tempoMedioEntrega} icon={faClock} color="green" />
            </div>

            <div className="p-4 bg-gray-50 border rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input type="text" placeholder="Buscar por item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-md lg:col-span-2"/>
                    <select value={selectedSolicitante} onChange={e => setSelectedSolicitante(e.target.value)} className="p-2 border rounded-md">
                        <option value="">Todos Solicitantes</option>
                        {solicitantes.map(s => <option key={s.id} value={s.id}>{s.nome} {s.sobrenome}</option>)}
                    </select>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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

            {isLoading ? (
                <div className="text-center py-10">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                    <p>Carregando pedidos...</p>
                </div>
            ) : isError ? (
                <p className="text-center text-red-500">{error.message}</p>
            ) : (
                <ComprasKanban 
                    pedidos={filteredPedidos} 
                    setPedidos={() => queryClient.invalidateQueries({ queryKey: ['painelCompras', organizacaoId, selectedEmpreendimento] })} // Passa uma função para refetch
                    onCardClick={handleCardClick}
                />
            )}
        </div>
    );
}
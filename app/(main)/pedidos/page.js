'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../../utils/supabase/client';
import ComprasKanban from '../../../components/ComprasKanban';
import { useLayout } from '../../../contexts/LayoutContext';
import { useEmpreendimento } from '../../../contexts/EmpreendimentoContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBoxOpen, faClock, faHourglassHalf, faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import PedidoDetalhesSidebar from '@/components/pedidos/PedidoDetalhesSidebar'; // Importe o novo sidebar

export default function PedidosPage() {
    const { setPageTitle } = useLayout();
    const { selectedEmpreendimento, empreendimentos } = useEmpreendimento();
    const [pedidos, setPedidos] = useState([]);
    const [solicitantes, setSolicitantes] = useState([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSolicitante, setSelectedSolicitante] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [kpiData, setKpiData] = useState({
        totalPedidos: 0,
        tempoMedioCotacao: 'N/A',
        tempoMedioEntrega: 'N/A',
        pedidosComPendencia: 0,
    });

    // Novos estados para o sidebar
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [selectedPedido, setSelectedPedido] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        setPageTitle('Painel de Compras');
        const fetchSolicitantes = async () => {
            const { data: solData, error: solError } = await supabase.from('usuarios').select('id, nome, sobrenome').order('nome');
             if (solError) {
                setError(prev => prev + ' Falha ao carregar solicitantes.');
            } else {
                setSolicitantes(solData || []);
            }
        };
        fetchSolicitantes();
    }, [setPageTitle, supabase]);

    const fetchPedidos = useCallback(async () => {
        setLoading(true);
        setError('');

        let query = supabase
            .from('pedidos_compra')
            .select(`
                *,
                titulo,
                turno_entrega,
                empreendimentos(nome),
                solicitante:solicitante_id(id, nome),
                itens:pedidos_compra_itens(*),
                anexos:pedidos_compra_anexos(descricao)
            `);

        if (selectedEmpreendimento && selectedEmpreendimento !== 'all') {
            query = query.eq('empreendimento_id', selectedEmpreendimento);
        }

        query = query.order('data_solicitacao', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error(error);
            setError('Falha ao carregar os pedidos.');
        } else {
            setPedidos(data || []);
        }
        setLoading(false);
    }, [selectedEmpreendimento, supabase]);


    useEffect(() => {
        fetchPedidos();
    }, [fetchPedidos]);

    const filteredPedidos = useMemo(() => {
        return pedidos.filter(pedido => {
            if (selectedSolicitante && pedido.solicitante?.id !== selectedSolicitante) {
                return false;
            }
            const pedidoDate = new Date(pedido.data_solicitacao);
            if (startDate && new Date(startDate) > pedidoDate) {
                return false;
            }
            if (endDate && new Date(endDate) < pedidoDate) {
                return false;
            }
            if (searchTerm.trim() !== '' && !pedido.itens.some(item => 
                item.descricao_item?.toLowerCase().includes(searchTerm.toLowerCase()))) {
                return false;
            }
            return true;
        });
    }, [pedidos, searchTerm, selectedSolicitante, startDate, endDate]);

    useEffect(() => {
        const calculateKpis = async () => {
            if (filteredPedidos.length === 0) {
                setKpiData({ totalPedidos: 0, tempoMedioCotacao: 'N/A', tempoMedioEntrega: 'N/A', pedidosComPendencia: 0 });
                return;
            }

            const comPendencia = filteredPedidos.filter(p => 
                p.status === 'Realizado' && !p.anexos.some(a => a.descricao === 'Nota Fiscal')
            ).length;

            const { data: historicos, error } = await supabase
                .from('pedidos_compra_status_historico')
                .select('pedido_compra_id, status_novo, data_mudanca')
                .in('pedido_compra_id', filteredPedidos.map(p => p.id));
            
            if (error) {
                console.error("Erro ao buscar histórico para KPIs", error);
                return;
            }

            let totalDiasCotacao = 0;
            let countCotacao = 0;
            let totalDiasEntrega = 0;
            let countEntrega = 0;

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
                
                if (dataRealizado && dataCotacao) {
                    const diffTime = new Date(dataCotacao) - dataRealizado;
                    totalDiasCotacao += diffTime / (1000 * 60 * 60 * 24);
                    countCotacao++;
                }
                
                if (dataCotacao && dataEntregue) {
                    const diffTime = new Date(dataEntregue) - new Date(dataCotacao);
                    totalDiasEntrega += diffTime / (1000 * 60 * 60 * 24);
                    countEntrega++;
                }
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
    
    const handleCreateNewPedido = async () => {
        if (!selectedEmpreendimento || selectedEmpreendimento === 'all') {
            alert('Por favor, selecione um empreendimento específico no cabeçalho para criar um novo pedido.');
            return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newPedido, error } = await supabase
            .from('pedidos_compra')
            .insert({
                empreendimento_id: selectedEmpreendimento,
                solicitante_id: user.id,
                status: 'Pedido Realizado'
            })
            .select()
            .single();

        if (error) {
            alert('Erro ao criar novo pedido: ' + error.message);
        } else {
            router.push(`/pedidos/${newPedido.id}`);
        }
    };

    // Funções para controlar o sidebar
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
                onUpdate={fetchPedidos}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-xl font-semibold">
                    {empreendimentos.find(e => e.id == selectedEmpreendimento)?.nome || 'Todos os Empreendimentos'}
                </h2>
                <button
                    onClick={handleCreateNewPedido}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 w-full md:w-auto"
                >
                    + Nova Solicitação
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

            {loading ? (
                <div className="text-center py-10">
                    <FontAwesomeIcon icon={faSpinner} spin size="2x" />
                    <p>Carregando pedidos...</p>
                </div>
            ) : error ? (
                <p className="text-center text-red-500">{error}</p>
            ) : (
                <ComprasKanban 
                    pedidos={filteredPedidos} 
                    setPedidos={setPedidos}
                    onCardClick={handleCardClick} // Passa a função de clique
                />
            )}
        </div>
    );
}
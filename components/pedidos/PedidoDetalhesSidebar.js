// components/pedidos/PedidoDetalhesSidebar.js
"use client";

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faTimes, faPenToSquare, faCalendarAlt, faUser, faBuilding, faClipboardList, 
    faAlignLeft, faPaperclip, faSpinner, faDollarSign, faHandHoldingDollar, 
    faFloppyDisk, faBan, faExternalLinkAlt, faCheckCircle, faHistory
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import LancamentoFormModal from '../financeiro/LancamentoFormModal';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- COMPONENTES AUXILIARES ---

const InfoField = ({ icon, label, value }) => {
    if (!value && value !== 0) return null;
    return (
        <div>
            <dt className="text-xs font-medium text-gray-500 flex items-center gap-2">
                <FontAwesomeIcon icon={icon} className="w-3 h-3" />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{value}</dd>
        </div>
    );
};

// Componente Visual da Linha do Tempo (Igual ao CRM) 🎨
const HistoricoTimeline = ({ history }) => {
    if (!history || history.length === 0) {
        return <p className="text-xs text-center text-gray-500 py-4">Nenhuma movimentação registrada.</p>;
    }

    return (
        <div className="flow-root">
            <ul className="-mb-8">
                {history.map((item, itemIdx) => (
                    <li key={item.id}>
                        <div className="relative pb-8">
                            {itemIdx !== history.length - 1 ? (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                            ) : null}
                            <div className="relative flex space-x-3">
                                <div>
                                    <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center ring-8 ring-white">
                                        <FontAwesomeIcon icon={faHistory} className="text-blue-600 w-3 h-3" />
                                    </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                    <div>
                                        <p className="text-sm text-gray-600">
                                            {item.fase_anterior ? (
                                                <>
                                                    De <strong className="font-medium text-gray-900">{item.fase_anterior?.nome}</strong> para <strong className="font-medium text-gray-900">{item.fase_nova?.nome}</strong>
                                                </>
                                            ) : (
                                                <>
                                                    Definido como <strong className="font-medium text-gray-900">{item.fase_nova?.nome}</strong>
                                                </>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            por {item.usuario?.nome || 'Sistema'}
                                        </p>
                                    </div>
                                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                        <time dateTime={item.data_movimentacao}>
                                            {format(new Date(item.data_movimentacao), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                        </time>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// --- FUNÇÃO DE BUSCA DE DADOS ---
const fetchSidebarExtraData = async (supabase, pedidoId, organizacaoId) => {
    if (!pedidoId || !organizacaoId) return { history: [] };

    // Busca o histórico na tabela nova "pedidos_compra_historico_fases"
    // JOINs: fase_anterior, fase_nova, usuario
    const { data, error } = await supabase
        .from('pedidos_compra_historico_fases')
        .select(`
            id,
            data_movimentacao,
            fase_anterior:fase_anterior_id(nome),
            fase_nova:fase_nova_id(nome),
            usuario:usuario_id(nome)
        `)
        .eq('pedido_compra_id', pedidoId)
        .eq('organizacao_id', organizacaoId)
        .order('data_movimentacao', { ascending: false });

    if (error) {
        console.error("Erro ao buscar histórico:", error);
        return { history: [] };
    }

    return { history: data || [] };
};

// --- COMPONENTE PRINCIPAL ---
export default function PedidoDetalhesSidebar({ 
    pedido, 
    isOpen, 
    onClose, 
    onUpdate, 
    solicitantes, 
    empreendimentos, 
    onEditCompleto 
}) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);

    // Formatação de valores
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    // --- FETCH DO HISTÓRICO ---
    // Usamos useQuery para que o histórico carregue assim que abrirmos a sidebar
    const { data: extraData, isLoading: isLoadingExtra } = useQuery({
        queryKey: ['pedidoSidebarExtra', pedido?.id],
        queryFn: () => fetchSidebarExtraData(supabase, pedido?.id, pedido?.organizacao_id),
        enabled: !!pedido?.id && isOpen, // Só busca se tiver pedido e sidebar aberta
        staleTime: 0, // Sempre busca dados frescos ao abrir
    });

    const history = extraData?.history || [];

    if (!pedido) return null;

    // Totais do pedido
    const totalItens = pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;

    return (
        <>
            <div 
                className={`fixed inset-y-0 right-0 w-full md:w-[500px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Detalhes do Pedido #{pedido.id}</h2>
                            <p className="text-xs text-gray-500">{pedido.titulo}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => onEditCompleto(pedido)}
                                className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-colors"
                                title="Editar Pedido Completo"
                            >
                                <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button 
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <main className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* Status e Ações Rápidas */}
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                    pedido.status === 'Entregue' ? 'bg-green-100 text-green-800 border-green-200' :
                                    pedido.status === 'Cancelado' ? 'bg-red-100 text-red-800 border-red-200' :
                                    'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                    {pedido.status}
                                </span>
                                <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded border border-green-100">
                                    {formatCurrency(totalItens)}
                                </span>
                            </div>

                            {/* Botão Financeiro */}
                            {pedido.status === 'Entregue' && (!pedido.lancamentos || pedido.lancamentos.length === 0) && (
                                <button 
                                    onClick={() => setIsLancamentoModalOpen(true)}
                                    className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                >
                                    <FontAwesomeIcon icon={faHandHoldingDollar} />
                                    Registrar Pagamento (Financeiro)
                                </button>
                            )}
                             {pedido.lancamentos && pedido.lancamentos.length > 0 && (
                                <div className="w-full bg-green-50 text-green-700 border border-green-200 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2">
                                     <FontAwesomeIcon icon={faCheckCircle} /> Pagamento Registrado
                                </div>
                            )}
                        </div>

                        {/* Informações Principais */}
                        <section className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                                <FontAwesomeIcon icon={faClipboardList} className="text-gray-400"/> Dados Gerais
                            </h3>
                            <dl className="grid grid-cols-2 gap-4">
                                <InfoField icon={faUser} label="Solicitante" value={pedido.solicitante?.nome || 'N/A'} />
                                <InfoField icon={faBuilding} label="Empreendimento" value={pedido.empreendimentos?.nome || 'N/A'} />
                                <InfoField icon={faCalendarAlt} label="Data Solicitação" value={formatDate(pedido.data_solicitacao)} />
                                <InfoField icon={faCalendarAlt} label="Previsão Entrega" value={formatDate(pedido.data_entrega_prevista)} />
                                <InfoField icon={faAlignLeft} label="Turno" value={pedido.turno_entrega || 'Comercial'} />
                            </dl>
                            {pedido.justificativa && (
                                <div className="mt-2">
                                    <dt className="text-xs font-medium text-gray-500">Justificativa:</dt>
                                    <dd className="text-sm bg-gray-50 p-2 rounded border mt-1 text-gray-700 italic">"{pedido.justificativa}"</dd>
                                </div>
                            )}
                        </section>

                        {/* Itens do Pedido */}
                        <section>
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                <FontAwesomeIcon icon={faClipboardList} className="text-gray-400"/> Itens ({pedido.itens?.length || 0})
                            </h3>
                            <div className="space-y-2 bg-gray-50 rounded-md p-2 max-h-60 overflow-y-auto">
                                {pedido.itens && pedido.itens.length > 0 ? (
                                    pedido.itens.map(item => (
                                        <div key={item.id} className="p-3 bg-white rounded shadow-sm text-sm border border-gray-100">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold text-gray-800">{item.descricao_item}</p>
                                                {item.custo_total_real > 0 && <span className="font-bold text-green-600">{formatCurrency(item.custo_total_real)}</span>}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                                {item.fornecedor && <p>Forn: <span className="text-gray-700">{item.fornecedor.nome || item.fornecedor.razao_social}</span></p>}
                                                <p>Qtd: {item.quantidade_solicitada} {item.unidade_medida}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : <p className="text-xs text-gray-500 text-center py-4">Nenhum item adicionado.</p>}
                            </div>
                        </section>

                        {/* Anexos */}
                        <section>
                             <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                <FontAwesomeIcon icon={faPaperclip} className="text-gray-400"/> Anexos ({pedido.anexos?.length || 0})
                            </h3>
                            <div className="space-y-2">
                                {pedido.anexos && pedido.anexos.length > 0 ? (
                                    pedido.anexos.map(anexo => (
                                        <div key={anexo.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border text-sm">
                                            <div className="truncate pr-2">
                                                <p className="font-medium text-gray-700 truncate">{anexo.nome_arquivo}</p>
                                                {anexo.descricao && <p className="text-xs text-gray-500">{anexo.descricao}</p>}
                                            </div>
                                            <a 
                                                href={anexo.caminho_arquivo} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-blue-600 hover:text-blue-800 p-1"
                                                title="Baixar/Visualizar"
                                            >
                                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                                            </a>
                                        </div>
                                    ))
                                ) : <p className="text-xs text-gray-500 italic">Sem anexos.</p>}
                            </div>
                        </section>

                        {/* --- NOVA SEÇÃO: HISTÓRICO DE MOVIMENTAÇÕES --- */}
                        <section>
                            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                                <FontAwesomeIcon icon={faHistory} className="text-gray-400"/> Histórico
                            </h3>
                            <div className="bg-gray-50 rounded-md p-4 max-h-60 overflow-y-auto border border-gray-200">
                                {isLoadingExtra ? (
                                    <div className="flex justify-center py-4">
                                        <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />
                                    </div>
                                ) : (
                                    <HistoricoTimeline history={history} />
                                )}
                            </div>
                        </section>

                    </main>
                </div>
            </div>

            {/* Modal de Lançamento Financeiro */}
            {isLancamentoModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
                        <button 
                            onClick={() => setIsLancamentoModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                        >
                            <FontAwesomeIcon icon={faTimes} size="lg"/>
                        </button>
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4 text-gray-800">Registrar Pagamento</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Isso criará um registro de despesa no módulo financeiro vinculado a este pedido.
                            </p>
                            <LancamentoFormModal 
                                onClose={() => setIsLancamentoModalOpen(false)}
                                onSuccess={() => {
                                    setIsLancamentoModalOpen(false);
                                    onUpdate(); // Atualiza o pedido para mostrar que já tem lançamento
                                }}
                                preFilledData={{
                                    descricao: `Pagamento Pedido #${pedido.id} - ${pedido.titulo}`,
                                    valor: totalItens,
                                    data_vencimento: new Date().toISOString().split('T')[0],
                                    tipo: 'Despesa',
                                    categoria_id: null, // Pode ser preenchido se souber a categoria padrão
                                    empreendimento_id: pedido.empreendimento_id,
                                    pedido_compra_id: pedido.id
                                }}
                                isModal={false} // Renderiza o form direto
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Backdrop para fechar ao clicar fora */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-25 z-30"
                    onClick={onClose}
                ></div>
            )}
        </>
    );
}
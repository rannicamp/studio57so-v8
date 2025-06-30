'use client';

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarAlt, faTag, faEllipsisV, faDollarSign, faExclamationTriangle, faTruck } from '@fortawesome/free-solid-svg-icons';
import { useState, useMemo } from 'react';

export default function PedidoCard({ pedido, onStatusChange, allStatusColumns, hasPendingInvoice }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const totalPedido = useMemo(() => {
        return pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;
    }, [pedido.itens]);

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const handleCardClick = (e) => {
        if (e.target.closest('.status-menu-button')) return;
        router.push(`/pedidos/${pedido.id}`);
    };

    const handleStatusMenuChange = (newStatus) => {
        onStatusChange(pedido.id, newStatus);
        setIsMenuOpen(false);
    };
    
    const handleDragStart = (e) => {
        e.dataTransfer.setData('pedidoId', pedido.id);
    };

    const totalItens = pedido.itens?.length || 0;
    const dataSolicitacaoFormatada = new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR');
    const dataEntregaFormatada = pedido.data_entrega_prevista ? new Date(pedido.data_entrega_prevista + 'T00:00:00Z').toLocaleDateString('pt-BR') : 'N/A';

    const borderClass = hasPendingInvoice ? 'border-red-500' : 'border-blue-500';
    const cardTitle = pedido.titulo || `Pedido #${pedido.id}`;

    return (
        <div 
            draggable="true"
            onDragStart={handleDragStart}
            onClick={handleCardClick}
            className={`bg-white rounded-md shadow p-3 border-l-4 ${borderClass} hover:shadow-lg transition-shadow duration-200 cursor-pointer kanban-card`}
        >
            <div>
                <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-gray-800 truncate" title={cardTitle}>{cardTitle}</p>
                    <p className="text-xs text-gray-500 ml-2">#{pedido.id}</p>
                </div>

                {hasPendingInvoice && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold p-2 rounded-md mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>PENDÊNCIA: Falta Nota Fiscal</span>
                    </div>
                )}

                <p className="text-xs text-gray-600 mb-1 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUser} className="w-3" />
                    <span>{pedido.solicitante?.nome || 'N/A'}</span>
                </p>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-2" title="Data da Solicitação">
                    <FontAwesomeIcon icon={faCalendarAlt} className="w-3" />
                    <span>{dataSolicitacaoFormatada}</span>
                </p>
                {/* INÍCIO DA ALTERAÇÃO: Adicionando data e turno de entrega */}
                <p className="text-xs text-gray-600 mb-2 flex items-center gap-2" title="Data e Turno da Entrega">
                    <FontAwesomeIcon icon={faTruck} className="w-3" />
                    <span>{dataEntregaFormatada} ({pedido.turno_entrega || 'Não definido'})</span>
                </p>
                {/* FIM DA ALTERAÇÃO */}

                <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-2 w-fit">
                        <FontAwesomeIcon icon={faTag} className="w-3" />
                        {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                    </span>
                    <span className="text-sm font-bold text-green-700 flex items-center gap-1">
                        <FontAwesomeIcon icon={faDollarSign} className="w-3" />
                        {formatCurrency(totalPedido)}
                    </span>
                </div>
            </div>
            <div className="relative mt-2 pt-2 border-t status-menu-button">
                 <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-xs font-semibold text-gray-600 hover:text-gray-900 w-full text-left flex justify-between items-center">
                    <span>Status: {pedido.status}</span>
                    <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-20 border">
                        <p className="p-2 font-semibold text-xs text-gray-500 border-b">Mover para...</p>
                        {allStatusColumns.map(status => (
                             <a key={status} onClick={() => handleStatusMenuChange(status)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                                {status}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
// components/PedidoCard.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUser, faCalendarAlt, faTag, faEllipsisV, faDollarSign, 
    faExclamationTriangle, faTruck, faCopy,
    faFileInvoiceDollar // <-- ÍCONE DE ALERTA FINANCEIRO
} from '@fortawesome/free-solid-svg-icons';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

export default function PedidoCard({ pedido, onStatusChange, onDuplicate, allStatusColumns, hasPendingInvoice, onCardClick }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const totalPedido = useMemo(() => {
        return pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;
    }, [pedido.itens]);

    // =================================================================================
    // LÓGICA DE ANISTIA (DATA DE CORTE) ADICIONADA
    // =================================================================================
    const jaLancado = pedido.lancamentos && pedido.lancamentos.length > 0;
    const totalItens = pedido.itens?.length || 0;
    
    // Define a data de corte para o final do dia 12/11/2025
    const cutoffDate = new Date('2025-11-12T23:59:59');
    const dataSolicitacao = new Date(pedido.data_solicitacao);
    const isAntigo = dataSolicitacao <= cutoffDate;

    // Alerta só aparece se:
    // 1. Não foi lançado E
    // 2. Está em status de pagamento E
    // 3. NÃO é um pedido antigo (anistiado)
    const mostrarAlertaFinanceiro = !jaLancado && ['Entregue', 'Realizado'].includes(pedido.status) && !isAntigo;


    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const handleCardClick = (e) => {
        if (e.target.closest('.action-button')) {
            e.stopPropagation();
            return;
        }
        onCardClick(pedido);
    };

    const handleStatusMenuChange = (newStatus) => {
        onStatusChange(pedido.id, newStatus);
        setIsMenuOpen(false);
    };
    
    const handleDuplicateClick = (e) => {
        e.stopPropagation();
        toast.warning(`Deseja criar uma cópia do pedido "${pedido.titulo || `#${pedido.id}`}"?`, {
            action: {
                label: "Duplicar",
                // CORREÇÃO: Passa o objeto 'pedido' inteiro, como a função no Kanban espera
                onClick: () => onDuplicate(pedido) 
            },
            cancel: {
                label: "Cancelar"
            }
        });
    };

    const handleDragStart = (e) => {
        e.dataTransfer.setData('pedidoId', pedido.id);
    };

    const dataSolicitacaoFormatada = new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR');

    const formatDataEntrega = (dateStr) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          return 'N/A';
      }
      const [year, month, day] = dateStr.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    };

    const dataEntregaFormatada = formatDataEntrega(pedido.data_entrega_prevista);

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
                    <div className="flex items-center gap-2">
                        <button onClick={handleDuplicateClick} title="Duplicar Pedido" className="action-button text-gray-400 hover:text-blue-600">
                            <FontAwesomeIcon icon={faCopy} />
                        </button>
                        <p className="text-xs text-gray-500">#{pedido.id}</p>
                    </div>
                </div>

                {hasPendingInvoice && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold p-2 rounded-md mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>PENDÊNCIA: Falta Nota Fiscal</span>
                    </div>
                )}

                <p className="text-xs text-gray-600 mb-1 flex items-center gap-2"> <FontAwesomeIcon icon={faUser} className="w-3" /> <span>{pedido.solicitante?.nome || 'N/A'}</span> </p>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-2" title="Data da Solicitação"> <FontAwesomeIcon icon={faCalendarAlt} className="w-3" /> <span>{dataSolicitacaoFormatada}</span> </p>
                <p className="text-xs text-gray-600 mb-2 flex items-center gap-2" title="Data e Turno da Entrega"> <FontAwesomeIcon icon={faTruck} className="w-3" /> <span>{dataEntregaFormatada} ({pedido.turno_entrega || 'Não definido'})</span> </p>
                
                <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-2 w-fit"> <FontAwesomeIcon icon={faTag} className="w-3" /> {totalItens} {totalItens === 1 ? 'item' : 'itens'} </span>
                    
                    {/* =================================================================================
                     * ALERTA DE PAGAMENTO PENDENTE (AGORA COM ANISTIA)
                     * ================================================================================= */}
                    {mostrarAlertaFinanceiro && (
                        <span 
                            className="text-xs font-semibold text-yellow-600 flex items-center gap-1 p-1 bg-yellow-50 rounded border border-yellow-200"
                            title="Pagamento pendente de planejamento"
                        >
                            <FontAwesomeIcon icon={faFileInvoiceDollar} /> Pendente Fin.
                        </span>
                    )}

                    <span className="text-sm font-bold text-green-700 flex items-center gap-1"> <FontAwesomeIcon icon={faDollarSign} className="w-3" /> {formatCurrency(totalPedido)} </span>
                </div>
            </div>
            <div className="relative mt-2 pt-2 border-t action-button">
                 <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="text-xs font-semibold text-gray-600 hover:text-gray-900 w-full text-left flex justify-between items-center">
                    <span>Status: {pedido.status}</span>
                    <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-20 border">
                        <p className="p-2 font-semibold text-xs text-gray-500 border-b">Mover para...</p>
                        {allStatusColumns.map(status => (
                             <a key={status} onClick={(e) => { e.stopPropagation(); handleStatusMenuChange(status); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                                {status}
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
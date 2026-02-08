// components/pedidos/PedidoCard.js
'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faUser, faCalendarAlt, faTag, faEllipsisV, faDollarSign, 
    faExclamationTriangle, faTruck, faCopy, faClock,
    faFileInvoiceDollar 
} from '@fortawesome/free-solid-svg-icons';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

export default function PedidoCard({ pedido, onStatusChange, onDuplicate, allStatusColumns, hasPendingInvoice, onCardClick }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const totalPedido = useMemo(() => {
        return pedido.itens?.reduce((acc, item) => acc + (item.custo_total_real || 0), 0) || 0;
    }, [pedido.itens]);

    // Lógica Financeira (Mantida)
    const jaLancado = pedido.lancamentos && pedido.lancamentos.length > 0;
    const isOldOrder = new Date(pedido.data_solicitacao) <= new Date('2025-11-12T23:59:59'); 
    
    // Regra de Pendência Financeira
    const showFinancialPending = !jaLancado && !isOldOrder && pedido.status !== 'Cancelado';

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const handleStatusMenuChange = (newStatus) => {
        onStatusChange(pedido.id, newStatus);
        setIsMenuOpen(false);
    };

    // --- 🕒 A MÁGICA DO ENVELHECIMENTO ---
    const getAgingStyle = () => {
        if (['Entregue', 'Cancelado', 'Realizado'].includes(pedido.status)) {
            return {
                containerClass: 'bg-white border-l-4 border-gray-200',
                badge: null
            };
        }

        const hoje = new Date();
        const dataCriacao = new Date(pedido.data_solicitacao);
        const diffTime = Math.abs(hoje - dataCriacao);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays >= 3) {
            return {
                containerClass: 'bg-red-50 border-l-4 border-red-500', 
                badge: <span className="text-[10px] font-bold bg-red-200 text-red-800 px-1.5 py-0.5 rounded flex items-center gap-1"><FontAwesomeIcon icon={faExclamationTriangle}/> +3 dias</span>
            };
        } else if (diffDays >= 1) {
            return {
                containerClass: 'bg-orange-50 border-l-4 border-orange-400',
                badge: <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded flex items-center gap-1"><FontAwesomeIcon icon={faClock}/> {diffDays}d</span>
            };
        }
        
        return {
            containerClass: 'bg-white border-l-4 border-blue-400',
            badge: null
        };
    };

    const { containerClass, badge } = getAgingStyle();

    return (
        <div 
            onClick={() => onCardClick && onCardClick(pedido)}
            className={`
                relative rounded-lg shadow-sm p-3 hover:shadow-md transition-all duration-200 border border-gray-100 cursor-pointer group
                ${containerClass}
            `}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 text-sm line-clamp-2 pr-6 flex-1" title={pedido.titulo}>
                    #{pedido.id} - {pedido.titulo}
                </h4>
                
                {badge && <div className="ml-2 flex-shrink-0">{badge}</div>}
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onDuplicate && onDuplicate(); }} 
                    className="text-gray-400 hover:text-blue-500 transition-colors ml-2" 
                    title="Duplicar Pedido"
                >
                    <FontAwesomeIcon icon={faCopy} className="w-3 h-3" />
                </button>
            </div>

            <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2" title="Solicitante">
                    <FontAwesomeIcon icon={faUser} className="w-3 text-gray-400" />
                    <span className="truncate">{pedido.solicitante?.nome || 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-2" title="Empreendimento">
                    <FontAwesomeIcon icon={faTag} className="w-3 text-gray-400" />
                    <span className="truncate">{pedido.empreendimentos?.nome || 'N/A'}</span>
                </div>

                {/* --- AQUI ESTÁ ELA DE VOLTA: DATA DE SOLICITAÇÃO --- */}
                <div className="flex items-center gap-2" title="Data da Solicitação">
                    <FontAwesomeIcon icon={faCalendarAlt} className="w-3 text-gray-400" />
                    <span className="font-medium text-gray-700">Solicitado: {formatDate(pedido.data_solicitacao)}</span>
                </div>

                {/* PREVISÃO DE ENTREGA (Só mostra se tiver data definida) */}
                {pedido.data_entrega_prevista && (
                    <div className="flex items-center gap-2" title="Previsão de Entrega">
                        <FontAwesomeIcon icon={faTruck} className="w-3 text-gray-400" />
                        <span className={`${
                            new Date(pedido.data_entrega_prevista) < new Date() && pedido.status !== 'Entregue' 
                            ? 'text-red-600 font-bold' 
                            : ''
                        }`}>
                            Prev: {formatDate(pedido.data_entrega_prevista)}
                        </span>
                    </div>
                )}

                <div className="pt-2 flex justify-between items-center border-t border-gray-200/50 mt-2">
                    {showFinancialPending ? (
                        <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded flex items-center gap-1" title="Necessário lançar no financeiro">
                            <FontAwesomeIcon icon={faFileInvoiceDollar} /> Pendente Fin.
                        </span>
                    ) : (
                         <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            {/* Espaço reservado se não tiver alerta */}
                         </span>
                    )}

                    <span className="text-sm font-bold text-green-700 flex items-center gap-1"> 
                        <FontAwesomeIcon icon={faDollarSign} className="w-3" /> {formatCurrency(totalPedido)} 
                    </span>
                </div>
            </div>

            {/* Menu de Status */}
            <div className="relative mt-2 pt-2 border-t border-gray-200/50 action-button">
                 <button 
                    onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} 
                    className="text-xs font-semibold text-gray-600 hover:text-gray-900 w-full text-left flex justify-between items-center px-1 py-1 rounded hover:bg-black/5 transition-colors"
                >
                    <span>Status: {pedido.status}</span>
                    <FontAwesomeIcon icon={faEllipsisV} />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-md shadow-xl z-50 border border-gray-200 overflow-hidden">
                        <p className="p-2 font-semibold text-xs text-gray-500 border-b bg-gray-50">Mover para...</p>
                        <div className="max-h-60 overflow-y-auto">
                            {allStatusColumns.map(status => (
                                 <a 
                                    key={status} 
                                    onClick={(e) => { e.stopPropagation(); handleStatusMenuChange(status); }} 
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors border-b last:border-0 border-gray-50"
                                >
                                    {status}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
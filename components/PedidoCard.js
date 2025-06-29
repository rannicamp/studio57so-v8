'use client';

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarAlt, faTag, faEllipsisV } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';

export default function PedidoCard({ pedido, onStatusChange, allStatusColumns }) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleCardClick = (e) => {
        // Impede que o clique no menu de status navegue para a página de detalhes
        if (e.target.closest('.status-menu-button')) return;
        router.push(`/pedidos/${pedido.id}`);
    };

    const handleStatusMenuChange = (newStatus) => {
        onStatusChange(pedido.id, newStatus);
        setIsMenuOpen(false);
    };
    
    // Função que é ativada quando o usuário começa a arrastar o card
    const handleDragStart = (e) => {
        // Armazena o ID do pedido que está sendo arrastado
        e.dataTransfer.setData('pedidoId', pedido.id);
    };

    const totalItens = pedido.itens?.length || 0;
    const dataFormatada = new Date(pedido.data_solicitacao).toLocaleDateString('pt-BR');

    return (
        // Adicionando as propriedades para o drag-and-drop
        <div 
            draggable="true"
            onDragStart={handleDragStart}
            onClick={handleCardClick}
            className="bg-white rounded-md shadow p-3 border-l-4 border-blue-500 hover:shadow-lg transition-shadow duration-200 cursor-grab active:cursor-grabbing"
        >
            <div>
                <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-gray-800 mb-2">Pedido #{pedido.id}</p>
                </div>
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUser} className="w-3" />
                    <span>{pedido.solicitante?.nome || 'N/A'}</span>
                </p>
                <p className="text-xs text-gray-600 mb-2 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarAlt} className="w-3" />
                    <span>{dataFormatada}</span>
                </p>
                 <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-2 w-fit">
                    <FontAwesomeIcon icon={faTag} className="w-3" />
                    {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                </span>
            </div>
            {/* O menu de status por botão continua funcionando como alternativa */}
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
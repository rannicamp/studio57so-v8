// components/crm/ContatoCardCRM.js
"use client";

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faStickyNote, faBullhorn, faHome } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// --- INÍCIO DA MODIFICAÇÃO ---
// Adicionadas 'availableProducts' e 'onAssociateProduct' à lista de props
export default function ContatoCardCRM({ 
    funilEntry, 
    onDragStart, 
    allColumns, 
    onMoveToColumn, 
    onOpenNotesModal,
    availableProducts,
    onAssociateProduct
}) {
// --- FIM DA MODIFICAÇÃO ---

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!funilEntry || !funilEntry.contatos) {
        return <div className="bg-red-100 p-3 rounded-md shadow">Erro ao carregar contato.</div>;
    }

    const contato = funilEntry.contatos;
    const cardNumber = funilEntry.numero_card;
    const currentColumnId = funilEntry.coluna_id;
    const isMetaLead = contato.origem === 'Meta Lead Ad';
    
    // --- INÍCIO DA MODIFICAÇÃO ---
    // Nova função para lidar com a seleção de um produto
    const handleProductSelection = (e) => {
        const selectedProductId = e.target.value ? parseInt(e.target.value, 10) : null;
        onAssociateProduct(funilEntry.id, selectedProductId);
    };
    // --- FIM DA MODIFICAÇÃO ---

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
        } catch (e) {
            return 'Formato inválido';
        }
    };

    const truncateMessage = (message, maxLength = 70) => {
        if (!message) return 'Nenhuma mensagem recente';
        if (message.length > maxLength) {
            return message.substring(0, maxLength) + '...';
        }
        return message;
    };

    const displayName = contato.razao_social || contato.nome || 'Nome Indisponível';

    const handleMoveClick = (columnId) => {
        onMoveToColumn(funilEntry.id, columnId);
        setIsDropdownOpen(false);
    };

    const handleOpenNotes = () => {
        onOpenNotesModal(funilEntry.id, contato.id);
        setIsDropdownOpen(false);
    };

    const handleCardDragStart = (e) => {
        e.stopPropagation();
        onDragStart(e);
    };

    return (
        <div
            draggable
            onDragStart={handleCardDragStart}
            className="relative bg-white p-3 rounded-md shadow border-l-4 border-blue-500 cursor-grab hover:shadow-lg transition-shadow duration-200 text-left"
        >
            <div className="flex justify-between items-start mb-1">
                <div className="flex-grow pr-8">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">
                        <span className="text-blue-600 font-bold">#{cardNumber}</span> {displayName}
                    </p>
                </div>
                <div className="absolute top-2 right-3 z-10" ref={dropdownRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                        className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors"
                    >
                        <FontAwesomeIcon icon={faEllipsisV} size="sm" />
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                            <p className="px-3 py-2 text-xs text-gray-500 border-b">Mover para:</p>
                            {allColumns
                                .filter(col => col.id !== currentColumnId)
                                .map(column => (
                                    <button
                                        key={column.id}
                                        onClick={() => handleMoveClick(column.id)}
                                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        {column.nome}
                                    </button>
                                ))}
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                                onClick={handleOpenNotes}
                                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                <FontAwesomeIcon icon={faStickyNote} className="mr-2"/> Ver/Adicionar Notas
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- INÍCIO DA MODIFICAÇÃO --- */}
            {/* Nova seção para associar produto */}
            <div className="mt-2">
                <label className="flex items-center text-xs text-gray-500 font-medium mb-1">
                    <FontAwesomeIcon icon={faHome} className="mr-2" />
                    Produto de Interesse:
                </label>
                <select 
                    value={funilEntry.produto_id || ''}
                    onChange={handleProductSelection}
                    onClick={(e) => e.stopPropagation()} // Impede que o clique no select propague para o card
                    className="w-full p-1.5 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Nenhum --</option>
                    {/* Se o produto atual já estiver associado, mas não estiver na lista (ex: foi vendido), o mostramos como uma opção desabilitada */}
                    {funilEntry.produto && !availableProducts.some(p => p.id === funilEntry.produto.id) && (
                        <option key={funilEntry.produto.id} value={funilEntry.produto.id} disabled>
                            {funilEntry.produto.unidade} ({funilEntry.produto.tipo})
                        </option>
                    )}
                    {/* Lista de produtos disponíveis */}
                    {availableProducts.map(product => (
                        <option key={product.id} value={product.id}>
                            {product.unidade} ({product.tipo})
                        </option>
                    ))}
                </select>
            </div>
            {/* --- FIM DA MODIFICAÇÃO --- */}

            {isMetaLead && (
                <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <FontAwesomeIcon icon={faBullhorn} />
                        Meta Lead
                    </span>
                </div>
            )}

            <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                {contato.last_whatsapp_message ? (
                    <p className="text-gray-700">
                        Última msg: <span className="font-medium">{truncateMessage(contato.last_whatsapp_message)}</span>
                        {contato.last_whatsapp_message_time && ` (${formatDate(contato.last_whatsapp_message_time)})`}
                    </p>
                ) : (
                    <p>Criado em: {formatDate(contato.created_at)}</p>
                )}
            </div>
        </div>
    );
}
// components/crm/ContatoCardCRM.js
"use client";

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV, faStickyNote } from '@fortawesome/free-solid-svg-icons';

export default function ContatoCardCRM({ funilEntry, onDragStart, allColumns, onMoveToColumn, onOpenNotesModal }) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Mover os hooks para antes do return condicional
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
        } catch (e) {
            console.error("Erro ao formatar data:", dateString, e);
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
    const displayContactInfo = (contato.telefones && contato.telefones.length > 0)
        ? contato.telefones[0].telefone
        : contato.email || 'Contato indisponível';

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
                {/* Cabeçalho do Card: Número e Nome */}
                <div className="flex items-center flex-grow">
                    {cardNumber !== undefined && cardNumber !== null && (
                        <span className="text-sm font-bold text-blue-600 mr-2">
                            #{cardNumber}
                        </span>
                    )}
                    <div className="font-semibold text-gray-800 text-sm pr-10">
                        {displayName}
                    </div>
                </div>

                {/* Menu de três pontinhos no canto superior direito */}
                <div className="absolute top-2 right-3 z-10" ref={dropdownRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDropdownOpen(!isDropdownOpen);
                        }}
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
                            {/* Novo item para Notas */}
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

            <p className="text-xs text-gray-600 mb-1">{displayContactInfo}</p>

            <div className="text-xs text-gray-500 mt-2">
                {contato.created_at && (
                    <p>Criado em: {formatDate(contato.created_at)}</p>
                )}

                {contato.last_whatsapp_message && (
                    <>
                        <div className="border-t border-gray-200 my-2"></div>
                        <p className="text-gray-700">
                            Última mensagem: <span className="font-medium">{truncateMessage(contato.last_whatsapp_message)}</span>
                            {contato.last_whatsapp_message_time && ` (${formatDate(contato.last_whatsapp_message_time)})`}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
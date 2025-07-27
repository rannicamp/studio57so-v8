// components/crm/ContatoCardCRM.js
"use client";

import { format } from 'date-fns'; // Importa a função format para formatar a data
import { ptBR } from 'date-fns/locale'; // Importa o locale para português do Brasil
import { useState, useRef, useEffect } from 'react'; // Adicionado useState, useRef, useEffect
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // Adicionado FontAwesomeIcon
import { faEllipsisV } from '@fortawesome/free-solid-svg-icons'; // Adicionado faEllipsisV (ícone de 3 pontos verticais)

export default function ContatoCardCRM({ contato, onDragStart, cardNumber, allColumns, onMoveToColumn }) { // Adicionado allColumns, onMoveToColumn
    // Se por algum motivo o contato não for carregado, retorna um card vazio para evitar erros.
    if (!contato) {
        return <div className="bg-red-100 p-3 rounded-md shadow">Erro ao carregar contato.</div>;
    }

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null); // Ref para o dropdown para detectar cliques fora

    // Função para formatar a data
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
        } catch (e) {
            console.error("Erro ao formatar data:", dateString, e);
            return 'Formato inválido';
        }
    };

    // Função para truncar a mensagem
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

    // Função para mover o card para a coluna selecionada no dropdown
    const handleMoveClick = (columnId) => {
        // contato.id aqui é o ID da entrada em contatos_no_funil (id da linha do Kanban)
        // newColumnId é o ID da coluna para onde o contato será movido
        // onMoveToColumn é a função que será passada do componente pai (FunilKanban)
        onMoveToColumn(contato.id, columnId); 
        setIsDropdownOpen(false); // Fecha o dropdown após a seleção
    };

    // Hook para fechar o dropdown ao clicar fora
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

    // Modificado para parar a propagação do evento de arrastar
    const handleCardDragStart = (e) => {
        e.stopPropagation(); // IMPORTANTE: Impede que o evento de arrastar da coluna seja acionado
        onDragStart(e); // Chama a função de arrastar original do card
    };

    return (
        <div
            draggable
            onDragStart={handleCardDragStart} // Usa a nova função para arrastar o card
            className="relative bg-white p-3 rounded-md shadow border-l-4 border-blue-500 cursor-grab hover:shadow-lg transition-shadow duration-200 text-left"
        >
            <div className="flex justify-between items-start mb-1">
                {/* Número do Card no canto superior esquerdo do cabeçalho */}
                {cardNumber !== undefined && cardNumber !== null && (
                    <span className="text-sm font-bold text-blue-600 mr-2">
                        #{cardNumber}
                    </span>
                )}
                {/* Nome do Cliente/Razão Social */}
                <div className="font-semibold text-gray-800 text-sm flex-grow">
                    {displayName}
                </div>

                {/* Menu de três pontinhos no canto superior direito */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Previne que o arrastar comece ao clicar no menu
                            setIsDropdownOpen(!isDropdownOpen);
                        }}
                        className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors -mt-1 -mr-1" // Margem ajustada para melhor alinhamento
                    >
                        <FontAwesomeIcon icon={faEllipsisV} size="sm" />
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1">
                            <p className="px-3 py-2 text-xs text-gray-500 border-b">Mover para:</p>
                            {/* Renderiza as opções de colunas */}
                            {allColumns
                                .filter(col => col.id !== contato.coluna_id) // Filtra a coluna atual
                                .map(column => (
                                    <button
                                        key={column.id}
                                        onClick={() => handleMoveClick(column.id)}
                                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        {column.nome}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Informações de Contato (telefone/email) */}
            <p className="text-xs text-gray-600 mb-1">{displayContactInfo}</p>

            {/* Data de Criação e Última Mensagem */}
            <div className="text-xs text-gray-500 mt-2">
                {contato.created_at && (
                    <p>Criado em: {formatDate(contato.created_at)}</p>
                )}
                
                {contato.last_whatsapp_message && (
                    <>
                        <div className="border-t border-gray-200 my-2"></div> {/* Separador visual */}
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

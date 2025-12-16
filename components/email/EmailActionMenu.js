'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faEllipsisV, faEnvelope, faEnvelopeOpen, faArchive, faTrash, 
    faFolderOpen, faRobot, faCalendarPlus, faChevronRight, faSpinner 
} from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';

export default function EmailActionMenu({ email, onAction, showCreateActivity = false, isOpen: controlledIsOpen, onToggle }) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    // Calcula a posição fixa quando abre
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            // Posiciona o menu à esquerda do botão, alinhado ao topo
            // Ajusta se estiver muito perto da borda inferior
            const top = rect.top + window.scrollY;
            const left = rect.left + window.scrollX - 224; // 224px (w-56) para abrir para a esquerda
            setMenuPos({ top, left });
        }
    }, [isOpen]);

    const handleToggle = (e) => {
        e.stopPropagation();
        if (isControlled) {
            onToggle();
        } else {
            setInternalIsOpen(!internalIsOpen);
        }
    };

    const handleClose = () => {
        setShowMoveSubmenu(false);
        if (isControlled) {
            if (isOpen) onToggle();
        } else {
            setInternalIsOpen(false);
        }
    };

    const { data: folderData, isLoading: isLoadingFolders } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: async () => {
            const res = await fetch('/api/email/folders');
            if (!res.ok) throw new Error('Erro ao buscar pastas');
            return res.json();
        },
        staleTime: 1000 * 60 * 5 
    });

    const handleClick = (action, value = null) => {
        onAction(action, value);
        handleClose();
    };

    // Renderiza o menu via Portal ou Fixed (aqui usamos Fixed direto no body visualmente)
    const MenuContent = (
        <div 
            className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-100 w-56 animate-fade-in ring-1 ring-black/5 text-left"
            style={{ 
                top: menuPos.top, 
                left: menuPos.left,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* BACKDROP TRANSPARENTE PARA FECHAR AO CLICAR FORA */}
            <div className="fixed inset-0 -z-10" onClick={handleClose}></div>

            <div className="py-1 flex flex-col relative">
                
                <button onClick={() => handleClick('markAsRead')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3">
                    <FontAwesomeIcon icon={faEnvelopeOpen} className="w-3" /> Marcar como lido
                </button>
                <button onClick={() => handleClick('markAsUnread')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3">
                    <FontAwesomeIcon icon={faEnvelope} className="w-3" /> Marcar como não lido
                </button>
                
                {showCreateActivity && (
                    <button onClick={() => handleClick('createActivity')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-3">
                        <FontAwesomeIcon icon={faCalendarPlus} className="w-3" /> Criar Atividade
                    </button>
                )}

                <div className="h-px bg-gray-100 my-1"></div>

                <button onClick={() => handleClick('createRule')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3">
                    <FontAwesomeIcon icon={faRobot} className="w-3" /> Criar Regra
                </button>

                {/* SUBMENU MOVER */}
                <div 
                    className="relative"
                    onMouseEnter={() => setShowMoveSubmenu(true)}
                    onMouseLeave={() => setShowMoveSubmenu(false)}
                >
                    <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faFolderOpen} className="w-3 text-gray-400 group-hover:text-gray-600" /> 
                            Mover para...
                        </div>
                        <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-gray-300" />
                    </button>

                    {showMoveSubmenu && (
                        <div className="absolute right-full top-0 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-[1000] max-h-60 overflow-y-auto custom-scrollbar animate-fade-in-left mr-1">
                            {isLoadingFolders ? (
                                <div className="p-3 text-center text-xs text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>
                            ) : (
                                folderData?.folders?.filter(f => !['INBOX', 'ENTRADA'].some(n => f.name.toUpperCase().includes(n))).map((folder) => (
                                    <button 
                                        key={folder.path} 
                                        onClick={(e) => { e.stopPropagation(); handleClick('move', folder.path); }}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 truncate block border-b border-gray-50 last:border-0"
                                        style={{ paddingLeft: `${16 + ((folder.level || 0) * 8)}px` }}
                                    >
                                        {folder.displayName || folder.name}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="h-px bg-gray-100 my-1"></div>

                <button onClick={() => handleClick('archive')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3">
                    <FontAwesomeIcon icon={faArchive} className="w-3" /> Arquivar
                </button>
                <button onClick={() => handleClick('trash')} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-3 font-medium">
                    <FontAwesomeIcon icon={faTrash} className="w-3" /> Excluir
                </button>
            </div>
        </div>
    );

    // Usa createPortal se estiver no navegador para renderizar fora da hierarquia
    const renderMenu = () => {
        if (typeof document === 'undefined') return null;
        return createPortal(MenuContent, document.body);
    };

    return (
        <>
            <button 
                ref={buttonRef}
                onClick={handleToggle}
                className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors ${isOpen ? 'bg-gray-200 text-gray-800 shadow-sm' : ''}`}
                title="Mais ações"
            >
                <FontAwesomeIcon icon={faEllipsisV} className="text-xs" />
            </button>

            {isOpen && renderMenu()}
        </>
    );
}
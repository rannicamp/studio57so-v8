'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faEllipsisV, faEnvelope, faEnvelopeOpen, faArchive, faTrash, 
    faFolderOpen, faRobot, faCalendarPlus, faChevronRight, faSpinner 
} from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';

export default function EmailActionMenu({ email, onAction, showCreateActivity = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
    const menuRef = useRef(null);

    // Busca as pastas para o menu "Mover para"
    const { data: folderData, isLoading: isLoadingFolders } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: async () => {
            const res = await fetch('/api/email/folders');
            if (!res.ok) throw new Error('Erro ao buscar pastas');
            return res.json();
        },
        staleTime: 1000 * 60 * 5 // Cache de 5 min
    });

    // Fecha ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setShowMoveSubmenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClick = (action, value = null) => {
        onAction(action, value);
        setIsOpen(false);
        setShowMoveSubmenu(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors ${isOpen ? 'bg-gray-200 text-gray-800 shadow-sm' : ''}`}
                title="Mais ações"
            >
                <FontAwesomeIcon icon={faEllipsisV} className="text-xs" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-2xl border border-gray-100 z-[999] animate-fade-in ring-1 ring-black/5 text-left">
                    <div className="py-1 flex flex-col">
                        
                        {/* Ações Básicas */}
                        <button onClick={() => handleClick('markAsRead')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3">
                            <FontAwesomeIcon icon={faEnvelopeOpen} className="w-3" /> Marcar como lido
                        </button>
                        <button onClick={() => handleClick('markAsUnread')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3">
                            <FontAwesomeIcon icon={faEnvelope} className="w-3" /> Marcar como não lido
                        </button>
                        
                        {/* Específico do ViewPanel */}
                        {showCreateActivity && (
                            <button onClick={() => handleClick('createActivity')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-3">
                                <FontAwesomeIcon icon={faCalendarPlus} className="w-3" /> Criar Atividade
                            </button>
                        )}

                        <div className="h-px bg-gray-100 my-1"></div>

                        {/* Criar Regra */}
                        <button onClick={() => handleClick('createRule')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-3">
                            <FontAwesomeIcon icon={faRobot} className="w-3" /> Criar Regra
                        </button>

                        {/* Mover Para (Com Submenu) */}
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
                                <div className="absolute right-full top-0 mr-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                                    {isLoadingFolders ? (
                                        <div className="p-3 text-center text-xs text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>
                                    ) : (
                                        folderData?.folders?.filter(f => !['INBOX', 'ENTRADA'].some(n => f.name.toUpperCase().includes(n))).map((folder) => (
                                            <button 
                                                key={folder.path} 
                                                onClick={() => handleClick('move', folder.path)}
                                                className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 truncate"
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

                        {/* Exclusão */}
                        <button onClick={() => handleClick('archive')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3">
                            <FontAwesomeIcon icon={faArchive} className="w-3" /> Arquivar
                        </button>
                        <button onClick={() => handleClick('trash')} className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-3 font-medium">
                            <FontAwesomeIcon icon={faTrash} className="w-3" /> Excluir
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
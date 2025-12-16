'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faEllipsisV, faEnvelope, faEnvelopeOpen, faArchive, faTrash, 
    faFolderOpen, faRobot, faCalendarPlus, faChevronRight, faSpinner,
    faPlus, faCheck, faTimes, faFolder
} from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

export default function EmailActionMenu({ email, onAction, showCreateActivity = false, isOpen: controlledIsOpen, onToggle }) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
    
    // Estados para criação rápida de pasta
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const queryClient = useQueryClient();

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    // Calcula a posição fixa
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const top = rect.top + window.scrollY;
            const left = rect.left + window.scrollX - 224; 
            setMenuPos({ top, left });
        } else {
            // Reseta estados internos ao fechar
            setIsCreatingFolder(false);
            setNewFolderName('');
            setShowMoveSubmenu(false);
        }
    }, [isOpen]);

    const handleToggle = (e) => {
        e.stopPropagation();
        if (isControlled) onToggle();
        else setInternalIsOpen(!internalIsOpen);
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

    const createFolderMutation = useMutation({
        mutationFn: async (folderName) => {
            const res = await fetch('/api/email/folders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName, parentPath: '' }) // Cria na raiz por padrão neste menu rápido
            });
            if (!res.ok) throw new Error('Falha ao criar pasta');
            return res.json();
        },
        onSuccess: (data) => {
            toast.success('Pasta criada!');
            queryClient.invalidateQueries(['emailFolders']);
            setIsCreatingFolder(false);
            setNewFolderName('');
            // Opcional: já mover para a nova pasta automaticamente?
            // Por enquanto, apenas atualiza a lista para o usuário clicar.
        },
        onError: () => toast.error('Erro ao criar pasta.')
    });

    // --- LÓGICA DE ÁRVORE (Igual ao Sidebar para garantir ordem correta) ---
    const processedFolders = useMemo(() => {
        if (!folderData?.folders) return [];
        
        const allFolders = folderData.folders;
        const childrenMap = {}; 
        const roots = [];       

        allFolders.forEach(folder => {
            if (folder.level === 0) {
                roots.push(folder);
            } else {
                const separator = folder.delimiter || '/';
                const lastIndex = folder.path.lastIndexOf(separator);
                const parentPath = lastIndex > -1 ? folder.path.substring(0, lastIndex) : '';
                if (!childrenMap[parentPath]) childrenMap[parentPath] = [];
                childrenMap[parentPath].push(folder);
            }
        });

        const specialOrder = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'JUNK', 'SPAM', 'ARCHIVE'];
        const sortList = (list) => list.sort((a, b) => {
            const indexA = specialOrder.findIndex(key => a.name.toUpperCase() === key);
            const indexB = specialOrder.findIndex(key => b.name.toUpperCase() === key);
            if (indexA === -1 && indexB === -1) return a.displayName.localeCompare(b.displayName);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            return 1;
        });

        const flattenTree = (list) => {
            let result = [];
            const sortedList = sortList(list);
            sortedList.forEach(folder => {
                const children = childrenMap[folder.path] || [];
                result.push(folder);
                if (children.length > 0) result = result.concat(flattenTree(children));
            });
            return result;
        };

        // Filtra para não mostrar pastas de sistema (opcional) no menu de mover
        // Mantemos INBOX visível pois às vezes queremos tirar da subpasta e voltar pra caixa de entrada
        return flattenTree(roots);
    }, [folderData]);

    const handleClick = (action, value = null) => {
        onAction(action, value);
        handleClose();
    };

    const handleCreateSubmit = (e) => {
        e.stopPropagation();
        if (!newFolderName.trim()) return;
        createFolderMutation.mutate(newFolderName);
    };

    const MenuContent = (
        <div 
            className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-100 w-56 animate-fade-in ring-1 ring-black/5 text-left"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
        >
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
                    onMouseLeave={() => !isCreatingFolder && setShowMoveSubmenu(false)} // Não fecha se estiver digitando
                >
                    <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faFolderOpen} className="w-3 text-gray-400 group-hover:text-gray-600" /> 
                            Mover para...
                        </div>
                        <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-gray-300" />
                    </button>

                    {showMoveSubmenu && (
                        <div className="absolute right-full top-0 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-[1000] max-h-80 overflow-y-auto custom-scrollbar animate-fade-in-left mr-1 flex flex-col">
                            
                            {/* ITEM 1: CRIAR NOVA PASTA */}
                            <div className="sticky top-0 bg-white border-b border-gray-100 z-10 p-2">
                                {isCreatingFolder ? (
                                    <div className="flex items-center gap-1 animate-fade-in">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            className="w-full text-xs border rounded px-2 py-1 outline-none focus:border-blue-500"
                                            placeholder="Nome da pasta..."
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateSubmit(e)}
                                        />
                                        <button onClick={handleCreateSubmit} disabled={createFolderMutation.isPending} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                            {createFolderMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheck} />}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(false); }} className="text-red-500 hover:bg-red-50 p-1 rounded">
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(true); }}
                                        className="w-full text-left text-xs text-blue-600 font-bold hover:bg-blue-50 py-1.5 px-2 rounded flex items-center gap-2"
                                    >
                                        <div className="w-5 flex justify-center"><FontAwesomeIcon icon={faPlus} /></div>
                                        Nova Pasta
                                    </button>
                                )}
                            </div>

                            {/* LISTA DE PASTAS COM INDENTAÇÃO */}
                            {isLoadingFolders ? (
                                <div className="p-3 text-center text-xs text-gray-400"><FontAwesomeIcon icon={faSpinner} spin /></div>
                            ) : (
                                <div className="py-1">
                                    {processedFolders.map((folder) => (
                                        <button 
                                            key={folder.path} 
                                            onClick={(e) => { e.stopPropagation(); handleClick('move', folder.path); }}
                                            className="w-full text-left py-2 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 truncate flex items-center gap-2"
                                            // Indentação visual usando padding-left
                                            style={{ paddingLeft: `${12 + (folder.level * 12)}px`, paddingRight: '12px' }}
                                        >
                                            <FontAwesomeIcon icon={faFolder} className={`text-gray-400 ${folder.level > 0 ? 'text-[10px]' : ''}`} />
                                            <span className="truncate">{folder.displayName || folder.name}</span>
                                        </button>
                                    ))}
                                </div>
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
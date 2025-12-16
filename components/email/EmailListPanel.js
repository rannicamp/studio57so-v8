'use client'

import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faArrowLeft, faSpinner, faSync, faBoxOpen, faExclamationCircle, 
    faEnvelopeOpen, faCheckSquare, faSquare, faTrash, faArchive, faEnvelope, faEllipsisV 
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// Busca de mensagens
const fetchMessages = async ({ queryKey, pageParam = 1 }) => {
    const [_key, folderPath, searchTerm, status] = queryKey;
    
    let url = `/api/email/messages?folder=${encodeURIComponent(folderPath)}&page=${pageParam}`;
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    if (status && status !== 'all') url += `&status=${status}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao buscar e-mails');
    return res.json();
};

const performBulkAction = async ({ action, folder, uids }) => {
    const res = await fetch('/api/email/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, folder, uids })
    });
    if (!res.ok) throw new Error('Falha na ação em massa');
    return res.json();
};

export default function EmailListPanel({ folder, onBack, onSelectEmail, selectedEmailId, searchTerm }) {
    const [filterStatus, setFilterStatus] = useState('unread');
    const [selectedIds, setSelectedIds] = useState(new Set()); 
    const [lastSelectedId, setLastSelectedId] = useState(null); 
    
    const [menuOpenId, setMenuOpenId] = useState(null);
    const menuRef = useRef(null);
    
    const loadMoreRef = useRef(null);
    const queryClient = useQueryClient();
    const folderIdentifier = folder.path || folder.name;

    useEffect(() => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
        setMenuOpenId(null); 
    }, [searchTerm, folder.path, filterStatus]);

    // Fecha o menu se clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpenId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const { 
        data, 
        isLoading, 
        isError, 
        fetchNextPage, 
        hasNextPage, 
        isFetchingNextPage,
        refetch,
        isFetching
    } = useInfiniteQuery({
        queryKey: ['emailMessages', folderIdentifier, searchTerm, filterStatus],
        queryFn: fetchMessages,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.hasMore ? allPages.length + 1 : undefined;
        },
        staleTime: 1000 * 60 * 1, 
        refetchOnWindowFocus: false,
    });

    const allEmails = data?.pages.flatMap(page => page.messages) || [];
    const totalEmails = data?.pages[0]?.total || 0;

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 1.0 }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => {
            if (loadMoreRef.current) {
                observer.unobserve(loadMoreRef.current);
            }
        };
    }, [loadMoreRef, hasNextPage, isFetchingNextPage, fetchNextPage]);

    const bulkActionMutation = useMutation({
        mutationFn: performBulkAction,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
            setSelectedIds(new Set());
            setLastSelectedId(null);
            setMenuOpenId(null);
            
            const count = variables.uids.length;
            if (variables.action === 'trash') toast.success(`${count} e-mails excluídos.`);
            else if (variables.action === 'archive') toast.success(`${count} e-mails arquivados.`);
            else if (variables.action === 'markAsRead') toast.success(`${count} marcados como lidos.`);
            else if (variables.action === 'markAsUnread') toast.success(`${count} marcados como não lidos.`);
        },
        onError: () => toast.error('Erro ao processar seleção.')
    });

    const applyRulesMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/email/rules/apply', { method: 'POST' });
            if (!res.ok) throw new Error('Falha ao processar regras');
            return res.json();
        },
        onSuccess: (data) => {
            if (data.moved > 0) {
                toast.success(`${data.moved} e-mails movidos por regras.`);
            }
        },
        onError: (err) => {
            console.error("Erro silencioso ao aplicar regras:", err);
        }
    });

    const handleRefresh = async () => {
        try {
            await applyRulesMutation.mutateAsync();
        } catch (e) {}
        refetch();
    };

    const handleEmailClick = (email, e) => {
        if (e.target.closest('.action-menu-btn') || e.target.closest('.action-menu-dropdown')) return;

        if (e.target.closest('.checkbox-area') || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            
            const newSet = new Set(selectedIds);
            if (newSet.has(email.id)) newSet.delete(email.id);
            else newSet.add(email.id);
            
            setSelectedIds(newSet);
            setLastSelectedId(email.id);
            return;
        }

        if (e.shiftKey && lastSelectedId) {
            e.preventDefault();
            e.stopPropagation();
            const lastIndex = allEmails.findIndex(em => em.id === lastSelectedId);
            const currentIndex = allEmails.findIndex(em => em.id === email.id);
            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const newSet = new Set(selectedIds);
                for (let i = start; i <= end; i++) {
                    newSet.add(allEmails[i].id);
                }
                setSelectedIds(newSet);
            }
            return;
        }

        if (selectedIds.size > 0) setSelectedIds(new Set()); 
        onSelectEmail(email);
    };

    const toggleSelection = (emailId, e) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(emailId)) newSet.delete(emailId);
        else newSet.add(emailId);
        setSelectedIds(newSet);
        setLastSelectedId(emailId);
    };

    const handleBulkAction = (action) => {
        if (selectedIds.size === 0) return;
        bulkActionMutation.mutate({ 
            action, 
            folder: folderIdentifier, 
            uids: Array.from(selectedIds) 
        });
    };

    const handleIndividualAction = (e, action, emailId) => {
        e.stopPropagation();
        setMenuOpenId(null);
        bulkActionMutation.mutate({
            action,
            folder: folderIdentifier,
            uids: [emailId]
        });
    };

    const toggleMenu = (e, emailId) => {
        e.stopPropagation(); // Impede que o clique abra o email
        setMenuOpenId(menuOpenId === emailId ? null : emailId);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Delete' && selectedIds.size > 0) {
                handleBulkAction('trash');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, folderIdentifier]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 relative">
            
            {/* BARRA DE AÇÕES EM MASSA */}
            {selectedIds.size > 0 && (
                <div className="absolute top-0 inset-x-0 h-[60px] bg-blue-600 z-20 flex items-center justify-between px-4 text-white shadow-md animate-slide-down">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-sm">{selectedIds.size} selecionados</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs opacity-80 hover:opacity-100 hover:underline">Cancelar</button>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => handleBulkAction('markAsRead')} title="Marcar como lido" className="p-2 hover:bg-blue-700 rounded-full transition-colors"><FontAwesomeIcon icon={faEnvelopeOpen} /></button>
                        <button onClick={() => handleBulkAction('markAsUnread')} title="Marcar como não lido" className="p-2 hover:bg-blue-700 rounded-full transition-colors"><FontAwesomeIcon icon={faEnvelope} /></button>
                        <button onClick={() => handleBulkAction('archive')} title="Arquivar" className="p-2 hover:bg-blue-700 rounded-full transition-colors"><FontAwesomeIcon icon={faArchive} /></button>
                        <button onClick={() => handleBulkAction('trash')} title="Excluir" className="p-2 hover:bg-red-500 rounded-full transition-colors"><FontAwesomeIcon icon={faTrash} /></button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col border-b bg-white shrink-0">
                <div className="flex items-center gap-3 p-4 pb-2 justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button onClick={onBack} className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <div className="overflow-hidden">
                            <h2 className="text-base font-bold text-gray-800 truncate" title={folderIdentifier}>
                                {folder.displayName || folder.name}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {isLoading ? '...' : `${totalEmails} mensagens`}
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleRefresh} 
                        disabled={isFetching || applyRulesMutation.isPending} 
                        className={`text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all ${isFetching ? 'opacity-50' : ''}`} 
                        title="Aplicar regras e atualizar"
                    >
                        <FontAwesomeIcon icon={faSync} spin={isFetching || applyRulesMutation.isPending} />
                    </button>
                </div>

                <div className="flex px-4 gap-4 mt-1">
                    <button onClick={() => setFilterStatus('unread')} className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'unread' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Não Lidas</button>
                    <button onClick={() => setFilterStatus('all')} className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Todas</button>
                </div>
            </div>

            {/* Lista Infinita */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40 text-blue-500"><FontAwesomeIcon icon={faSpinner} spin size="lg" /></div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-400 p-4 text-center"><FontAwesomeIcon icon={faExclamationCircle} size="2x" className="mb-2" /><p className="text-sm font-medium">Erro ao carregar.</p><button onClick={() => refetch()} className="mt-4 text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold">Tentar Novamente</button></div>
                ) : allEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center"><FontAwesomeIcon icon={filterStatus === 'unread' ? faEnvelopeOpen : faBoxOpen} size="2x" /><p className="mt-2 text-sm">{searchTerm ? `Sem resultados para "${searchTerm}"` : 'Tudo limpo por aqui!'}</p></div>
                ) : (
                    <div className="divide-y divide-gray-100 pb-4">
                        
                        {allEmails.map((email) => {
                            const isSelected = selectedIds.has(email.id);
                            const isActive = selectedEmailId === email.id;
                            const isMenuOpen = menuOpenId === email.id;
                            const isRead = email.flags?.includes('\\Seen');
                            
                            return (
                                <div 
                                    key={email.id}
                                    onClick={(e) => handleEmailClick(email, e)}
                                    // REMOVIDO: opacity-75 daqui de cima. Agora é só no conteúdo interno.
                                    className={`
                                        p-3 cursor-pointer hover:bg-gray-50 border-l-4 transition-all relative group
                                        ${isSelected ? 'bg-blue-50 border-l-blue-600' : isActive ? 'bg-blue-50/50 border-l-blue-400' : 'bg-white border-l-transparent'}
                                    `}
                                >
                                    {/* CONTEÚDO DO EMAIL (Aqui aplicamos a opacidade se lido) */}
                                    <div className={`flex items-start gap-3 transition-opacity ${isRead ? 'opacity-60' : ''}`}>
                                        <div 
                                            className="checkbox-area pt-1 text-gray-300 hover:text-blue-500 cursor-pointer z-10"
                                            onClick={(e) => toggleSelection(email.id, e)}
                                        >
                                            <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className={`text-sm ${isSelected ? 'text-blue-600' : ''}`} />
                                        </div>

                                        <div className="flex-grow min-w-0 pr-6"> 
                                            <div className="flex justify-between items-start mb-0.5 gap-2">
                                                <h4 className={`text-sm truncate flex-1 ${isSelected || isActive ? 'text-blue-900' : 'text-gray-800'} ${!isRead ? 'font-bold' : ''}`}>
                                                    {email.from}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                                                    {format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })}
                                                </span>
                                            </div>
                                            <h3 className={`text-xs truncate mb-0.5 ${isSelected || isActive ? 'text-blue-800' : 'text-gray-600'} ${!isRead ? 'font-semibold' : ''}`}>
                                                {email.subject}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* BOTÃO DE AÇÕES (Fora da div de opacidade, para ficar sempre vivo) */}
                                    <div className={`absolute right-2 top-3 ${isMenuOpen ? 'opacity-100 z-[100]' : 'opacity-0 md:group-hover:opacity-100 z-20'} transition-all action-menu-btn`}>
                                        <button 
                                            onClick={(e) => toggleMenu(e, email.id)}
                                            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors ${isMenuOpen ? 'bg-gray-200 text-gray-800 shadow-sm' : ''}`}
                                        >
                                            <FontAwesomeIcon icon={faEllipsisV} className="text-xs" />
                                        </button>
                                        
                                        {/* Dropdown Menu - Corrigido: bg-white, shadow-xl, z-index altissimo */}
                                        {isMenuOpen && (
                                            <div ref={menuRef} className="absolute right-0 mt-1 w-52 bg-white rounded-lg shadow-2xl border border-gray-100 z-[999] animate-fade-in action-menu-dropdown ring-1 ring-black/5">
                                                <div className="py-1">
                                                    <button onClick={(e) => handleIndividualAction(e, 'markAsRead', email.id)} className="block w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors">
                                                        <FontAwesomeIcon icon={faEnvelopeOpen} className="w-3" /> Marcar como lido
                                                    </button>
                                                    <button onClick={(e) => handleIndividualAction(e, 'markAsUnread', email.id)} className="block w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 transition-colors">
                                                        <FontAwesomeIcon icon={faEnvelope} className="w-3" /> Marcar como não lido
                                                    </button>
                                                    <button onClick={(e) => handleIndividualAction(e, 'archive', email.id)} className="block w-full text-left px-4 py-2.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-3 transition-colors">
                                                        <FontAwesomeIcon icon={faArchive} className="w-3" /> Arquivar
                                                    </button>
                                                    <div className="h-px bg-gray-100 my-1"></div>
                                                    <button onClick={(e) => handleIndividualAction(e, 'trash', email.id)} className="block w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-3 font-medium transition-colors">
                                                        <FontAwesomeIcon icon={faTrash} className="w-3" /> Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        <div ref={loadMoreRef} className="py-4 text-center">
                            {isFetchingNextPage ? (
                                <div className="text-blue-500 text-xs flex items-center justify-center gap-2">
                                    <FontAwesomeIcon icon={faSpinner} spin /> Carregando mais...
                                </div>
                            ) : hasNextPage ? (
                                <span className="text-transparent text-[1px]">.</span> 
                            ) : (
                                <span className="text-gray-300 text-[10px] uppercase font-bold tracking-widest">Fim da lista</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
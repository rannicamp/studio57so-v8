'use client'

import { useState, useEffect, useCallback } from 'react';
import { useQuery, keepPreviousData, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faArrowLeft, faSpinner, faSync, faBoxOpen, faExclamationCircle, faSearch, 
    faEnvelopeOpen, faCheckSquare, faSquare, faTrash, faArchive, faEnvelope 
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// Busca de mensagens
const fetchMessages = async ({ queryKey }) => {
    const [_key, folderPath, page, searchTerm, status] = queryKey;
    let url = `/api/email/messages?folder=${encodeURIComponent(folderPath)}&page=${page}`;
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    if (status && status !== 'all') url += `&status=${status}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao buscar e-mails');
    return res.json();
};

// Ação em massa
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
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedIds, setSelectedIds] = useState(new Set()); 
    const [lastSelectedId, setLastSelectedId] = useState(null); 

    const queryClient = useQueryClient();
    const folderIdentifier = folder.path || folder.name;

    useEffect(() => {
        setPage(1);
        setSelectedIds(new Set());
        setLastSelectedId(null);
    }, [searchTerm, folder.path, filterStatus]);

    const { 
        data, isLoading, isError, error, isFetching, refetch 
    } = useQuery({
        queryKey: ['emailMessages', folderIdentifier, page, searchTerm, filterStatus],
        queryFn: fetchMessages,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 1, 
        refetchOnWindowFocus: false, 
    });

    const emails = data?.messages || [];
    const hasMore = data?.hasMore || false;

    const bulkActionMutation = useMutation({
        mutationFn: performBulkAction,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
            setSelectedIds(new Set());
            setLastSelectedId(null);
            
            const count = variables.uids.length;
            if (variables.action === 'trash') toast.success(`${count} e-mails excluídos.`);
            else if (variables.action === 'archive') toast.success(`${count} e-mails arquivados.`);
            else if (variables.action === 'markAsRead') toast.success(`${count} marcados como lidos.`);
            else if (variables.action === 'markAsUnread') toast.success(`${count} marcados como não lidos.`);
        },
        onError: () => toast.error('Erro ao processar seleção.')
    });

    // --- LÓGICA DE SELEÇÃO ---
    const handleEmailClick = (email, e) => {
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
            
            const lastIndex = emails.findIndex(em => em.id === lastSelectedId);
            const currentIndex = emails.findIndex(em => em.id === email.id);
            
            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                
                const newSet = new Set(selectedIds);
                for (let i = start; i <= end; i++) {
                    newSet.add(emails[i].id);
                }
                setSelectedIds(newSet);
            }
            return;
        }

        if (selectedIds.size > 0) {
             setSelectedIds(new Set()); 
        }
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

            {/* Header Normal */}
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
                                {isLoading ? '...' : `${data?.total || 0} mensagens`}
                            </p>
                        </div>
                    </div>
                    {/* O ícone de atualizar continua aqui, discreto e rodando se precisar */}
                    <button onClick={() => refetch()} disabled={isFetching} className={`text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all ${isFetching ? 'opacity-50' : ''}`} title="Atualizar">
                        <FontAwesomeIcon icon={faSync} spin={isFetching} />
                    </button>
                </div>

                {/* Filtros */}
                <div className="flex px-4 gap-4 mt-1">
                    <button onClick={() => setFilterStatus('all')} className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Todas</button>
                    <button onClick={() => setFilterStatus('unread')} className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'unread' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Não Lidas</button>
                    <button onClick={() => setFilterStatus('read')} className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'read' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Lidas</button>
                </div>
            </div>

            {/* Lista */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40 text-blue-500"><FontAwesomeIcon icon={faSpinner} spin size="lg" /></div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-400 p-4 text-center"><FontAwesomeIcon icon={faExclamationCircle} size="2x" className="mb-2" /><p className="text-sm font-medium">Erro ao carregar.</p><button onClick={() => refetch()} className="mt-4 text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold">Tentar Novamente</button></div>
                ) : emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center"><FontAwesomeIcon icon={filterStatus === 'unread' ? faEnvelopeOpen : faBoxOpen} size="2x" /><p className="mt-2 text-sm">{searchTerm ? `Sem resultados para "${searchTerm}"` : 'Tudo limpo por aqui!'}</p></div>
                ) : (
                    <div className="divide-y divide-gray-100 pb-4">
                        {/* Removido o banner de 'Atualizando...' daqui */}
                        
                        {emails.map((email) => {
                            const isSelected = selectedIds.has(email.id);
                            const isActive = selectedEmailId === email.id;
                            
                            return (
                                <div 
                                    key={email.id}
                                    onClick={(e) => handleEmailClick(email, e)}
                                    className={`
                                        p-3 cursor-pointer hover:bg-gray-50 border-l-4 transition-all relative group
                                        ${isSelected ? 'bg-blue-50 border-l-blue-600' : isActive ? 'bg-blue-50/50 border-l-blue-400' : 'bg-white border-l-transparent'}
                                        ${email.flags?.includes('\\Seen') ? 'opacity-75' : 'font-semibold'}
                                    `}
                                >
                                    <div className="flex items-start gap-3">
                                        <div 
                                            className="checkbox-area pt-1 text-gray-300 hover:text-blue-500 cursor-pointer z-10"
                                            onClick={(e) => toggleSelection(email.id, e)}
                                        >
                                            <FontAwesomeIcon icon={isSelected ? faCheckSquare : faSquare} className={`text-sm ${isSelected ? 'text-blue-600' : ''}`} />
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-start mb-0.5 gap-2">
                                                <h4 className={`text-sm truncate flex-1 ${isSelected || isActive ? 'text-blue-900' : 'text-gray-800'}`}>
                                                    {email.from}
                                                </h4>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                                                    {format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })}
                                                </span>
                                            </div>
                                            <h3 className={`text-xs truncate mb-0.5 ${isSelected || isActive ? 'text-blue-800' : 'text-gray-600'}`}>
                                                {email.subject}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        <div className="p-4 flex justify-between items-center bg-gray-50 border-t mt-2">
                            <button onClick={() => setPage(old => Math.max(old - 1, 1))} disabled={page === 1 || isFetching} className="px-3 py-1.5 bg-white border rounded text-xs text-gray-600 disabled:opacity-50 hover:bg-gray-100 font-medium">Anterior</button>
                            <span className="text-xs font-bold text-gray-500">Pág {page}</span>
                            <button onClick={() => setPage(old => (hasMore ? old + 1 : old))} disabled={!hasMore || isFetching} className="px-3 py-1.5 bg-white border rounded text-xs text-gray-600 disabled:opacity-50 hover:bg-gray-100 font-medium">Próxima</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
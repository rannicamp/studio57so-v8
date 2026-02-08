'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faEnvelope, faInbox, faPaperPlane, faTrash, faBan, 
    faFolder, faPlus, faCog, faSpinner, 
    faChevronRight, faChevronDown, faUserCircle, faEllipsisV, 
    faCheckDouble, faEraser, faSync
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import EmailAutoSync from './EmailAutoSync'; 

const FOLDER_EXPANSION_KEY = 'email_expanded_folders_final_v1';

// --- A MÁGICA: O NORMALIZADOR ---
// Isso faz o sistema entender que "INBOX.Trabalho" é igual a "INBOX/TRABALHO"
const normalizeKey = (key) => {
    if (!key) return '';
    return key.toString()
        .toUpperCase()
        .trim()
        .replace(/\./g, '/')   // Troca ponto por barra (Correção Hostinger)
        .replace(/\\/g, '/')   // Troca contra-barra
        .replace(/\/+/g, '/'); // Remove duplicadas
};

const FolderContextMenu = ({ position, folder, onClose, onAction, isSystemFolder }) => {
    if (!position) return null;
    return createPortal(
        <>
            <div className="fixed inset-0 z-[99990] cursor-default" onClick={onClose}></div>
            <div 
                className="fixed z-[99999] bg-white rounded-lg shadow-xl border border-gray-100 w-48 py-1 animate-fade-in text-gray-700"
                style={{ top: position.top, left: position.left }}
            >
                <button onClick={(e) => onAction(e, 'markAllRead', folder.path)} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                    <FontAwesomeIcon icon={faCheckDouble} className="text-blue-500 w-3" /> Marcar lidos
                </button>
                <button onClick={(e) => onAction(e, 'empty', folder.path)} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2">
                    <FontAwesomeIcon icon={faEraser} className="text-orange-500 w-3" /> Esvaziar pasta
                </button>
                {!isSystemFolder && (
                    <>
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button onClick={(e) => onAction(e, 'delete', folder.path)} className="w-full text-left px-4 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2">
                            <FontAwesomeIcon icon={faTrash} className="w-3" /> Excluir pasta
                        </button>
                    </>
                )}
            </div>
        </>,
        document.body
    );
};

const AccountFolderTree = ({ account, selectedFolder, onSelectFolder, expandedPaths, toggleExpand, onCreateFolder }) => {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [menuState, setMenuState] = useState({ isOpen: false, position: null, folder: null });
    
    // Estado local para garantir atualização imediata
    const [countsMap, setCountsMap] = useState({});

    // 1. Busca Pastas
    const { data: folderData, isLoading } = useQuery({
        queryKey: ['emailFolders', account.id],
        queryFn: async () => {
            const res = await fetch(`/api/email/folders?accountId=${account.id}`);
            if (!res.ok) throw new Error('Erro ao buscar pastas');
            return res.json();
        },
        staleTime: 1000 * 60 * 60 
    });

    const folderList = folderData?.folders || [];

    // 2. Busca Contagens
    const { data: countsData, refetch: refetchCounts } = useQuery({
        queryKey: ['emailFolderCounts', account.id],
        queryFn: async () => {
            const res = await fetch(`/api/email/folders?accountId=${account.id}&action=getAllCounts`);
            if (!res.ok) return { counts: {} };
            return res.json();
        },
        refetchInterval: 10000, 
    });

    // 3. Atualiza o Mapa de Contagens (Com Normalização)
    useEffect(() => {
        if (countsData?.counts) {
            const newMap = {};
            Object.entries(countsData.counts).forEach(([path, count]) => {
                newMap[path] = count; // Chave original
                newMap[normalizeKey(path)] = count; // Chave normalizada
                
                // Hack para Inbox sempre funcionar
                if (normalizeKey(path).includes('INBOX')) {
                    newMap['INBOX'] = count;
                }
            });
            setCountsMap(newMap);
        }
    }, [countsData]);

    // 4. Realtime (Websockets)
    useEffect(() => {
        if (!account?.id) return;
        
        const channel = supabase
            .channel(`folder-counts-${account.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'email_folders_cache',
                    filter: `account_id=eq.${account.id}`
                },
                (payload) => {
                    if (payload.new) {
                        const path = payload.new.path;
                        const count = payload.new.unseen_count;
                        
                        setCountsMap(prev => ({
                            ...prev,
                            [path]: count,
                            [normalizeKey(path)]: count
                        }));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [account.id, supabase]);

    const folderActionMutation = useMutation({
        mutationFn: async ({ action, folderPath }) => {
            const res = await fetch('/api/email/folders/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, folderPath, accountId: account.id })
            });
            if (!res.ok) throw new Error('Erro na ação');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Feito!");
            queryClient.invalidateQueries(['emailFolders', account.id]);
            refetchCounts();
            setMenuState({ isOpen: false, position: null, folder: null });
        }
    });

    const openMenu = (e, folder) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuState({ isOpen: true, folder, position: { top: rect.bottom + 5, left: rect.left } });
    };

    const handleAction = (e, action, folderPath) => {
        setMenuState({ ...menuState, isOpen: false });
        if (action === 'delete' && !confirm('Tem certeza?')) return;
        folderActionMutation.mutate({ action, folderPath });
    };

    const processedFolders = useMemo(() => {
        if (!folderList || folderList.length === 0) return [];
        const childrenMap = {}; 
        const roots = [];       
        const allPaths = new Set(folderList.map(f => f.path));

        folderList.forEach(folder => {
            // Detecção inteligente de separador
            const separator = folder.delimiter || (folder.path.includes('/') ? '/' : '.');
            const lastIndex = folder.path.lastIndexOf(separator);
            const parentPath = lastIndex > -1 ? folder.path.substring(0, lastIndex) : null;
            
            const parentExists = parentPath && allPaths.has(parentPath);

            if (folder.level === 0 || !parentExists) {
                roots.push(folder);
            } else {
                if (!childrenMap[parentPath]) childrenMap[parentPath] = [];
                childrenMap[parentPath].push(folder);
            }
        });

        const specialOrder = ['INBOX', 'ENTRADA', 'SENT', 'ENVIADOS', 'DRAFTS', 'RASCUNHOS', 'TRASH', 'LIXEIRA', 'JUNK', 'SPAM'];
        
        const sortList = (list) => list.sort((a, b) => {
            const getPriority = (f) => {
                const n = normalizeKey(f.name);
                const d = normalizeKey(f.displayName);
                const byName = specialOrder.findIndex(key => n.includes(key));
                if (byName !== -1) return byName;
                return specialOrder.findIndex(key => d.includes(key));
            };
            const indexA = getPriority(a);
            const indexB = getPriority(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.displayName.localeCompare(b.displayName);
        });

        const flattenTree = (list, currentLevel = 0) => {
            let result = [];
            const sortedList = sortList(list);
            
            sortedList.forEach(folder => {
                const visualFolder = { ...folder, level: currentLevel };
                const children = childrenMap[folder.path] || [];
                const hasChildren = children.length > 0;
                result.push({ ...visualFolder, hasChildren });
                if (hasChildren && expandedPaths.has(`${account.id}-${folder.path}`)) {
                    result = result.concat(flattenTree(children, currentLevel + 1));
                }
            });
            return result;
        };

        return flattenTree(roots);
    }, [folderList, expandedPaths, account.id]);

    const getFolderIcon = (name, path) => {
        const n = normalizeKey(name);
        if (n.includes('INBOX') || n.includes('ENTRADA')) return faInbox;
        if (n.includes('SENT') || n.includes('ENVIAD')) return faPaperPlane;
        if (n.includes('TRASH') || n.includes('LIXEIRA') || n.includes('DELETED')) return faTrash;
        if (n.includes('SPAM') || n.includes('JUNK')) return faBan;
        if (n.includes('DRAFT') || n.includes('RASCUNHO')) return faEnvelope;
        return faFolder; 
    };

    if (isLoading) return <div className="py-4 text-center text-gray-300"><FontAwesomeIcon icon={faSpinner} spin /></div>;

    return (
        <div className="pb-2">
            {processedFolders.map((folder) => {
                const uniqueKey = `${account.id}-${folder.path}`;
                const isExpanded = expandedPaths.has(uniqueKey);
                const isSelected = selectedFolder?.path === folder.path && selectedFolder?.accountId === account.id;
                const isInbox = normalizeKey(folder.name).includes('INBOX');

                // --- A BUSCA PELO NÚMERO ---
                let unreadCount = countsMap[folder.path]; // Exato
                if (unreadCount === undefined) unreadCount = countsMap[normalizeKey(folder.path)]; // Normalizado
                if (unreadCount === undefined) unreadCount = countsMap[folder.name]; // Nome simples
                
                unreadCount = unreadCount || 0;

                return (
                    <div 
                        key={uniqueKey}
                        className={`
                            w-full text-left hover:bg-gray-50 flex items-center text-sm transition-colors cursor-pointer group select-none relative
                            ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                        `}
                        onClick={() => onSelectFolder({ ...folder, accountId: account.id })}
                        style={{ paddingLeft: `${16 + (folder.level * 12)}px`, paddingRight: '8px' }} 
                    >
                        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>}
                        
                        <div 
                            className="h-9 w-6 flex items-center justify-center shrink-0 hover:text-blue-600 text-gray-400 mr-1"
                            onClick={(e) => { e.stopPropagation(); if(folder.hasChildren) toggleExpand(uniqueKey); }}
                        >
                            {folder.hasChildren && <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-[10px]" />}
                        </div>
                        
                        <div className="flex items-center gap-2 flex-grow py-2.5 overflow-hidden">
                            <FontAwesomeIcon icon={getFolderIcon(folder.name, folder.path)} className={`${isSelected ? 'text-blue-500' : 'text-gray-400'} w-4`} />
                            <span className="truncate flex-grow" title={folder.path}>{folder.displayName}</span>
                            
                            {unreadCount > 0 && (
                                <span className={`
                                    text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[20px] text-center ml-1 animate-fade-in
                                    ${isInbox ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-200 text-gray-600'}
                                `}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}

                            <button onClick={(e) => openMenu(e, folder)} className="w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" />
                            </button>
                        </div>
                    </div>
                );
            })}
            {menuState.isOpen && (
                <FolderContextMenu 
                    position={menuState.position} folder={menuState.folder} 
                    onClose={() => setMenuState({ isOpen: false, position: null, folder: null })} 
                    onAction={handleAction} 
                    isSystemFolder={normalizeKey(menuState.folder.name).includes('INBOX')}
                />
            )}
        </div>
    );
};

export default function EmailSidebar({ 
    selectedFolder, onSelectFolder, onCompose, onConfig, onChangeTab, 
    searchTerm, onSearchChange, onCreateFolder, canViewWhatsapp = true, className = '' 
}) {
    const [expandedPaths, setExpandedPaths] = useState(new Set());
    const [isHydrated, setIsHydrated] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(FOLDER_EXPANSION_KEY);
            if (saved) { try { setExpandedPaths(new Set(JSON.parse(saved))); } catch (e) { } }
            setIsHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') localStorage.setItem(FOLDER_EXPANSION_KEY, JSON.stringify(Array.from(expandedPaths)));
    }, [expandedPaths, isHydrated]);

    const toggleExpand = (uniqueKey) => {
        const newSet = new Set(expandedPaths);
        if (newSet.has(uniqueKey)) newSet.delete(uniqueKey);
        else newSet.add(uniqueKey);
        setExpandedPaths(newSet);
    };

    const handleForceSync = async () => {
        const toastId = toast.loading('Atualizando...');
        try {
            await fetch('/api/email/sync', { method: 'POST' });
            queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
            queryClient.invalidateQueries({ queryKey: ['emailFolderCounts'] });
            toast.success('Pronto!', { id: toastId });
        } catch (e) { toast.error('Erro', { id: toastId }); }
    };

    const { data: accountsData, isLoading: loadingAccounts } = useQuery({
        queryKey: ['emailAccounts'],
        queryFn: async () => {
            const res = await fetch('/api/email/accounts');
            if (!res.ok) throw new Error('Erro');
            return res.json();
        },
        staleTime: 1000 * 60 * 10
    });

    const accounts = accountsData?.accounts || [];

    return (
        <div className={`flex flex-col border-r bg-white h-full overflow-hidden min-h-0 ${className} relative`}>
            <div className="flex border-b bg-gray-50 shrink-0">
                {canViewWhatsapp && (
                    <button onClick={() => onChangeTab('whatsapp')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100"><FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp</button>
                )}
                <button className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-blue-600 text-blue-600 bg-white"><FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail</button>
            </div>

            <div className="p-4 pb-0">
                <button onClick={onCompose} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-transform active:scale-95"><FontAwesomeIcon icon={faPlus} /> Escrever E-mail</button>
            </div>

            <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                <div className="relative">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                <div className="p-3 bg-blue-50/50 text-xs font-bold text-blue-800 flex justify-between items-center tracking-wide border-b border-blue-100">
                    <span>MINHAS CONTAS</span>
                    <div className="flex gap-1">
                        <button onClick={handleForceSync} title="Forçar Atualização" className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-100"><FontAwesomeIcon icon={faSync} /></button>
                        <button onClick={onCreateFolder} title="Nova Pasta" className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-100"><FontAwesomeIcon icon={faPlus} /></button>
                        <button onClick={onConfig} title="Gerenciar Contas" className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-100"><FontAwesomeIcon icon={faCog} /></button>
                    </div>
                </div>

                {loadingAccounts ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2 text-blue-500" /><p className="text-xs">Sincronizando...</p></div>
                ) : accounts.length === 0 ? (
                    <div className="p-6 text-center text-gray-500"><p className="text-sm font-medium text-gray-700 mb-2">Nenhuma conta conectada</p><button onClick={onConfig} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md">Conectar Agora</button></div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {accounts.map(acc => (
                            <div key={acc.id} className="pb-2">
                                <div className="px-4 py-3 flex items-center gap-2 text-gray-800 font-bold text-xs uppercase bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                                    <FontAwesomeIcon icon={faUserCircle} className="text-gray-400" />
                                    <span className="truncate">{acc.conta_apelido || acc.email}</span>
                                </div>
                                <AccountFolderTree account={acc} selectedFolder={selectedFolder} onSelectFolder={onSelectFolder} expandedPaths={expandedPaths} toggleExpand={toggleExpand} onCreateFolder={onCreateFolder} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <EmailAutoSync intervalMinutes={1} />
        </div>
    );
}
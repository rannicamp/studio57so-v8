'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faEnvelope, faInbox, faPaperPlane, faTrash, faBan, 
    faFolder, faPlus, faCog, faSpinner, faExclamationTriangle, 
    faChevronRight, faChevronDown, faUserCircle, faEllipsisV, 
    faCheckDouble, faEraser
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';

// Chave para salvar no localStorage
const FOLDER_EXPANSION_KEY = 'email_expanded_folders_v1';

// --- MENU FLUTUANTE ---
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

// --- ÁRVORE DE PASTAS ---
const AccountFolderTree = ({ account, selectedFolder, onSelectFolder, expandedPaths, toggleExpand, onCreateFolder }) => {
    const queryClient = useQueryClient();
    const [menuState, setMenuState] = useState({ isOpen: false, position: null, folder: null });

    const { data: folderData, isLoading, isError } = useQuery({
        queryKey: ['emailFolders', account.id],
        queryFn: async () => {
            const res = await fetch(`/api/email/folders?accountId=${account.id}`);
            if (!res.ok) throw new Error('Erro ao buscar pastas');
            return res.json();
        },
        staleTime: 1000 * 60 * 2
    });

    const folderActionMutation = useMutation({
        mutationFn: async ({ action, folderPath }) => {
            const res = await fetch('/api/email/folders/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, folderPath, accountId: account.id })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro na ação');
            }
            return res.json();
        },
        onSuccess: (_, vars) => {
            const msg = { delete: 'Pasta excluída!', empty: 'Pasta esvaziada!', markAllRead: 'Tudo lido!' };
            toast.success(msg[vars.action]);
            queryClient.invalidateQueries(['emailFolders', account.id]);
            queryClient.invalidateQueries(['emailMessages']);
            setMenuState({ isOpen: false, position: null, folder: null });
        },
        onError: (err) => toast.error(err.message)
    });

    const openMenu = (e, folder) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuState({
            isOpen: true,
            folder: folder,
            position: { top: rect.bottom + 5, left: rect.left }
        });
    };

    const handleAction = (e, action, folderPath) => {
        setMenuState({ ...menuState, isOpen: false });
        if (action === 'delete' && !confirm('Excluir pasta permanentemente?')) return;
        if (action === 'empty' && !confirm('Apagar TODAS as mensagens desta pasta?')) return;
        folderActionMutation.mutate({ action, folderPath });
    };

    const processedFolders = useMemo(() => {
        if (!folderData?.folders) return [];
        const allFolders = folderData.folders;
        const childrenMap = {}; 
        const roots = [];       

        allFolders.forEach(folder => {
            if (folder.level === 0) roots.push(folder);
            else {
                const separator = folder.delimiter || '/';
                const lastIndex = folder.path.lastIndexOf(separator);
                const parentPath = lastIndex > -1 ? folder.path.substring(0, lastIndex) : '';
                if (!childrenMap[parentPath]) childrenMap[parentPath] = [];
                childrenMap[parentPath].push(folder);
            }
        });

        // Ordem fixa para pastas especiais
        const specialOrder = ['INBOX', 'ENTRADA', 'SENT', 'ENVIADOS', 'DRAFTS', 'RASCUNHOS', 'TRASH', 'LIXEIRA', 'JUNK', 'SPAM'];
        
        const sortList = (list) => list.sort((a, b) => {
            // Tenta achar a posição da pasta A e B na lista especial
            // Verificamos tanto o nome interno (name) quanto o visual (displayName)
            const getPriority = (f) => {
                const byName = specialOrder.findIndex(key => f.name.toUpperCase().includes(key));
                if (byName !== -1) return byName;
                return specialOrder.findIndex(key => f.displayName.toUpperCase().includes(key));
            };

            const indexA = getPriority(a);
            const indexB = getPriority(b);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            
            return a.displayName.localeCompare(b.displayName);
        });

        const flattenTree = (list) => {
            let result = [];
            const sortedList = sortList(list);
            sortedList.forEach(folder => {
                const children = childrenMap[folder.path] || [];
                const hasChildren = children.length > 0;
                result.push({ ...folder, hasChildren });
                // Usa a chave única composta (conta + path) para saber se expande
                if (hasChildren && expandedPaths.has(`${account.id}-${folder.path}`)) {
                    result = result.concat(flattenTree(children));
                }
            });
            return result;
        };
        return flattenTree(roots);
    }, [folderData, expandedPaths, account.id]);

    const getFolderIcon = (name) => {
        const n = name.toLowerCase();
        if (n.includes('inbox') || n.includes('entrada')) return faInbox;
        if (n.includes('sent') || n.includes('enviad')) return faPaperPlane;
        if (n.includes('trash') || n.includes('lixeira')) return faTrash;
        if (n.includes('spam') || n.includes('junk')) return faBan;
        return faFolder; 
    };

    if (isLoading) return <div className="py-2 px-6 text-xs text-gray-400 flex items-center gap-2"><FontAwesomeIcon icon={faSpinner} spin /> Carregando pastas...</div>;
    if (isError) return <div className="py-2 px-6 text-xs text-red-400 flex items-center gap-2"><FontAwesomeIcon icon={faExclamationTriangle} /> Erro de conexão</div>;

    return (
        <>
            <div className="pb-2">
                {processedFolders.map((folder) => {
                    const uniqueKey = `${account.id}-${folder.path}`;
                    const isExpanded = expandedPaths.has(uniqueKey);
                    const isSelected = selectedFolder?.path === folder.path && selectedFolder?.accountId === account.id;
                    
                    return (
                        <div 
                            key={uniqueKey}
                            className={`
                                w-full text-left hover:bg-gray-50 flex items-center text-sm transition-colors cursor-pointer group select-none relative
                                ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                            `}
                            onClick={() => onSelectFolder({ ...folder, accountId: account.id })}
                            style={{ paddingLeft: `${16 + (folder.level * 16)}px`, paddingRight: '12px' }} 
                        >
                            {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>}
                            
                            <div 
                                className="h-9 w-6 flex items-center justify-center shrink-0 hover:text-blue-600 text-gray-400 mr-1"
                                onClick={(e) => { e.stopPropagation(); if(folder.hasChildren) toggleExpand(uniqueKey); }}
                            >
                                {folder.hasChildren && <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} className="text-[10px]" />}
                            </div>
                            
                            <div className="flex items-center gap-3 flex-grow py-2.5 overflow-hidden pr-2">
                                <FontAwesomeIcon icon={getFolderIcon(folder.name)} className={`${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                                <span className="truncate flex-grow">{folder.displayName || folder.name}</span>
                                
                                {/* CONTADOR DE NÃO LIDOS */}
                                {folder.unseen > 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'} ${folder.displayName === 'Caixa de Entrada' ? 'bg-red-500 text-white' : ''}`}>
                                        {folder.unseen}
                                    </span>
                                )}

                                {/* BOTÃO 3 PONTINHOS */}
                                <button 
                                    onClick={(e) => openMenu(e, folder)}
                                    className="w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            {menuState.isOpen && (
                <FolderContextMenu 
                    position={menuState.position} 
                    folder={menuState.folder} 
                    onClose={() => setMenuState({ isOpen: false, position: null, folder: null })}
                    onAction={handleAction}
                    isSystemFolder={['INBOX', 'SENT', 'TRASH', 'JUNK', 'SPAM', 'DRAFTS'].some(s => menuState.folder.name.toUpperCase().includes(s))}
                />
            )}
        </>
    );
};

export default function EmailSidebar({ 
    selectedFolder, onSelectFolder, onCompose, onConfig, onChangeTab, 
    searchTerm, onSearchChange, onCreateFolder, canViewWhatsapp = true, className = '' 
}) {
    // --- LÓGICA DE PERSISTÊNCIA DAS PASTAS ---
    const [expandedPaths, setExpandedPaths] = useState(new Set());
    const [isHydrated, setIsHydrated] = useState(false);

    // 1. Carregar do LocalStorage ao iniciar
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(FOLDER_EXPANSION_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Converte array de volta para Set
                    setExpandedPaths(new Set(parsed));
                } catch (e) { console.error("Erro ao ler expansão de pastas", e); }
            }
            setIsHydrated(true);
        }
    }, []);

    // 2. Salvar no LocalStorage sempre que mudar
    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            // Converte Set para Array para salvar em JSON
            localStorage.setItem(FOLDER_EXPANSION_KEY, JSON.stringify(Array.from(expandedPaths)));
        }
    }, [expandedPaths, isHydrated]);

    const toggleExpand = (uniqueKey) => {
        const newSet = new Set(expandedPaths);
        if (newSet.has(uniqueKey)) newSet.delete(uniqueKey);
        else newSet.add(uniqueKey);
        setExpandedPaths(newSet);
    };
    // ----------------------------------------

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
            {/* Abas Superiores */}
            <div className="flex border-b bg-gray-50 shrink-0">
                {canViewWhatsapp && (
                    <button onClick={() => onChangeTab('whatsapp')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                    </button>
                )}
                <button className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-blue-600 text-blue-600 bg-white">
                    <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                </button>
            </div>

            {/* Botão Escrever */}
            <div className="p-4 pb-0">
                <button onClick={onCompose} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-transform active:scale-95">
                    <FontAwesomeIcon icon={faPlus} /> Escrever E-mail
                </button>
            </div>

            {/* Busca */}
            <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                <div className="relative">
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                </div>
            </div>

            {/* Lista de Contas e Pastas */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                <div className="p-3 bg-blue-50/50 text-xs font-bold text-blue-800 flex justify-between items-center tracking-wide border-b border-blue-100">
                    <span>MINHAS CONTAS</span>
                    <div className="flex gap-1">
                        <button onClick={onCreateFolder} title="Nova Pasta" className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-100"><FontAwesomeIcon icon={faPlus} /></button>
                        <button onClick={onConfig} title="Gerenciar Contas" className="hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-100"><FontAwesomeIcon icon={faCog} /></button>
                    </div>
                </div>

                {loadingAccounts ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2 text-blue-500" />
                        <p className="text-xs">Carregando contas...</p>
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                        <p className="text-sm font-medium text-gray-700 mb-2">Nenhuma conta conectada</p>
                        <button onClick={onConfig} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md">Conectar Agora</button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {accounts.map(acc => (
                            <div key={acc.id} className="pb-2">
                                <div className="px-4 py-3 flex items-center gap-2 text-gray-800 font-bold text-xs uppercase bg-gray-50/50 sticky top-0 z-10 backdrop-blur-sm">
                                    <FontAwesomeIcon icon={faUserCircle} className="text-gray-400" />
                                    <span className="truncate">{acc.conta_apelido || acc.email}</span>
                                </div>
                                <AccountFolderTree 
                                    account={acc}
                                    selectedFolder={selectedFolder}
                                    onSelectFolder={onSelectFolder}
                                    expandedPaths={expandedPaths}
                                    toggleExpand={toggleExpand}
                                    onCreateFolder={onCreateFolder}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
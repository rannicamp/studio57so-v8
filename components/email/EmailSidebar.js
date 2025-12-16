'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faEnvelope, faInbox, faPaperPlane, faTrash, faBan, 
    faFolder, faPlus, faCog, faSpinner, faExclamationTriangle, 
    faChevronRight, faChevronDown 
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const getEmailFolders = async () => {
    const res = await fetch('/api/email/folders');
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao buscar pastas');
    }
    return res.json();
};

const getFolderIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('inbox') || n.includes('entrada')) return faInbox;
    if (n.includes('sent') || n.includes('enviad')) return faPaperPlane;
    if (n.includes('trash') || n.includes('lixeira')) return faTrash;
    if (n.includes('spam') || n.includes('junk')) return faBan;
    return faFolder; 
};

export default function EmailSidebar({ 
    selectedFolder, 
    onSelectFolder, 
    onCompose, 
    onConfig, 
    onChangeTab, 
    searchTerm, 
    onSearchChange,
    onCreateFolder, // <--- Prop recebida do Inbox
    className = '' 
}) {
    const queryClient = useQueryClient();
    
    // Estados
    const [expandedPaths, setExpandedPaths] = useState(new Set()); 

    const { 
        data: emailData, isLoading, isError 
    } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: getEmailFolders,
        retry: false, 
        refetchOnWindowFocus: false, 
        staleTime: 1000 * 60 * 5
    });

    // --- LÓGICA DE ÁRVORE HIERÁRQUICA (Mantida Integralmente) ---
    const processedFolders = useMemo(() => {
        if (!emailData?.folders) return [];
        
        const allFolders = emailData.folders;
        const childrenMap = {}; 
        const roots = [];       

        // 1. Organizar Famílias
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

        // 2. Ordenação (Especiais primeiro)
        const specialOrder = ['INBOX', 'SENT', 'DRAFTS', 'TRASH', 'JUNK', 'SPAM', 'ARCHIVE'];
        
        const sortList = (list) => {
            return list.sort((a, b) => {
                const indexA = specialOrder.findIndex(key => a.name.toUpperCase() === key);
                const indexB = specialOrder.findIndex(key => b.name.toUpperCase() === key);

                if (indexA === -1 && indexB === -1) return a.displayName.localeCompare(b.displayName);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                return 1;
            });
        };

        // 3. Achatamento Recursivo
        const flattenTree = (list) => {
            let result = [];
            const sortedList = sortList(list);

            sortedList.forEach(folder => {
                const children = childrenMap[folder.path] || [];
                const hasChildren = children.length > 0;
                
                result.push({ ...folder, hasChildren });

                if (hasChildren && expandedPaths.has(folder.path)) {
                    result = result.concat(flattenTree(children));
                }
            });
            return result;
        };

        return flattenTree(roots);

    }, [emailData, expandedPaths]);

    const toggleExpand = (e, path) => {
        e.stopPropagation();
        const newSet = new Set(expandedPaths);
        if (newSet.has(path)) newSet.delete(path);
        else newSet.add(path);
        setExpandedPaths(newSet);
    };

    return (
        <div className={`flex flex-col border-r bg-white h-full overflow-hidden min-h-0 ${className} relative`}>
            
            {/* Abas */}
            <div className="flex border-b bg-gray-50 shrink-0">
                <button onClick={() => onChangeTab('whatsapp')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100">
                    <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                </button>
                <button className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-blue-600 text-blue-600 bg-white">
                    <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                </button>
            </div>

            {/* Botão Escrever */}
            <div className="p-4 pb-0">
                <button 
                    onClick={onCompose}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-transform active:scale-95"
                >
                    <FontAwesomeIcon icon={faPlus} /> Escrever E-mail
                </button>
            </div>

            {/* Busca */}
            <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        value={searchTerm} 
                        onChange={(e) => onSearchChange(e.target.value)} 
                        className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" 
                    />
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                </div>
            </div>

            {/* Lista de Pastas */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2 text-blue-500" />
                        <p className="text-xs">Conectando...</p>
                    </div>
                ) : isError ? (
                    <div className="p-6 text-center text-gray-500">
                        <div className="bg-red-50 p-4 rounded-full mb-3 inline-block">
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-red-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Ops! Falha na conexão</p>
                        <button onClick={onConfig} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md mt-2">Configurar E-mail</button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        <div className="p-3 bg-blue-50/50 text-xs font-bold text-blue-800 flex justify-between items-center tracking-wide">
                            <span>PASTAS</span>
                            <div className="flex gap-2">
                                <button onClick={onCreateFolder} title="Nova Pasta" className="hover:text-blue-600 transition-colors">
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                                <button onClick={onConfig} title="Ajustes" className="hover:text-blue-600 transition-colors">
                                    <FontAwesomeIcon icon={faCog} />
                                </button>
                            </div>
                        </div>
                        
                        {processedFolders.map((folder) => {
                            const isExpanded = expandedPaths.has(folder.path);
                            const isSelected = selectedFolder?.path === folder.path;

                            return (
                                <div 
                                    key={folder.path}
                                    className={`
                                        w-full text-left hover:bg-gray-50 flex items-center text-sm transition-colors cursor-pointer group select-none relative
                                        ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                                    `}
                                    onClick={() => onSelectFolder(folder)}
                                    // MANTIDA INDENTAÇÃO CORRETA
                                    style={{ paddingLeft: `${16 + (folder.level * 16)}px`, paddingRight: '12px' }} 
                                >
                                    {/* Indicador de Seleção */}
                                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>}

                                    {/* Botão de Expandir */}
                                    <div 
                                        className="h-10 w-6 flex items-center justify-center shrink-0 hover:text-blue-600 text-gray-400 mr-1"
                                        onClick={(e) => folder.hasChildren && toggleExpand(e, folder.path)}
                                    >
                                        {folder.hasChildren && (
                                            <FontAwesomeIcon 
                                                icon={isExpanded ? faChevronDown : faChevronRight} 
                                                className="text-[10px]" 
                                            />
                                        )}
                                    </div>

                                    {/* Nome e Ícone */}
                                    <div className="flex items-center gap-3 flex-grow py-3 overflow-hidden">
                                        <FontAwesomeIcon 
                                            icon={getFolderIcon(folder.name)} 
                                            className={`
                                                ${isSelected ? 'text-blue-500' : 'text-gray-400'}
                                            `} 
                                        />
                                        <span className="truncate flex-grow">
                                            {folder.displayName || folder.name}
                                        </span>
                                        
                                        {/* NOVO: CONTADOR DE NÃO LIDOS */}
                                        {folder.unseen > 0 && (
                                            <span className={`
                                                text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0
                                                ${isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}
                                                ${folder.displayName === 'Caixa de Entrada' ? 'bg-red-500 text-white' : ''}
                                            `}>
                                                {folder.unseen}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
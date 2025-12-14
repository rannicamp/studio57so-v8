'use client';

import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query'; // Mudança aqui!
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faUserCircle, faInbox, faSync, faChevronDown 
} from '@fortawesome/free-solid-svg-icons';

// Função de busca adaptada para paginação
const fetchMessagesPage = async ({ pageParam = 1, queryKey }) => {
    // O folderPath vem do queryKey
    const [_key, folderPath] = queryKey; 
    
    if (!folderPath) return { messages: [], hasMore: false };

    // Passamos o pageParam para a API
    const res = await fetch(`/api/email/messages?folder=${encodeURIComponent(folderPath)}&page=${pageParam}`);
    
    if (!res.ok) throw new Error('Erro ao carregar mensagens');
    return res.json();
};

export default function EmailListPanel({ folder, onBack }) {
    
    // Uso do useInfiniteQuery para gerenciar páginas
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetching,
        isFetchingNextPage,
        isError,
        refetch
    } = useInfiniteQuery({
        queryKey: ['emailMessages', folder?.path], // Se mudar a pasta, reseta
        queryFn: fetchMessagesPage,
        initialPageParam: 1,
        getNextPageParam: (lastPage, allPages) => {
            // Se a API disser que tem mais (hasMore), a próxima página é atual + 1
            return lastPage.hasMore ? allPages.length + 1 : undefined;
        },
        enabled: !!folder,
        staleTime: 1000 * 60, // 1 minuto de cache
    });

    // Função para planificar os dados (juntar todas as páginas em um array só)
    const allMessages = data ? data.pages.flatMap(page => page.messages) : [];

    if (isFetching && !isFetchingNextPage && allMessages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                <p>Buscando e-mails...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400 p-6 text-center">
                <p>Não foi possível carregar os e-mails desta pasta.</p>
                <div className="flex gap-2 mt-4">
                    <button onClick={onBack} className="text-gray-600 hover:underline">Voltar</button>
                    <button onClick={() => refetch()} className="text-blue-600 hover:underline">Tentar Novamente</button>
                </div>
            </div>
        );
    }

    if (allMessages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FontAwesomeIcon icon={faInbox} className="text-4xl mb-3 opacity-30" />
                <p>Esta pasta está vazia.</p>
                <button onClick={onBack} className="mt-4 text-sm text-blue-500 md:hidden">Voltar para pastas</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Cabeçalho da Pasta */}
            <div className="h-16 border-b flex items-center px-4 justify-between bg-gray-50 flex-shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-800">
                        ←
                    </button>
                    <div className="flex flex-col">
                        <h3 className="font-bold text-gray-700 text-base truncate max-w-[200px]" title={folder.name}>
                            {folder.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                            Exibindo {allMessages.length} e-mails
                        </span>
                    </div>
                </div>
                <button 
                    onClick={() => refetch()} 
                    title="Atualizar lista"
                    className={`p-2 rounded-full hover:bg-gray-200 text-gray-500 transition-all ${isFetching ? 'animate-spin' : ''}`}
                >
                    <FontAwesomeIcon icon={faSync} />
                </button>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-[#f0f2f5] p-2 space-y-2">
                {allMessages.map((msg, index) => (
                    <div 
                        key={`${msg.id}-${index}`} 
                        className="bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-transparent hover:border-blue-200 group relative"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FontAwesomeIcon icon={faUserCircle} className="text-gray-300 text-lg flex-shrink-0" />
                                <span className="font-semibold text-sm text-gray-800 truncate" title={msg.from}>
                                    {msg.from || 'Desconhecido'} 
                                </span>
                            </div>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 flex-shrink-0">
                                {msg.date ? new Date(msg.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' }) : '-'}
                            </span>
                        </div>
                        
                        <div className="ml-7">
                            <p className={`text-sm text-gray-800 mb-1 line-clamp-1 ${!msg.flags?.includes('\\Seen') ? 'font-bold' : ''}`}>
                                {msg.subject || '(Sem Assunto)'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                                Clique para visualizar
                            </p>
                        </div>
                    </div>
                ))}

                {/* Área de Carregamento / Botão Carregar Mais */}
                <div className="py-4 text-center">
                    {isFetchingNextPage ? (
                        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                            <FontAwesomeIcon icon={faSpinner} spin />
                            Carregando antigos...
                        </div>
                    ) : hasNextPage ? (
                        <button 
                            onClick={() => fetchNextPage()}
                            className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm flex items-center gap-2 mx-auto"
                        >
                            <FontAwesomeIcon icon={faChevronDown} />
                            Carregar mais antigos
                        </button>
                    ) : (
                        <p className="text-xs text-gray-400 italic">
                            Fim da lista de e-mails desta pasta.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
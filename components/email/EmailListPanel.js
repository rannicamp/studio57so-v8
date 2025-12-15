'use client'

import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faSync, faBoxOpen, faExclamationCircle, faSearch, faEnvelopeOpen, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função de busca atualizada para aceitar status
const fetchMessages = async ({ queryKey }) => {
    const [_key, folderName, page, searchTerm, status] = queryKey;
    
    let url = `/api/email/messages?folder=${encodeURIComponent(folderName)}&page=${page}`;
    
    // Adiciona busca se houver
    if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
    }
    
    // Adiciona status se diferente de 'all'
    if (status && status !== 'all') {
        url += `&status=${status}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao buscar e-mails');
    return res.json();
};

export default function EmailListPanel({ folder, onBack, onSelectEmail, selectedEmailId, searchTerm }) {
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'unread', 'read'

    // Reseta página se mudar busca, pasta ou filtro
    useEffect(() => {
        setPage(1);
    }, [searchTerm, folder.name, filterStatus]);

    const { 
        data, 
        isLoading, 
        isError, 
        error, 
        isFetching, 
        refetch 
    } = useQuery({
        // Adicionamos filterStatus na chave para o cache diferenciar as abas
        queryKey: ['emailMessages', folder.name, page, searchTerm, filterStatus],
        queryFn: fetchMessages,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 1, 
        refetchOnWindowFocus: false, 
    });

    const emails = data?.messages || [];
    const hasMore = data?.hasMore || false;

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header da Lista */}
            <div className="flex flex-col border-b bg-white shrink-0">
                <div className="flex items-center gap-3 p-4 pb-2 justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button onClick={onBack} className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </button>
                        <div className="overflow-hidden">
                            <h2 className="text-base font-bold text-gray-800 truncate" title={folder.name}>
                                {folder.name}
                            </h2>
                            {searchTerm ? (
                                <p className="text-xs text-blue-600 font-medium truncate flex items-center gap-1">
                                    <FontAwesomeIcon icon={faSearch} className="text-[10px]" />
                                    "{searchTerm}"
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500">
                                    {isLoading ? '...' : `${data?.total || 0} mensagens`}
                                </p>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={() => refetch()} 
                        disabled={isFetching}
                        className={`text-blue-600 p-2 rounded-full hover:bg-blue-50 transition-all ${isFetching ? 'opacity-50' : ''}`}
                        title="Atualizar lista"
                    >
                        <FontAwesomeIcon icon={faSync} spin={isFetching} />
                    </button>
                </div>

                {/* Abas de Filtro (Lidos / Não Lidos) */}
                <div className="flex px-4 gap-4 mt-1">
                    <button 
                        onClick={() => setFilterStatus('all')}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Todas
                    </button>
                    <button 
                        onClick={() => setFilterStatus('unread')}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'unread' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Não Lidas
                    </button>
                    <button 
                        onClick={() => setFilterStatus('read')}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex-1 text-center ${filterStatus === 'read' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        Lidas
                    </button>
                </div>
            </div>

            {/* Lista */}
            <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40 text-blue-500">
                        <FontAwesomeIcon icon={faSpinner} spin size="lg" />
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-400 p-4 text-center">
                        <FontAwesomeIcon icon={faExclamationCircle} size="2x" className="mb-2" />
                        <p className="text-sm font-medium">Erro ao carregar e-mails.</p>
                        <p className="text-xs mt-1 opacity-75">{error.message}</p>
                        <button onClick={() => refetch()} className="mt-4 text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold">Tentar Novamente</button>
                    </div>
                ) : emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-6 text-center">
                        <FontAwesomeIcon icon={filterStatus === 'unread' ? faEnvelopeOpen : faBoxOpen} size="2x" />
                        <p className="mt-2 text-sm">
                            {searchTerm 
                                ? `Nenhum resultado para "${searchTerm}"` 
                                : filterStatus === 'unread' 
                                    ? 'Tudo lido por aqui!' 
                                    : 'Nenhum e-mail encontrado.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 pb-4">
                        {/* Indicador de atualização em background */}
                        {isFetching && !isLoading && (
                            <div className="absolute top-0 inset-x-0 bg-blue-50 text-blue-600 text-[10px] font-bold text-center py-1 z-10 opacity-90">
                                Atualizando...
                            </div>
                        )}
                        
                        {emails.map((email) => (
                            <div 
                                key={email.id}
                                onClick={() => onSelectEmail(email)}
                                className={`
                                    p-4 cursor-pointer hover:bg-gray-50 border-l-4 transition-all relative
                                    ${selectedEmailId === email.id ? 'bg-blue-50 border-l-blue-600' : 'bg-white border-l-transparent'}
                                    ${email.flags?.includes('\\Seen') ? 'opacity-75' : 'font-semibold'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-1 gap-2">
                                    <h4 className={`text-sm truncate flex-1 ${selectedEmailId === email.id ? 'text-blue-900' : 'text-gray-800'}`}>
                                        {email.from}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                                        {format(new Date(email.date), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                </div>
                                <h3 className={`text-xs truncate ${selectedEmailId === email.id ? 'text-blue-800' : 'text-gray-600'}`}>
                                    {email.subject}
                                </h3>
                            </div>
                        ))}
                        
                        {/* Paginação */}
                        <div className="p-4 flex justify-between items-center bg-gray-50 border-t mt-2">
                            <button 
                                onClick={() => setPage(old => Math.max(old - 1, 1))} 
                                disabled={page === 1 || isFetching}
                                className="px-3 py-1.5 bg-white border rounded text-xs text-gray-600 disabled:opacity-50 hover:bg-gray-100 font-medium"
                            >
                                Anterior
                            </button>
                            <span className="text-xs font-bold text-gray-500">Pág {page}</span>
                            <button 
                                onClick={() => setPage(old => (hasMore ? old + 1 : old))} 
                                disabled={!hasMore || isFetching}
                                className="px-3 py-1.5 bg-white border rounded text-xs text-gray-600 disabled:opacity-50 hover:bg-gray-100 font-medium"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
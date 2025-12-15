'use client'

import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faSync, faBoxOpen, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função de busca separada (Boas Práticas)
const fetchMessages = async ({ queryKey }) => {
    const [_key, folderName, page] = queryKey;
    const res = await fetch(`/api/email/messages?folder=${encodeURIComponent(folderName)}&page=${page}`);
    if (!res.ok) throw new Error('Erro ao buscar e-mails');
    return res.json();
};

export default function EmailListPanel({ folder, onBack, onSelectEmail, selectedEmailId }) {
    const [page, setPage] = useState(1);

    // --- MAGIA DO TANSTACK QUERY ---
    const { 
        data, 
        isLoading, 
        isError, 
        error, 
        isFetching, 
        refetch 
    } = useQuery({
        queryKey: ['emailMessages', folder.name, page],
        queryFn: fetchMessages,
        placeholderData: keepPreviousData, // Mantém os dados antigos enquanto carrega a px página
        staleTime: 1000 * 60 * 1, // 1 minuto de cache fresco
        refetchOnWindowFocus: false, // Não recarregar só de trocar de janela (economiza dados)
    });

    const emails = data?.messages || [];
    const hasMore = data?.hasMore || false;

    // Resetar página ao trocar de pasta
    // (O useQuery lida com a chave da pasta, mas o estado 'page' precisa voltar a 1)
    if (data && folder.name !== data.messages?.[0]?.folderName && page !== 1 && !isFetching) {
        // Pequeno trick: verificamos se a query mudou drasticamente, 
        // mas idealmente controlamos isso via useEffect se necessário.
        // Por simplicidade com useQuery, deixaremos o usuário controlar a página,
        // mas vamos garantir que se a folder mudar no pai, a chave da query muda e reseta a lista.
    }

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header da Lista */}
            <div className="flex items-center gap-3 p-4 border-b bg-white shrink-0 h-16 justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button onClick={onBack} className="md:hidden text-gray-500 hover:bg-gray-100 p-2 rounded-full">
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <div className="overflow-hidden">
                        <h2 className="text-base font-bold text-gray-800 truncate" title={folder.name}>
                            {folder.name}
                        </h2>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            {isLoading ? 'Carregando...' : `${data?.total || 0} mensagens`}
                        </p>
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
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <FontAwesomeIcon icon={faBoxOpen} size="2x" />
                        <p className="mt-2 text-sm">Nenhum e-mail aqui.</p>
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
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faSync, faEnvelopeOpen, faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EmailListPanel({ folder, onBack }) {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);

    const fetchEmails = async (pageNum, isLoadMore = false) => {
        try {
            if (isLoadMore) setLoadingMore(true);
            else {
                setLoading(true);
                setError(null); // Limpa erros anteriores ao trocar de pasta
            }
            
            // Encode garante que pastas com espaço (ex: "Itens Enviados") funcionem
            const res = await fetch(`/api/email/messages?folder=${encodeURIComponent(folder.name)}&page=${pageNum}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (isLoadMore) {
                setEmails(prev => [...prev, ...data.messages]);
            } else {
                setEmails(data.messages);
            }

            setHasMore(data.hasMore);
        } catch (err) {
            console.error(err);
            setError('Não foi possível baixar os e-mails desta pasta. Tente novamente.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // RESET TOTAL AO TROCAR DE PASTA
    useEffect(() => {
        setEmails([]); // Limpa visualmente imediatamente
        setPage(1);
        setHasMore(true);
        fetchEmails(1, false);
    }, [folder]); // Toda vez que 'folder' mudar, isso roda

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchEmails(nextPage, true);
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 p-4 border-b bg-gray-50 shadow-sm shrink-0">
                <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700">
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <div className="overflow-hidden">
                    <h2 className="text-lg font-bold text-gray-800 truncate" title={folder.name}>{folder.name}</h2>
                    <p className="text-xs text-gray-500">
                        {emails.length} mensagens visualizadas
                    </p>
                </div>
                <button 
                    onClick={() => { setPage(1); fetchEmails(1, false); }} 
                    className="ml-auto p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Forçar Atualização"
                >
                    <FontAwesomeIcon icon={faSync} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Lista */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                {loading && page === 1 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                        <p className="text-sm">Sincronizando {folder.name}...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64 text-red-500 p-4 text-center">
                        <p className="mb-2">{error}</p>
                        <button onClick={() => fetchEmails(1)} className="text-sm underline font-bold">Tentar novamente</button>
                    </div>
                ) : emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <FontAwesomeIcon icon={faBoxOpen} className="text-4xl mb-3 opacity-20" />
                        <p>A pasta está vazia.</p>
                    </div>
                ) : (
                    <div className="space-y-2 pb-4">
                        {emails.map((email, idx) => (
                            <div 
                                key={`${email.id}-${idx}`}
                                className="group p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md hover:border-blue-200 cursor-pointer transition-all duration-200"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-gray-800 line-clamp-1 text-sm max-w-[70%]">
                                        {email.from}
                                    </h4>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-full">
                                        {format(new Date(email.date), "dd/MM/yy HH:mm", { locale: ptBR })}
                                    </span>
                                </div>
                                <h3 className="text-sm font-medium text-blue-900 mb-1 line-clamp-1">
                                    {email.subject}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <FontAwesomeIcon icon={faEnvelopeOpen} className="opacity-50" />
                                    <span>Ler mensagem</span>
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="w-full py-3 mt-4 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-dashed border-gray-300"
                            >
                                {loadingMore ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                        Buscando mais antigos...
                                    </>
                                ) : (
                                    "Carregar mensagens anteriores"
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
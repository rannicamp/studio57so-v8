import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSpinner, faSync, faBoxOpen } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EmailListPanel({ folder, onBack, onSelectEmail, selectedEmailId }) {
    const [emails, setEmails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchEmails = async (pageNum, isLoadMore = false) => {
        try {
            if (isLoadMore) setLoadingMore(true);
            else setLoading(true);
            
            const res = await fetch(`/api/email/messages?folder=${encodeURIComponent(folder.name)}&page=${pageNum}`);
            const data = await res.json();

            if (!data.error) {
                if (isLoadMore) setEmails(prev => [...prev, ...data.messages]);
                else setEmails(data.messages);
                setHasMore(data.hasMore);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        setEmails([]); setPage(1); setHasMore(true);
        fetchEmails(1, false);
    }, [folder]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Header da Lista */}
            <div className="flex items-center gap-3 p-4 border-b bg-white shrink-0 h-16">
                <button onClick={onBack} className="md:hidden text-gray-500"><FontAwesomeIcon icon={faArrowLeft} /></button>
                <div className="overflow-hidden">
                    <h2 className="text-base font-bold text-gray-800 truncate">{folder.name}</h2>
                    <p className="text-xs text-gray-500">{emails.length} mensagens</p>
                </div>
                <button onClick={() => { setPage(1); fetchEmails(1); }} className="ml-auto text-blue-600 p-2"><FontAwesomeIcon icon={faSync} /></button>
            </div>

            {/* Lista */}
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {loading && page === 1 ? (
                    <div className="flex justify-center items-center h-40 text-blue-500"><FontAwesomeIcon icon={faSpinner} spin size="lg" /></div>
                ) : emails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400"><FontAwesomeIcon icon={faBoxOpen} size="2x" /><p className="mt-2 text-sm">Vazio</p></div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {emails.map((email) => (
                            <div 
                                key={email.id}
                                onClick={() => onSelectEmail(email)}
                                className={`p-4 cursor-pointer hover:bg-gray-50 border-l-4 transition-all ${selectedEmailId === email.id ? 'bg-blue-50 border-l-blue-600' : 'bg-white border-l-transparent'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm font-semibold truncate max-w-[70%] ${selectedEmailId === email.id ? 'text-blue-900' : 'text-gray-800'}`}>{email.from}</h4>
                                    <span className="text-[10px] text-gray-400">{format(new Date(email.date), "dd/MM", { locale: ptBR })}</span>
                                </div>
                                <h3 className={`text-xs font-medium truncate ${selectedEmailId === email.id ? 'text-blue-800' : 'text-gray-600'}`}>{email.subject}</h3>
                            </div>
                        ))}
                        {hasMore && (
                            <button onClick={() => { setPage(p => p + 1); fetchEmails(page + 1, true); }} disabled={loadingMore} className="w-full py-3 text-xs text-blue-600 font-medium">
                                {loadingMore ? 'Carregando...' : 'Carregar mais antigos'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
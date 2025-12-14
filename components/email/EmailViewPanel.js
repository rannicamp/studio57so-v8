import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faReply, faPaperclip, faTimes } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function EmailViewPanel({ emailSummary, folder, onClose }) {
    const [fullEmail, setFullEmail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!emailSummary?.id) return;
        const fetchContent = async () => {
            setLoading(true);
            setFullEmail(null);
            try {
                const res = await fetch(`/api/email/content?folder=${encodeURIComponent(folder.name)}&uid=${emailSummary.id}`);
                const data = await res.json();
                if (!data.error) setFullEmail(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [emailSummary, folder]);

    if (!emailSummary) return null;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 w-full">
            {/* Header do E-mail */}
            <div className="p-5 border-b bg-gray-50 flex justify-between items-start shrink-0">
                <div className="flex-1 overflow-hidden">
                    <h2 className="text-lg font-bold text-gray-800 break-words mb-2">{emailSummary.subject}</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <FontAwesomeIcon icon={faUserCircle} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900 truncate">{emailSummary.from}</p>
                            <p className="text-xs text-gray-500">
                                {format(new Date(emailSummary.date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                            </p>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="lg:hidden text-gray-400 p-2"><FontAwesomeIcon icon={faTimes} /></button>
            </div>

            {/* Corpo do E-mail */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-white">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2 text-blue-500" />
                        <p className="text-sm">Carregando conteúdo...</p>
                    </div>
                ) : fullEmail ? (
                    <div className="prose max-w-none text-sm text-gray-800">
                        {fullEmail.html ? (
                            <div dangerouslySetInnerHTML={{ __html: fullEmail.html }} />
                        ) : (
                            <pre className="whitespace-pre-wrap font-sans">{fullEmail.text}</pre>
                        )}
                        {/* Anexos */}
                        {fullEmail.attachments?.length > 0 && (
                            <div className="mt-8 pt-4 border-t">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPaperclip} /> Anexos
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {fullEmail.attachments.map((att, i) => (
                                        <div key={i} className="px-3 py-2 bg-gray-100 rounded text-xs border truncate max-w-[200px]">
                                            {att.filename}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-red-500 mt-10">Erro ao carregar mensagem.</div>
                )}
            </div>
        </div>
    );
}
'use client'

import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPaperclip, faTimes, faFileAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'isomorphic-dompurify'; // Segurança

// Função de busca
const fetchEmailContent = async ({ queryKey }) => {
    const [_key, folderName, uid] = queryKey;
    if (!uid) return null;
    const res = await fetch(`/api/email/content?folder=${encodeURIComponent(folderName)}&uid=${uid}`);
    if (!res.ok) throw new Error('Erro ao carregar conteúdo');
    return res.json();
};

export default function EmailViewPanel({ emailSummary, folder, onClose }) {
    
    // --- QUERY ---
    const { 
        data: fullEmail, 
        isLoading, 
        isError 
    } = useQuery({
        queryKey: ['emailContent', folder?.name, emailSummary?.id],
        queryFn: fetchEmailContent,
        enabled: !!emailSummary?.id && !!folder?.name,
        staleTime: 1000 * 60 * 30, // Cache de 30 min (conteúdo de email não muda)
        refetchOnWindowFocus: false,
    });

    if (!emailSummary) return null;

    // Sanitização de Segurança (Impede XSS)
    const safeHtml = fullEmail?.html ? DOMPurify.sanitize(fullEmail.html, {
        USE_PROFILES: { html: true }, // Permite formatação segura
        ADD_ATTR: ['target'], // Permite links abrirem em nova aba
    }) : null;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 w-full relative">
            {/* Header do E-mail */}
            <div className="p-5 border-b bg-gray-50 flex justify-between items-start shrink-0">
                <div className="flex-1 overflow-hidden mr-4">
                    <h2 className="text-lg font-bold text-gray-800 break-words mb-3 leading-snug">
                        {emailSummary.subject}
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <FontAwesomeIcon icon={faUserCircle} className="text-xl" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                                {emailSummary.from}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                {format(new Date(emailSummary.date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                {fullEmail?.to && <span className="hidden sm:inline text-gray-400">para {fullEmail.to}</span>}
                            </p>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-lg transition-colors">
                    <FontAwesomeIcon icon={faTimes} className="text-lg" />
                </button>
            </div>

            {/* Corpo do E-mail */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-white relative">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                        <p className="text-sm animate-pulse">Baixando conteúdo...</p>
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center h-full text-red-500">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2 opacity-50" />
                        <p>Não foi possível carregar a mensagem.</p>
                    </div>
                ) : fullEmail ? (
                    <div className="animate-fade-in">
                        <div className="prose prose-sm max-w-none text-gray-800 break-words font-sans">
                            {safeHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                            ) : (
                                <pre className="whitespace-pre-wrap font-sans text-gray-700">{fullEmail.text}</pre>
                            )}
                        </div>

                        {/* Área de Anexos Melhorada */}
                        {fullEmail.attachments?.length > 0 && (
                            <div className="mt-10 pt-6 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPaperclip} /> 
                                    {fullEmail.attachments.length} Anexos
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fullEmail.attachments.map((att, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-100 transition-colors group cursor-pointer" title="Visualizar não implementado ainda">
                                            <div className="bg-white p-2 rounded border border-gray-200 text-blue-500">
                                                <FontAwesomeIcon icon={faFileAlt} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">
                                                    {att.filename || 'Sem nome'}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {att.size ? (att.size / 1024).toFixed(0) + ' KB' : 'Anexo'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
'use client'

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUserCircle, faPaperclip, faTimes, faFileAlt, faExclamationTriangle, faDownload, faReply, faReplyAll, faShare } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'isomorphic-dompurify';
import EmailComposeModal from './EmailComposeModal'; // <--- Importar Modal

// Função de busca
const fetchEmailContent = async ({ queryKey }) => {
    const [_key, folderName, uid] = queryKey;
    if (!uid) return null;
    const res = await fetch(`/api/email/content?folder=${encodeURIComponent(folderName)}&uid=${uid}`);
    if (!res.ok) throw new Error('Erro ao carregar conteúdo');
    return res.json();
};

const performEmailAction = async ({ action, folder, uid }) => {
    const res = await fetch('/api/email/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, folder, uid })
    });
    if (!res.ok) throw new Error('Falha na ação');
    return res.json();
};

export default function EmailViewPanel({ emailSummary, folder, onClose }) {
    const queryClient = useQueryClient();
    
    // Controle do Modal de Composição
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState(null);

    const { 
        data: fullEmail, 
        isLoading, 
        isError 
    } = useQuery({
        queryKey: ['emailContent', folder?.name, emailSummary?.id],
        queryFn: fetchEmailContent,
        enabled: !!emailSummary?.id && !!folder?.name,
        staleTime: 1000 * 60 * 30, 
        refetchOnWindowFocus: false,
    });

    const markReadMutation = useMutation({
        mutationFn: performEmailAction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
        }
    });

    useEffect(() => {
        if (fullEmail && !emailSummary?.flags?.includes('\\Seen')) {
            const timer = setTimeout(() => {
                markReadMutation.mutate({ 
                    action: 'markAsRead', 
                    folder: folder.name, 
                    uid: emailSummary.id 
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [fullEmail, emailSummary, folder]);

    // --- FUNÇÕES DE RESPOSTA ---
    const prepareReply = (type) => {
        if (!fullEmail) return;

        let to = fullEmail.from; // Quem enviou
        let cc = '';
        let subject = fullEmail.subject;
        
        // Ajuste de Assunto
        if (!subject.toLowerCase().startsWith('re:')) {
            subject = `Re: ${subject}`;
        }

        // Se for Reply All, adiciona os CCs originais
        if (type === 'replyAll' && fullEmail.to) {
            // Lógica simples: adiciona quem estava no TO original (exceto eu mesmo, idealmente)
            // Aqui vamos apenas concatenar por enquanto
           // Nota: O 'fullEmail.to' geralmente vem como string ou array na API, ajuste conforme retorno real
           if (typeof fullEmail.to === 'string') cc = fullEmail.to;
        }

        // Citação (Quote)
        const dateStr = format(new Date(fullEmail.date), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const quote = `
            <br><br><br>
            <div style="border-left: 2px solid #ccc; padding-left: 10px; color: #555;">
                Em ${dateStr}, <strong>${fullEmail.from}</strong> escreveu:<br><br>
                ${fullEmail.html || fullEmail.text}
            </div>
        `;

        setComposeData({
            type: type === 'forward' ? 'forward' : 'reply',
            to: type === 'forward' ? '' : to,
            cc: type === 'replyAll' ? cc : '',
            subject: type === 'forward' ? `Fwd: ${fullEmail.subject}` : subject,
            body: quote,
            messageId: fullEmail.id // ID original para threading
        });
        setIsComposeOpen(true);
    };

    const handleDownloadAttachment = (att) => {
        if (!att || !att.content || !att.content.data) return;
        try {
            const byteArray = new Uint8Array(att.content.data);
            const blob = new Blob([byteArray], { type: att.contentType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = att.filename || 'anexo_download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Erro ao baixar:", err);
            alert("Erro ao processar anexo.");
        }
    };

    if (!emailSummary) return null;

    const safeHtml = fullEmail?.html ? DOMPurify.sanitize(fullEmail.html, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target'], 
    }) : null;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 w-full relative">
            <EmailComposeModal 
                isOpen={isComposeOpen} 
                onClose={() => setIsComposeOpen(false)} 
                initialData={composeData} 
            />

            {/* Header */}
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
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                     {/* BOTÕES DE AÇÃO: RESPONDER / ENCAMINHAR */}
                    <div className="flex bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
                        <button 
                            onClick={() => prepareReply('reply')} 
                            className="p-2 text-gray-600 hover:bg-gray-100 border-r border-gray-200" 
                            title="Responder"
                        >
                            <FontAwesomeIcon icon={faReply} />
                        </button>
                        <button 
                            onClick={() => prepareReply('replyAll')} 
                            className="p-2 text-gray-600 hover:bg-gray-100 border-r border-gray-200" 
                            title="Responder a Todos"
                        >
                            <FontAwesomeIcon icon={faReplyAll} />
                        </button>
                        <button 
                            onClick={() => prepareReply('forward')} 
                            className="p-2 text-gray-600 hover:bg-gray-100" 
                            title="Encaminhar"
                        >
                            <FontAwesomeIcon icon={faShare} />
                        </button>
                    </div>

                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-2 rounded-lg transition-colors ml-2">
                        <FontAwesomeIcon icon={faTimes} className="text-lg" />
                    </button>
                </div>
            </div>

            {/* Corpo */}
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

                        {fullEmail.attachments?.length > 0 && (
                            <div className="mt-10 pt-6 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPaperclip} /> 
                                    {fullEmail.attachments.length} Anexos
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fullEmail.attachments.map((att, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => handleDownloadAttachment(att)}
                                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group"
                                            title="Clique para baixar"
                                        >
                                            <div className="bg-white p-2.5 rounded border border-gray-200 text-blue-500 group-hover:text-blue-600 shadow-sm">
                                                <FontAwesomeIcon icon={faFileAlt} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">
                                                    {att.filename || 'Sem nome'}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {att.size ? (att.size / 1024).toFixed(0) + ' KB' : 'Arquivo'}
                                                </p>
                                            </div>
                                            <div className="text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <FontAwesomeIcon icon={faDownload} />
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
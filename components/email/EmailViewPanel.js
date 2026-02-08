'use client'

import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faUserCircle, faPaperclip, faTimes, faFileAlt, faExclamationTriangle, 
    faDownload, faReply, faReplyAll, faShare, faCopy 
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'isomorphic-dompurify';
import EmailComposeModal from './EmailComposeModal';
import AtividadeModal from '@/components/atividades/AtividadeModal'; 
import { toast } from 'sonner';
import EmailActionMenu from './EmailActionMenu';

const fetchEmailContent = async ({ queryKey }) => {
    const [_key, folderPath, uid, accountId] = queryKey;
    if (!uid) return null;
    
    let url = `/api/email/content?folder=${encodeURIComponent(folderPath)}&uid=${uid}`;
    if (accountId) url += `&accountId=${accountId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao carregar conteúdo');
    return res.json();
};

const performEmailAction = async ({ action, folder, uid, destination, accountId }) => { 
    const body = { action, folder, uid, accountId };
    if (destination) body.targetFolder = destination;
    const res = await fetch('/api/email/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Falha na ação');
    return res.json();
};

export default function EmailViewPanel({ emailSummary, folder, onClose, onCreateRule }) {
    const queryClient = useQueryClient();
    
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState(null);
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [activityData, setActivityData] = useState(null);

    const folderIdentifier = folder?.path || folder?.name;
    const accountId = folder?.accountId; 

    const { data: fullEmail, isLoading, isError } = useQuery({
        queryKey: ['emailContent', folderIdentifier, emailSummary?.id, accountId],
        queryFn: fetchEmailContent,
        enabled: !!emailSummary?.id && !!folderIdentifier,
        staleTime: 1000 * 60 * 30, 
        refetchOnWindowFocus: false,
    });

    const senderInfo = useMemo(() => {
        const rawFrom = fullEmail?.from || emailSummary?.from || '';
        if (!rawFrom) return { name: 'Desconhecido', email: '' };
        const match = rawFrom.match(/(.*?)\s*<(.+?)>/);
        if (match) return { name: match[1].replace(/['"]/g, '').trim() || match[2], email: match[2].trim() };
        if (rawFrom.includes('@')) return { name: rawFrom, email: rawFrom };
        return { name: rawFrom, email: '' };
    }, [fullEmail, emailSummary]);

    const actionMutation = useMutation({
        mutationFn: (vars) => performEmailAction({ ...vars, accountId }), 
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
            if (variables.action === 'trash') { toast.success('E-mail excluído.'); onClose(); }
            else if (variables.action === 'archive') { toast.success('E-mail arquivado.'); onClose(); }
            else if (variables.action === 'move') { toast.success('E-mail movido.'); onClose(); }
            else if (variables.action === 'markAsUnread') { toast.success('Marcado como não lido.'); onClose(); }
        },
        onError: () => toast.error('Erro ao realizar ação.')
    });

    // --- LÓGICA DE MARCAR COMO LIDO (CORRIGIDA PELO DEVONILDO) ---
    useEffect(() => {
        // Capturamos os dados ATUAIS para usar no cleanup (desmontagem)
        const currentEmailId = emailSummary?.id;
        const currentFolder = folderIdentifier;
        const currentAccountId = accountId;
        
        // Verifica se JÁ estava lido no momento que abriu (baseado no resumo da lista)
        const isAlreadyRead = emailSummary?.flags?.includes('\\Seen') || emailSummary?.is_read;

        return () => {
            // A mágica acontece aqui: quando o componente desmontar ou o ID mudar
            // só disparamos se tivermos um ID e se ele NÃO estava lido quando abrimos.
            if (currentEmailId && !isAlreadyRead) {
                // console.log("👀 Saindo do e-mail, marcando como lido:", currentEmailId);
                fetch('/api/email/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'markAsRead', 
                        folder: currentFolder, 
                        uid: currentEmailId,
                        accountId: currentAccountId
                    }),
                    keepalive: true // Garante que o request termine mesmo se a tela fechar
                }).then(() => { 
                    // Atualiza contadores e lista em background
                    queryClient.invalidateQueries({ queryKey: ['emailMessages'] }); 
                    queryClient.invalidateQueries({ queryKey: ['emailFolders'] }); 
                    queryClient.invalidateQueries({ queryKey: ['emailFolderCounts'] });
                }).catch(err => console.error('Erro ao marcar lido na saída:', err));
            }
        };
        // ATENÇÃO SEU LINDO: Removi 'emailSummary?.flags' das dependências.
        // Agora o efeito só reinicia se o ID do e-mail mudar ou a pasta mudar.
        // Isso impede que atualizações automáticas disparem o "lido" enquanto você lê.
    }, [emailSummary?.id, folderIdentifier, accountId, queryClient]); 

    const handleCreateActivity = () => {
        if (!fullEmail) return;
        const cleanBody = fullEmail.text || fullEmail.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
        const description = `E-mail de: ${senderInfo.name} (${senderInfo.email})\nEnviado em: ${format(new Date(fullEmail.date), "dd/MM/yyyy HH:mm")}\n\n${cleanBody.substring(0, 2000)}`;
        setActivityData({
            nome: fullEmail.subject,
            descricao: description,
            tipo_atividade: 'Tarefa',
            status: 'Não Iniciado',
            contato_id: emailSummary.contato_id || null
        });
        setIsActivityOpen(true);
    };

    const handleMenuAction = (action, value) => {
        if (action === 'createActivity') {
            handleCreateActivity();
        } else if (action === 'createRule') {
            if (onCreateRule) onCreateRule(emailSummary); 
        } else if (action === 'move') {
             actionMutation.mutate({ action: 'move', folder: folderIdentifier, uid: emailSummary.id, destination: value });
        } else {
             actionMutation.mutate({ action, folder: folderIdentifier, uid: emailSummary.id });
        }
    };

    const prepareReply = (type) => {
        if (!fullEmail) return;
        let to = senderInfo.email || fullEmail.from; 
        let cc = ''; 
        let subject = fullEmail.subject;
        if (!subject.toLowerCase().startsWith('re:')) subject = `Re: ${subject}`;
        if (type === 'replyAll' && fullEmail.to) { if (typeof fullEmail.to === 'string') cc = fullEmail.to; }
        const dateStr = format(new Date(fullEmail.date), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const quote = `<br><br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #555;">Em ${dateStr}, <strong>${senderInfo.name}</strong> escreveu:<br><br>${fullEmail.html || fullEmail.text}</div>`;
        
        setComposeData({ 
            type: type === 'forward' ? 'forward' : 'reply', 
            to: type === 'forward' ? '' : to, 
            cc: type === 'replyAll' ? cc : '', 
            subject: type === 'forward' ? `Fwd: ${fullEmail.subject}` : subject, 
            body: quote, 
            messageId: fullEmail.id,
            accountId 
        });
        setIsComposeOpen(true);
    };

    const handleCopyEmail = () => {
        if (senderInfo.email) { navigator.clipboard.writeText(senderInfo.email); toast.success('E-mail copiado: ' + senderInfo.email); } 
        else { toast.error('Endereço de e-mail não encontrado.'); }
    };

    const handleDownloadAttachment = (att) => {
        if (!att || !att.content || !att.content.data) return;
        try {
            const byteArray = new Uint8Array(att.content.data);
            const blob = new Blob([byteArray], { type: att.contentType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = att.filename || 'anexo_download';
            document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
        } catch (err) { console.error(err); alert("Erro ao processar anexo."); }
    };

    if (!emailSummary) return null;
    const safeHtml = fullEmail?.html ? DOMPurify.sanitize(fullEmail.html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }) : null;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 w-full relative">
            <EmailComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} initialData={composeData} />
            {isActivityOpen && <AtividadeModal isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} initialData={activityData} />}

            <div className="p-5 border-b bg-gray-50 flex justify-between items-start shrink-0">
                <div className="flex-1 overflow-hidden mr-4">
                    <h2 className="text-lg font-bold text-gray-800 break-words mb-3 leading-snug">{emailSummary.subject}</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"><FontAwesomeIcon icon={faUserCircle} className="text-xl" /></div>
                        <div className="min-w-0 flex flex-col">
                            <p className="text-sm font-bold text-gray-900 truncate">{senderInfo.name}</p>
                            {senderInfo.email ? ( <button onClick={handleCopyEmail} className="text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-1 -ml-1 rounded transition-all flex items-center gap-1.5 w-fit mt-0.5" title="Clique para copiar o e-mail">{senderInfo.email}<FontAwesomeIcon icon={faCopy} className="text-[10px] opacity-70" /></button> ) : ( isLoading && <span className="text-[10px] text-gray-400 animate-pulse">Carregando e-mail...</span> )}
                            <p className="text-[10px] text-gray-400 mt-1">{format(new Date(emailSummary.date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 items-center">
                    <div className="flex bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden h-[34px]">
                        <button onClick={() => prepareReply('reply')} className="px-3 text-gray-600 hover:bg-gray-100 border-r border-gray-200" title="Responder"><FontAwesomeIcon icon={faReply} /></button>
                        <button onClick={() => prepareReply('replyAll')} className="px-3 text-gray-600 hover:bg-gray-100 border-r border-gray-200" title="Responder a Todos"><FontAwesomeIcon icon={faReplyAll} /></button>
                        <button onClick={() => prepareReply('forward')} className="px-3 text-gray-600 hover:bg-gray-100" title="Encaminhar"><FontAwesomeIcon icon={faShare} /></button>
                    </div>
                    
                    <div className="z-50">
                        {/* AQUI TAMBÉM: Passamos o accountId explicitamente */}
                        <EmailActionMenu 
                            email={emailSummary}
                            accountId={accountId} 
                            onAction={handleMenuAction}
                            showCreateActivity={true} 
                        />
                    </div>

                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 w-[34px] h-[34px] rounded-lg transition-colors ml-1"><FontAwesomeIcon icon={faTimes} className="text-lg" /></button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 bg-white relative">
                {isLoading ? ( <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" /><p className="text-sm animate-pulse">Baixando conteúdo...</p></div> ) 
                : isError ? ( <div className="flex flex-col items-center justify-center h-full text-red-500"><FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-2 opacity-50" /><p>Não foi possível carregar a mensagem.</p></div> ) 
                : fullEmail ? (
                    <div className="animate-fade-in">
                        <div className="prose prose-sm max-w-none text-gray-800 break-words font-sans">
                            {safeHtml ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} /> : <pre className="whitespace-pre-wrap font-sans text-gray-700">{fullEmail.text}</pre>}
                        </div>
                        {fullEmail.attachments?.length > 0 && (
                            <div className="mt-10 pt-6 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2"><FontAwesomeIcon icon={faPaperclip} /> {fullEmail.attachments.length} Anexos</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fullEmail.attachments.map((att, i) => (
                                        <div key={i} onClick={() => handleDownloadAttachment(att)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group" title="Clique para baixar">
                                            <div className="bg-white p-2.5 rounded border border-gray-200 text-blue-500 group-hover:text-blue-600 shadow-sm"><FontAwesomeIcon icon={faFileAlt} /></div>
                                            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">{att.filename || 'Sem nome'}</p><p className="text-[10px] text-gray-400">{att.size ? (att.size / 1024).toFixed(0) + ' KB' : 'Arquivo'}</p></div>
                                            <div className="text-gray-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"><FontAwesomeIcon icon={faDownload} /></div>
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
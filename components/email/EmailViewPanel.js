'use client'

import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faUserCircle, faPaperclip, faTimes, faFileAlt, faExclamationTriangle, 
    faDownload, faReply, faReplyAll, faShare, faEllipsisV, faTrash, faArchive, faEnvelope,
    faCalendarPlus 
} from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DOMPurify from 'isomorphic-dompurify';
import EmailComposeModal from './EmailComposeModal';
// Importação correta do seu modal (em português)
import AtividadeModal from '@/components/atividades/AtividadeModal'; 
import { toast } from 'sonner';

const fetchEmailContent = async ({ queryKey }) => {
    const [_key, folderPath, uid] = queryKey;
    if (!uid) return null;
    const res = await fetch(`/api/email/content?folder=${encodeURIComponent(folderPath)}&uid=${uid}`);
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
    
    // Estados dos Modais de Email
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState(null);
    
    // Estado do Modal de Atividade
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [activityData, setActivityData] = useState(null);

    // Estado do Menu Dropdown
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const folderIdentifier = folder?.path || folder?.name;

    const { data: fullEmail, isLoading, isError } = useQuery({
        queryKey: ['emailContent', folderIdentifier, emailSummary?.id],
        queryFn: fetchEmailContent,
        enabled: !!emailSummary?.id && !!folderIdentifier,
        staleTime: 1000 * 60 * 30, 
        refetchOnWindowFocus: false,
    });

    const actionMutation = useMutation({
        mutationFn: performEmailAction,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
            if (variables.action === 'trash') { toast.success('E-mail excluído.'); onClose(); }
            else if (variables.action === 'archive') { toast.success('E-mail arquivado.'); onClose(); }
            else if (variables.action === 'markAsUnread') { toast.success('Marcado como não lido.'); onClose(); }
        },
        onError: () => toast.error('Erro ao realizar ação.')
    });

    // --- LÓGICA DE MARCAR COMO LIDO (Só ao sair/fechar) ---
    useEffect(() => {
        const currentEmailId = emailSummary?.id;
        const currentFolder = folderIdentifier;
        const isAlreadyRead = emailSummary?.flags?.includes('\\Seen');

        return () => {
            // Executa quando o componente desmonta ou o ID muda
            if (currentEmailId && !isAlreadyRead) {
                fetch('/api/email/actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'markAsRead', folder: currentFolder, uid: currentEmailId })
                }).then(() => {
                    // Atualiza a lista em background
                    queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
                });
            }
        };
    }, [emailSummary?.id, folderIdentifier, emailSummary?.flags, queryClient]); 

    // Fechar menu ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (action) => {
        setIsMenuOpen(false);
        actionMutation.mutate({ action, folder: folderIdentifier, uid: emailSummary.id });
    };

    // --- CRIAR ATIVIDADE A PARTIR DO E-MAIL ---
    const handleCreateActivity = () => {
        if (!fullEmail) return;

        // Precisamos limpar o HTML porque seu modal usa textarea simples.
        // Se não limpar, vai aparecer "<div><br>..." no campo de descrição.
        const cleanBody = fullEmail.text || fullEmail.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '';
        
        const description = `E-mail de: ${fullEmail.from}\nEnviado em: ${format(new Date(fullEmail.date), "dd/MM/yyyy HH:mm")}\n\n${cleanBody.substring(0, 2000)}`;

        // Mapeia para os campos exatos que seu banco de dados e modal esperam
        setActivityData({
            nome: fullEmail.subject,     // Campo 'nome' (not null no banco)
            descricao: description,      // Campo 'descricao'
            tipo_atividade: 'Tarefa',    // Campo 'tipo_atividade' (not null no banco)
            status: 'Não Iniciado',       // Padrão
            // Se o emailSummary tiver o contato vinculado, passamos aqui
            contato_id: emailSummary.contato_id || null
        });
        
        setIsMenuOpen(false);
        setIsActivityOpen(true);
    };

    const prepareReply = (type) => {
        if (!fullEmail) return;
        let to = fullEmail.from; let cc = ''; let subject = fullEmail.subject;
        if (!subject.toLowerCase().startsWith('re:')) subject = `Re: ${subject}`;
        if (type === 'replyAll' && fullEmail.to) { if (typeof fullEmail.to === 'string') cc = fullEmail.to; }
        const dateStr = format(new Date(fullEmail.date), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const quote = `<br><br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; color: #555;">Em ${dateStr}, <strong>${fullEmail.from}</strong> escreveu:<br><br>${fullEmail.html || fullEmail.text}</div>`;
        setComposeData({ type: type === 'forward' ? 'forward' : 'reply', to: type === 'forward' ? '' : to, cc: type === 'replyAll' ? cc : '', subject: type === 'forward' ? `Fwd: ${fullEmail.subject}` : subject, body: quote, messageId: fullEmail.id });
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
        } catch (err) { console.error(err); alert("Erro ao processar anexo."); }
    };

    if (!emailSummary) return null;
    const safeHtml = fullEmail?.html ? DOMPurify.sanitize(fullEmail.html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }) : null;

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 w-full relative">
            {/* Modal de Escrever E-mail */}
            <EmailComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} initialData={composeData} />
            
            {/* Modal de Criar Atividade */}
            {isActivityOpen && (
                <AtividadeModal 
                    isOpen={isActivityOpen} 
                    onClose={() => setIsActivityOpen(false)} 
                    initialData={activityData} 
                />
            )}

            {/* Cabeçalho do Painel */}
            <div className="p-5 border-b bg-gray-50 flex justify-between items-start shrink-0">
                <div className="flex-1 overflow-hidden mr-4">
                    <h2 className="text-lg font-bold text-gray-800 break-words mb-3 leading-snug">{emailSummary.subject}</h2>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0"><FontAwesomeIcon icon={faUserCircle} className="text-xl" /></div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{emailSummary.from}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">{format(new Date(emailSummary.date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                    </div>
                </div>
                
                {/* Botões de Ação */}
                <div className="flex gap-2 items-center">
                    <div className="flex bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden h-[34px]">
                        <button onClick={() => prepareReply('reply')} className="px-3 text-gray-600 hover:bg-gray-100 border-r border-gray-200" title="Responder"><FontAwesomeIcon icon={faReply} /></button>
                        <button onClick={() => prepareReply('replyAll')} className="px-3 text-gray-600 hover:bg-gray-100 border-r border-gray-200" title="Responder a Todos"><FontAwesomeIcon icon={faReplyAll} /></button>
                        <button onClick={() => prepareReply('forward')} className="px-3 text-gray-600 hover:bg-gray-100" title="Encaminhar"><FontAwesomeIcon icon={faShare} /></button>
                    </div>
                    
                    {/* Menu Três Pontinhos */}
                    <div className="relative" ref={menuRef}>
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="w-[34px] h-[34px] flex items-center justify-center bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors shadow-sm">
                            {actionMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faEllipsisV} />}
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-xl border border-gray-200 z-50 animate-fade-in">
                                <div className="py-1">
                                    <button onClick={handleCreateActivity} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 border-b border-gray-100">
                                        <FontAwesomeIcon icon={faCalendarPlus} className="w-3" /> Criar Atividade
                                    </button>
                                    
                                    <button onClick={() => handleAction('markAsUnread')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faEnvelope} className="w-3" /> Marcar como não lido
                                    </button>
                                    <button onClick={() => handleAction('archive')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faArchive} className="w-3" /> Arquivar
                                    </button>
                                    <button onClick={() => handleAction('trash')} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                        <FontAwesomeIcon icon={faTrash} className="w-3" /> Excluir
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 w-[34px] h-[34px] rounded-lg transition-colors ml-1"><FontAwesomeIcon icon={faTimes} className="text-lg" /></button>
                </div>
            </div>

            {/* Conteúdo do E-mail */}
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
                        {/* Corpo da Mensagem */}
                        <div className="prose prose-sm max-w-none text-gray-800 break-words font-sans">
                            {safeHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                            ) : (
                                <pre className="whitespace-pre-wrap font-sans text-gray-700">{fullEmail.text}</pre>
                            )}
                        </div>
                        
                        {/* Anexos */}
                        {fullEmail.attachments?.length > 0 && (
                            <div className="mt-10 pt-6 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faPaperclip} /> {fullEmail.attachments.length} Anexos
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {fullEmail.attachments.map((att, i) => (
                                        <div key={i} onClick={() => handleDownloadAttachment(att)} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all cursor-pointer group" title="Clique para baixar">
                                            <div className="bg-white p-2.5 rounded border border-gray-200 text-blue-500 group-hover:text-blue-600 shadow-sm"><FontAwesomeIcon icon={faFileAlt} /></div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-700 truncate group-hover:text-blue-700">{att.filename || 'Sem nome'}</p>
                                                <p className="text-[10px] text-gray-400">{att.size ? (att.size / 1024).toFixed(0) + ' KB' : 'Arquivo'}</p>
                                            </div>
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
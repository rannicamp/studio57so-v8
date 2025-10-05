// components/whatsapp/MessagePanel.js
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faSpinner, faUserCircle, faPaperclip, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TemplateMessageModal from './TemplateMessageModal';

const getAttachmentType = (fileType) => {
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('audio/')) return 'audio';
    return 'document';
};

export default function MessagePanel({ contact }) {
    const queryClient = useQueryClient();
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [recipientPhone, setRecipientPhone] = useState(null);

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { data: messages, isLoading } = useQuery({
        queryKey: ['messages', organizacaoId, contact?.contato_id],
        queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
        enabled: !!organizacaoId && !!contact,
    });

    useEffect(() => {
        if (messages && messages.length > 0) {
            const inboundMsg = messages.find(m => m.direction === 'inbound');
            if (inboundMsg && inboundMsg.sender_id) {
                setRecipientPhone(inboundMsg.sender_id);
                return;
            }
            const outboundMsg = messages.find(m => m.direction === 'outbound');
            if (outboundMsg && outboundMsg.receiver_id) {
                setRecipientPhone(outboundMsg.receiver_id);
            }
        } else if (contact?.telefone) {
            setRecipientPhone(contact.telefone);
        }
    }, [messages, contact]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (!contact) return;
        const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
                if (payload.new.contato_id === contact.contato_id) {
                    queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
                }
                queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
                toast.info("Nova mensagem recebida!");
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [contact, organizacaoId, supabase, queryClient]);

    const mutationOptions = {
        onError: (error) => toast.error(`Erro ao enviar: ${error.message}`),
        onSettled: () => toast.dismiss(),
    };

    const sendMessageMutation = useMutation({
        mutationFn: async (messageContent) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: recipientPhone, type: 'text', text: messageContent }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar mensagem');
            return response.json();
        },
        onSuccess: () => setNewMessage(''),
        ...mutationOptions,
    });

    const sendTemplateMutation = useMutation({
        // ##### CORREÇÃO APLICADA AQUI (2/3) #####
        // A função agora espera receber o "language"
        mutationFn: async ({ templateName, language, variables }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            const components = variables.length > 0 ? [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: v })) }] : [];
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                // E o "language" é enviado para a API
                body: JSON.stringify({ to: recipientPhone, type: 'template', templateName: templateName, languageCode: language, components: components }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar modelo');
            return response.json();
        },
        onSuccess: () => setIsTemplateModalOpen(false),
        ...mutationOptions,
    });

    const sendAttachmentMutation = useMutation({
        mutationFn: async ({ file }) => {
            if (!recipientPhone) throw new Error("Número do destinatário não encontrado.");
            toast.loading("Enviando anexo...");
            const fileExt = file.name.split('.').pop();
            const fileNameForUpload = `${Date.now()}.${fileExt}`;
            const filePath = `${organizacaoId}/${contact.contato_id}/${fileNameForUpload}`;
            const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file);
            if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);
            const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
            if (!publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");
            const attachmentType = getAttachmentType(file.type);
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: recipientPhone, type: attachmentType, link: publicUrl, filename: file.name, caption: '' }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar anexo');
            await supabase.from('whatsapp_attachments').insert({ contato_id: contact.contato_id, storage_path: filePath, public_url: publicUrl, file_name: file.name, file_type: file.type, file_size: file.size });
            return response.json();
        },
        onSuccess: () => toast.success("Anexo enviado com sucesso!"),
        ...mutationOptions,
    });

    const handleSendMessage = (e) => { e.preventDefault(); if (newMessage.trim()) { sendMessageMutation.mutate(newMessage); } };
    const handleFileSelect = (e) => { const file = e.target.files[0]; if (file) { sendAttachmentMutation.mutate({ file }); } e.target.value = null; };
    // A função de "handle" também é atualizada para passar o idioma para a mutação
    const handleSendTemplate = (templateName, language, variables) => { sendTemplateMutation.mutate({ templateName, language, variables }); };

    if (!contact) {
        return <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500"><FontAwesomeIcon icon={faUserCircle} size="6x" /><p className="mt-4 text-lg">Selecione uma conversa para começar</p></div>;
    }
    
    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-gray-400" /></div>;
    }
    
    return (
        <>
            <TemplateMessageModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} onSendTemplate={handleSendTemplate} contactName={contact?.nome} />
            <div className="flex flex-col h-full bg-gray-50">
                <div className="flex items-center p-3 border-b border-gray-200 bg-white">
                    <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white">{contact.nome?.charAt(0).toUpperCase()}</div>
                    <h2 className="font-semibold">{contact.nome}</h2>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    {messages?.map(msg => (
                        <div key={msg.id} className={`flex my-2 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg ${msg.direction === 'outbound' ? 'bg-green-200' : 'bg-white shadow'}`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className="text-right text-xs text-gray-500 mt-1">{msg.sent_at ? format(new Date(msg.sent_at), 'HH:mm') : ''}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 bg-white border-t border-gray-200">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                        <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 text-gray-600" disabled={sendAttachmentMutation.isPending}>
                            {sendAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperclip} />}
                        </button>
                        <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="p-3 rounded-full hover:bg-gray-200 text-gray-600" disabled={sendTemplateMutation.isPending}>
                            {sendTemplateMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileLines} />}
                        </button>
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Digite uma mensagem" className="w-full px-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={sendMessageMutation.isPending} />
                        <button type="submit" className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400" disabled={sendMessageMutation.isPending}>
                            {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
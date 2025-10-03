// components/whatsapp/MessagePanel.js
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMessages } from '@/app/(main)/caixa-de-entrada/data-fetching'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane, faSpinner, faUserCircle, faPaperclip, faFileLines } from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { toast } from 'sonner'
import TemplateMessageModal from './TemplateMessageModal' // NOVO: Importando o modal de templates

export default function MessagePanel({ contact }) {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null); // NOVO: Referência para o input de arquivo
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false); // NOVO: Estado para controlar o modal

  const supabase = createClient();
  const { user } = useAuth();
  const organizacaoId = user?.organizacao_id;

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages', organizacaoId, contact?.contato_id],
    queryFn: () => getMessages(supabase, organizacaoId, contact?.contato_id),
    enabled: !!organizacaoId && !!contact,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // ... (o useEffect do real-time continua o mesmo)
  useEffect(() => {
    if (!contact) return;
    const channel = supabase.channel(`whatsapp_messages_org_${organizacaoId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `organizacao_id=eq.${organizacaoId}`}, (payload) => {
          if(payload.new.contato_id === contact.contato_id) {
              queryClient.invalidateQueries({ queryKey: ['messages', organizacaoId, contact.contato_id] });
          }
          queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
          toast.info("Nova mensagem recebida!");
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contact, organizacaoId, supabase, queryClient]);


  // --- MUTAÇÕES (LOGICA DE ENVIO) ---

  // 1. Enviar mensagem de TEXTO
  const sendMessageMutation = useMutation({
      mutationFn: async (messageContent) => {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'text', to: messages[0].contatos.telefone, message: messageContent }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar mensagem');
        return response.json();
      },
      onSuccess: () => setNewMessage(''),
      onError: (error) => toast.error(`Erro ao enviar: ${error.message}`),
  });

  // NOVO: 2. Enviar mensagem de TEMPLATE
  const sendTemplateMutation = useMutation({
    mutationFn: async ({ templateName, variables }) => {
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'template', to: messages[0].contatos.telefone, template: { name: templateName, variables } }),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar modelo');
        return response.json();
    },
    onSuccess: () => setIsTemplateModalOpen(false),
    onError: (error) => toast.error(`Erro ao enviar: ${error.message}`),
  });

  // NOVO: 3. Enviar ANEXO (arquivo/imagem/video)
  const sendAttachmentMutation = useMutation({
    mutationFn: async ({ file }) => {
      if (!organizacaoId || !contact) throw new Error("Organização ou contato não identificado.");
      
      // Passo 1: Fazer o upload para o Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${organizacaoId}/${contact.contato_id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file);
      if (uploadError) throw new Error(`Falha no upload: ${uploadError.message}`);

      // Passo 2: Obter a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
      if (!publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");
      
      // Passo 3: Enviar a mensagem via API
      const response = await fetch('/api/whatsapp/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'attachment', to: messages[0].contatos.telefone, url: publicUrl, fileType: file.type, fileName: file.name }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Falha ao enviar anexo');
      
      // Passo 4 (Opcional, mas recomendado): Salvar na sua tabela de anexos
      await supabase.from('whatsapp_attachments').insert({
        contato_id: contact.contato_id,
        storage_path: filePath,
        public_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      });

      return response.json();
    },
    onSuccess: () => toast.success("Anexo enviado com sucesso!"),
    onError: (error) => toast.error(`Erro no anexo: ${error.message}`),
  });


  // --- FUNÇÕES DE INTERAÇÃO (HANDLERS) ---
  const handleSendMessage = (e) => {
      e.preventDefault();
      if (newMessage.trim() && messages?.length > 0) {
        sendMessageMutation.mutate(newMessage);
      }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      sendAttachmentMutation.mutate({ file });
    }
    e.target.value = null; // Limpa o input para permitir selecionar o mesmo arquivo novamente
  };

  const handleSendTemplate = (templateName, variables) => {
    sendTemplateMutation.mutate({ templateName, variables });
  };


  // --- RENDERIZAÇÃO DO COMPONENTE ---
  if (!contact) { /* ... (código existente) */ }
  if (isLoading) { /* ... (código existente) */ }

  return (
    <>
      <TemplateMessageModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSendTemplate={handleSendTemplate}
        contactName={contact?.nome}
      />
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex items-center p-3 border-b border-gray-200 bg-white">
          <div className="w-10 h-10 bg-gray-300 rounded-full mr-3 flex items-center justify-center font-bold text-white">
              {contact.nome?.charAt(0).toUpperCase()}
          </div>
          <h2 className="font-semibold">{contact.nome}</h2>
        </div>
        
        <div className="flex-grow p-4 overflow-y-auto">
          {/* ... (mapeamento de mensagens existente) ... */}
        </div>
        
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            
            {/* NOVO: Botões de Anexo e Template */}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 rounded-full hover:bg-gray-200 text-gray-600" disabled={sendAttachmentMutation.isPending}>
              {sendAttachmentMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperclip} />}
            </button>
            <button type="button" onClick={() => setIsTemplateModalOpen(true)} className="p-3 rounded-full hover:bg-gray-200 text-gray-600" disabled={sendTemplateMutation.isPending}>
              {sendTemplateMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faFileLines} />}
            </button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite uma mensagem"
              className="w-full px-4 py-2 border rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sendMessageMutation.isPending}
            />
            <button type="submit" className="p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400" disabled={sendMessageMutation.isPending}>
              {sendMessageMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
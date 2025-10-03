"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';

// Lógica de busca de dados ATUALIZADA para ser mais robusta
const fetchWhatsappContacts = async (supabase) => {
    // 1. Busca primeiro a lista de contatos. A RLS da tabela 'contatos' já vai filtrar pela organização do usuário.
    const { data: contactsData, error: contactsDataError } = await supabase
        .from('contatos')
        .select(`
            id,
            nome,
            razao_social,
            is_awaiting_name_response,
            telefones (id, telefone, tipo)
        `)
        .order('created_at', { ascending: false });

    if (contactsDataError) {
        console.error("Erro ao buscar contatos:", contactsDataError);
        throw new Error(`Falha ao buscar contatos: ${contactsDataError.message}`);
    }

    // Se nenhum contato for retornado, encerramos aqui.
    if (!contactsData || contactsData.length === 0) {
        return [];
    }

    // 2. Com a lista de contatos em mãos, buscamos os dados adicionais (mensagens não lidas e última mensagem)
    const { data: unreadData, error: unreadError } = await supabase
        .from('whatsapp_messages')
        .select('contato_id')
        .eq('is_read', false)
        .eq('direction', 'inbound');
    
    if (unreadError) throw unreadError;

    const unreadCounts = unreadData.reduce((acc, msg) => {
        acc[msg.contato_id] = (acc[msg.contato_id] || 0) + 1;
        return acc;
    }, {});

    const { data: lastMessagesData, error: lastMessagesError } = await supabase.rpc('get_last_messages_for_contacts');
    if (lastMessagesError) throw lastMessagesError;

    const lastMessagesMap = lastMessagesData.reduce((map, msg) => {
        map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at };
        return map;
    }, {});

    // 3. Combinamos todos os dados
    const contatosComDados = contactsData.map(contact => ({
        ...contact,
        unread_count: unreadCounts[contact.id] || 0,
        last_whatsapp_message: lastMessagesMap[contact.id]?.content || null,
        last_whatsapp_message_time: lastMessagesMap[contact.id]?.sent_at || null
    })).filter(c => c.telefones && c.telefones.length > 0); // Garante que só contatos com telefone apareçam

    // 4. Ordenamos a lista final
    return contatosComDados.sort((a, b) => {
        const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
        const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
        if (dateA && dateB) return dateB - dateA;
        if (dateA) return -1;
        if (dateB) return 1;
        return (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '');
    });
};


export default function CaixaDeEntradaPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    const [currentlyOpenContactId, setCurrentlyOpenContactId] = useState(null);
    const notificationSoundRef = useRef(null);
    const isFetchingRef = useRef(false);

    const { data: contatosWhatsapp = [], isLoading: loadingWhatsapp, isFetching, isSuccess } = useQuery({
        queryKey: ['whatsappContacts'],
        queryFn: () => fetchWhatsappContacts(supabase),
        staleTime: 1000 * 60 * 1,
        refetchOnWindowFocus: true,
    });

    useEffect(() => {
        if (isFetchingRef.current && !isFetching && isSuccess) {
            toast.success('Página atualizada!');
        }
        isFetchingRef.current = isFetching;
    }, [isFetching, isSuccess]);

    useEffect(() => {
        setPageTitle("Caixa de Entrada");
    }, [setPageTitle]);
    
    useEffect(() => {
        const channel = supabase.channel('whatsapp_messages_global_listener')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
                (payload) => {
                    queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
                    
                    const newMessage = payload.new;
                    const contactId = newMessage.contato_id;
                    if (newMessage.direction === 'inbound' && contactId !== currentlyOpenContactId) {
                        notificationSoundRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, queryClient, currentlyOpenContactId]);

    const handleMarkAsRead = useCallback(async (contactId) => {
        setCurrentlyOpenContactId(contactId);
        
        queryClient.setQueryData(['whatsappContacts'], (oldData) => 
            oldData.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c)
        );
        
        await supabase.from('whatsapp_messages')
            .update({ is_read: true })
            .eq('contato_id', contactId)
            .eq('is_read', false);
    }, [supabase, queryClient]);

    const tabStyle = "px-6 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none flex items-center gap-2";
    const activeTabStyle = "text-blue-600 border-b-2 border-blue-500";
    
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <audio ref={notificationSoundRef} src="/sounds/notification.mp3" preload="auto" />
            
            <div className="flex-shrink-0 bg-white shadow-sm">
                <div className="px-4 pt-4">
                    <h1 className="text-xl font-bold text-gray-800">Canais de Atendimento</h1>
                </div>
                <div className="px-4">
                    <div className="flex border-b">
                        <div className={`${tabStyle} ${activeTabStyle}`}>
                            <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                            <span>WhatsApp</span>
                            {contatosWhatsapp.some(c => c.unread_count > 0) && (<span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-hidden">
                {loadingWhatsapp ? (
                    <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                ) : (
                    <WhatsAppChatManager 
                        contatos={contatosWhatsapp} 
                        onMarkAsRead={handleMarkAsRead}
                        onNewMessageSent={() => queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] })}
                        onContactSelected={(contactId) => setCurrentlyOpenContactId(contactId)}
                    />
                )}
            </div>
        </div>
    );
}
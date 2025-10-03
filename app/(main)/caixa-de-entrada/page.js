"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBell } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';

// 1. A lógica de busca de dados foi movida para uma função separada e assíncrona.
// Isso organiza melhor o código e o torna reutilizável.
const fetchWhatsappContacts = async (supabase) => {
    const { data: contactsData, error: contactsDataError } = await supabase
        .from('contatos')
        .select(`*, telefones (id, telefone, tipo), is_awaiting_name_response`);
    
    if (contactsDataError) throw contactsDataError;
    
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

    const contatosComDados = contactsData.map(contact => ({
        ...contact,
        unread_count: unreadCounts[contact.id] || 0,
        last_whatsapp_message: lastMessagesMap[contact.id]?.content || null,
        last_whatsapp_message_time: lastMessagesMap[contact.id]?.sent_at || null
    }));

    // A ordenação agora faz parte da lógica de busca de dados
    return contatosComDados.sort((a, b) => {
        const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
        const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
        if(dateA && dateB) return dateB - dateA;
        if(dateA) return -1;
        if(dateB) return 1;
        return (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '');
    });
};


export default function CaixaDeEntradaPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    const queryClient = useQueryClient(); // Cliente para interagir com o cache
    
    const [currentlyOpenContactId, setCurrentlyOpenContactId] = useState(null);
    const notificationSoundRef = useRef(null);
    const isFetchingRef = useRef(false);

    // 2. Substituímos useState e useEffect pelo poderoso useQuery.
    const { data: contatosWhatsapp = [], isLoading: loadingWhatsapp, isFetching, isSuccess } = useQuery({
        queryKey: ['whatsappContacts'], // Chave única para o cache
        queryFn: () => fetchWhatsappContacts(supabase),
        staleTime: 1000 * 60 * 1, // Considera os dados "frescos" por 1 minuto (Carregamento Mágico)
        refetchOnWindowFocus: true, // Atualiza automaticamente ao voltar para a aba
    });

    // 3. Efeito para a notificação de "Página atualizada!"
    useEffect(() => {
        if (isFetchingRef.current && !isFetching && isSuccess) {
            toast.success('Página atualizada!');
        }
        isFetchingRef.current = isFetching;
    }, [isFetching, isSuccess]);

    useEffect(() => {
        setPageTitle("Caixa de Entrada");
    }, [setPageTitle]);
    
    // 4. O listener de tempo real agora é mais simples e robusto.
    useEffect(() => {
        const channel = supabase.channel('whatsapp_messages_global_listener')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
                (payload) => {
                    const newMessage = payload.new;
                    const contactId = newMessage.contato_id;
                    
                    // Notificação sonora apenas para mensagens de entrada que não estão na tela aberta
                    if (newMessage.direction === 'inbound' && contactId !== currentlyOpenContactId) {
                        notificationSoundRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
                    }
                    
                    // Invalida o cache, forçando o useQuery a buscar os dados mais recentes.
                    // Isso é mais seguro do que manipular o estado manualmente.
                    queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, queryClient, currentlyOpenContactId]);

    const handleMarkAsRead = useCallback(async (contactId) => {
        setCurrentlyOpenContactId(contactId);
        
        // Atualiza a UI imediatamente para uma melhor experiência do usuário
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
                        // Apenas invalida para buscar dados frescos
                        onNewMessageSent={() => queryClient.invalidateQueries({ queryKey: ['whatsappContacts'] })}
                        onContactSelected={(contactId) => setCurrentlyOpenContactId(contactId)}
                    />
                )}
            </div>
        </div>
    );
}
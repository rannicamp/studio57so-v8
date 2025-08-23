"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBell } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';

export default function CaixaDeEntradaPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    
    const [activeTab, setActiveTab] = useState('whatsapp');
    const [contatosWhatsapp, setContatosWhatsapp] = useState([]);
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
    const [currentlyOpenContactId, setCurrentlyOpenContactId] = useState(null);
    const notificationSoundRef = useRef(null);

    const fetchWhatsappData = useCallback(async () => {
        setLoadingWhatsapp(true);
        try {
            // ##### INÍCIO DA CORREÇÃO #####
            const { data: contactsData, error: contactsDataError } = await supabase.from('contatos').select(`*, telefones (id, telefone, tipo), is_awaiting_name_response`);
            // ##### FIM DA CORREÇÃO #####
            
            if (contactsDataError) throw contactsDataError;
            
            const { data: unreadData, error: unreadError } = await supabase.from('whatsapp_messages').select('contato_id').eq('is_read', false).eq('direction', 'inbound');
            if (unreadError) throw unreadError;

            const unreadCounts = unreadData.reduce((acc, msg) => { acc[msg.contato_id] = (acc[msg.contato_id] || 0) + 1; return acc; }, {});

            const { data: lastMessagesData, error: lastMessagesError } = await supabase.rpc('get_last_messages_for_contacts');
            if (lastMessagesError) throw lastMessagesError;

            const lastMessagesMap = lastMessagesData.reduce((map, msg) => { map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at }; return map; }, {});

            const contatosComDados = contactsData.map(contact => ({ ...contact, unread_count: unreadCounts[contact.id] || 0, last_whatsapp_message: lastMessagesMap[contact.id]?.content || null, last_whatsapp_message_time: lastMessagesMap[contact.id]?.sent_at || null }));

            const sortedContatos = contatosComDados.sort((a, b) => {
                const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
                const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
                if(dateA && dateB) return dateB - dateA;
                if(dateA) return -1;
                if(dateB) return 1;
                return (a.nome || a.razao_social || '').localeCompare(b.nome || b.razao_social || '');
            });
            
            setContatosWhatsapp(sortedContatos);

        } catch (error) {
            console.error("Erro ao carregar contatos do WhatsApp:", error);
            toast.error('Erro ao carregar contatos do WhatsApp.');
        } finally {
            setLoadingWhatsapp(false);
        }
    }, [supabase]);

    useEffect(() => {
        setPageTitle("Caixa de Entrada");
        fetchWhatsappData();
    }, [setPageTitle, fetchWhatsappData]);
    
    useEffect(() => {
        const channel = supabase.channel('whatsapp_messages_global_listener')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: 'direction=eq.inbound' },
                (payload) => {
                    const newMessage = payload.new;
                    const contactId = newMessage.contato_id;
                    if (contactId === currentlyOpenContactId) return;
                    notificationSoundRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
                    setContatosWhatsapp(prevContatos => {
                        let contactExists = false;
                        const updatedContatos = prevContatos.map(c => {
                            if (c.id === contactId) {
                                contactExists = true;
                                return { ...c, unread_count: (c.unread_count || 0) + 1, last_whatsapp_message: newMessage.content, last_whatsapp_message_time: newMessage.sent_at };
                            }
                            return c;
                        });
                        if (!contactExists) fetchWhatsappData();
                        return updatedContatos.sort((a, b) => {
                            const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
                            const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
                            return dateB - dateA;
                        });
                    });
                    const contact = contatosWhatsapp.find(c => c.id === contactId);
                    const contactName = contact?.nome || contact?.razao_social || `Contato ${contactId}`;
                    toast.info(
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faBell} className="text-blue-500" />
                            <div>
                                <p className="font-bold">Nova mensagem de {contactName}</p>
                                <p className="text-sm text-gray-600 truncate">{newMessage.content}</p>
                            </div>
                        </div>
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, contatosWhatsapp, currentlyOpenContactId, fetchWhatsappData]);

    const handleMarkAsRead = useCallback(async (contactId) => {
        setCurrentlyOpenContactId(contactId);
        setContatosWhatsapp(prev => prev.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c));
        await supabase.from('whatsapp_messages').update({ is_read: true }).eq('contato_id', contactId).eq('is_read', false);
    }, [supabase]);

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
                        onNewMessageSent={fetchWhatsappData}
                        onContactSelected={(contactId) => setCurrentlyOpenContactId(contactId)}
                    />
                )}
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useLayout } from '@/contexts/LayoutContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBell, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faInstagram } from '@fortawesome/free-brands-svg-icons';
import { toast } from 'sonner';
import WhatsAppChatManager from '@/components/WhatsAppChatManager';
import { useSession, signIn } from 'next-auth/react';

export default function CaixaDeEntradaPage() {
    const { setPageTitle } = useLayout();
    const supabase = createClient();
    
    const [activeTab, setActiveTab] = useState('whatsapp');

    // Estados do WhatsApp
    const [contatosWhatsapp, setContatosWhatsapp] = useState([]);
    const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
    const [currentlyOpenContactId, setCurrentlyOpenContactId] = useState(null);
    const notificationSoundRef = useRef(null);

    // Estados do Instagram
    const { data: session, status: sessionStatus } = useSession();
    const [instagramAccounts, setInstagramAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [instagramConversations, setInstagramConversations] = useState([]);
    const [loadingInstagram, setLoadingInstagram] = useState(false);

    // Lógica de busca de dados do WhatsApp (sem alterações)
    const fetchWhatsappData = useCallback(async () => {
        setLoadingWhatsapp(true);
        try {
            const { data: contactsData } = await supabase.from('contatos').select(`*, telefones (id, telefone, tipo), is_awaiting_name_response`);
            const { data: unreadData } = await supabase.from('whatsapp_messages').select('contato_id').eq('is_read', false).eq('direction', 'inbound');
            const unreadCounts = unreadData.reduce((acc, msg) => { acc[msg.contato_id] = (acc[msg.contato_id] || 0) + 1; return acc; }, {});
            const { data: lastMessagesData } = await supabase.rpc('get_last_messages_for_contacts');
            const lastMessagesMap = lastMessagesData.reduce((map, msg) => { map[msg.contato_id] = { content: msg.content, sent_at: msg.sent_at }; return map; }, {});
            const contatosComDados = contactsData.map(contact => ({ ...contact, unread_count: unreadCounts[contact.id] || 0, last_whatsapp_message: lastMessagesMap[contact.id]?.content || null, last_whatsapp_message_time: lastMessagesMap[contact.id]?.sent_at || null }));
            const sortedContatos = contatosComDados.sort((a, b) => {
                const dateA = a.last_whatsapp_message_time ? new Date(a.last_whatsapp_message_time).getTime() : 0;
                const dateB = b.last_whatsapp_message_time ? new Date(b.last_whatsapp_message_time).getTime() : 0;
                return dateB - dateA;
            });
            setContatosWhatsapp(sortedContatos);
        } catch (error) { toast.error('Erro ao carregar contatos do WhatsApp.'); } 
        finally { setLoadingWhatsapp(false); }
    }, [supabase]);

    // Lógica de busca de contas do Instagram
    const fetchInstagramAccounts = useCallback(async () => {
        if (sessionStatus !== 'authenticated') return;
        setLoadingInstagram(true);
        try {
            const response = await fetch('/api/instagram/accounts');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao buscar contas.');
            setInstagramAccounts(data);
            if (data.length > 0) {
                setSelectedAccountId(data[0].page_id);
            }
        } catch (error) { toast.error(`Erro ao buscar contas do Instagram: ${error.message}`); }
        setLoadingInstagram(false);
    }, [sessionStatus]);
    
    // Lógica de busca de conversas do Instagram
    useEffect(() => {
        const fetchConversations = async () => {
            if (!selectedAccountId) { setInstagramConversations([]); return; }
            const selectedAccount = instagramAccounts.find(acc => acc.page_id === selectedAccountId);
            if (!selectedAccount) return;

            setLoadingInstagram(true);
            try {
                const response = await fetch('/api/instagram/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instagramAccountId: selectedAccount.instagram_id,
                        pageAccessToken: selectedAccount.page_access_token,
                    }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Falha ao buscar conversas.');
                setInstagramConversations(data.data || []);
            } catch (error) { toast.error(`Erro ao buscar conversas: ${error.message}`); }
            setLoadingInstagram(false);
        };
        fetchConversations();
    }, [selectedAccountId, instagramAccounts]);

    useEffect(() => {
        setPageTitle("Caixa de Entrada");
        fetchWhatsappData();
    }, [setPageTitle, fetchWhatsappData]);

    useEffect(() => {
        if (sessionStatus === 'authenticated') {
            fetchInstagramAccounts();
        }
    }, [sessionStatus, fetchInstagramAccounts]);

    const handleMarkAsRead = useCallback(async (contactId) => {
        setCurrentlyOpenContactId(contactId);
        setContatosWhatsapp(prev => prev.map(c => c.id === contactId ? { ...c, unread_count: 0 } : c));
        await supabase.from('whatsapp_messages').update({ is_read: true }).eq('contato_id', contactId).eq('is_read', false);
    }, [supabase]);

    const tabStyle = "px-6 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none flex items-center gap-2";
    const activeTabStyle = "text-blue-600 border-b-2 border-blue-500";
    const inactiveTabStyle = "text-gray-600 hover:text-gray-800";

    return (
        <div className="h-full flex flex-col bg-gray-100">
            <audio ref={notificationSoundRef} src="/sounds/notification.mp3" preload="auto" />
            
            <div className="flex-shrink-0 bg-white shadow-sm">
                <div className="px-4">
                    <div className="flex border-b">
                        <button onClick={() => setActiveTab('whatsapp')} className={`${tabStyle} ${activeTab === 'whatsapp' ? activeTabStyle : inactiveTabStyle}`}>
                            <FontAwesomeIcon icon={faWhatsapp} className="text-xl" />
                            <span>WhatsApp</span>
                            {contatosWhatsapp.some(c => c.unread_count > 0) && (<span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>)}
                        </button>
                        <button onClick={() => setActiveTab('instagram')} className={`${tabStyle} ${activeTab === 'instagram' ? activeTabStyle : inactiveTabStyle}`}>
                            <FontAwesomeIcon icon={faInstagram} className="text-xl" />
                            Instagram
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-hidden">
                {activeTab === 'whatsapp' && (
                    loadingWhatsapp ? (
                        <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                    ) : (
                        <WhatsAppChatManager 
                            contatos={contatosWhatsapp} 
                            onMarkAsRead={handleMarkAsRead}
                            onNewMessageSent={fetchWhatsappData}
                            onContactSelected={(contactId) => setCurrentlyOpenContactId(contactId)}
                        />
                    )
                )}
                 {activeTab === 'instagram' && (
                    <div className="h-full w-full">
                        {sessionStatus === 'unauthenticated' && (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <p className="font-semibold text-gray-700">Conecte sua conta da Meta para ver as mensagens do Instagram.</p>
                                <button onClick={() => signIn('facebook')} className="bg-blue-800 text-white px-4 py-2 rounded-md hover:bg-blue-900 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faInstagram} />
                                    Conectar com a Meta
                                </button>
                            </div>
                        )}
                        {sessionStatus === 'loading' && <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>}
                        {sessionStatus === 'authenticated' && (
                             loadingInstagram ? (
                                <div className="flex justify-center items-center h-full"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
                             ) : (
                                <div className="grid grid-cols-[300px_1fr] h-full bg-white rounded-lg shadow-xl border">
                                    <div className="flex flex-col border-r overflow-hidden">
                                        <div className="p-2 border-b">
                                            <select onChange={(e) => setSelectedAccountId(e.target.value)} value={selectedAccountId} className="w-full p-2 border rounded-md text-sm">
                                                {instagramAccounts.length === 0 && <option>Nenhuma conta encontrada</option>}
                                                {instagramAccounts.map(acc => <option key={acc.page_id} value={acc.page_id}>{acc.name} (@{acc.username})</option>)}
                                            </select>
                                        </div>
                                        <ul className="overflow-y-auto flex-1">
                                            {instagramConversations.map(convo => {
                                                const participant = convo.participants.data.find(p => p.id !== instagramAccounts.find(acc => acc.page_id === selectedAccountId)?.instagram_id);
                                                return (
                                                    <li key={convo.id} className="p-3 border-b hover:bg-gray-50 cursor-pointer flex items-center gap-3">
                                                        <FontAwesomeIcon icon={faUserCircle} className="text-3xl text-gray-400" />
                                                        <div className="flex-1 overflow-hidden">
                                                            <p className="font-semibold truncate">{participant?.name || 'Usuário do Instagram'}</p>
                                                            <p className="text-sm text-gray-600 truncate">{convo.snippet}</p>
                                                        </div>
                                                        {convo.unread_count > 0 && <span className="bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">{convo.unread_count}</span>}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                    <div className="flex items-center justify-center bg-gray-50">
                                        <p className="text-gray-500">Selecione uma conversa para ver as mensagens.</p>
                                    </div>
                                </div>
                             )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
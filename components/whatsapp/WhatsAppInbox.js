'use client'

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getConversations, getBroadcastLists, markMessagesAsRead } from '@/app/(main)/caixa-de-entrada/data-fetching';
import ConversationList from '@/components/whatsapp/ConversationList';
import MessagePanel from '@/components/whatsapp/MessagePanel';
import BroadcastPanel from '@/components/whatsapp/BroadcastPanel';
import ContactProfile from '@/components/whatsapp/ContactProfile';
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';

// CHAVE DE CACHE ESPECÍFICA DO WHATSAPP
const WHATSAPP_UI_STATE_KEY = 'whatsappUiState';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(WHATSAPP_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`Erro ao ler cache (${WHATSAPP_UI_STATE_KEY}):`, error);
        return null;
    }
};

export default function WhatsAppInbox({ onChangeTab }) {
    const cachedState = getCachedData();

    // Estados WhatsApp
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [selectedContact, setSelectedContact] = useState(cachedState?.selectedContact || null);
    const [selectedList, setSelectedList] = useState(cachedState?.selectedList || null);

    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Salvamos apenas o que importa pro WhatsApp
    const uiStateToSave = { selectedContact, selectedList, searchTerm };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(WHATSAPP_UI_STATE_KEY, JSON.stringify(debouncedUiState));
            } catch (error) {
                console.error("Falha ao salvar estado da UI do WhatsApp:", error);
            }
        }
    }, [debouncedUiState]);

    // --- QUERIES ---
    const { data: conversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    const { data: broadcastLists, isLoading: isLoadingLists } = useQuery({
        queryKey: ['broadcastLists', organizacaoId],
        queryFn: () => getBroadcastLists(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    // --- REALTIME ---
    useEffect(() => {
        if (!organizacaoId) return;
        const channel = supabase.channel('whatsapp-realtime-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos', filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
                queryClient.invalidateQueries(['conversations', organizacaoId]);
                if (selectedContact?.contato_id === payload.new?.id) {
                    setSelectedContact(prev => ({ ...prev, nome: payload.new.nome, avatar_url: payload.new.foto_url }));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `organizacao_id=eq.${organizacaoId}` }, () => queryClient.invalidateQueries(['conversations', organizacaoId]))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_broadcast_lists', filter: `organizacao_id=eq.${organizacaoId}` }, () => queryClient.invalidateQueries(['broadcastLists', organizacaoId]))
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [organizacaoId, queryClient, selectedContact?.contato_id]);

    // --- HANDLERS ---
    const handleSelectContact = async (contact) => {
        setSelectedList(null);
        setSelectedContact(contact);
        if (contact && contact.unread_count > 0) {
            await markMessagesAsRead(supabase, organizacaoId, contact.contato_id);
            queryClient.invalidateQueries({ queryKey: ['conversations', organizacaoId] });
        }
    };

    const handleSelectList = (list) => {
        setSelectedContact(null);
        setSelectedList(list);
    };

    const handleBackToList = () => {
        setSelectedContact(null);
        setSelectedList(null);
    };

    // Filtros
    const filteredConversations = conversations?.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone_number.includes(searchTerm)
    );

    const hasSelection = selectedContact || selectedList;

    return (
        <div className="flex h-full w-full">
            <Toaster position="top-right" richColors />

            {/* --- COLUNA 1: NAVEGAÇÃO E LISTAS --- */}
            <div className={`
                ${hasSelection ? 'hidden md:flex' : 'flex'} 
                w-full md:w-[350px] shrink-0
                flex-col border-r bg-white h-full overflow-hidden min-h-0
            `}>
                
                {/* Abas */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    <button className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-[#00a884] text-[#00a884] bg-white">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                    </button>
                    <button onClick={() => onChangeTab('email')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100">
                        <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                    </button>
                </div>

                {/* Busca Específica do WhatsApp */}
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                    <div className="relative">
                        <input type="text" placeholder="Pesquisar conversas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>

                {/* Listas */}
                <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                    <ConversationList
                        conversations={filteredConversations || conversations}
                        broadcastLists={broadcastLists}
                        isLoading={isLoadingConversations || isLoadingLists}
                        onSelectContact={handleSelectContact}
                        selectedContactId={selectedContact?.contato_id || selectedContact?.conversation_id}
                        onSelectList={handleSelectList}
                        selectedListId={selectedList?.id}
                    />
                </div>
            </div>

            {/* --- COLUNA 2: LISTA CENTRAL (CHAT) --- */}
            <div className={`
                ${hasSelection ? 'flex' : 'hidden md:flex'} 
                flex-grow flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0
            `}>
                {selectedContact ? <MessagePanel contact={selectedContact} onBack={handleBackToList} /> :
                selectedList ? <BroadcastPanel list={selectedList} onBack={handleBackToList} /> :
                <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#f0f2f5]"><FontAwesomeIcon icon={faWhatsapp} className="text-6xl mb-4 text-gray-300" /><p>Selecione uma conversa</p></div>
                }
            </div>
            
            {/* --- COLUNA 3: DIREITA (PERFIL WHATSAPP) --- */}
            {selectedContact && (
                <div className="hidden lg:flex w-[350px] shrink-0 border-l bg-white flex-col h-full overflow-hidden min-h-0">
                    <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0"><h2 className="text-base font-semibold text-gray-700">Dados do Contato</h2></div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar"><ContactProfile contact={selectedContact} /></div>
                </div>
            )}
        </div>
    );
}
'use client'

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getConversations, getBroadcastLists, markMessagesAsRead, getWhatsappConfig } from '@/app/(main)/caixa-de-entrada/data-fetching';
import ConversationList from '@/components/whatsapp/ConversationList';
import MessagePanel from '@/components/whatsapp/MessagePanel';
import BroadcastPanel from '@/components/whatsapp/BroadcastPanel';
import ContactProfile from '@/components/whatsapp/ContactProfile';
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEnvelope, faSpinner, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';

const WHATSAPP_UI_STATE_KEY = 'whatsappUiState';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(WHATSAPP_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        return null;
    }
};

export default function WhatsAppInbox({ onChangeTab }) {
    const cachedState = getCachedData();
    const router = useRouter();

    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [selectedContact, setSelectedContact] = useState(cachedState?.selectedContact || null);
    const [selectedList, setSelectedList] = useState(cachedState?.selectedList || null);

    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const uiStateToSave = { selectedContact, selectedList, searchTerm };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try { localStorage.setItem(WHATSAPP_UI_STATE_KEY, JSON.stringify(debouncedUiState)); } catch (e) { }
        }
    }, [debouncedUiState]);

    // 1. O GATEKEEPER
    const { data: whatsappConfig, isLoading: isLoadingConfig } = useQuery({
        queryKey: ['whatsappConfig', organizacaoId],
        queryFn: () => getWhatsappConfig(supabase, organizacaoId),
        enabled: !!organizacaoId,
        refetchOnWindowFocus: true,
    });

    // 2. Busca conversas (só ativa se tiver config)
    const { data: rawConversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId && !!whatsappConfig,
        refetchOnWindowFocus: true,
    });

    // Deduplica as conversas para evitar que a mesma pessoa apareça duas vezes
    const conversations = React.useMemo(() => {
        if (!rawConversations) return [];
        const seen = new Set();
        return rawConversations.filter(c => {
            const identifier = c.contato_id || c.phone_number;
            if (!identifier) return true; // Se não tem identificador, deixa passar
            if (seen.has(identifier)) return false;
            seen.add(identifier);
            return true;
        });
    }, [rawConversations]);


    // 3. Busca listas
    const { data: broadcastLists, isLoading: isLoadingLists } = useQuery({
        queryKey: ['broadcastLists', organizacaoId],
        queryFn: () => getBroadcastLists(supabase, organizacaoId),
        enabled: !!organizacaoId && !!whatsappConfig,
        refetchOnWindowFocus: true,
    });

    // --- REALTIME ---
    useEffect(() => {
        if (!organizacaoId || !whatsappConfig) return;
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
    }, [organizacaoId, queryClient, selectedContact?.contato_id, whatsappConfig]);

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

    const filteredConversations = conversations?.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone_number.includes(searchTerm)
    );

    const hasSelection = selectedContact || selectedList;

    return (
        <div className="flex h-full w-full overflow-hidden bg-white">
            <Toaster position="top-right" richColors />

            {/* --- COLUNA 1: NAVEGAÇÃO E LISTAS (SEMPRE VISÍVEL) --- */}
            <div className={`
                ${(hasSelection && whatsappConfig) ? 'hidden md:flex' : 'flex'} 
                w-full md:w-[350px] shrink-0 flex-col border-r bg-white h-full overflow-hidden min-h-0
            `}>
                {/* Abas Superiores (E-mail e WhatsApp) */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    <button className="flex-1 py-4 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors border-[#00a884] text-[#00a884] bg-white">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                    </button>
                    <button onClick={() => onChangeTab('email')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100">
                        <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                    </button>
                </div>

                {/* Corpo da Coluna 1 */}
                {isLoadingConfig ? (
                    <div className="flex-1 flex justify-center items-center bg-gray-50">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-[#00a884] text-2xl" />
                    </div>
                ) : !whatsappConfig ? (
                    // Estado vazio da Coluna 1 (Para Mobile ou se não tiver config)
                    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-5xl text-gray-300 mb-4" />
                        <p className="text-gray-500 text-sm mb-6">WhatsApp não conectado.</p>
                        <button
                            onClick={() => router.push('/configuracoes/integracoes')}
                            className="md:hidden w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                        >
                            Conectar Agora
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Busca Específica do WhatsApp */}
                        <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                            <div className="relative">
                                <input type="text" placeholder="Pesquisar conversas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all shadow-sm" />
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
                    </>
                )}
            </div>

            {/* --- ÁREA CENTRAL (BLOQUEIO OU CHAT) --- */}
            {isLoadingConfig ? (
                <div className="hidden md:flex flex-grow items-center justify-center bg-[#f0f2f5]">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-[#00a884] text-4xl" />
                </div>
            ) : !whatsappConfig ? (
                // O NOSSO EMPTY STATE LINDO FICA AQUI (NO LUGAR DO CHAT)
                <div className="hidden md:flex flex-grow flex-col items-center justify-center bg-[#f0f2f5] p-6 text-center">
                    <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-100 max-w-lg w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-[#25D366] text-6xl opacity-90" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-800 mb-3">WhatsApp Não Conectado</h2>
                        <p className="text-gray-500 mb-8 leading-relaxed px-4">
                            Conecte o número oficial da sua empresa para enviar mensagens, áudios e gerir toda a sua operação diretamente pelo CRM.
                        </p>
                        <button
                            onClick={() => router.push('/configuracoes/integracoes')}
                            className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 px-6 rounded-xl transition-all hover:shadow-md flex items-center justify-center gap-2"
                        >
                            Conectar WhatsApp Agora <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* --- COLUNA 2: LISTA CENTRAL (CHAT NORMAL) --- */}
                    <div className={`
                        ${hasSelection ? 'flex' : 'hidden md:flex'} 
                        flex-grow flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0
                    `}>
                        {selectedContact ? <MessagePanel contact={selectedContact} onBack={handleBackToList} /> :
                            selectedList ? <BroadcastPanel list={selectedList} onBack={handleBackToList} /> :
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#f0f2f5]"><FontAwesomeIcon icon={faWhatsapp} className="text-7xl mb-6 text-gray-300 opacity-50" /><p className="font-medium text-lg">Selecione uma conversa para iniciar</p></div>
                        }
                    </div>

                    {/* --- COLUNA 3: DIREITA (PERFIL WHATSAPP) --- */}
                    {selectedContact && (
                        <div className="hidden lg:flex w-[350px] shrink-0 border-l bg-white flex-col h-full overflow-hidden min-h-0">
                            <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0"><h2 className="text-base font-bold text-gray-700">Dados do Contato</h2></div>
                            <div className="flex-grow overflow-y-auto custom-scrollbar"><ContactProfile contact={selectedContact} /></div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
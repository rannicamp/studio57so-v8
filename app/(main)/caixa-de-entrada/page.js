'use client'

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getConversations, getBroadcastLists, markMessagesAsRead } from './data-fetching';
import ConversationList from '@/components/whatsapp/ConversationList';
import MessagePanel from '@/components/whatsapp/MessagePanel';
import BroadcastPanel from '@/components/whatsapp/BroadcastPanel';
import ContactProfile from '@/components/whatsapp/ContactProfile';
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { useDebounce } from 'use-debounce';

// CHAVE DE CACHE
const CAIXA_ENTRADA_UI_STATE_KEY = 'caixaEntradaUiState';

// Função auxiliar para ler o cache
const getCachedData = (key) => {
    if (typeof window === 'undefined') return undefined;
    try {
        const cachedData = localStorage.getItem(key);
        return cachedData ? JSON.parse(cachedData) : undefined;
    } catch (error) {
        console.error(`Erro ao ler cache (${key}):`, error);
        return undefined;
    }
};

export default function CaixaDeEntrada() {
    const [selectedContact, setSelectedContact] = useState(null);
    const [selectedList, setSelectedList] = useState(null);
    const [searchTerm, setSearchTerm] = useState(''); 
    
    // Refs para controlar a restauração
    const hasRestoredUiState = useRef(false);
    
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- 1. RESTAURAÇÃO DE ESTADO ---
    useEffect(() => {
        if (!hasRestoredUiState.current) {
            const savedUiState = getCachedData(CAIXA_ENTRADA_UI_STATE_KEY);
            if (savedUiState) {
                if (savedUiState.selectedContact) setSelectedContact(savedUiState.selectedContact);
                if (savedUiState.selectedList) setSelectedList(savedUiState.selectedList);
            }
            hasRestoredUiState.current = true;
        }
    }, []);

    // --- 2. SALVAMENTO AUTOMÁTICO ---
    const uiStateToSave = { selectedContact, selectedList };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (hasRestoredUiState.current) {
            try {
                localStorage.setItem(CAIXA_ENTRADA_UI_STATE_KEY, JSON.stringify(debouncedUiState));
            } catch (error) {
                console.error("Falha ao salvar estado da UI:", error);
            }
        }
    }, [debouncedUiState]);

    // --- 3. QUERIES DE DADOS ---
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

    // --- 4. REALTIME UPDATES ---
    useEffect(() => {
        if (!organizacaoId) return;
        
        const channel = supabase.channel('whatsapp-realtime-dashboard')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'contatos', filter: `organizacao_id=eq.${organizacaoId}` }, 
                (payload) => {
                    queryClient.invalidateQueries(['conversations', organizacaoId]);
                    if (selectedContact?.contato_id === payload.new?.id) {
                        setSelectedContact(prev => ({ ...prev, nome: payload.new.nome, avatar_url: payload.new.foto_url }));
                    }
                }
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `organizacao_id=eq.${organizacaoId}` }, 
                () => {
                    queryClient.invalidateQueries(['conversations', organizacaoId]);
                }
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'whatsapp_broadcast_lists', filter: `organizacao_id=eq.${organizacaoId}` }, 
                () => {
                    queryClient.invalidateQueries(['broadcastLists', organizacaoId]);
                }
            )
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
    
    const filteredConversations = conversations?.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone_number.includes(searchTerm)
    );

    const hasSelection = selectedContact || selectedList;

    return (
        // --- LAYOUT AJUSTADO PC E MOBILE ---
        // MOBILE: fixed top-16 bottom-[88px] (trava no meio da tela)
        // DESKTOP (md): md:h-[calc(100vh-144px)] 
        // -> Cálculo Desktop: 100vh (Tela Total) - 64px (Topo) - 80px (Folga Embaixo) = 144px
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-144px)]
        ">
            <Toaster position="top-right" richColors />

            {/* COLUNA 1: LISTA */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white h-full overflow-hidden min-h-0`}>
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-[#f0f2f5] shrink-0 z-10">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Pesquisar..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884] text-sm" 
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto custom-scrollbar">
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

            {/* COLUNA 2: PAINEL CENTRAL */}
            <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0`}>
                {selectedContact ? (
                    <MessagePanel contact={selectedContact} onBack={handleBackToList} />
                ) : selectedList ? (
                    <BroadcastPanel list={selectedList} onBack={handleBackToList} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <p>Selecione uma conversa ou lista para começar.</p>
                    </div>
                )}
            </div>
            
            {/* COLUNA 3: PERFIL */}
            {selectedContact && (
                <div className="hidden lg:flex w-1/4 flex-col border-l bg-white h-full overflow-hidden min-h-0">
                    <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0">
                        <h2 className="text-base font-semibold text-gray-700">Dados do Contato</h2>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        <ContactProfile contact={selectedContact} />
                    </div>
                </div>
            )}
        </div>
    );
}
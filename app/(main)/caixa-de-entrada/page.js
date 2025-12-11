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

// CHAVE DE CACHE (Para salvar o estado desta página)
const CAIXA_ENTRADA_UI_STATE_KEY = 'caixaEntradaUiState';

// Função auxiliar para ler o cache ANTES de renderizar (evita "piscada")
const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(CAIXA_ENTRADA_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`Erro ao ler cache (${CAIXA_ENTRADA_UI_STATE_KEY}):`, error);
        return null;
    }
};

export default function CaixaDeEntrada() {
    // 1. INICIALIZAÇÃO INTELIGENTE (Já nasce com os dados salvos)
    const cachedState = getCachedData();

    const [selectedContact, setSelectedContact] = useState(cachedState?.selectedContact || null);
    const [selectedList, setSelectedList] = useState(cachedState?.selectedList || null);
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || ''); // Agora o termo de busca também é salvo!
    
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- 2. PERSISTÊNCIA AUTOMÁTICA ---
    // Agrupamos tudo que queremos salvar
    const uiStateToSave = { selectedContact, selectedList, searchTerm };
    // Usamos debounce para não salvar a cada letra digitada (espera 1s)
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    // Efeito que efetivamente grava no navegador
    useEffect(() => {
        if (typeof window !== 'undefined') {
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
                    // Se o contato aberto foi editado, atualizamos os dados dele na tela
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
        // --- LAYOUT TRAVADO (Mantendo o ajuste de altura que funcionou) ---
        // PC: Altura da tela - Header (64px) - Padding Inferior (80px para garantir folga do menu)
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-64px)] md:pb-20
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
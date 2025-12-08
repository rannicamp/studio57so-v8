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
import { useDebounce } from 'use-debounce'; // IMPORTANTE: Mesma lib do Financeiro

// CHAVE DE CACHE (Igual ao Financeiro, mas exclusiva desta página)
const CAIXA_ENTRADA_UI_STATE_KEY = 'caixaEntradaUiState';

// Função auxiliar para ler o cache com segurança
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
    
    // Refs para controlar a restauração (padrão do Financeiro)
    const hasRestoredUiState = useRef(false);
    
    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- 1. RESTAURAÇÃO DE ESTADO (MEMÓRIA DE ELEFANTE 🐘) ---
    useEffect(() => {
        // Só restaura na primeira carga
        if (!hasRestoredUiState.current) {
            const savedUiState = getCachedData(CAIXA_ENTRADA_UI_STATE_KEY);
            if (savedUiState) {
                // Restaura o contato ou lista que estava aberto
                if (savedUiState.selectedContact) setSelectedContact(savedUiState.selectedContact);
                if (savedUiState.selectedList) setSelectedList(savedUiState.selectedList);
            }
            hasRestoredUiState.current = true;
        }
    }, []);

    // --- 2. SALVAMENTO AUTOMÁTICO (DEBOUNCE) ---
    // Preparamos o objeto que queremos salvar
    const uiStateToSave = { selectedContact, selectedList };
    // Aguarda 1 segundo após a última mudança para salvar (evita lentidão)
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (hasRestoredUiState.current) { // Só salva depois de ter restaurado
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
        const channel = supabase.channel('contacts-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contatos', filter: `organizacao_id=eq.${organizacaoId}` }, (payload) => {
                queryClient.invalidateQueries(['conversations', organizacaoId]);
                // Se o contato selecionado foi alterado, atualiza ele na tela
                if (selectedContact?.contato_id === payload.new?.id) {
                    setSelectedContact(prev => ({ ...prev, nome: payload.new.nome, avatar_url: payload.new.foto_url }));
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_broadcast_lists', filter: `organizacao_id=eq.${organizacaoId}` }, () => {
                queryClient.invalidateQueries(['broadcastLists', organizacaoId]);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [organizacaoId, queryClient, selectedContact?.contato_id]);

    // --- HANDLERS ---
    const handleSelectContact = async (contact) => {
        setSelectedList(null);
        setSelectedContact(contact);
        if (contact.unread_count > 0) {
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
    
    const hasSelection = selectedContact || selectedList;

    return (
        <div className="flex h-full w-full bg-gray-100 overflow-hidden">
            <Toaster position="top-right" richColors />

            {/* COLUNA 1: LISTA (Conversas/Listas) */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white`}>
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-[#f0f2f5] shrink-0">
                    <div className="relative">
                        <input type="text" placeholder="Pesquisar..." className="w-full pl-10 pr-4 py-1.5 border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884] text-sm" />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>
                
                <ConversationList
                    conversations={conversations}
                    broadcastLists={broadcastLists}
                    isLoading={isLoadingConversations || isLoadingLists}
                    onSelectContact={handleSelectContact}
                    selectedContactId={selectedContact?.contato_id}
                    onSelectList={handleSelectList}
                    selectedListId={selectedList?.id}
                />
            </div>

            {/* COLUNA 2: PAINEL CENTRAL (Chat ou Broadcast) */}
            <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-[#efeae2]`}>
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
            
            {/* COLUNA 3: PERFIL (Só aparece se for Contato) */}
            {selectedContact && (
                <div className="hidden lg:flex w-1/4 flex-col border-l bg-white">
                    <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0">
                        <h2 className="text-base font-semibold text-gray-700">Dados do Contato</h2>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        <ContactProfile contact={selectedContact} />
                    </div>
                </div>
            )}
        </div>
    );
}
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
import EmailConfigModal from '@/components/email/EmailConfigModal'; // <--- NOVO IMPORT
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEnvelope, faInbox, faCog } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';

// CHAVE DE CACHE (Para salvar o estado desta página)
const CAIXA_ENTRADA_UI_STATE_KEY = 'caixaEntradaUiState';

// Função auxiliar para ler o cache ANTES de renderizar
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
    // 1. INICIALIZAÇÃO INTELIGENTE
    const cachedState = getCachedData();

    // Estados
    const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'whatsapp');
    const [selectedContact, setSelectedContact] = useState(cachedState?.selectedContact || null);
    const [selectedList, setSelectedList] = useState(cachedState?.selectedList || null);
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    
    // Novo estado para e-mail
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false); // <--- NOVO ESTADO

    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- 2. PERSISTÊNCIA AUTOMÁTICA ---
    const uiStateToSave = { selectedContact, selectedList, searchTerm, activeTab };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(CAIXA_ENTRADA_UI_STATE_KEY, JSON.stringify(debouncedUiState));
            } catch (error) {
                console.error("Falha ao salvar estado da UI:", error);
            }
        }
    }, [debouncedUiState]);

    // --- 3. QUERIES DE DADOS (WHATSAPP) ---
    const isWhatsAppTab = activeTab === 'whatsapp';

    const { data: conversations, isLoading: isLoadingConversations } = useQuery({
        queryKey: ['conversations', organizacaoId],
        queryFn: () => getConversations(supabase, organizacaoId),
        enabled: !!organizacaoId && isWhatsAppTab,
        refetchOnWindowFocus: true,
    });

    const { data: broadcastLists, isLoading: isLoadingLists } = useQuery({
        queryKey: ['broadcastLists', organizacaoId],
        queryFn: () => getBroadcastLists(supabase, organizacaoId),
        enabled: !!organizacaoId && isWhatsAppTab,
        refetchOnWindowFocus: true,
    });

    // --- 4. REALTIME UPDATES (WHATSAPP) ---
    useEffect(() => {
        if (!organizacaoId || !isWhatsAppTab) return;
        
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
                () => queryClient.invalidateQueries(['conversations', organizacaoId])
            )
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'whatsapp_broadcast_lists', filter: `organizacao_id=eq.${organizacaoId}` }, 
                () => queryClient.invalidateQueries(['broadcastLists', organizacaoId])
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organizacaoId, queryClient, selectedContact?.contato_id, isWhatsAppTab]);

    // --- HANDLERS ---
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedContact(null);
        setSelectedList(null);
        setSelectedEmail(null);
    };

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
        setSelectedEmail(null);
    };
    
    // Filtros
    const filteredConversations = conversations?.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone_number.includes(searchTerm)
    );

    const hasSelection = selectedContact || selectedList || selectedEmail;

    return (
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-64px)] md:pb-20
        ">
            <Toaster position="top-right" richColors />
            
            {/* --- MODAL DE CONFIGURAÇÃO DE EMAIL (INVISÍVEL ATÉ CLICAR) --- */}
            <EmailConfigModal isOpen={isEmailConfigOpen} onClose={() => setIsEmailConfigOpen(false)} />

            {/* --- COLUNA 1: LISTAS (Esquerda) --- */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white h-full overflow-hidden min-h-0`}>
                
                {/* 1. ABAS DE NAVEGAÇÃO */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    <button 
                        onClick={() => handleTabChange('whatsapp')}
                        className={`flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'whatsapp' ? 'border-[#00a884] text-[#00a884] bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" />
                        WhatsApp
                    </button>
                    <button 
                        onClick={() => handleTabChange('email')}
                        className={`flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'email' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FontAwesomeIcon icon={faEnvelope} className="text-lg" />
                        E-mail
                    </button>
                </div>

                {/* 2. BARRA DE PESQUISA */}
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder={activeTab === 'whatsapp' ? "Pesquisar conversas..." : "Pesquisar e-mails..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" 
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>

                {/* 3. CONTEÚDO DA LISTA */}
                <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                    {activeTab === 'whatsapp' ? (
                        <ConversationList
                            conversations={filteredConversations || conversations}
                            broadcastLists={broadcastLists}
                            isLoading={isLoadingConversations || isLoadingLists}
                            onSelectContact={handleSelectContact}
                            selectedContactId={selectedContact?.contato_id || selectedContact?.conversation_id}
                            onSelectList={handleSelectList}
                            selectedListId={selectedList?.id}
                        />
                    ) : (
                        // --- LISTA DE E-MAILS (Placeholder) ---
                        <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-gray-400">
                            <div className="bg-blue-50 p-4 rounded-full mb-3">
                                <FontAwesomeIcon icon={faEnvelope} className="text-3xl text-blue-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">Nenhum e-mail conectado</p>
                            <p className="text-xs mt-1">Configure sua conta para ver seus e-mails aqui.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- COLUNA 2: PAINEL CENTRAL --- */}
            <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0`}>
                {activeTab === 'whatsapp' ? (
                    selectedContact ? (
                        <MessagePanel contact={selectedContact} onBack={handleBackToList} />
                    ) : selectedList ? (
                        <BroadcastPanel list={selectedList} onBack={handleBackToList} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#f0f2f5]">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-6xl mb-4 text-gray-300" />
                            <p>Selecione uma conversa do WhatsApp</p>
                        </div>
                    )
                ) : (
                    // --- PAINEL VAZIO DE E-MAIL (Com Botão de Configuração) ---
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500 p-8 text-center">
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
                            <FontAwesomeIcon icon={faInbox} className="text-5xl text-blue-500 mb-6" />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Cliente de E-mail Studio 57</h3>
                            <p className="text-sm text-gray-600 mb-6">
                                Centralize sua comunicação. Conecte seu e-mail profissional (IMAP/SMTP) para enviar e receber mensagens diretamente do painel.
                            </p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={() => setIsEmailConfigOpen(true)} // <--- ABRE O MODAL
                                    className="block w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
                                >
                                    <FontAwesomeIcon icon={faCog} />
                                    Configurar E-mail
                                </button>
                                <button className="block w-full py-2.5 px-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                                    Saiba mais
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* --- COLUNA 3: PERFIL (Apenas WhatsApp por enquanto) --- */}
            {activeTab === 'whatsapp' && selectedContact && (
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
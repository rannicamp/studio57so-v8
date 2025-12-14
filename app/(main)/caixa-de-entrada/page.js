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
import EmailConfigModal from '@/components/email/EmailConfigModal';
import EmailListPanel from '@/components/email/EmailListPanel';
import EmailViewPanel from '@/components/email/EmailViewPanel'; // <--- NOVO IMPORT
import { Toaster } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSearch, faEnvelope, faInbox, faCog, faFolder, 
    faSpinner, faExclamationTriangle, faPaperPlane, faTrash, faBan
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';
import Link from 'next/link';

// CHAVE DE CACHE
const CAIXA_ENTRADA_UI_STATE_KEY = 'caixaEntradaUiState';

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

const getEmailFolders = async () => {
    const res = await fetch('/api/email/folders');
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao buscar pastas');
    }
    return res.json();
};

const getFolderIcon = (name) => {
    const n = name.toLowerCase();
    if (n.includes('inbox') || n.includes('entrada')) return faInbox;
    if (n.includes('sent') || n.includes('enviad')) return faPaperPlane;
    if (n.includes('trash') || n.includes('lixeira')) return faTrash;
    if (n.includes('spam') || n.includes('junk')) return faBan;
    return faFolder; 
};

export default function CaixaDeEntrada() {
    const cachedState = getCachedData();

    // Estados Gerais
    const [activeTab, setActiveTab] = useState(cachedState?.activeTab || 'whatsapp');
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    
    // Estados WhatsApp
    const [selectedContact, setSelectedContact] = useState(cachedState?.selectedContact || null);
    const [selectedList, setSelectedList] = useState(cachedState?.selectedList || null);
    
    // Estados E-mail
    const [selectedEmailFolder, setSelectedEmailFolder] = useState(null); 
    const [selectedEmail, setSelectedEmail] = useState(null); // <--- ESTADO NOVO DO EMAIL
    const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);

    const queryClient = useQueryClient();
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

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

    const isWhatsAppTab = activeTab === 'whatsapp';
    const isEmailTab = activeTab === 'email';

    // --- QUERIES ---
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

    const { 
        data: emailData, isLoading: isLoadingEmail, isError: isEmailError, error: emailError 
    } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: getEmailFolders,
        enabled: isEmailTab, 
        retry: false, 
        refetchOnWindowFocus: false, 
    });

    // --- REALTIME ---
    useEffect(() => {
        if (!organizacaoId || !isWhatsAppTab) return;
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
    }, [organizacaoId, queryClient, selectedContact?.contato_id, isWhatsAppTab]);

    // --- HANDLERS ---
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSelectedContact(null);
        setSelectedList(null);
        // Não limpamos selectedEmailFolder para manter a pasta aberta, mas limpamos a leitura
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
    
    // Handler para selecionar E-mail (NOVO)
    const handleSelectEmail = (email) => {
        setSelectedEmail(email);
    };

    // Handler de Voltar
    const handleBackToList = () => {
        // Se estiver vendo um e-mail, volta pra lista de e-mails
        if (activeTab === 'email' && selectedEmail) {
            setSelectedEmail(null);
            return;
        }
        // Se estiver vendo uma pasta de e-mail, volta pras pastas
        if (activeTab === 'email' && selectedEmailFolder) {
            setSelectedEmailFolder(null);
            return;
        }
        
        // Padrão WhatsApp
        setSelectedContact(null);
        setSelectedList(null);
    };
    
    // Filtros
    const filteredConversations = conversations?.filter(c => 
        c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone_number.includes(searchTerm)
    );

    const hasSelection = selectedContact || selectedList || selectedEmailFolder;

    // --- LÓGICA DE LAYOUT 3 COLUNAS ---
    // WhatsApp: Sidebar | Chat (Grande) | Perfil (Pequeno)
    // E-mail: Sidebar | Lista (Médio) | Leitura (Grande)
    
    // Verifica se devemos mostrar a coluna de leitura do E-mail
    const showEmailReadingPane = isEmailTab && selectedEmail;

    return (
        <div className="
            w-full bg-gray-100 overflow-hidden flex
            fixed inset-x-0 top-16 bottom-[88px] 
            md:static md:inset-auto md:h-[calc(100vh-64px)] md:pb-20
        ">
            <Toaster position="top-right" richColors />
            <EmailConfigModal isOpen={isEmailConfigOpen} onClose={() => setIsEmailConfigOpen(false)} />

            {/* --- COLUNA 1: NAVEGAÇÃO E LISTAS --- */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white h-full overflow-hidden min-h-0`}>
                
                {/* Abas */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    <button onClick={() => handleTabChange('whatsapp')} className={`flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'whatsapp' ? 'border-[#00a884] text-[#00a884] bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                    </button>
                    <button onClick={() => handleTabChange('email')} className={`flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'email' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                        <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                    </button>
                </div>

                {/* Busca */}
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                    <div className="relative">
                        <input type="text" placeholder={activeTab === 'whatsapp' ? "Pesquisar conversas..." : "Pesquisar e-mails..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>

                {/* Listas */}
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
                        isLoadingEmail ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl mb-2 text-blue-500" /><p className="text-xs">Conectando...</p></div>
                        ) : isEmailError ? (
                            <div className="p-6 text-center text-gray-500">
                                <div className="bg-red-50 p-4 rounded-full mb-3 inline-block"><FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-red-400" /></div>
                                <p className="text-sm font-medium text-gray-700 mb-1">Ops! Falha na conexão</p>
                                <button onClick={() => setIsEmailConfigOpen(true)} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-md mt-2">Configurar E-mail</button>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                <div className="p-3 bg-blue-50/50 text-xs font-bold text-blue-800 flex justify-between items-center tracking-wide"><span>SUAS PASTAS</span><button onClick={() => setIsEmailConfigOpen(true)} title="Ajustes"><FontAwesomeIcon icon={faCog} /></button></div>
                                {emailData?.folders?.map((folder, idx) => (
                                    <button key={idx} onClick={() => setSelectedEmailFolder(folder)} className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm transition-colors ${selectedEmailFolder?.name === folder.name ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                                        <FontAwesomeIcon icon={getFolderIcon(folder.name)} className={`${selectedEmailFolder?.name === folder.name ? 'text-blue-500' : 'text-gray-400'}`} />
                                        <span className="truncate">{folder.name}</span>
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* --- COLUNA 2: LISTA CENTRAL (CHAT ou LISTA DE EMAILS) --- */}
            {/* LÓGICA DE LARGURA: Se for E-mail e estiver lendo, a coluna fica menor (30%). Se for WhatsApp, ocupa tudo (flex-grow). */}
            <div className={`
                ${hasSelection ? 'flex' : 'hidden md:flex'} 
                ${showEmailReadingPane ? 'hidden lg:flex lg:w-[350px] xl:w-[400px] border-r shrink-0' : 'flex-grow'} 
                flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0 transition-all duration-300
            `}>
                {activeTab === 'whatsapp' ? (
                    selectedContact ? <MessagePanel contact={selectedContact} onBack={handleBackToList} /> :
                    selectedList ? <BroadcastPanel list={selectedList} onBack={handleBackToList} /> :
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#f0f2f5]"><FontAwesomeIcon icon={faWhatsapp} className="text-6xl mb-4 text-gray-300" /><p>Selecione uma conversa</p></div>
                ) : (
                    selectedEmailFolder ? (
                        <EmailListPanel 
                            folder={selectedEmailFolder} 
                            onBack={handleBackToList} 
                            onSelectEmail={handleSelectEmail}
                            selectedEmailId={selectedEmail?.id} 
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500 p-8 text-center">
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
                                <FontAwesomeIcon icon={faInbox} className="text-5xl text-blue-500 mb-6" />
                                <h3 className="text-xl font-bold text-gray-800 mb-2">E-mail Conectado!</h3>
                                <p className="text-sm text-gray-600 mb-6">Selecione uma pasta ao lado.</p>
                            </div>
                        </div>
                    )
                )}
            </div>
            
            {/* --- COLUNA 3: DIREITA (PERFIL WHATSAPP ou LEITURA DE E-MAIL) --- */}
            {/* LÓGICA: Se for E-mail, ocupa o resto da tela (flex-grow). Se for WhatsApp, é fixo (w-1/4). */}
            {((activeTab === 'whatsapp' && selectedContact) || showEmailReadingPane) && (
                <div className={`
                    ${showEmailReadingPane ? 'flex-grow w-full lg:w-auto bg-white' : 'hidden lg:flex w-1/4 border-l bg-white'} 
                    flex-col h-full overflow-hidden min-h-0
                    ${showEmailReadingPane && !selectedEmail ? 'hidden' : 'flex'}
                `}>
                    {activeTab === 'whatsapp' && selectedContact ? (
                        <>
                            <div className="h-16 border-b flex items-center px-4 bg-[#f0f2f5] shrink-0"><h2 className="text-base font-semibold text-gray-700">Dados do Contato</h2></div>
                            <div className="flex-grow overflow-y-auto custom-scrollbar"><ContactProfile contact={selectedContact} /></div>
                        </>
                    ) : (
                        // Componente de Leitura de Email (Ocupa o espaço grande)
                        showEmailReadingPane && (
                            <EmailViewPanel 
                                emailSummary={selectedEmail} 
                                folder={selectedEmailFolder} 
                                onClose={() => setSelectedEmail(null)} 
                            />
                        )
                    )}
                </div>
            )}
        </div>
    );
}
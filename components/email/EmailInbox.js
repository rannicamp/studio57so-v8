'use client'

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import EmailConfigModal from '@/components/email/EmailConfigModal';
import EmailListPanel from '@/components/email/EmailListPanel';
import EmailViewPanel from '@/components/email/EmailViewPanel';
import EmailComposeModal from '@/components/email/EmailComposeModal'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faEnvelope, faInbox, faCog, faFolder, faSpinner, faExclamationTriangle, faPaperPlane, faTrash, faBan, faPlus } from '@fortawesome/free-solid-svg-icons'; 
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useDebounce } from 'use-debounce';

// CHAVE DE CACHE ESPECÍFICA DO EMAIL
const EMAIL_UI_STATE_KEY = 'emailUiState';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(EMAIL_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error(`Erro ao ler cache (${EMAIL_UI_STATE_KEY}):`, error);
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

export default function EmailInbox({ onChangeTab }) {
    const cachedState = getCachedData();

    // Estados E-mail
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [selectedEmailFolder, setSelectedEmailFolder] = useState(cachedState?.selectedEmailFolder || null); 
    const [selectedEmail, setSelectedEmail] = useState(cachedState?.selectedEmail || null);
    const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);
    
    // ESTADO DO MODAL DE COMPOSIÇÃO
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    const [debouncedSearchTerm] = useDebounce(searchTerm, 600);

    const hasRestoredUiState = useRef(false);
    useEffect(() => { hasRestoredUiState.current = true; }, []);

    const uiStateToSave = { selectedEmailFolder, searchTerm, selectedEmail };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (typeof window !== 'undefined' && hasRestoredUiState.current) {
            try {
                localStorage.setItem(EMAIL_UI_STATE_KEY, JSON.stringify(debouncedUiState));
            } catch (error) {
                console.error("Falha ao salvar UI:", error);
            }
        }
    }, [debouncedUiState]);

    const { 
        data: emailData, isLoading: isLoadingEmail, isError: isEmailError, error: emailError 
    } = useQuery({
        queryKey: ['emailFolders'],
        queryFn: getEmailFolders,
        retry: false, 
        refetchOnWindowFocus: false, 
        staleTime: 1000 * 60 * 5
    });

    const handleSelectEmail = (email) => {
        setSelectedEmail(email);
    };

    const handleBackToList = () => {
        if (selectedEmail) {
            setSelectedEmail(null);
            return;
        }
        if (selectedEmailFolder) {
            setSelectedEmailFolder(null);
            return;
        }
    };

    const hasSelection = selectedEmailFolder;
    const showEmailReadingPane = selectedEmail;

    return (
        <div className="flex h-full w-full relative">
            <EmailConfigModal isOpen={isEmailConfigOpen} onClose={() => setIsEmailConfigOpen(false)} />
            
            {/* MODAL DE NOVO EMAIL */}
            <EmailComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />

            {/* --- COLUNA 1: NAVEGAÇÃO E PASTAS --- */}
            <div className={`${hasSelection ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 lg:w-1/4 flex-col border-r bg-white h-full overflow-hidden min-h-0`}>
                
                {/* Abas */}
                <div className="flex border-b bg-gray-50 shrink-0">
                    <button onClick={() => onChangeTab('whatsapp')} className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-transparent text-gray-500 hover:bg-gray-100">
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg" /> WhatsApp
                    </button>
                    <button className="flex-1 py-4 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors border-blue-600 text-blue-600 bg-white">
                        <FontAwesomeIcon icon={faEnvelope} className="text-lg" /> E-mail
                    </button>
                </div>

                {/* BOTÃO FLUTUANTE DE NOVO E-MAIL */}
                <div className="p-4 pb-0">
                    <button 
                        onClick={() => setIsComposeOpen(true)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center justify-center gap-2 text-sm font-bold transition-transform active:scale-95"
                    >
                        <FontAwesomeIcon icon={faPlus} /> Escrever E-mail
                    </button>
                </div>

                {/* Busca Específica do E-mail */}
                <div className="h-16 border-b flex flex-col justify-center px-4 bg-white shrink-0 z-10">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pl-10 pr-4 py-1.5 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all" 
                        />
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    </div>
                </div>

                {/* Lista de Pastas */}
                <div className="flex-grow overflow-y-auto custom-scrollbar bg-white">
                    {isLoadingEmail ? (
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
                                <button 
                                    key={idx} 
                                    onClick={() => setSelectedEmailFolder(folder)} 
                                    className={`
                                        w-full text-left py-3 hover:bg-gray-50 flex items-center gap-3 text-sm transition-colors
                                        ${selectedEmailFolder?.path === folder.path ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                                    `}
                                    // APLICANDO A INDENTAÇÃO AQUI (padding left base + nivel * 12px)
                                    style={{ paddingLeft: `${16 + ((folder.level || 0) * 16)}px`, paddingRight: '16px' }}
                                >
                                    <FontAwesomeIcon 
                                        icon={getFolderIcon(folder.name)} 
                                        className={`
                                            ${selectedEmailFolder?.path === folder.path ? 'text-blue-500' : 'text-gray-400'}
                                            ${(folder.level || 0) > 0 ? 'text-xs opacity-75' : ''} 
                                        `} 
                                    />
                                    <span className="truncate">
                                        {folder.displayName || folder.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- COLUNA 2: LISTA DE EMAILS --- */}
            <div className={`
                ${hasSelection ? 'flex' : 'hidden md:flex'} 
                ${showEmailReadingPane ? 'hidden lg:flex lg:w-[350px] xl:w-[400px] border-r shrink-0' : 'flex-grow'} 
                flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0 transition-all duration-300
            `}>
                {selectedEmailFolder ? (
                    <EmailListPanel 
                        folder={selectedEmailFolder} 
                        onBack={handleBackToList} 
                        onSelectEmail={handleSelectEmail}
                        selectedEmailId={selectedEmail?.id}
                        searchTerm={debouncedSearchTerm}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-500 p-8 text-center">
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-md w-full">
                            <FontAwesomeIcon icon={faInbox} className="text-5xl text-blue-500 mb-6" />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">E-mail Conectado!</h3>
                            <p className="text-sm text-gray-600 mb-6">Selecione uma pasta ao lado.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* --- COLUNA 3: LEITURA DE E-MAIL --- */}
            {showEmailReadingPane && (
                <div className="flex-grow w-full lg:w-auto bg-white flex-col h-full overflow-hidden min-h-0">
                    <EmailViewPanel 
                        emailSummary={selectedEmail} 
                        folder={selectedEmailFolder} 
                        onClose={() => setSelectedEmail(null)} 
                    />
                </div>
            )}
        </div>
    );
}
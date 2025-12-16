'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import EmailConfigModal from '@/components/email/EmailConfigModal';
import EmailListPanel from '@/components/email/EmailListPanel';
import EmailViewPanel from '@/components/email/EmailViewPanel';
import EmailComposeModal from '@/components/email/EmailComposeModal'; 
import EmailSidebar from '@/components/email/EmailSidebar'; // <--- O NOVO FILHO
import { faInbox } from '@fortawesome/free-solid-svg-icons'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';

const EMAIL_UI_STATE_KEY = 'emailUiState';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(EMAIL_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        return null;
    }
};

export default function EmailInbox({ onChangeTab }) {
    const cachedState = getCachedData();
    const queryClient = useQueryClient();

    // --- Estados ---
    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [selectedEmailFolder, setSelectedEmailFolder] = useState(cachedState?.selectedEmailFolder || null); 
    const [selectedEmail, setSelectedEmail] = useState(cachedState?.selectedEmail || null);
    
    const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(false);
    const [configInitialTab, setConfigInitialTab] = useState('connection'); 
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    
    const [debouncedSearchTerm] = useDebounce(searchTerm, 600);

    // --- Persistência UI ---
    const hasRestoredUiState = useRef(false);
    useEffect(() => { hasRestoredUiState.current = true; }, []);

    const uiStateToSave = { selectedEmailFolder, searchTerm, selectedEmail };
    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        if (typeof window !== 'undefined' && hasRestoredUiState.current) {
            localStorage.setItem(EMAIL_UI_STATE_KEY, JSON.stringify(debouncedUiState));
        }
    }, [debouncedUiState]);

    // --- Gatilho de Regras ---
    useEffect(() => {
        const isInbox = selectedEmailFolder?.name?.toUpperCase() === 'INBOX' || 
                        selectedEmailFolder?.displayName === 'Caixa de Entrada';

        if (!selectedEmailFolder || isInbox) {
            const runRules = async () => {
                try {
                    const res = await fetch('/api/email/rules/apply', { method: 'POST' });
                    const data = await res.json();
                    if (data.moved > 0) {
                        toast.success(`Automação: ${data.moved} e-mails movidos.`);
                        setTimeout(() => {
                            queryClient.resetQueries({ queryKey: ['emailMessages'] });
                            queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
                        }, 1500); 
                    }
                } catch (err) {
                    console.error("Erro silencioso ao rodar regras:", err);
                }
            };
            runRules();
            const intervalId = setInterval(runRules, 30000);
            return () => clearInterval(intervalId);
        }
    }, [selectedEmailFolder, queryClient]);

    // --- Handlers ---
    const handleSelectEmail = (email) => setSelectedEmail(email);
    
    const handleBackToList = () => {
        if (selectedEmail) { setSelectedEmail(null); return; }
        if (selectedEmailFolder) { setSelectedEmailFolder(null); return; }
    };

    const handleOpenRules = () => {
        setConfigInitialTab('rules');
        setIsEmailConfigOpen(true);
    };

    const handleOpenConfig = () => {
        setConfigInitialTab('connection');
        setIsEmailConfigOpen(true);
    };

    const hasSelection = selectedEmailFolder;
    const showEmailReadingPane = selectedEmail;

    return (
        <div className="flex h-full w-full relative bg-gray-100 overflow-hidden">
            <EmailConfigModal 
                isOpen={isEmailConfigOpen} 
                onClose={() => setIsEmailConfigOpen(false)} 
                initialTab={configInitialTab} 
            />
            
            <EmailComposeModal isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)} />

            {/* --- COMPONENTE 1: SIDEBAR --- */}
            <EmailSidebar 
                className={`w-full md:w-[280px] shrink-0 ${hasSelection ? 'hidden md:flex' : 'flex'}`}
                selectedFolder={selectedEmailFolder}
                onSelectFolder={setSelectedEmailFolder}
                onCompose={() => setIsComposeOpen(true)}
                onConfig={handleOpenConfig}
                onChangeTab={onChangeTab}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
            />

            {/* --- COMPONENTE 2: LISTA DE E-MAILS --- */}
            <div className={`
                ${hasSelection ? 'flex' : 'hidden md:flex'} 
                ${showEmailReadingPane ? 'hidden lg:flex lg:w-[350px] border-r shrink-0' : 'flex-grow'} 
                flex-col bg-[#efeae2] h-full overflow-hidden relative min-h-0 shadow-xl z-20
            `}>
                {selectedEmailFolder ? (
                    <EmailListPanel 
                        folder={selectedEmailFolder} 
                        onBack={handleBackToList} 
                        onSelectEmail={handleSelectEmail}
                        selectedEmailId={selectedEmail?.id}
                        searchTerm={debouncedSearchTerm}
                        onCreateRule={handleOpenRules} 
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

            {/* --- COMPONENTE 3: LEITURA --- */}
            {showEmailReadingPane && (
                <div className="flex-grow w-full lg:w-auto bg-white flex-col h-full overflow-hidden min-h-0 relative z-10">
                    <EmailViewPanel 
                        emailSummary={selectedEmail} 
                        folder={selectedEmailFolder} 
                        onClose={() => setSelectedEmail(null)} 
                        onCreateRule={handleOpenRules} 
                    />
                </div>
            )}
        </div>
    );
}
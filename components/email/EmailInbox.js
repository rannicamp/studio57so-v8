'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import EmailConfigModal from '@/components/email/EmailConfigModal';
import EmailListPanel from '@/components/email/EmailListPanel';
import EmailViewPanel from '@/components/email/EmailViewPanel';
import EmailComposeModal from '@/components/email/EmailComposeModal';
import EmailSidebar from '@/components/email/EmailSidebar';
import EmailCreateFolderModal from '@/components/email/EmailCreateFolderModal';
import { faInbox, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useDebounce } from 'use-debounce';
import { toast } from 'sonner';

const EMAIL_UI_STATE_KEY = 'emailUiState_v2';

const getCachedData = () => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(EMAIL_UI_STATE_KEY);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        return null;
    }
};

function EmailInboxContent({ onChangeTab, canViewWhatsapp }) {
    const cachedState = getCachedData();
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const router = useRouter();
    const supabase = createClient();

    const [searchTerm, setSearchTerm] = useState(cachedState?.searchTerm || '');
    const [selectedEmailFolder, setSelectedEmailFolder] = useState(cachedState?.selectedEmailFolder || null);
    const [selectedEmail, setSelectedEmail] = useState(cachedState?.selectedEmail || null);

    const [isEmailConfigOpen, setIsEmailConfigOpen] = useState(cachedState?.isEmailConfigOpen || false);
    const [configInitialTab, setConfigInitialTab] = useState(cachedState?.configInitialTab || 'connection');
    const [isComposeOpen, setIsComposeOpen] = useState(cachedState?.isComposeOpen || false);
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [rulePrefill, setRulePrefill] = useState(null);

    const [debouncedSearchTerm] = useDebounce(searchTerm, 600);
    const hasRestoredUiState = useRef(false);

    // --- LÓGICA DE DEEP LINK ---
    useEffect(() => {
        const emailId = searchParams.get('email_id');
        if (emailId) {
            console.log("🔗 Deep Link detectado para e-mail:", emailId);

            const fetchEmail = async () => {
                const { data, error } = await supabase
                    .from('email_messages_cache')
                    .select('*')
                    .eq('id', emailId)
                    .single();

                if (data && !error) {
                    setSelectedEmail(data);
                    setSelectedEmailFolder({
                        path: data.folder_path,
                        name: data.folder_path.split('/').pop(),
                        display_name: data.folder_path,
                        accountId: data.account_id
                    });
                    router.replace('/caixa-de-entrada', { scroll: false });
                }
            };
            fetchEmail();
        }
    }, [searchParams, supabase, router]);

    const uiStateToSave = {
        selectedEmailFolder,
        searchTerm,
        selectedEmail,
        isEmailConfigOpen,
        configInitialTab,
        isComposeOpen
    };

    const [debouncedUiState] = useDebounce(uiStateToSave, 1000);

    useEffect(() => {
        hasRestoredUiState.current = true;
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && hasRestoredUiState.current) {
            localStorage.setItem(EMAIL_UI_STATE_KEY, JSON.stringify(debouncedUiState));
        }
    }, [debouncedUiState]);

    const handleUnreadUpdate = useCallback((accountId, folderPath, newCount) => {
        queryClient.setQueryData(['emailFolderCounts', accountId], (oldData) => {
            if (!oldData) return { counts: { [folderPath]: newCount } };
            return {
                ...oldData,
                counts: {
                    ...oldData.counts,
                    [folderPath]: newCount
                }
            };
        });
    }, [queryClient]);

    const handleSelectEmail = (email) => setSelectedEmail(email);

    const handleBackToList = () => {
        if (selectedEmail) { setSelectedEmail(null); return; }
        if (selectedEmailFolder) { setSelectedEmailFolder(null); return; }
    };

    const handleOpenRules = (email = null) => {
        if (email) {
            let term = email.from || '';
            const match = term.match(/(.*?)\s*<(.+?)>/);
            if (match) {
                let namePart = match[1].replace(/['"]/g, '').trim();
                let emailPart = match[2].trim();
                term = namePart || emailPart;
            } else if (term.includes('@')) {
                term = term.trim();
            }
            setRulePrefill({
                nome: `Mover e-mails de ${term}`,
                account_id: email.account_id || null, // Garante que a regra nasça vinculada à conta correta
                condicoes: [{ campo: 'from', operador: 'contains', valor: term }],
                acoes: [{ tipo: 'move', pasta: '' }]
            });
        } else { setRulePrefill(null); }
        setConfigInitialTab('rules');
        setIsEmailConfigOpen(true);
    };

    const handleOpenConfig = () => { setConfigInitialTab('connection'); setIsEmailConfigOpen(true); };
    const handleOpenCreateFolder = () => { setIsCreateFolderOpen(true); };
    const handleEmailSent = () => {
        queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
        queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
        queryClient.invalidateQueries({ queryKey: ['emailFolderCounts'] });
    };

    const hasSelection = selectedEmailFolder;
    const showEmailReadingPane = selectedEmail;

    return (
        <div className="flex h-full w-full relative bg-gray-100 overflow-hidden isolate">
            <EmailConfigModal
                isOpen={isEmailConfigOpen}
                onClose={() => setIsEmailConfigOpen(false)}
                initialTab={configInitialTab}
                rulePrefill={rulePrefill}
            />
            <EmailComposeModal
                isOpen={isComposeOpen}
                onClose={() => setIsComposeOpen(false)}
                onEmailSent={handleEmailSent}
            />
            <EmailCreateFolderModal
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
            />

            <EmailSidebar
                className={`w-full md:w-[280px] shrink-0 ${hasSelection ? 'hidden md:flex' : 'flex'}`}
                selectedFolder={selectedEmailFolder}
                onSelectFolder={setSelectedEmailFolder}
                onCompose={() => setIsComposeOpen(true)}
                onConfig={handleOpenConfig}
                onChangeTab={onChangeTab}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onCreateFolder={handleOpenCreateFolder}
                canViewWhatsapp={canViewWhatsapp}
            />

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
                        onSearchChange={setSearchTerm}
                        onCreateRule={handleOpenRules}
                        onCreateFolder={handleOpenCreateFolder}
                        onUnreadCountChange={handleUnreadUpdate}
                        onChangeTab={onChangeTab}
                        canViewWhatsapp={canViewWhatsapp}
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

            {showEmailReadingPane && (
                <div className="flex-grow w-full lg:w-auto bg-white flex-col h-full overflow-hidden min-h-0 relative z-10">
                    <EmailViewPanel
                        emailSummary={selectedEmail}
                        folder={selectedEmailFolder}
                        onClose={() => setSelectedEmail(null)}
                        onCreateRule={handleOpenRules}
                        onCreateFolder={handleOpenCreateFolder}
                    />
                </div>
            )}
        </div>
    );
}

export default function EmailInbox(props) {
    return (
        <Suspense fallback={<div className="p-4 text-center">Carregando Inbox...</div>}>
            <EmailInboxContent {...props} />
        </Suspense>
    );
}
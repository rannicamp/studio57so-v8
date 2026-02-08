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
    
    // --- ESTADOS DE PROTEÇÃO CONTRA LOOP (ADICIONADOS PELO DEVONILDO) ---
    const [autoSync, setAutoSync] = useState(true); 
    const [syncErrorCount, setSyncErrorCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

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

    // --- FUNÇÃO DE SYNC BLINDADA (EVITA O LOOP INFINITO) ---
    const runSyncSafe = useCallback(async () => {
        // Se a proteção estiver ativa ou já estiver rodando, não faz nada
        if (!autoSync || isSyncing) return;

        // Se errou muitas vezes seguidas, desliga o automático
        if (syncErrorCount > 3) {
            console.warn("🛑 Sync automático desligado por segurança (muitos erros seguidos).");
            setAutoSync(false);
            return;
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/email/sync', { method: 'POST' });
            
            // PROTEÇÃO CRÍTICA: Se der 401 (Não autorizado), para tudo imediatamente
            if (res.status === 401) {
                console.error("🚨 Sessão expirada (401) no Sync. Parando automação.");
                setAutoSync(false);
                setSyncErrorCount(10); // Força parada
                return;
            }

            const data = await res.json();
            
            // Sucesso: zera contadores de erro
            setSyncErrorCount(0);

            if (data.newEmails > 0 || data.totalNew > 0) {
                queryClient.invalidateQueries({ queryKey: ['emailMessages'] });
                queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
                queryClient.invalidateQueries({ queryKey: ['emailFolderCounts'] });
                queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
            }
        } catch (error) {
            console.error("Erro no sync:", error);
            setSyncErrorCount(prev => prev + 1);
        } finally {
            setIsSyncing(false);
        }
    }, [autoSync, isSyncing, syncErrorCount, queryClient]);

    // --- INTERVALO DE SYNC (AGORA USA A FUNÇÃO SEGURA) ---
    useEffect(() => {
        runSyncSafe(); // Roda ao montar
        const intervalId = setInterval(runSyncSafe, 60000); // A cada 1 min
        return () => clearInterval(intervalId);
    }, [runSyncSafe]);

    // --- REGRAS AUTOMÁTICAS ---
    useEffect(() => {
        const isInbox = selectedEmailFolder?.name?.toUpperCase() === 'INBOX' || 
                        selectedEmailFolder?.displayName === 'Caixa de Entrada';

        if (!selectedEmailFolder || isInbox) {
            const runRules = async () => {
                if (!autoSync) return; // Não roda regras se o sync estiver pausado por erro
                try {
                    const res = await fetch('/api/email/rules/apply', { method: 'POST' });
                    if (res.status === 401) return; // Ignora se 401

                    const data = await res.json();
                    if (data.moved > 0) {
                        toast.success(`Automação: ${data.moved} e-mails movidos.`);
                        setTimeout(() => {
                            queryClient.resetQueries({ queryKey: ['emailMessages'] });
                            queryClient.invalidateQueries({ queryKey: ['emailFolders'] });
                            queryClient.invalidateQueries({ queryKey: ['emailFolderCounts'] });
                        }, 1500); 
                    }
                } catch (err) { console.error("Erro regras:", err); }
            };
            
            runRules();
            const intervalId = setInterval(runRules, 30000);
            return () => clearInterval(intervalId);
        }
    }, [selectedEmailFolder, queryClient, autoSync]);

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

    // Função de reset manual caso o usuário queira tentar conectar de novo
    const handleRetrySync = () => {
        setSyncErrorCount(0);
        setAutoSync(true);
        runSyncSafe();
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
                        onCreateRule={handleOpenRules}
                        onCreateFolder={handleOpenCreateFolder}
                        onUnreadCountChange={handleUnreadUpdate}
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

            {/* AVISO DE ERRO DE CONEXÃO (Proteção Visual) */}
            {!autoSync && syncErrorCount > 3 && (
                <div className="absolute bottom-4 right-4 bg-red-100 text-red-600 px-4 py-2 rounded-lg shadow-lg text-xs flex items-center gap-2 z-50 animate-bounce">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>Conexão instável. Sync pausado.</span>
                    <button 
                        onClick={handleRetrySync} 
                        className="underline font-bold ml-2 hover:text-red-800"
                    >
                        Tentar reconectar
                    </button>
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
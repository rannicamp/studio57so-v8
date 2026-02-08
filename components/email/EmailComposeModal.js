'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'; 
import { createPortal } from 'react-dom'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faTrashAlt, faFile, faUser, faBuilding, faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import EmailEditor from './EmailEditor';
import EmailAttachmentUpload from './EmailAttachmentUpload'; // O novo motor
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { usePersistentState } from '@/hooks/usePersistentState';

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export default function EmailComposeModal({ isOpen, onClose, initialData = null, onEmailSent }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    
    // Rascunho persistente
    const [formData, setFormData] = usePersistentState('studio57_email_draft_temp', {
        to: '', cc: '', bcc: '', subject: '', body: '', 
        replyToMessageId: null, attachments: [], accountId: '' 
    });

    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    // Busca Contas
    const { data: emailAccounts, isLoading: isLoadingAccounts } = useQuery({
        queryKey: ['emailConfigList', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id);
            return data || [];
        },
        enabled: !!user && isOpen, 
        staleTime: 1000 * 60 * 5 
    });

    useEffect(() => {
        if (emailAccounts && emailAccounts.length > 0 && !formData.accountId) {
            setFormData(prev => ({ ...prev, accountId: emailAccounts[0].id }));
        }
    }, [emailAccounts, formData.accountId, setFormData]);

    const selectedAccountConfig = useMemo(() => emailAccounts?.find(acc => acc.id === formData.accountId), [emailAccounts, formData.accountId]);

    // Assinatura
    const buildSignature = (config) => {
        if (!config || !config.assinatura_texto) return '';
        const textoAssinatura = config.assinatura_texto;
        const fotoUrl = user?.avatar_url; 
        if (config.assinatura_incluir_foto && fotoUrl) {
            return `<br><br><div style="display: flex; align-items: flex-start; gap: 16px; font-family: sans-serif; border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px;"><img src="${fotoUrl}" alt="Foto" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" /><div>${textoAssinatura}</div></div>`;
        }
        return `<br><br><div style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px; font-family: sans-serif;">${textoAssinatura}</div>`;
    };

    // Autocomplete Lógica...
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const getLastTerm = (text) => text ? text.split(',').pop().trim() : '';
    const searchTerm = getLastTerm(formData.to);
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    useEffect(() => {
        const fetchContacts = async () => {
            if (!debouncedSearchTerm || debouncedSearchTerm.length < 2 || (debouncedSearchTerm.includes('@') && debouncedSearchTerm.includes('.'))) {
                setSuggestions([]); setShowSuggestions(false); return;
            }
            if (!organizacaoId) return;
            setIsSearching(true);
            try {
                const queryNome = supabase.from('contatos').select('id, nome, razao_social, nome_fantasia, emails(email)').eq('organizacao_id', organizacaoId).or(`nome.ilike.%${debouncedSearchTerm}%,razao_social.ilike.%${debouncedSearchTerm}%,nome_fantasia.ilike.%${debouncedSearchTerm}%`).limit(5);
                const queryEmail = supabase.from('emails').select('email, contatos(id, nome, razao_social, nome_fantasia)').eq('organizacao_id', organizacaoId).ilike('email', `%${debouncedSearchTerm}%`).limit(5);
                const [resNome, resEmail] = await Promise.all([queryNome, queryEmail]);
                const combinedResults = [];
                const seenEmails = new Set();
                const processItem = (id, nome, email, isCompany) => {
                    if (!seenEmails.has(email)) {
                        combinedResults.push({ id, nome, email, isCompany });
                        seenEmails.add(email);
                    }
                };
                resNome.data?.forEach(c => c.emails?.forEach(e => processItem(c.id, c.nome || c.razao_social || c.nome_fantasia, e.email, !!c.razao_social)));
                resEmail.data?.forEach(e => e.contatos && processItem(e.contatos.id, e.contatos.nome || e.contatos.razao_social || e.contatos.nome_fantasia, e.email, !!e.contatos.razao_social));
                setSuggestions(combinedResults); setShowSuggestions(combinedResults.length > 0);
            } catch (err) { console.error(err); } finally { setIsSearching(false); }
        };
        fetchContacts();
    }, [debouncedSearchTerm, supabase, organizacaoId]);

    const handleSelectContact = (item) => {
        const parts = formData.to.split(','); parts.pop(); parts.push(` ${item.email}`); 
        setFormData(prev => ({ ...prev, to: parts.join(',').replace(/^,/, '').trim() + ', ' }));
        setSuggestions([]); setShowSuggestions(false);
    };

    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false);
        if (showSuggestions) document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showSuggestions]);

    useEffect(() => {
        if (isOpen && initialData && selectedAccountConfig) {
            const signature = buildSignature(selectedAccountConfig);
            const sigHtml = selectedAccountConfig?.assinatura_usar_respostas !== false ? `<p></p>${signature}` : ''; 
            const initialBody = `${sigHtml}${initialData.body || ''}`;
            setFormData({ to: initialData.to || '', cc: initialData.cc || '', bcc: '', subject: initialData.subject || '', body: initialBody, replyToMessageId: initialData.messageId || null, attachments: [], accountId: formData.accountId });
        } else if (isOpen && selectedAccountConfig && !formData.body && !initialData && selectedAccountConfig?.assinatura_usar_novos !== false) {
             setFormData(prev => ({ ...prev, body: `<p></p>${buildSignature(selectedAccountConfig)}` }));
        }
    }, [isOpen, initialData, selectedAccountConfig]);

    // --- RECEBE O RETORNO DO UPPY ---
    const handleAttachmentsComplete = useCallback((newFiles) => {
        const formattedAttachments = newFiles.map(f => ({
            filename: f.name,
            path: f.url,
            size: typeof f.size === 'number' ? f.size : 0 
        }));
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...formattedAttachments] }));
    }, [setFormData]);

    const removeAttachment = (index) => {
        setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
    };

    const handleDiscard = () => {
        if (confirm('Tem certeza?')) {
            setFormData({ to: '', cc: '', bcc: '', subject: '', body: '', replyToMessageId: null, attachments: [], accountId: formData.accountId });
            onClose();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.accountId) { toast.error("Selecione uma conta."); return; }
        setLoading(true);
        try {
            const finalTo = formData.to.trim().replace(/,$/, '');
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, to: finalTo, html: formData.body, attachments: formData.attachments.map(a => ({ filename: a.filename, path: a.path })) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
            toast.success('E-mail enviado!');
            setFormData({ to: '', cc: '', bcc: '', subject: '', body: '', replyToMessageId: null, attachments: [], accountId: formData.accountId });
            if (onEmailSent) onEmailSent();
            onClose();
        } catch (error) { toast.error(error.message); } finally { setLoading(false); }
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[90vh] animate-fade-in-up">
                
                <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl shrink-0">
                    <h2 className="font-bold text-gray-800 text-lg">
                        {initialData?.type === 'reply' ? 'Responder' : initialData?.type === 'forward' ? 'Encaminhar' : 'Nova Mensagem'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="p-6 flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
                        <div className="grid gap-4 relative">
                            {/* Inputs De/Para/Assunto (Simplificados para leitura, código igual) */}
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">De:</label>
                                <div className="flex-grow relative">
                                    {isLoadingAccounts ? <div className="text-xs text-gray-400">Carregando...</div> : (
                                        <div className="relative w-full md:w-1/2">
                                            <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full outline-none text-sm text-gray-800 bg-transparent py-1 pr-8 appearance-none font-medium cursor-pointer hover:bg-gray-50 rounded">
                                                {emailAccounts?.map(acc => <option key={acc.id} value={acc.id}>{acc.nome_remetente ? `${acc.nome_remetente} <${acc.email}>` : acc.email}</option>)}
                                            </select>
                                            <FontAwesomeIcon icon={faChevronDown} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 relative">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Para:</label>
                                <div className="flex-grow relative">
                                    <input type="text" required value={formData.to} onChange={e => setFormData({...formData, to: e.target.value})} className="w-full outline-none text-sm text-gray-800 bg-transparent" placeholder="Nome ou e-mail..." autoComplete="off"/>
                                    {isSearching && <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-xs" /></div>}
                                </div>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 mt-1 max-h-60 overflow-y-auto">
                                        {suggestions.map((item, idx) => (
                                            <div key={`${item.id}-${idx}`} onClick={(e) => { e.stopPropagation(); handleSelectContact(item); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0"><FontAwesomeIcon icon={item.isCompany ? faBuilding : faUser} /></div>
                                                <div className="flex flex-col"><span className="text-sm font-medium text-gray-800">{item.nome}</span><span className="text-xs text-gray-500">{item.email}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Cc:</label>
                                <input type="text" value={formData.cc} onChange={e => setFormData({...formData, cc: e.target.value})} className="flex-grow outline-none text-sm text-gray-800" placeholder="Cópia..." />
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Assunto:</label>
                                <input type="text" required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="flex-grow outline-none text-sm font-medium text-gray-800" placeholder="Assunto" />
                            </div>
                        </div>

                        {/* ÁREA DE ANEXOS */}
                        <div className="space-y-3">
                            <div className="border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50">
                                <EmailAttachmentUpload onUploadComplete={handleAttachmentsComplete} />
                            </div>

                            {/* LISTA VISUAL NO PAI */}
                            {formData.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 animate-fade-in">
                                    {formData.attachments.map((att, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-100 shadow-sm">
                                            <FontAwesomeIcon icon={faCheck} className="text-green-500" />
                                            <FontAwesomeIcon icon={faFile} />
                                            <span className="max-w-[200px] truncate" title={att.filename}>{att.filename}</span>
                                            {att.size > 0 && <span className="text-blue-400 text-[10px] ml-1">({formatBytes(att.size)})</span>}
                                            <button type="button" onClick={() => removeAttachment(index)} className="ml-2 text-gray-400 hover:text-red-500 p-1">
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex-grow min-h-[300px] border rounded-lg overflow-hidden">
                            <EmailEditor value={formData.body} onChange={(html) => setFormData({...formData, body: html})} />
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center shrink-0">
                        <button type="button" onClick={handleDiscard} className="text-gray-500 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-gray-100">
                            <FontAwesomeIcon icon={faTrashAlt} className="mr-1" /> Descartar
                        </button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium">Salvar Rascunho</button>
                            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 text-sm font-bold transition-transform active:scale-95 disabled:opacity-70">
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />} Enviar
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
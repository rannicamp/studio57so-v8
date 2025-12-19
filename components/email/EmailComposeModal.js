'use client'

import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faPaperclip, faTrashAlt, faFile, faUser, faBuilding, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import EmailEditor from './EmailEditor';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

// Função auxiliar para formatar bytes (KB, MB)
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
    const [attaching, setAttaching] = useState(false); 
    const fileInputRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    
    const [formData, setFormData] = useState({
        to: '', cc: '', bcc: '', subject: '', body: '', replyToMessageId: null, attachments: []
    });

    // --- CÁLCULO DO TAMANHO TOTAL (EM TEMPO REAL) ---
    const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
    
    const totalSize = useMemo(() => {
        return formData.attachments.reduce((acc, curr) => acc + (curr.size || 0), 0);
    }, [formData.attachments]);

    const isOverLimit = totalSize > MAX_SIZE_BYTES;
    const sizePercentage = Math.min((totalSize / MAX_SIZE_BYTES) * 100, 100);

    // Define a cor da barra baseado no uso
    let progressColor = 'bg-blue-500';
    if (sizePercentage > 80) progressColor = 'bg-orange-500';
    if (isOverLimit) progressColor = 'bg-red-600';
    // ------------------------------------------------

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // --- 1. BUSCAR CONFIGURAÇÃO ---
    const { data: emailConfig } = useQuery({
        queryKey: ['emailConfig', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('email_configuracoes')
                .select('*')
                .eq('user_id', user.id)
                .single();
            return data;
        },
        enabled: !!user && isOpen, 
        staleTime: 1000 * 60 * 5 
    });

    // --- 2. ASSINATURA ---
    const buildSignature = () => {
        if (!emailConfig || !emailConfig.assinatura_texto) return '';
        const textoAssinatura = emailConfig.assinatura_texto;
        const incluirFoto = emailConfig.assinatura_incluir_foto;
        const fotoUrl = user?.avatar_url; 

        if (incluirFoto && fotoUrl) {
            return `
                <br><br>
                <div style="display: flex; align-items: flex-start; gap: 16px; font-family: sans-serif; border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px;">
                    <img src="${fotoUrl}" alt="Foto" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
                    <div>${textoAssinatura}</div>
                </div>
            `;
        }
        return `
            <br><br>
            <div style="border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px; font-family: sans-serif;">
                ${textoAssinatura}
            </div>
        `;
    };

    // --- AUTOCOMPLETE ---
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    
    const getLastTerm = (text) => {
        if (!text) return '';
        const parts = text.split(',');
        return parts[parts.length - 1].trim();
    };

    const searchTerm = getLastTerm(formData.to);
    const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

    useEffect(() => {
        const fetchContacts = async () => {
            if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
                setSuggestions([]); setShowSuggestions(false); return;
            }
            if (debouncedSearchTerm.includes('@') && debouncedSearchTerm.includes('.')) {
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

                if (resNome.data) resNome.data.forEach(c => c.emails?.forEach(e => processItem(c.id, c.nome || c.razao_social || c.nome_fantasia, e.email, !!c.razao_social)));
                if (resEmail.data) resEmail.data.forEach(e => e.contatos && processItem(e.contatos.id, e.contatos.nome || e.contatos.razao_social || e.contatos.nome_fantasia, e.email, !!e.contatos.razao_social));

                if (combinedResults.length > 0) { setSuggestions(combinedResults); setShowSuggestions(true); } 
                else { setSuggestions([]); setShowSuggestions(false); }
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

    // --- POPULAR DADOS ---
    useEffect(() => {
        if (isOpen && emailConfig !== undefined) { 
            const signature = buildSignature();
            let initialBody = '';

            if (initialData) {
                const shouldUseSig = emailConfig?.assinatura_usar_respostas !== false; 
                const sigHtml = shouldUseSig ? `<p></p>${signature}` : ''; 
                initialBody = `${sigHtml}${initialData.body || ''}`;

                setFormData({
                    to: initialData.to || '', cc: initialData.cc || '', bcc: '', subject: initialData.subject || '',
                    body: initialBody,
                    replyToMessageId: initialData.messageId || null,
                    attachments: []
                });
            } else {
                const shouldUseSig = emailConfig?.assinatura_usar_novos !== false;
                initialBody = shouldUseSig ? `<p></p>${signature}` : '';

                setFormData({ 
                    to: '', cc: '', bcc: '', subject: '', 
                    body: initialBody, 
                    replyToMessageId: null, attachments: [] 
                });
            }
            setSuggestions([]);
        }
    }, [isOpen, initialData, emailConfig]); 

    const handleAttachmentClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setAttaching(true);

        const newAttachments = [];
        let tempTotalSize = totalSize; // Começa com o tamanho que já tem
        
        for (const file of files) {
            // Verifica se a adição desse arquivo vai estourar o limite TOTAL
            if (tempTotalSize + file.size > MAX_SIZE_BYTES) {
                toast.error(`O arquivo "${file.name}" não cabe! O total passaria de 25MB.`);
                continue; // Pula este arquivo, mas continua tentando os outros
            }

            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                
                tempTotalSize += file.size; // Atualiza o contador temporário
                newAttachments.push({ filename: file.name, content: base64.split(',')[1], encoding: 'base64', size: file.size });
            } catch (err) { 
                console.error("Erro ao ler arquivo:", err); 
            }
        }
        
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
        e.target.value = ''; 
        setAttaching(false);
    };

    const removeAttachment = (index) => {
        setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isOverLimit) {
            toast.error("O tamanho total excede 25MB. Remova alguns anexos.");
            return;
        }

        setLoading(true);
        try {
            const finalTo = formData.to.trim().replace(/,$/, '');
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, to: finalTo, html: formData.body })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
            
            toast.success('E-mail enviado!');
            if (onEmailSent) onEmailSent();
            onClose();
        } catch (error) { 
            console.error(error);
            toast.error(error.message);
        } 
        finally { setLoading(false); }
    };

    if (!mounted || !isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/50 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm" style={{ pointerEvents: 'auto' }}>
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[85vh] animate-fade-in-up">
                
                <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl shrink-0">
                    <h2 className="font-bold text-gray-800 text-lg">
                        {initialData?.type === 'reply' ? 'Responder' : 
                         initialData?.type === 'forward' ? 'Encaminhar' : 'Nova Mensagem'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="p-6 flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
                        
                        <div className="grid gap-4 relative">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 relative">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Para:</label>
                                <div className="flex-grow relative">
                                    <input 
                                        type="text" 
                                        required
                                        value={formData.to}
                                        onChange={e => setFormData({...formData, to: e.target.value})}
                                        className="w-full outline-none text-sm text-gray-800 placeholder-gray-300 bg-transparent"
                                        placeholder="Nome ou e-mail..."
                                        autoComplete="off"
                                    />
                                    {isSearching && <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 text-gray-400"><FontAwesomeIcon icon={faSpinner} spin className="text-xs" /></div>}
                                </div>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 mt-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {suggestions.map((item, idx) => (
                                            <div key={`${item.id}-${idx}`} onClick={(e) => { e.stopPropagation(); handleSelectContact(item); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0"><FontAwesomeIcon icon={item.isCompany ? faBuilding : faUser} /></div>
                                                <div className="flex flex-col"><span className="text-sm font-medium text-gray-800">{item.nome}</span><span className="text-xs text-gray-500">{item.email}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Cc:</label>
                                <input type="text" value={formData.cc} onChange={e => setFormData({...formData, cc: e.target.value})} className="flex-grow outline-none text-sm text-gray-800 placeholder-gray-300" placeholder="Cópia..." />
                            </div>
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Assunto:</label>
                                <input type="text" required value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="flex-grow outline-none text-sm font-medium text-gray-800 placeholder-gray-300" placeholder="Assunto" />
                            </div>
                        </div>

                        {/* ÁREA DE ANEXOS E BARRA DE PROGRESSO */}
                        <div className="flex flex-col gap-2">
                            {/* Barra de Progresso de Tamanho Total */}
                            {totalSize > 0 && (
                                <div className="flex flex-col gap-1 px-2 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
                                        <span className={isOverLimit ? "text-red-600" : "text-gray-600"}>
                                            Tamanho Total: {formatBytes(totalSize)} / 25 MB
                                        </span>
                                        {isOverLimit && <span className="text-red-600 flex items-center gap-1"><FontAwesomeIcon icon={faExclamationTriangle} /> Limite excedido!</span>}
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-300 ${progressColor}`} 
                                            style={{ width: `${sizePercentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {attaching && (
                                <div className="text-xs text-blue-600 flex items-center gap-2 animate-pulse pl-2">
                                    <FontAwesomeIcon icon={faSpinner} spin /> Processando anexos...
                                </div>
                            )}
                            
                            {formData.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 py-2">
                                    {formData.attachments.map((att, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100 shadow-sm">
                                            <FontAwesomeIcon icon={faFile} />
                                            <span className="max-w-[150px] truncate" title={att.filename}>{att.filename}</span>
                                            <span className="text-blue-400 text-[10px]">({formatBytes(att.size)})</span>
                                            <button type="button" onClick={() => removeAttachment(index)} className="ml-1 text-blue-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes} /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex-grow min-h-[300px]">
                            <EmailEditor value={formData.body} onChange={(html) => setFormData({...formData, body: html})} />
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center shrink-0">
                        <div className="flex gap-4">
                            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            
                            <button type="button" onClick={handleAttachmentClick} disabled={attaching || loading || isOverLimit} className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50">
                                <FontAwesomeIcon icon={faPaperclip} /> <span className="hidden sm:inline">Anexar</span>
                            </button>
                            
                            <button type="button" onClick={() => setFormData({...formData, body: '', attachments: [], to: '', subject: ''})} className="text-gray-500 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-gray-100"><FontAwesomeIcon icon={faTrashAlt} className="mr-1" /> Descartar</button>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium">Cancelar</button>
                            
                            {/* O BOTÃO FICA DESABILITADO SE ESTOURAR O LIMITE */}
                            <button type="submit" disabled={loading || attaching || isOverLimit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 text-sm font-bold transition-transform active:scale-95 disabled:opacity-70 disabled:bg-gray-400">
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
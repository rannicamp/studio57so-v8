'use client'

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom'; 
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner, faPaperclip, faTrashAlt, faFile, faUser, faBuilding } from '@fortawesome/free-solid-svg-icons';
import EmailEditor from './EmailEditor';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

// Adicionei 'onEmailSent' nas props aqui embaixo
export default function EmailComposeModal({ isOpen, onClose, initialData = null, onEmailSent }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);
    const [mounted, setMounted] = useState(false); // Para evitar erros de hidratação com o Portal
    
    const [formData, setFormData] = useState({
        to: '', cc: '', bcc: '', subject: '', body: '', replyToMessageId: null, attachments: []
    });

    // Garante que o componente está montado antes de usar o Portal
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // --- 1. BUSCAR CONFIGURAÇÃO DE ASSINATURA ---
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

    // --- 2. FUNÇÃO PARA MONTAR HTML DA ASSINATURA ---
    const buildSignature = () => {
        if (!emailConfig || !emailConfig.assinatura_texto) return '';

        const textoAssinatura = emailConfig.assinatura_texto;
        const incluirFoto = emailConfig.assinatura_incluir_foto;
        
        const fotoUrl = user?.avatar_url; 

        // Se tiver foto e a opção estiver marcada
        if (incluirFoto && fotoUrl) {
            return `
                <br><br>
                <div style="display: flex; align-items: flex-start; gap: 16px; font-family: sans-serif; border-top: 1px solid #eee; padding-top: 16px; margin-top: 16px;">
                    <img src="${fotoUrl}" alt="Foto" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />
                    <div>${textoAssinatura}</div>
                </div>
            `;
        }

        // Apenas texto
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

    // BUSCA DUPLA INTELIGENTE (Contatos + Emails)
    useEffect(() => {
        const fetchContacts = async () => {
            if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }
            if (debouncedSearchTerm.includes('@') && debouncedSearchTerm.includes('.')) {
                 setSuggestions([]);
                 setShowSuggestions(false);
                 return;
            }
            if (!organizacaoId) return;

            setIsSearching(true);

            try {
                // 1. Busca por NOME do Contato (Traz os emails associados)
                const queryNome = supabase
                    .from('contatos')
                    .select('id, nome, razao_social, nome_fantasia, emails(email)')
                    .eq('organizacao_id', organizacaoId)
                    .or(`nome.ilike.%${debouncedSearchTerm}%,razao_social.ilike.%${debouncedSearchTerm}%,nome_fantasia.ilike.%${debouncedSearchTerm}%`)
                    .limit(5);

                // 2. Busca por E-MAIL na tabela de emails (Traz o contato dono)
                const queryEmail = supabase
                    .from('emails')
                    .select('email, contatos(id, nome, razao_social, nome_fantasia)')
                    .eq('organizacao_id', organizacaoId)
                    .ilike('email', `%${debouncedSearchTerm}%`)
                    .limit(5);

                const [resNome, resEmail] = await Promise.all([queryNome, queryEmail]);

                const combinedResults = [];
                const seenEmails = new Set(); // Para evitar duplicatas

                // Processa resultados por NOME
                if (resNome.data) {
                    resNome.data.forEach(contato => {
                        const nomeDisplay = contato.nome || contato.razao_social || contato.nome_fantasia;
                        // Se o contato tem emails cadastrados na tabela filha
                        if (contato.emails && contato.emails.length > 0) {
                            contato.emails.forEach(emailObj => {
                                if (!seenEmails.has(emailObj.email)) {
                                    combinedResults.push({
                                        id: contato.id,
                                        nome: nomeDisplay,
                                        email: emailObj.email,
                                        isCompany: !!contato.razao_social
                                    });
                                    seenEmails.add(emailObj.email);
                                }
                            });
                        }
                    });
                }

                // Processa resultados por EMAIL
                if (resEmail.data) {
                    resEmail.data.forEach(item => {
                        if (item.contatos && !seenEmails.has(item.email)) {
                            const contato = item.contatos;
                            const nomeDisplay = contato.nome || contato.razao_social || contato.nome_fantasia;
                            combinedResults.push({
                                id: contato.id,
                                nome: nomeDisplay,
                                email: item.email,
                                isCompany: !!contato.razao_social
                            });
                            seenEmails.add(item.email);
                        }
                    });
                }

                if (combinedResults.length > 0) {
                    setSuggestions(combinedResults);
                    setShowSuggestions(true);
                } else {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }

            } catch (err) {
                console.error("Erro na busca dupla:", err);
            } finally {
                setIsSearching(false);
            }
        };

        fetchContacts();
    }, [debouncedSearchTerm, supabase, organizacaoId]);

    const handleSelectContact = (item) => {
        const parts = formData.to.split(',');
        parts.pop(); 
        parts.push(` ${item.email}`); 
        const newValue = parts.join(',').replace(/^,/, '').trim() + ', '; 
        setFormData(prev => ({ ...prev, to: newValue }));
        setSuggestions([]);
        setShowSuggestions(false);
    };

    useEffect(() => {
        const handleClickOutside = () => setShowSuggestions(false);
        if (showSuggestions) document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showSuggestions]);

    // --- 3. POPULAR FORMULÁRIO (Com Assinatura) ---
    useEffect(() => {
        if (isOpen && emailConfig !== undefined) { 
            const signature = buildSignature();
            let initialBody = '';

            if (initialData) {
                const shouldUseSig = emailConfig?.assinatura_usar_respostas !== false; 
                const sigHtml = shouldUseSig ? `<p></p>${signature}` : ''; 
                initialBody = `${sigHtml}${initialData.body || ''}`;

                setFormData({
                    to: initialData.to || '',
                    cc: initialData.cc || '',
                    bcc: '',
                    subject: initialData.subject || '',
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
                    replyToMessageId: null, 
                    attachments: [] 
                });
            }
            setSuggestions([]);
        }
    }, [isOpen, initialData, emailConfig]); 

    const handleAttachmentClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        const newAttachments = [];
        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { toast.error(`Arquivo ${file.name} muito grande (máx 10MB).`); continue; }
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                newAttachments.push({ filename: file.name, content: base64.split(',')[1], encoding: 'base64' });
            } catch (err) { console.error(err); }
        }
        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
        e.target.value = '';
    };

    const removeAttachment = (index) => {
        setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
            
            // --- AQUI ESTÁ A CORREÇÃO ---
            // Avisa o componente pai (Inbox) que enviamos, para ele atualizar a lista
            if (onEmailSent) {
                onEmailSent();
            }
            // ---------------------------

            onClose();
        } catch (error) { toast.error(error.message); } 
        finally { setLoading(false); }
    };

    if (!mounted || !isOpen) return null;

    // USANDO PORTAL E Z-INDEX 99999 PARA FICAR POR CIMA DE TUDO
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

                        {formData.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 py-2">
                                {formData.attachments.map((att, index) => (
                                    <div key={index} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                                        <FontAwesomeIcon icon={faFile} /><span className="max-w-[150px] truncate">{att.filename}</span><button type="button" onClick={() => removeAttachment(index)} className="ml-1 text-blue-400 hover:text-red-500"><FontAwesomeIcon icon={faTimes} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex-grow min-h-[300px]">
                            <EmailEditor value={formData.body} onChange={(html) => setFormData({...formData, body: html})} />
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center shrink-0">
                        <div className="flex gap-4">
                            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <button type="button" onClick={handleAttachmentClick} className="text-gray-500 hover:text-blue-600 text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100"><FontAwesomeIcon icon={faPaperclip} /> <span className="hidden sm:inline">Anexar</span></button>
                            <button type="button" onClick={() => setFormData({...formData, body: '', attachments: [], to: '', subject: ''})} className="text-gray-500 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-gray-100"><FontAwesomeIcon icon={faTrashAlt} className="mr-1" /> Descartar</button>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium">Cancelar</button>
                            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 text-sm font-bold transition-transform active:scale-95 disabled:opacity-70">{loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />} Enviar</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>,
        document.body // <--- RENDERIZA NO CORPO DA PÁGINA
    );
}
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faUser, faPaperPlane, faSpinner, faArrowLeft, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

const useWhatsAppTemplates = () => {
    return useQuery({
        queryKey: ['whatsappTemplates'],
        queryFn: async () => {
            const response = await fetch('/api/whatsapp/templates');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao buscar modelos');
            }
            return response.json();
        },
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });
};

// Adicionei a prop 'preSelectedContact' aqui
export default function NewConversationModal({ isOpen, onClose, onConversationCreated, preSelectedContact }) {
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [contacts, setContacts] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    
    const { data: templatesData, isLoading: loadingTemplates, error: templatesError } = useWhatsAppTemplates(); 
    const [selectedContact, setSelectedContact] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [isSending, setIsSending] = useState(false);

    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- EFEITO INTELIGENTE: Pular etapa se já tiver contato ---
    useEffect(() => {
        if (isOpen) {
            if (preSelectedContact) {
                // Se veio contato do CRM, seleciona ele e vai pro passo 2 direto!
                // Tratamos para garantir que o campo telefone_principal exista
                const contactReady = {
                    ...preSelectedContact,
                    telefone_principal: preSelectedContact.telefone_principal || preSelectedContact.telefones?.[0]?.telefone
                };
                setSelectedContact(contactReady);
                setStep(2);
            } else {
                // Se abriu normal (sem card), reseta tudo
                setStep(1);
                setSelectedContact(null);
                setSearchTerm('');
            }
        }
    }, [isOpen, preSelectedContact]);
    // -----------------------------------------------------------

    useEffect(() => {
        if (!isOpen || !organizacaoId) return;

        // Se já temos um contato selecionado (via prop), não gasta recurso buscando lista
        if (preSelectedContact) return; 

        const fetchContacts = async () => {
            setLoadingContacts(true);
            try {
                let query = supabase
                    .from('contatos')
                    .select('id, nome, telefones(telefone)')
                    .eq('organizacao_id', organizacaoId)
                    .limit(20);

                if (searchTerm) {
                    query = query.ilike('nome', `%${searchTerm}%`);
                }

                const { data, error } = await query;
                if (error) throw error;
                
                const validContacts = data.filter(c => c.telefones && c.telefones.length > 0).map(c => ({
                    ...c,
                    telefone_principal: c.telefones[0].telefone
                }));
                
                setContacts(validContacts);
            } catch (error) {
                console.error("Erro ao buscar contatos:", error);
                toast.error("Erro ao carregar contatos.");
            } finally {
                setLoadingContacts(false);
            }
        };

        const delayDebounce = setTimeout(() => {
            fetchContacts();
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [isOpen, searchTerm, organizacaoId, supabase, preSelectedContact]); // Adicionei preSelectedContact aqui

    const handleTemplateChange = (templateName) => {
        const actualTemplates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
        const template = actualTemplates.find(t => t.name === templateName);
        
        if (template) {
            setSelectedTemplate(template);
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            const variableCount = (bodyComponent?.text?.match(/\{\{\d\}\}/g) || []).length;
            
            const initialVars = Array(variableCount).fill('');
            if (selectedContact?.nome && variableCount > 0) {
                initialVars[0] = selectedContact.nome;
            }
            setVariables(initialVars);
        } else {
            setSelectedTemplate(null);
            setVariables([]);
        }
    };

    const handleVariableChange = (index, value) => {
        const newVariables = [...variables];
        newVariables[index] = value;
        setVariables(newVariables);
    };

    const handleSelectContact = (contact) => {
        setSelectedContact(contact);
        setStep(2);
    };

    const handleSend = async () => {
        if (!selectedContact || !selectedTemplate) return;
        
        if (variables.some(v => v.trim() === '')) {
            toast.warning('Preencha todas as variáveis do modelo.');
            return;
        }

        setIsSending(true);

        try {
            const components = [];
            if (variables.length > 0) {
                components.push({
                    type: 'body',
                    parameters: variables.map(v => ({ type: 'text', text: v }))
                });
            }

            let fullText = selectedTemplate.components.find(c => c.type === 'BODY')?.text || '';
            variables.forEach((val, i) => {
                fullText = fullText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
            });

            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedContact.telefone_principal,
                    type: 'template',
                    templateName: selectedTemplate.name,
                    languageCode: selectedTemplate.language,
                    components: components,
                    contact_id: selectedContact.id,
                    custom_content: fullText
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erro no envio");

            toast.success("Conversa iniciada com sucesso!");
            
            if (onConversationCreated) {
                onConversationCreated({
                    contato_id: selectedContact.id,
                    nome: selectedContact.nome,
                    avatar_url: null,
                    unread_count: 0,
                    conversation_id: result.data?.messages?.[0]?.id || 'temp', 
                    phone_number: selectedContact.telefone_principal
                });
            }
            onCloseModal();

        } catch (error) {
            console.error(error);
            toast.error("Falha ao iniciar: " + error.message);
        } finally {
            setIsSending(false);
        }
    };

    const onCloseModal = () => {
        setStep(1);
        setSelectedContact(null);
        setSelectedTemplate(null);
        setVariables([]);
        setSearchTerm('');
        onClose();
    };

    if (!isOpen) return null;

    const rawTemplates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
    const availableTemplates = rawTemplates.filter(t => t.status === 'APPROVED');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center p-4 border-b">
                    <div className="flex items-center gap-2">
                        {/* Se não tem pré-selecionado, mostra botão de voltar (comportamento padrão) */}
                        {step === 2 && !preSelectedContact && (
                            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-800">
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </button>
                        )}
                        <h3 className="text-lg font-semibold text-gray-800">
                            {step === 1 ? 'Nova Conversa' : 'Enviar Template'}
                        </h3>
                    </div>
                    <button onClick={onCloseModal} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    
                    {step === 1 && (
                        <>
                            <div className="relative mb-4">
                                <input
                                    type="text"
                                    placeholder="Buscar contato..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#00a884] focus:border-transparent outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>

                            {loadingContacts ? (
                                <div className="text-center py-8 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin /> Carregando...</div>
                            ) : (
                                <div className="space-y-2">
                                    {contacts.length === 0 ? (
                                        <p className="text-center text-gray-500 py-4 text-sm">Nenhum contato encontrado.</p>
                                    ) : (
                                        contacts.map(contact => (
                                            <div 
                                                key={contact.id} 
                                                onClick={() => handleSelectContact(contact)}
                                                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                                            >
                                                <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white shrink-0">
                                                    <FontAwesomeIcon icon={faUser} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="font-medium text-gray-800 truncate">{contact.nome}</p>
                                                    <p className="text-xs text-gray-500">{contact.telefone_principal}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {step === 2 && selectedContact && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm shrink-0">
                                    <FontAwesomeIcon icon={faUser} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Enviando para:</p>
                                    <p className="font-medium text-gray-800 text-sm">{selectedContact.nome}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de Mensagem</label>
                                
                                {loadingTemplates && (
                                    <div className="text-sm text-gray-500 mb-2"><FontAwesomeIcon icon={faSpinner} spin /> Carregando modelos...</div>
                                )}
                                
                                {templatesError && (
                                    <div className="text-sm text-red-500 mb-2"><FontAwesomeIcon icon={faExclamationTriangle} /> Erro ao carregar modelos</div>
                                )}

                                <select 
                                    className="w-full border rounded-lg p-2 text-sm focus:ring-[#00a884] outline-none"
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    defaultValue=""
                                    disabled={loadingTemplates || !!templatesError}
                                >
                                    <option value="" disabled>Selecione um modelo...</option>
                                    {availableTemplates.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.name.replace(/_/g, ' ')} ({t.language})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedTemplate && (
                                <div className="space-y-3">
                                    <div className="bg-[#f0f2f5] p-3 rounded-lg text-sm text-gray-800 border relative">
                                        <div className="absolute top-2 right-2 text-[10px] text-gray-400 font-bold tracking-wider">PRÉVIA</div>
                                        <p className="whitespace-pre-line text-sm mt-1">
                                            {selectedTemplate.components.find(c => c.type === 'BODY')?.text}
                                        </p>
                                    </div>

                                    {variables.length > 0 && (
                                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 space-y-2">
                                            <p className="text-xs font-bold text-yellow-700 uppercase">Preencha as Variáveis</p>
                                            {variables.map((value, index) => (
                                                <div key={index}>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        {`{{${index + 1}}}`}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => handleVariableChange(index, e.target.value)}
                                                        className="w-full border rounded p-2 text-sm focus:border-yellow-400 outline-none"
                                                        placeholder={`Conteúdo para {{${index + 1}}}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {step === 2 && (
                    <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                        <button onClick={onCloseModal} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSend} 
                            disabled={!selectedTemplate || isSending || variables.some(v => v.trim() === '')}
                            className="bg-[#00a884] hover:bg-[#008f6f] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                            Iniciar Conversa
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
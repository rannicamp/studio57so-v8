'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faTimes, faPaperPlane, faExclamationTriangle, 
    faImage, faVideo, faFileAlt, faClock, faCalendarAlt, faSave, faCheck
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

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

const sanitizeFileName = (fileName) => {
    return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
};

export default function TemplateMessageModal({ isOpen, onClose, onSendTemplate, contactName, showScheduling = false, initialData = null }) {
    const { data: templatesData, isLoading, error } = useWhatsAppTemplates();
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [isSending, setIsSending] = useState(false);
    
    // Mídia
    const [headerType, setHeaderType] = useState(null);
    const [headerFile, setHeaderFile] = useState(null);
    const [existingHeaderUrl, setExistingHeaderUrl] = useState(null); 
    const fileInputRef = useRef(null);

    // Agendamento
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [minDate, setMinDate] = useState('');
    
    const supabase = createClient();

    // Reset ou Preencher Dados ao Abrir
    useEffect(() => {
        if (isOpen) {
            const tzOffset = new Date().getTimezoneOffset() * 60000;
            const localISOTime = new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
            setMinDate(localISOTime);

            if (initialData && templatesData) {
                const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
                const foundTemplate = templates.find(t => t.name === initialData.template_name);
                
                if (foundTemplate) {
                    setSelectedTemplate(foundTemplate);
                    setVariables(initialData.variables || []);
                    
                    if (initialData.scheduled_at) {
                        setIsScheduled(true);
                        const dateObj = new Date(initialData.scheduled_at);
                        const localDate = new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
                        setScheduledDate(localDate);
                    }

                    const headerComp = foundTemplate.components.find(c => c.type === 'HEADER');
                    if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                        setHeaderType(headerComp.format);
                        const savedHeader = initialData.components?.find(c => c.type === 'header');
                        if (savedHeader?.parameters?.[0]?.[headerComp.format.toLowerCase()]?.link) {
                            setExistingHeaderUrl(savedHeader.parameters[0][headerComp.format.toLowerCase()].link);
                        }
                    }
                }
            } else {
                setSelectedTemplate(null);
                setVariables([]);
                setHeaderType(null);
                setHeaderFile(null);
                setExistingHeaderUrl(null);
                setIsScheduled(false);
                setScheduledDate('');
            }
        }
    }, [isOpen, initialData, templatesData]);

    const handleTemplateChange = (templateName) => {
        const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
        const template = templates.find(t => t.name === templateName);
        
        if (template) {
            setSelectedTemplate(template);
            setExistingHeaderUrl(null); 
            
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            const variableCount = (bodyComponent?.text?.match(/\{\{\d\}\}/g) || []).length;
            const initialVars = Array(variableCount).fill('');
            if (contactName && variableCount > 0 && !initialData) {
                initialVars[0] = contactName;
            }
            setVariables(initialVars);

            const headerComponent = template.components.find(c => c.type === 'HEADER');
            if (headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent.format)) {
                setHeaderType(headerComponent.format);
            } else {
                setHeaderType(null);
            }
            setHeaderFile(null);
        } else {
            setSelectedTemplate(null);
            setVariables([]);
            setHeaderType(null);
            setHeaderFile(null);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo muito grande (Max 15MB)");
            setHeaderFile(file);
            setExistingHeaderUrl(null); 
        }
    };

    const handleSend = async () => {
        if (!selectedTemplate) return;
        if (variables.some(v => v.trim() === '')) return toast.warning('Preencha as variáveis.');
        
        if (headerType && !headerFile && !existingHeaderUrl) {
            return toast.warning(`Adicione um arquivo de ${headerType}.`);
        }

        if (isScheduled && !scheduledDate) return toast.warning("Selecione a data e hora.");

        setIsSending(true);
        try {
            let headerUrl = existingHeaderUrl; 

            if (headerType && headerFile) {
                const cleanName = sanitizeFileName(headerFile.name);
                const uniqueName = `template_${Date.now()}_${cleanName}`;
                const filePath = `templates/${uniqueName}`;

                const { error: uploadError } = await supabase.storage
                    .from('whatsapp-media')
                    .upload(filePath, headerFile);

                if (uploadError) throw new Error("Erro upload template.");
                const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
                headerUrl = urlData.publicUrl;
            }

            let fullText = selectedTemplate.components.find(c => c.type === 'BODY')?.text || '';
            variables.forEach((val, i) => {
                fullText = fullText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
            });

            const components = [];
            if (headerUrl) {
                components.push({
                    type: 'header',
                    parameters: [{ type: headerType.toLowerCase(), [headerType.toLowerCase()]: { link: headerUrl } }]
                });
            }
            if (variables.length > 0) {
                components.push({
                    type: 'body',
                    parameters: variables.map(v => ({ type: 'text', text: v }))
                });
            }

            let finalDate = null;
            if (isScheduled && scheduledDate) {
                finalDate = new Date(scheduledDate).toISOString();
            }

            // --- AQUI ESTAVA O PROBLEMA: Agora enviamos UM objeto ---
            const templatePayload = {
                name: selectedTemplate.name,
                language: { code: selectedTemplate.language },
                components: components,
                fullText: fullText, 
                scheduledAt: finalDate,
                id: initialData?.id 
            };

            await onSendTemplate(templatePayload);
            
            onClose();
        } catch (err) {
            toast.error("Erro: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;
    const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
    const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-800">
                        {initialData ? 'Editar Agendamento' : (isScheduled ? 'Agendar Mensagem' : 'Enviar Template')}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-5">
                    {!templatesData && !error ? <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-[#00a884]" /></div> : (
                        <>
                            {error && <div className="text-red-500 bg-red-50 p-3 rounded text-sm">{error.message}</div>}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                                <select className="w-full p-2 border rounded-md" onChange={(e) => handleTemplateChange(e.target.value)} value={selectedTemplate?.name || ''}>
                                    <option value="" disabled>Selecione...</option>
                                    {approvedTemplates.map(t => (
                                        <option key={t.id} value={t.name}>{t.name.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedTemplate && (
                                <>
                                    {headerType && (
                                        <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                            <label className="block text-sm font-bold text-blue-800 mb-2">Anexar {headerType}</label>
                                            
                                            {existingHeaderUrl && (
                                                <div className="mb-2 text-xs text-green-700 flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faCheck} /> Arquivo já anexado. (Envie outro para trocar)
                                                </div>
                                            )}
                                            
                                            <input type="file" onChange={handleFileChange} accept={headerType === 'IMAGE' ? "image/*" : headerType === 'VIDEO' ? "video/*" : ".pdf"} className="block w-full text-sm text-gray-500" />
                                        </div>
                                    )}
                                    <div className="p-3 border rounded bg-gray-50 text-sm italic whitespace-pre-line">{selectedTemplate.components.find(c => c.type === 'BODY')?.text}</div>
                                    {variables.map((v, i) => (
                                        <input key={i} type="text" value={v} onChange={(e) => {const n=[...variables];n[i]=e.target.value;setVariables(n)}} className="w-full p-2 border rounded" placeholder={`Variável {{${i+1}}}`} />
                                    ))}

                                    {showScheduling && (
                                        <div className="border-t pt-4 mt-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <input type="checkbox" id="schedule-check" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="w-4 h-4 text-[#00a884] rounded cursor-pointer" />
                                                <label htmlFor="schedule-check" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2"><FontAwesomeIcon icon={faClock} className="text-gray-500" /> Agendar envio</label>
                                            </div>

                                            {isScheduled && (
                                                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                                                    <label className="block text-xs font-bold text-yellow-800 mb-1">Data e Hora</label>
                                                    <input type="datetime-local" className="w-full p-2 border rounded bg-white text-sm" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={minDate} />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2 pt-3 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancelar</button>
                    <button onClick={handleSend} disabled={isSending || !selectedTemplate} className="px-4 py-2 bg-[#00a884] text-white rounded text-sm flex items-center gap-2">
                        {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : (initialData ? <FontAwesomeIcon icon={faSave} /> : isScheduled ? <FontAwesomeIcon icon={faCalendarAlt} /> : <FontAwesomeIcon icon={faPaperPlane} />)}
                        {initialData ? 'Salvar Alterações' : (isScheduled ? 'Agendar' : 'Enviar')}
                    </button>
                </div>
            </div>
        </div>
    );
}
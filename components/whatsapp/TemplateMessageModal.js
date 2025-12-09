'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faTimes, faPaperPlane, faExclamationTriangle, 
    faImage, faVideo, faFileAlt, faClock, faCalendarAlt 
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

export default function TemplateMessageModal({ isOpen, onClose, onSendTemplate, contactName, showScheduling = false }) {
    const { data: templatesData, isLoading, error } = useWhatsAppTemplates();
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [isSending, setIsSending] = useState(false);
    
    // Mídia
    const [headerType, setHeaderType] = useState(null);
    const [headerFile, setHeaderFile] = useState(null);
    const fileInputRef = useRef(null);

    // Agendamento
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    const [minDate, setMinDate] = useState(''); // Estado para a data mínima correta
    
    const supabase = createClient();

    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(null);
            setVariables([]);
            setHeaderType(null);
            setHeaderFile(null);
            setIsScheduled(false);
            setScheduledDate('');
            
            // CORREÇÃO FUSO HORÁRIO (MIN DATE): 
            // Calcula o deslocamento do fuso para o 'min' funcionar no horário local do usuário
            const tzOffset = new Date().getTimezoneOffset() * 60000; // offset em milissegundos
            const localISOTime = new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
            setMinDate(localISOTime);
        }
    }, [isOpen]);

    const handleTemplateChange = (templateName) => {
        const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
        const template = templates.find(t => t.name === templateName);
        
        if (template) {
            setSelectedTemplate(template);
            
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            const variableCount = (bodyComponent?.text?.match(/\{\{\d\}\}/g) || []).length;
            const initialVars = Array(variableCount).fill('');
            if (contactName && variableCount > 0) initialVars[0] = contactName;
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

    const handleVariableChange = (index, value) => {
        const newVariables = [...variables];
        newVariables[index] = value;
        setVariables(newVariables);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 15 * 1024 * 1024) return toast.error("Arquivo muito grande (Max 15MB)");
            setHeaderFile(file);
        }
    };

    const handleSend = async () => {
        if (!selectedTemplate) return;
        if (variables.some(v => v.trim() === '')) return toast.warning('Preencha as variáveis.');
        if (headerType && !headerFile) return toast.warning(`Adicione um arquivo de ${headerType}.`);
        if (isScheduled && !scheduledDate) return toast.warning("Selecione a data e hora do agendamento.");

        setIsSending(true);
        try {
            let headerUrl = null;

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

            // CORREÇÃO FUSO HORÁRIO (ENVIO):
            // Transforma a data local escolhida pelo usuário em ISO (UTC) antes de enviar
            let finalDate = null;
            if (isScheduled && scheduledDate) {
                const dateObj = new Date(scheduledDate); 
                finalDate = dateObj.toISOString(); // Converte para o padrão universal (UTC)
            }

            await onSendTemplate(
                selectedTemplate.name, 
                selectedTemplate.language, 
                variables, 
                fullText, 
                components, 
                finalDate 
            );
            
            // O toast será exibido pelo pai (BroadcastPanel) que recebe a resposta do servidor
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
                        {isScheduled ? 'Agendar Mensagem' : 'Enviar Template'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><FontAwesomeIcon icon={faTimes} /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-5">
                    {!templatesData && !error ? <div className="text-center p-8"><FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-[#00a884]" /></div> : (
                        <>
                            {error && <div className="text-red-500 bg-red-50 p-3 rounded text-sm">{error.message}</div>}
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                                <select className="w-full p-2 border rounded-md" onChange={(e) => handleTemplateChange(e.target.value)} defaultValue="">
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
                                            <input type="file" onChange={handleFileChange} accept={headerType === 'IMAGE' ? "image/*" : headerType === 'VIDEO' ? "video/*" : ".pdf"} className="block w-full text-sm text-gray-500" />
                                        </div>
                                    )}
                                    <div className="p-3 border rounded bg-gray-50 text-sm italic whitespace-pre-line">{selectedTemplate.components.find(c => c.type === 'BODY')?.text}</div>
                                    {variables.map((v, i) => (
                                        <input key={i} type="text" value={v} onChange={(e) => {const n=[...variables];n[i]=e.target.value;setVariables(n)}} className="w-full p-2 border rounded" placeholder={`Variável {{${i+1}}}`} />
                                    ))}

                                    {/* AGENDAMENTO */}
                                    {showScheduling && (
                                        <div className="border-t pt-4 mt-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <input 
                                                    type="checkbox" 
                                                    id="schedule-check" 
                                                    checked={isScheduled} 
                                                    onChange={(e) => setIsScheduled(e.target.checked)}
                                                    className="w-4 h-4 text-[#00a884] rounded cursor-pointer"
                                                />
                                                <label htmlFor="schedule-check" className="text-sm font-medium text-gray-700 cursor-pointer select-none flex items-center gap-2">
                                                    <FontAwesomeIcon icon={faClock} className="text-gray-500" /> 
                                                    Agendar envio para depois
                                                </label>
                                            </div>

                                            {isScheduled && (
                                                <div className="bg-yellow-50 p-3 rounded border border-yellow-200 animate-in slide-in-from-top-2">
                                                    <label className="block text-xs font-bold text-yellow-800 mb-1">Data e Hora do Disparo</label>
                                                    <input 
                                                        type="datetime-local" 
                                                        className="w-full p-2 border rounded bg-white text-sm focus:ring-yellow-500 focus:border-yellow-500"
                                                        value={scheduledDate}
                                                        onChange={(e) => setScheduledDate(e.target.value)}
                                                        min={minDate} // Usa o mínimo corrigido
                                                    />
                                                    <p className="text-[10px] text-yellow-700 mt-1">
                                                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                                                        O sistema enviará automaticamente neste horário.
                                                    </p>
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
                        {isSending ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                        ) : isScheduled ? (
                            <><FontAwesomeIcon icon={faCalendarAlt} /> Agendar</>
                        ) : (
                            <><FontAwesomeIcon icon={faPaperPlane} /> Enviar</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
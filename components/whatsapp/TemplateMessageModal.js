'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, 
    faTimes, 
    faPaperPlane, 
    faExclamationTriangle, 
    faImage, 
    faVideo, 
    faFileAlt, 
    faClock, 
    faCalendarAlt 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

// Hook para buscar templates com cache
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
        staleTime: 1000 * 60 * 5, // 5 minutos
        refetchOnWindowFocus: false,
    });
};

// Helper para limpar nome de arquivo
const sanitizeFileName = (fileName) => {
    return fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
};

export default function TemplateMessageModal({ isOpen, onClose, onSendTemplate, contactName, showScheduling = false }) {
    const { data: templatesData, isLoading, error } = useWhatsAppTemplates();
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [isSending, setIsSending] = useState(false);
    
    // Estados para Mídia no Header
    const [headerType, setHeaderType] = useState(null); // 'IMAGE', 'VIDEO', 'DOCUMENT'
    const [headerFile, setHeaderFile] = useState(null);
    const fileInputRef = useRef(null);

    // Estados para Agendamento
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDate, setScheduledDate] = useState('');
    
    const supabase = createClient();

    // Resetar estados ao abrir
    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(null);
            setVariables([]);
            setHeaderType(null);
            setHeaderFile(null);
            setIsScheduled(false);
            setScheduledDate('');
        }
    }, [isOpen]);

    const handleTemplateChange = (templateName) => {
        const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
        const template = templates.find(t => t.name === templateName);
        
        if (template) {
            setSelectedTemplate(template);
            
            // 1. Detectar Variáveis do Corpo
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            const variableCount = (bodyComponent?.text?.match(/\{\{\d\}\}/g) || []).length;
            
            const initialVars = Array(variableCount).fill('');
            // Preenche a primeira variável com o nome do contato, se houver
            if (contactName && variableCount > 0) {
                initialVars[0] = contactName;
            }
            setVariables(initialVars);

            // 2. Detectar Mídia no Header
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
            // Validações básicas de tamanho
            if (file.size > 15 * 1024 * 1024) {
                toast.error("Arquivo muito grande (Max 15MB)");
                return;
            }
            setHeaderFile(file);
        }
    };

    const handleSend = async () => {
        // Validações Iniciais
        if (!selectedTemplate) return;
        if (variables.some(v => v.trim() === '')) {
            toast.warning('Preencha todas as variáveis do modelo.');
            return;
        }
        
        if (headerType && !headerFile) {
            toast.warning(`Este modelo exige o envio de um arquivo de ${headerType}.`);
            return;
        }

        if (isScheduled && !scheduledDate) {
            toast.warning("Selecione a data e hora do agendamento.");
            return;
        }

        setIsSending(true);
        try {
            let headerUrl = null;

            // 1. Upload da Mídia (se houver)
            if (headerType && headerFile) {
                const cleanName = sanitizeFileName(headerFile.name);
                const uniqueName = `template_${Date.now()}_${cleanName}`;
                const filePath = `templates/${uniqueName}`;

                const { error: uploadError } = await supabase.storage
                    .from('whatsapp-media')
                    .upload(filePath, headerFile);

                if (uploadError) throw new Error("Erro ao subir arquivo do template.");

                const { data: urlData } = supabase.storage
                    .from('whatsapp-media')
                    .getPublicUrl(filePath);
                
                headerUrl = urlData.publicUrl;
            }

            // 2. Montar Texto Completo (para histórico)
            let fullText = selectedTemplate.components.find(c => c.type === 'BODY')?.text || '';
            variables.forEach((val, i) => {
                fullText = fullText.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
            });

            // 3. Montar Componentes do Payload para API do WhatsApp
            const components = [];

            // Adiciona Header se existir
            if (headerUrl) {
                components.push({
                    type: 'header',
                    parameters: [{
                        type: headerType.toLowerCase(), // image, video, document
                        [headerType.toLowerCase()]: { link: headerUrl }
                    }]
                });
            }

            // Adiciona Body com Variáveis
            if (variables.length > 0) {
                components.push({
                    type: 'body',
                    parameters: variables.map(v => ({ type: 'text', text: v }))
                });
            }

            // 4. Enviar para o Pai (MessagePanel ou BroadcastPanel)
            await onSendTemplate(
                selectedTemplate.name, 
                selectedTemplate.language, 
                variables, 
                fullText,
                components, // Componentes montados (mídia + texto)
                isScheduled ? scheduledDate : null // Data de agendamento (opcional)
            );
            
            // O toast de sucesso geralmente é feito pelo pai, mas podemos reforçar aqui se for agendamento
            if (isScheduled) toast.success("Agendamento solicitado!");
            
            onClose();

        } catch (err) {
            console.error("Erro envio template:", err);
            toast.error("Erro ao enviar: " + err.message);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.data || []);
    const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-800">
                        {isScheduled ? 'Agendar Mensagem' : 'Enviar Template'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                    {isLoading && (
                        <div className="text-center p-8">
                            <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
                            <p className="mt-2">Carregando modelos...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                            <h3 className="font-bold flex items-center gap-2">
                                <FontAwesomeIcon icon={faExclamationTriangle} /> Erro
                            </h3>
                            <p className="text-sm mt-1">{error.message}</p>
                        </div>
                    )}

                    {!isLoading && !error && (
                        <div className="space-y-5">
                            {/* Seleção de Template */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de Mensagem</label>
                                <select
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Selecione...</option>
                                    {approvedTemplates.map(template => (
                                        <option key={template.id} value={template.name}>
                                            {template.name.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedTemplate && (
                                <>
                                    {/* Mídia do Header */}
                                    {headerType && (
                                        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                                            <label className="block text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                                                {headerType === 'IMAGE' && <FontAwesomeIcon icon={faImage} />}
                                                {headerType === 'VIDEO' && <FontAwesomeIcon icon={faVideo} />}
                                                {headerType === 'DOCUMENT' && <FontAwesomeIcon icon={faFileAlt} />}
                                                Enviar Arquivo ({headerType})
                                            </label>
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                accept={headerType === 'IMAGE' ? "image/*" : headerType === 'VIDEO' ? "video/*" : ".pdf,.doc,.docx"}
                                                onChange={handleFileChange}
                                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                                            />
                                            {headerFile && <p className="text-xs text-green-600 mt-2 font-medium">Arquivo selecionado: {headerFile.name}</p>}
                                        </div>
                                    )}

                                    {/* Preview do Texto */}
                                    <div className="p-4 border rounded-md bg-gray-50">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-1">Texto da Mensagem</p>
                                        <p className="text-sm text-gray-800 italic whitespace-pre-line">
                                            {selectedTemplate.components.find(c => c.type === 'BODY')?.text}
                                        </p>
                                    </div>

                                    {/* Campos de Variáveis */}
                                    {variables.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-sm font-medium text-gray-700">Preencha os campos:</p>
                                            {variables.map((value, index) => (
                                                <div key={index}>
                                                    <label className="block text-xs font-medium text-gray-500 mb-1">
                                                        {`Variável {{${index + 1}}}`}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => handleVariableChange(index, e.target.value)}
                                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder={`Conteúdo para {{${index + 1}}}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* --- ÁREA DE AGENDAMENTO (NOVO) --- */}
                                    {showScheduling && (
                                        <div className="border-t pt-4 mt-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <input 
                                                    type="checkbox" 
                                                    id="schedule-check" 
                                                    checked={isScheduled} 
                                                    onChange={(e) => setIsScheduled(e.target.checked)}
                                                    className="w-4 h-4 text-[#00a884] rounded focus:ring-[#00a884] cursor-pointer"
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
                                                        min={new Date().toISOString().slice(0, 16)}
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
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3 border-t">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!selectedTemplate || isLoading || isSending || (headerType && !headerFile)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
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
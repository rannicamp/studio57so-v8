// components/whatsapp/TemplateMessageModal.js

"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faPaperPlane, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Hook para buscar os templates da nossa nova API
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
        staleTime: 1000 * 60 * 5, // Cache de 5 minutos
        refetchOnWindowFocus: false,
    });
};

export default function TemplateMessageModal({ isOpen, onClose, onSendTemplate, contactName }) {
    const { data: templates, isLoading, error } = useWhatsAppTemplates();
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [variables, setVariables] = useState([]);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedTemplate(null);
            setVariables([]);
        }
    }, [isOpen]);

    const handleTemplateChange = (templateName) => {
        const template = templates.find(t => t.name === templateName);
        if (template) {
            setSelectedTemplate(template);
            const bodyComponent = template.components.find(c => c.type === 'BODY');
            const variableCount = (bodyComponent?.text?.match(/\{\{\d\}\}/g) || []).length;
            
            const initialVars = Array(variableCount).fill('');
            if (contactName && variableCount > 0) {
                initialVars[0] = contactName;
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

    const handleSend = async () => {
        if (!selectedTemplate || variables.some(v => v.trim() === '')) {
            toast.warning('Por favor, selecione um modelo e preencha todas as variáveis.');
            return;
        }
        setIsSending(true);
        try {
            // Agora enviamos o nome, o IDIOMA e as variáveis.
            await onSendTemplate(selectedTemplate.name, selectedTemplate.language, variables);
            toast.success('Mensagem de modelo enviada!');
            onClose();
        } catch (err) {
            // O erro já é tratado na mutação, então não precisa de toast aqui.
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Enviar Mensagem de Modelo</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                
                {isLoading && (
                    <div className="text-center p-8">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-blue-500" />
                        <p className="mt-2">Carregando modelos...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                        <h3 className="font-bold flex items-center gap-2">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Erro ao Carregar
                        </h3>
                        <p className="text-sm mt-1">{error.message}</p>
                    </div>
                )}

                {templates && !isLoading && !error && (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-1">
                                Modelo de Mensagem
                            </label>
                            <select
                                id="template-select"
                                className="w-full p-2 border rounded-md"
                                onChange={(e) => handleTemplateChange(e.target.value)}
                                defaultValue=""
                            >
                                <option value="" disabled>Selecione um modelo...</option>
                                {templates.map(template => (
                                    <option key={template.id} value={template.name}>
                                        {template.name} ({template.language})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedTemplate && (
                             <div className="p-4 border rounded-md bg-gray-50 space-y-3">
                                <p className="text-sm font-semibold text-gray-600">Pré-visualização:</p>
                                <p className="text-sm text-gray-800 italic">
                                   {selectedTemplate.components.find(c => c.type === 'BODY')?.text}
                                </p>
                             </div>
                        )}

                        {variables.map((value, index) => (
                            <div key={index}>
                                <label htmlFor={`variable-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                    {`Variável {{${index + 1}}}`}
                                </label>
                                <input
                                    type="text"
                                    id={`variable-${index}`}
                                    value={value}
                                    onChange={(e) => handleVariableChange(index, e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder={`Preencha a variável ${index + 1}`}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!selectedTemplate || isLoading || isSending || variables.some(v => v.trim() === '')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {isSending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                        Enviar
                    </button>
                </div>
            </div>
        </div>
    );
}
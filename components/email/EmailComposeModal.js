'use client'

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faSpinner } from '@fortawesome/free-solid-svg-icons';
import EmailEditor from './EmailEditor';
import { toast } from 'sonner';

export default function EmailComposeModal({ isOpen, onClose, initialData = null }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
        replyToMessageId: null
    });

    // Popula o formulário quando abre (Novo, Responder ou Encaminhar)
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Modo Resposta/Encaminhamento
                setFormData({
                    to: initialData.to || '',
                    cc: initialData.cc || '',
                    bcc: '',
                    subject: initialData.subject || '',
                    body: initialData.body || '', // Corpo com a citação original
                    replyToMessageId: initialData.messageId || null
                });
            } else {
                // Modo Novo E-mail
                setFormData({ to: '', cc: '', bcc: '', subject: '', body: '', replyToMessageId: null });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: formData.to,
                    cc: formData.cc,
                    bcc: formData.bcc,
                    subject: formData.subject,
                    html: formData.body,
                    replyToMessageId: formData.replyToMessageId
                })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erro ao enviar');

            toast.success('E-mail enviado com sucesso!');
            onClose();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[85vh] animate-fade-in-up">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 rounded-t-xl">
                    <h2 className="font-bold text-gray-800 text-lg">
                        {initialData?.type === 'reply' ? 'Responder' : 
                         initialData?.type === 'forward' ? 'Encaminhar' : 'Nova Mensagem'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-xl" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
                    <div className="p-6 flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
                        
                        {/* Campos de Destinatário */}
                        <div className="grid gap-4">
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Para:</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.to}
                                    onChange={e => setFormData({...formData, to: e.target.value})}
                                    className="flex-grow outline-none text-sm text-gray-800 placeholder-gray-300"
                                    placeholder="destinatario@email.com, outro@email.com"
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Cc:</label>
                                <input 
                                    type="text" 
                                    value={formData.cc}
                                    onChange={e => setFormData({...formData, cc: e.target.value})}
                                    className="flex-grow outline-none text-sm text-gray-800 placeholder-gray-300"
                                    placeholder="Cópia para..."
                                />
                            </div>

                            <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                                <label className="w-16 text-sm font-semibold text-gray-500 text-right">Assunto:</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.subject}
                                    onChange={e => setFormData({...formData, subject: e.target.value})}
                                    className="flex-grow outline-none text-sm font-medium text-gray-800 placeholder-gray-300"
                                    placeholder="Assunto da mensagem"
                                />
                            </div>
                        </div>

                        {/* Editor Rico */}
                        <div className="flex-grow min-h-[300px]">
                            <EmailEditor 
                                value={formData.body} 
                                onChange={(html) => setFormData({...formData, body: html})} 
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
                        <button 
                            type="button" 
                            onClick={() => setFormData({...formData, body: ''})} // Limpar rascunho (simples)
                            className="text-gray-500 hover:text-red-500 text-sm transition-colors"
                        >
                            <FontAwesomeIcon icon={faTimes} className="mr-1" /> Descartar
                        </button>
                        
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 text-sm font-bold transition-transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                                Enviar Mensagem
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
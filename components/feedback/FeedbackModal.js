"use client";

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faTimes, faPaperPlane, faSpinner, faImage, faLink } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Uppy from '@uppy/core';
import GoldenRetriever from '@uppy/golden-retriever';

const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

export default function FeedbackModal() {
    const [isOpen, setIsOpen] = useState(false);
    const { userData } = useAuth();
    const pathname = usePathname();
    const supabase = createClient();
    
    // Form States
    const [descricao, setDescricao] = useState('');
    const [linkOpcional, setLinkOpcional] = useState('');
    const [arquivo, setArquivo] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Uppy Engine Reference (Anti-crash local memory)
    const uppyRef = useRef(null);
    useEffect(() => {
        if (!uppyRef.current) {
            const uppy = new Uppy({ 
                id: 'feedback-print', 
                autoProceed: false, 
                restrictions: { maxNumberOfFiles: 1, allowedFileTypes: ['image/*'] } 
            });
            uppy.use(GoldenRetriever, { serviceWorker: false });
            uppy.on('file-added', (file) => setArquivo(file));
            uppy.on('file-removed', () => setArquivo(null));
            uppyRef.current = uppy;
        }
        return () => {
            if (uppyRef.current && uppyRef.current.close) uppyRef.current.close();
        };
    }, []);

    const { mutate: sendFeedback, isPending } = useMutation({
        mutationFn: async (feedbackData) => {
            let imagem_url = null;

            // 1. Fazer o Upload Manual se tiver Arquivo no Uppy
            if (arquivo) {
                const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${arquivo.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('feedbacks')
                    .upload(`prints/${uniqueName}`, arquivo.data);
                
                if (uploadError) throw new Error("Falha ao subir imagem: " + uploadError.message);
                
                const { data: publicUrlData } = supabase.storage.from('feedbacks').getPublicUrl(`prints/${uniqueName}`);
                imagem_url = publicUrlData.publicUrl;
            }

            // 2. Enviar Formulário 
            const payload = {
                ...feedbackData,
                imagem_url,
                link_opcional: linkOpcional
            };

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro no envio do ticket.');
            return result;
        },
        onSuccess: () => {
            toast.success('Ideia enviada! Obrigado pelo anexo e feedback.');
            setIsOpen(false);
            setDescricao('');
            setLinkOpcional('');
            if (uppyRef.current) uppyRef.current.cancelAll();
        },
        onError: (error) => {
            toast.error(`Erro: ${error.message}`);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!userData) { toast.error('Ocorreu um erro com sua sessão.'); return; }

        sendFeedback({
            usuario_id: userData.id,
            organizacao_id: userData.organizacao_id,
            pagina: pathname, 
            descricao
        });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                uppyRef.current.addFile({ source: 'file input', name: file.name, type: file.type, data: file });
            } catch (err) { }
        }
    };

    return (
        <>
            <link href={UPPY_CSS_URL} rel="stylesheet" />
            <button
                onClick={() => setIsOpen(true)}
                title="Sugerir Melhoria ou Reportar Bug"
                className="flex items-center gap-2 p-2 px-3 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200"
            >
                <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
                <span className="hidden xl:inline text-sm font-semibold text-gray-600 hover:text-amber-700">Ideias & Bugs</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
                                Reportar Bug ou Ideia
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                className="w-full h-32 p-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none shadow-sm"
                                placeholder="Descreva o problema ou sugestão em detalhes..."
                                required
                            />

                            <div className="space-y-3">
                                {/* Link Opcional */}
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 focus-within:ring-2 focus-within:ring-amber-500/50 focus-within:border-amber-500 transition-all">
                                    <FontAwesomeIcon icon={faLink} className="text-gray-400 text-sm" />
                                    <input
                                        type="url"
                                        value={linkOpcional}
                                        onChange={(e) => setLinkOpcional(e.target.value)}
                                        placeholder="Link / URL de referência (Opcional)"
                                        className="w-full bg-transparent border-none text-sm text-gray-700 focus:ring-0 px-3 py-2.5 outline-none placeholder-gray-400"
                                    />
                                </div>

                                {/* Print Opcional */}
                                <div className="border border-dashed border-gray-300 rounded-lg p-3 flex items-center justify-between bg-white hover:bg-amber-50/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                                            <FontAwesomeIcon icon={faImage} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">Anexar Print</p>
                                            <p className="text-xs text-gray-400 line-clamp-1">{arquivo ? arquivo.name : 'Nenhuma imagem selecionada'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {arquivo && (
                                           <button type="button" onClick={() => uppyRef.current.removeFile(arquivo.id)} className="text-xs text-red-500 hover:underline px-2">Remover</button>
                                        )}
                                        <label className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-amber-200 transition-colors">
                                            Procurar
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3 border-t border-gray-100 pt-5">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending || !descricao.trim()}
                                    className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-colors focus:ring-4 focus:ring-gray-200 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faPaperPlane} />}
                                    {isPending ? 'Enviando Ticket...' : 'Enviar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}


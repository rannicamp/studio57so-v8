'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSpinner, faUserCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import EmailEditor from './EmailEditor';

export default function EmailSignatureConfig({ initialData, onClose }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    const [signatureHtml, setSignatureHtml] = useState('');
    const [settings, setSettings] = useState({
        usar_novos: true,
        usar_respostas: true,
        incluir_foto: true
    });

    useEffect(() => {
        if (initialData) {
            setSignatureHtml(initialData.assinatura_texto || '');
            setSettings({
                usar_novos: initialData.assinatura_usar_novos ?? true,
                usar_respostas: initialData.assinatura_usar_respostas ?? true,
                incluir_foto: initialData.assinatura_incluir_foto ?? true
            });
        }
    }, [initialData]);

    const mutation = useMutation({
        mutationFn: async () => {
            const payload = {
                user_id: user.id,
                organizacao_id: organizacao_id,
                assinatura_texto: signatureHtml,
                assinatura_usar_novos: settings.usar_novos,
                assinatura_usar_respostas: settings.usar_respostas,
                assinatura_incluir_foto: settings.incluir_foto
            };
            // Atualiza apenas os campos de assinatura, preservando os de conexão se já existirem
            const { error } = await supabase.from('email_configuracoes')
                .update(payload)
                .eq('user_id', user.id);
            
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Assinatura salva com sucesso!");
            queryClient.invalidateQueries(['emailConfig']);
            if (onClose) onClose();
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    // Preview Simulado
    const userPhoto = user?.user_metadata?.avatar_url; // Pega foto do auth (pode ajustar para pegar de 'usuarios' se preferir)

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                
                {/* Lado Esquerdo: Editor */}
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">Texto da Assinatura</label>
                        <div className="border rounded-lg overflow-hidden h-64 bg-white">
                            <EmailEditor 
                                value={signatureHtml} 
                                onChange={setSignatureHtml} 
                                placeholder="Digite seu nome, cargo, telefone..." 
                            />
                        </div>
                    </div>

                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase">Configurações</p>
                        
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={settings.usar_novos} onChange={e => setSettings({...settings, usar_novos: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm text-gray-700">Inserir em novos e-mails</span>
                        </label>
                        
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={settings.usar_respostas} onChange={e => setSettings({...settings, usar_respostas: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm text-gray-700">Inserir em respostas/encaminhamentos</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={settings.incluir_foto} onChange={e => setSettings({...settings, incluir_foto: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm text-gray-700">Incluir minha foto de perfil</span>
                        </label>
                    </div>
                </div>

                {/* Lado Direito: Preview */}
                <div className="border-l pl-6 border-gray-100 flex flex-col">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-4">Pré-visualização</p>
                    
                    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm flex-grow">
                        <p className="text-gray-400 text-xs italic mb-4">--- Fim da mensagem ---</p>
                        
                        <div className="flex items-start gap-4">
                            {settings.incluir_foto && (
                                <div className="shrink-0">
                                    {userPhoto ? (
                                        <img src={userPhoto} alt="Perfil" className="w-16 h-16 rounded-full object-cover border border-gray-100" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                            <FontAwesomeIcon icon={faUserCircle} className="text-3xl" />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: signatureHtml || '<p>Seu Nome<br>Seu Cargo</p>' }} />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
                            {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            Salvar Assinatura
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
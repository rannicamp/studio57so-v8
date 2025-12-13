'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faSpinner, faServer, faLock, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export default function EmailConfigModal({ isOpen, onClose }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    const [provider, setProvider] = useState('custom'); // 'gmail', 'outlook', 'custom'
    const [formData, setFormData] = useState({
        email: '',
        senha_app: '',
        nome_remetente: '',
        imap_host: '',
        imap_port: 993,
        smtp_host: '',
        smtp_port: 465,
    });

    // 1. Carregar configuração existente (se houver)
    const { data: existingConfig, isLoading } = useQuery({
        queryKey: ['emailConfig', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('email_configuracoes')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // Ignora erro de "não encontrado"
            return data;
        },
        enabled: isOpen && !!user,
    });

    // Preenche o formulário se já existir config
    useEffect(() => {
        if (existingConfig) {
            setFormData({
                email: existingConfig.email,
                senha_app: existingConfig.senha_app,
                nome_remetente: existingConfig.nome_remetente || '',
                imap_host: existingConfig.imap_host,
                imap_port: existingConfig.imap_port,
                smtp_host: existingConfig.smtp_host,
                smtp_port: existingConfig.smtp_port,
            });
            // Tenta adivinhar o provedor
            if (existingConfig.imap_host.includes('gmail')) setProvider('gmail');
            else if (existingConfig.imap_host.includes('outlook')) setProvider('outlook');
            else setProvider('custom');
        }
    }, [existingConfig]);

    // 2. Predefinições Automáticas
    const handleProviderChange = (newProvider) => {
        setProvider(newProvider);
        if (newProvider === 'gmail') {
            setFormData(prev => ({ ...prev, imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 465 }));
        } else if (newProvider === 'outlook') {
            setFormData(prev => ({ ...prev, imap_host: 'outlook.office365.com', imap_port: 993, smtp_host: 'smtp.office365.com', smtp_port: 587 }));
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // 3. Salvar no Banco
    const mutation = useMutation({
        mutationFn: async (data) => {
            const payload = {
                user_id: user.id,
                organizacao_id: organizacao_id,
                ...data,
                imap_user: data.email, // Geralmente é o mesmo
                smtp_user: data.email
            };

            const { error } = await supabase
                .from('email_configuracoes')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Configuração de e-mail salva!");
            queryClient.invalidateQueries(['emailConfig']);
            onClose();
        },
        onError: (err) => {
            toast.error("Erro ao salvar: " + err.message);
        }
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Conectar Conta de E-mail</h2>
                        <p className="text-xs text-gray-500">Configure IMAP e SMTP para enviar e receber.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <FontAwesomeIcon icon={faTimes} className="text-lg" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    
                    {/* Seleção de Provedor */}
                    <div className="flex gap-4 justify-center mb-6">
                        <button 
                            type="button"
                            onClick={() => handleProviderChange('gmail')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-28 transition-all ${provider === 'gmail' ? 'border-red-500 bg-red-50 text-red-700 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="text-xl">G</span>
                            <span className="text-xs">Gmail</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleProviderChange('outlook')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-28 transition-all ${provider === 'outlook' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="text-xl">O</span>
                            <span className="text-xs">Outlook</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleProviderChange('custom')}
                            className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-28 transition-all ${provider === 'custom' ? 'border-gray-500 bg-gray-50 text-gray-800 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <FontAwesomeIcon icon={faServer} className="text-xl" />
                            <span className="text-xs">Outro</span>
                        </button>
                    </div>

                    <form id="email-config-form" onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="space-y-4">
                        
                        {/* Credenciais Básicas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Seu E-mail</label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faEnvelope} className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                                    <input 
                                        type="email" 
                                        name="email"
                                        required
                                        value={formData.email} 
                                        onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="usuario@exemplo.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Senha de App 
                                    <span className="ml-1 text-[10px] text-blue-600 cursor-help font-normal" title="Não use sua senha normal! Gere uma 'Senha de Aplicativo' nas configurações de segurança do seu provedor.">(O que é isso?)</span>
                                </label>
                                <div className="relative">
                                    <FontAwesomeIcon icon={faLock} className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                                    <input 
                                        type="password" 
                                        name="senha_app"
                                        required
                                        value={formData.senha_app} 
                                        onChange={handleChange}
                                        className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="••••••••••••"
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Exibição (Remetente)</label>
                                <input 
                                    type="text" 
                                    name="nome_remetente"
                                    value={formData.nome_remetente} 
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Ex: João - Studio 57"
                                />
                            </div>
                        </div>

                        {/* Configurações Avançadas (Servidores) */}
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Configurações do Servidor</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* IMAP */}
                                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs font-bold text-blue-600">Recebimento (IMAP)</p>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 uppercase">Host</label>
                                        <input type="text" name="imap_host" value={formData.imap_host} onChange={handleChange} className="w-full p-1.5 border rounded text-xs" placeholder="imap.exemplo.com" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 uppercase">Porta</label>
                                        <input type="number" name="imap_port" value={formData.imap_port} onChange={handleChange} className="w-20 p-1.5 border rounded text-xs" />
                                    </div>
                                </div>

                                {/* SMTP */}
                                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p className="text-xs font-bold text-green-600">Envio (SMTP)</p>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 uppercase">Host</label>
                                        <input type="text" name="smtp_host" value={formData.smtp_host} onChange={handleChange} className="w-full p-1.5 border rounded text-xs" placeholder="smtp.exemplo.com" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 uppercase">Porta</label>
                                        <input type="number" name="smtp_port" value={formData.smtp_port} onChange={handleChange} className="w-20 p-1.5 border rounded text-xs" />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        form="email-config-form"
                        type="submit" 
                        disabled={mutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                        Salvar Configuração
                    </button>
                </div>
            </div>
        </div>
    );
}
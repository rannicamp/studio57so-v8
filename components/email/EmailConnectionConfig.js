'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSpinner, faServer, faLock, faEnvelope, faPlus, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

const CONFIG_UI_STATE_KEY = 'emailConnectionFormState';

export default function EmailConnectionConfig({ onClose }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const queryClient = useQueryClient();

    const [editingId, setEditingId] = useState(null); 
    const [provider, setProvider] = useState('custom');
    const [formData, setFormData] = useState({
        conta_apelido: '',
        email: '',
        senha_app: '',
        nome_remetente: '',
        imap_host: '',
        imap_port: 993,
        smtp_host: '',
        smtp_port: 465,
    });

    // --- Persistência de Estado do Formulário ---
    const hasRestored = useRef(false);

    // 1. Restaurar dados ao montar
    useEffect(() => {
        const saved = localStorage.getItem(CONFIG_UI_STATE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.formData) setFormData(parsed.formData);
                if (parsed.provider) setProvider(parsed.provider);
                if (parsed.editingId) setEditingId(parsed.editingId);
            } catch (e) { console.error("Erro ao restaurar form", e); }
        }
        hasRestored.current = true;
    }, []);

    // 2. Salvar dados ao digitar (Debounce para não pesar)
    const [debouncedState] = useDebounce({ formData, provider, editingId }, 500);

    useEffect(() => {
        if (hasRestored.current) {
            localStorage.setItem(CONFIG_UI_STATE_KEY, JSON.stringify(debouncedState));
        }
    }, [debouncedState]);

    // 3. Função para limpar o cache (usada ao salvar com sucesso ou limpar manualmente)
    const clearFormCache = () => {
        localStorage.removeItem(CONFIG_UI_STATE_KEY);
    };
    // ---------------------------------------------

    // 1. Buscar contas existentes
    const { data: accounts, isLoading } = useQuery({
        queryKey: ['emailAccounts', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('email_configuracoes').select('*').eq('user_id', user.id).order('created_at');
            return data || [];
        }
    });

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

    const resetForm = () => {
        setEditingId(null);
        setProvider('custom');
        setFormData({ conta_apelido: '', email: '', senha_app: '', nome_remetente: '', imap_host: '', imap_port: 993, smtp_host: '', smtp_port: 465 });
        clearFormCache(); // Limpa o rascunho salvo ao clicar em "Nova" explicitamente
    };

    const handleEdit = (acc) => {
        setEditingId(acc.id);
        setFormData({
            conta_apelido: acc.conta_apelido || '',
            email: acc.email || '',
            senha_app: acc.senha_app || '',
            nome_remetente: acc.nome_remetente || '',
            imap_host: acc.imap_host || '',
            imap_port: acc.imap_port || 993,
            smtp_host: acc.smtp_host || '',
            smtp_port: acc.smtp_port || 465,
        });
        if (acc.imap_host?.includes('gmail')) setProvider('gmail');
        else if (acc.imap_host?.includes('outlook')) setProvider('outlook');
        else setProvider('custom');
    };

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            const payload = {
                user_id: user.id,
                organizacao_id: organizacao_id,
                ...data,
                imap_user: data.email,
                smtp_user: data.email
            };

            let result;
            if (editingId) {
                result = await supabase.from('email_configuracoes').update(payload).eq('id', editingId);
            } else {
                result = await supabase.from('email_configuracoes').insert(payload);
            }

            if (result.error) throw result.error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Conta atualizada!" : "Conta conectada!");
            queryClient.invalidateQueries(['emailAccounts']);
            queryClient.invalidateQueries(['emailFolders']); 
            resetForm(); // Isso já limpa o cache
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('email_configuracoes').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Conta removida.");
            queryClient.invalidateQueries(['emailAccounts']);
            if (editingId) resetForm();
        }
    });

    return (
        <div className="flex h-full gap-6 animate-fade-in">
            {/* LISTA DE CONTAS (ESQUERDA) */}
            <div className="w-1/3 border-r pr-6 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-700">Contas Conectadas</h3>
                    <button onClick={resetForm} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 font-medium">
                        <FontAwesomeIcon icon={faPlus} /> Nova
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar">
                    {isLoading ? <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" /> : 
                     accounts?.length === 0 ? <p className="text-xs text-gray-400 italic">Nenhuma conta conectada.</p> :
                     accounts.map(acc => (
                        <div key={acc.id} className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${editingId === acc.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`} onClick={() => handleEdit(acc)}>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-gray-800 truncate">{acc.conta_apelido || 'Conta sem nome'}</p>
                                <p className="text-xs text-gray-500 truncate">{acc.email}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); if(confirm('Remover esta conta?')) deleteMutation.mutate(acc.id); }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* FORMULÁRIO (DIREITA) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    {editingId ? 'Editar Conta' : 'Nova Conexão'}
                    <span className="text-[10px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Rascunho automático</span>
                </h3>
                
                <div className="flex gap-4 justify-center mb-6">
                    <button type="button" onClick={() => handleProviderChange('gmail')} className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-24 transition-all ${provider === 'gmail' ? 'border-red-500 bg-red-50 text-red-700 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <span className="text-xl">G</span><span className="text-[10px]">Gmail</span>
                    </button>
                    <button type="button" onClick={() => handleProviderChange('outlook')} className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-24 transition-all ${provider === 'outlook' ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <span className="text-xl">O</span><span className="text-[10px]">Outlook</span>
                    </button>
                    <button type="button" onClick={() => handleProviderChange('custom')} className={`flex flex-col items-center gap-2 p-3 rounded-lg border w-24 transition-all ${provider === 'custom' ? 'border-gray-500 bg-gray-50 text-gray-800 font-bold shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <FontAwesomeIcon icon={faServer} className="text-xl" /><span className="text-[10px]">Outro</span>
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Apelido da Conta (Ex: Igor, Comercial)</label>
                        <input type="text" name="conta_apelido" required value={formData.conta_apelido} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Principal" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faEnvelope} className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="usuario@exemplo.com" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Senha de App</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faLock} className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                                <input type="password" name="senha_app" required value={formData.senha_app} onChange={handleChange} className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••••••" />
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Remetente</label>
                            <input type="text" name="nome_remetente" value={formData.nome_remetente} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: João - Studio 57" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Servidores (IMAP/SMTP)</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] uppercase text-gray-400">IMAP Host</label><input type="text" name="imap_host" value={formData.imap_host} onChange={handleChange} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                            <div><label className="block text-[10px] uppercase text-gray-400">IMAP Port</label><input type="number" name="imap_port" value={formData.imap_port} onChange={handleChange} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                            <div><label className="block text-[10px] uppercase text-gray-400">SMTP Host</label><input type="text" name="smtp_host" value={formData.smtp_host} onChange={handleChange} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                            <div><label className="block text-[10px] uppercase text-gray-400">SMTP Port</label><input type="number" name="smtp_port" value={formData.smtp_port} onChange={handleChange} className="w-full p-2 border rounded text-xs bg-gray-50" /></div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="submit" disabled={saveMutation.isPending} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
                            {saveMutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />} 
                            {editingId ? 'Salvar Alterações' : 'Conectar Conta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
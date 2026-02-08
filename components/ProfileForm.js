'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSave, faSpinner, faCamera, faUser, faEnvelope, faIdCard, 
    faBriefcase, faLock, faKey, faTimes, faCheckCircle 
} from '@fortawesome/free-solid-svg-icons';

export default function ProfileForm() {
    const { user, refreshUser } = useAuth();
    const supabase = createClient();
    const fileInputRef = useRef(null);
    
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Estados do Formulário
    const [formData, setFormData] = useState({
        nome: '',
        sobrenome: '',
        email: '',
        cargo: '', // Será preenchido com o nome_funcao
        avatar_url: ''
    });

    // Estados do Modal de Senha
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });
    const [loadingPassword, setLoadingPassword] = useState(false);

    // 1. Busca os dados COMPLETOS do banco (incluindo o nome da função)
    useEffect(() => {
        const fetchProfileData = async () => {
            if (!user) return;

            try {
                // Buscamos na tabela 'usuarios' e fazemos o JOIN com 'funcoes'
                const { data, error } = await supabase
                    .from('usuarios')
                    .select(`
                        nome,
                        sobrenome,
                        email,
                        avatar_url,
                        funcoes ( nome_funcao )
                    `)
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                if (data) {
                    setFormData({
                        nome: data.nome || '',
                        sobrenome: data.sobrenome || '',
                        email: data.email || user.email || '', // Prioriza banco, fallback para auth
                        // Aqui está a correção: Pega o nome de dentro do objeto funcoes
                        cargo: data.funcoes?.nome_funcao || 'Sem função definida',
                        avatar_url: data.avatar_url || ''
                    });
                }
            } catch (err) {
                console.error("Erro ao buscar perfil:", err);
            }
        };

        fetchProfileData();
    }, [user, supabase]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // 2. Salvar Dados Pessoais
    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('usuarios')
                .update({
                    nome: formData.nome,
                    sobrenome: formData.sobrenome,
                })
                .eq('id', user.id);

            if (error) throw error;

            toast.success('Perfil atualizado com sucesso!');
            if (refreshUser) await refreshUser(); // Atualiza o contexto global
        } catch (error) {
            toast.error('Erro ao atualizar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 3. Alterar Senha
    const handleChangePassword = async (e) => {
        e.preventDefault();
        
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoadingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword
            });

            if (error) throw error;

            toast.success("Senha alterada com sucesso!");
            setShowPasswordModal(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error("Erro ao alterar senha: " + error.message);
        } finally {
            setLoadingPassword(false);
        }
    };

    // 4. Upload de Avatar
    const handleAvatarUpload = async (event) => {
        try {
            setUploading(true);
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // URL Pública
            const { data: { publicUrl } } = supabase.storage
                .from('public-assets')
                .getPublicUrl(filePath);

            // Atualiza banco
            await supabase
                .from('usuarios')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
            toast.success('Foto atualizada!');
            if (refreshUser) await refreshUser();

        } catch (error) {
            console.error(error);
            toast.error('Erro no upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    if (!user) return (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" /> Carregando seus dados...
        </div>
    );

    return (
        <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in relative">
                {/* Banner de Fundo */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 relative">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(/pattern.svg)' }}></div>
                </div>

                <div className="px-8 pb-8">
                    {/* Foto de Perfil */}
                    <div className="relative -mt-16 mb-6 flex justify-between items-end">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-200 shadow-md overflow-hidden relative">
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Perfil" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                                        <FontAwesomeIcon icon={faUser} />
                                    </div>
                                )}
                                
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Alterar foto"
                                >
                                    <FontAwesomeIcon icon={faCamera} />
                                </div>
                            </div>
                            
                            {uploading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-full z-10">
                                    <FontAwesomeIcon icon={faSpinner} spin className="text-blue-600" />
                                </div>
                            )}

                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleAvatarUpload} 
                                accept="image/*" 
                                className="hidden" 
                            />
                        </div>

                        <div className="mb-2 flex flex-col items-end">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">
                                {formData.cargo}
                            </span>
                        </div>
                    </div>

                    {/* Campos do Formulário */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nome</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><FontAwesomeIcon icon={faUser} /></span>
                                <input 
                                    name="nome"
                                    value={formData.nome}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sobrenome</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><FontAwesomeIcon icon={faIdCard} /></span>
                                <input 
                                    name="sobrenome"
                                    value={formData.sobrenome}
                                    onChange={handleChange}
                                    className="w-full pl-10 p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    placeholder="Seu sobrenome"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email (Acesso)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><FontAwesomeIcon icon={faEnvelope} /></span>
                                <input 
                                    value={formData.email}
                                    disabled
                                    className="w-full pl-10 p-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Função no Sistema</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-400"><FontAwesomeIcon icon={faBriefcase} /></span>
                                <input 
                                    value={formData.cargo}
                                    disabled
                                    className="w-full pl-10 p-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Botões de Rodapé */}
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="text-gray-500 hover:text-blue-600 text-sm font-semibold flex items-center gap-2 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50"
                        >
                            <FontAwesomeIcon icon={faLock} />
                            Alterar Senha
                        </button>

                        <button 
                            onClick={handleSave} 
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Alteração de Senha */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faKey} className="text-blue-500" />
                                Segurança da Conta
                            </h3>
                            <button 
                                onClick={() => setShowPasswordModal(false)}
                                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-all"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <p className="text-sm text-gray-500 mb-4">
                                Digite sua nova senha abaixo. Ela deve ter no mínimo 6 caracteres.
                            </p>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Nova Senha</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400"><FontAwesomeIcon icon={faLock} /></span>
                                    <input 
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Confirmar Senha</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-3 text-gray-400"><FontAwesomeIcon icon={faCheckCircle} /></span>
                                    <input 
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingPassword}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-70 flex justify-center items-center gap-2"
                                >
                                    {loadingPassword ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

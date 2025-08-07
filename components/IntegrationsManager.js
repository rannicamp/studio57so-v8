"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faKey, faSave, faLink, faUnlink } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function IntegrationsManager({ empresas, initialConfigs }) {
    const supabase = createClient();
    const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
    const [configs, setConfigs] = useState(initialConfigs);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Hook do NextAuth para verificar a sessão do Google
    const { data: session, status } = useSession();

    useEffect(() => {
        if (empresas && empresas.length === 1) {
            const empresaId = empresas[0].id;
            setSelectedEmpresaId(empresaId);
            const existingConfig = initialConfigs.find(c => c.empresa_id == empresaId);
            setFormData(existingConfig || { empresa_id: empresaId });
        }
    }, [empresas, initialConfigs]);


    const handleEmpresaChange = (e) => {
        const empresaId = e.target.value;
        setSelectedEmpresaId(empresaId);
        if (empresaId) {
            const existingConfig = configs.find(c => c.empresa_id == empresaId);
            setFormData(existingConfig || { empresa_id: empresaId });
        } else {
            setFormData({});
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('Salvando...');
        
        const dataToSave = { ...formData, empresa_id: selectedEmpresaId };
        delete dataToSave.id;

        const { error } = await supabase
            .from('configuracoes_whatsapp')
            .upsert(dataToSave, { onConflict: 'empresa_id' }); 

        if (error) {
            console.error('Erro ao salvar:', error);
            setMessage(`Erro ao salvar: ${error.message}`);
        } else {
            setMessage('Configurações salvas com sucesso!');
            const newConfigs = configs.filter(c => c.empresa_id != dataToSave.empresa_id);
            setConfigs([...newConfigs, dataToSave]);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            {/* Seção do WhatsApp (sem alterações) */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faKey} />
                    Configuração da API do WhatsApp
                </h2>
                {message && <p className="text-center text-sm p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">1. Selecione a Empresa</label>
                        <select onChange={handleEmpresaChange} value={selectedEmpresaId} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">-- Escolha uma empresa --</option>
                            {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.razao_social}</option>)}
                        </select>
                    </div>
                    {selectedEmpresaId && (
                        <div className="space-y-4 pt-4 border-t animate-fade-in">
                            {/* Campos do WhatsApp */}
                            <div>
                                <label className="block text-sm font-medium">ID do Número de Telefone (Phone Number ID)</label>
                                <input type="text" name="whatsapp_phone_number_id" value={formData.whatsapp_phone_number_id || ''} onChange={handleFormChange} className="mt-1 w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">ID da Conta Empresarial (Business Account ID)</label>
                                <input type="text" name="whatsapp_business_account_id" value={formData.whatsapp_business_account_id || ''} onChange={handleFormChange} className="mt-1 w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Token de Acesso Permanente</label>
                                <input type="password" name="whatsapp_permanent_token" value={formData.whatsapp_permanent_token || ''} onChange={handleFormChange} className="mt-1 w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Token de Verificação do Webhook</label>
                                <input type="text" name="verify_token" value={formData.verify_token || ''} onChange={handleFormChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Crie uma senha qualquer aqui, ex: 'meu-token-secreto'" />
                            </div>
                            <div className="text-right">
                                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                                    {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <><FontAwesomeIcon icon={faSave} /> Salvar Configurações</>}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* --- NOVA SEÇÃO DO GOOGLE CALENDAR --- */}
            <div className="border-t pt-6 mt-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faGoogle} className="text-red-500" />
                    Integração com Google Calendar
                </h2>
                <p className="text-sm text-gray-600 mt-2 mb-4">
                    Conecte sua conta Google para permitir que o sistema crie eventos na sua agenda principal automaticamente quando novas atividades forem criadas.
                </p>

                {status === 'loading' && (
                    <div className="text-center p-4">
                        <FontAwesomeIcon icon={faSpinner} spin /> Verificando status...
                    </div>
                )}

                {session && (
                    <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between border border-green-200">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faLink} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                                Conectado como: {session.user.email}
                            </span>
                        </div>
                        <button onClick={() => signOut()} className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUnlink} />
                            Desconectar
                        </button>
                    </div>
                )}

                {status === 'unauthenticated' && (
                    <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between border">
                        <span className="text-sm font-medium text-gray-700">
                            Nenhuma conta Google conectada.
                        </span>
                        <button onClick={() => signIn('google')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                            <FontAwesomeIcon icon={faGoogle} />
                            Conectar com Google
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faKey, faSave } from '@fortawesome/free-solid-svg-icons';

export default function IntegrationsManager({ empresas, initialConfigs }) {
    const supabase = createClient();
    const [selectedEmpresaId, setSelectedEmpresaId] = useState('');
    const [configs, setConfigs] = useState(initialConfigs);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Pré-seleciona a primeira empresa se houver apenas uma
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

        // ***** CORREÇÃO APLICADA AQUI *****
        // Garante que o ID da empresa está no objeto a ser salvo
        const dataToSave = { ...formData, empresa_id: selectedEmpresaId };
        
        // Remove a propriedade 'id' se ela existir, para não causar conflito no upsert
        // O banco de dados gerencia o 'id' da linha
        delete dataToSave.id;

        const { error } = await supabase
            .from('configuracoes_whatsapp')
            .upsert(dataToSave, { onConflict: 'empresa_id' }); // 'upsert' atualiza se já existe, ou insere se não existir.

        if (error) {
            console.error('Erro ao salvar:', error);
            setMessage(`Erro ao salvar: ${error.message}`);
        } else {
            setMessage('Configurações salvas com sucesso!');
            // Atualiza o estado local para refletir a mudança
            const newConfigs = configs.filter(c => c.empresa_id != dataToSave.empresa_id);
            setConfigs([...newConfigs, dataToSave]);
        }
        setLoading(false);
    };

    return (
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
    );
}
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faSpinner, faCalendarAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function ContratoGeral({ contrato, onUpdate }) {
    const supabase = createClient();
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        titulo: '',
        data_inicio: '',
        data_fim: '',
        valor_total: '',
        descricao: '',
        status: 'Ativo'
    });

    // Carrega dados iniciais
    useEffect(() => {
        if (contrato) {
            setFormData({
                titulo: contrato.titulo,
                data_inicio: contrato.data_inicio,
                data_fim: contrato.data_fim || '',
                valor_total: contrato.valor_total,
                descricao: contrato.descricao || '',
                status: contrato.status
            });
        }
    }, [contrato]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase
                .from('contratos_terceirizados')
                .update({
                    titulo: formData.titulo,
                    data_inicio: formData.data_inicio,
                    data_fim: formData.data_fim || null,
                    valor_total: formData.valor_total ? parseFloat(formData.valor_total) : 0,
                    descricao: formData.descricao,
                    status: formData.status
                })
                .eq('id', contrato.id);

            if (error) throw error;
            toast.success('Alterações salvas!');
            if (onUpdate) onUpdate(); 
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título do Contrato</label>
                    <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                        value={formData.titulo || ''}
                        onChange={e => setFormData({...formData, titulo: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.status || 'Ativo'}
                        onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                        <option value="Ativo">Ativo</option>
                        <option value="Encerrado">Encerrado</option>
                        <option value="Pendente">Pendente</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$)</label>
                    <input 
                        type="number" 
                        step="0.01"
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.valor_total || ''}
                        onChange={e => setFormData({...formData, valor_total: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início da Vigência</label>
                    <div className="relative">
                        <input 
                            type="date" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={formData.data_inicio || ''}
                            onChange={e => setFormData({...formData, data_inicio: e.target.value})}
                        />
                        <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim da Vigência</label>
                    <div className="relative">
                        <input 
                            type="date" 
                            className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={formData.data_fim || ''}
                            onChange={e => setFormData({...formData, data_fim: e.target.value})}
                        />
                        <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3 top-3.5 text-gray-400" />
                    </div>
                    {formData.data_fim && new Date(formData.data_fim) < new Date() && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Contrato vencido
                        </p>
                    )}
                </div>

                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Objeto / Descrição Detalhada</label>
                    <textarea 
                        rows="6"
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={formData.descricao || ''}
                        onChange={e => setFormData({...formData, descricao: e.target.value})}
                        placeholder="Descreva aqui o escopo completo do serviço..."
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
                <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md shadow-sm hover:bg-blue-700 flex items-center gap-2 transition-all active:scale-95"
                >
                    {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
                    Salvar Alterações
                </button>
            </div>
        </form>
    );
}
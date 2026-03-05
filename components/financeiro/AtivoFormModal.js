"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faChartLine, faChartBar } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';
import { toast } from 'sonner';

export default function AtivoFormModal({ isOpen, onClose, onSuccess, contasPatrimoniais = [] }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, organizacao_id: organizacaoId } = useAuth();

    const getInitialState = () => ({
        tipo: 'Ativo',
        descricao: '',
        valor: '',
        data_transacao: new Date().toISOString().split('T')[0],
        conta_id: '',
        observacoes: '',
    });

    const [formData, setFormData] = useState(getInitialState());

    const { data: categorias = [] } = useQuery({
        queryKey: ['categorias-patrimonio', organizacaoId],
        queryFn: async () => {
            const { data } = await supabase
                .from('categorias_financeiras')
                .select('id, nome, tipo')
                .in('organizacao_id', [organizacaoId, 1])
                .in('tipo', ['Ativo', 'Passivo'])
                .order('nome');
            return data || [];
        },
        enabled: isOpen && !!organizacaoId,
    });

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (!organizacaoId) throw new Error('Organização não encontrada');
            const valorNumerico = parseFloat(String(data.valor || '0').replace(',', '.')) || 0;
            const { error } = await supabase.from('lancamentos').insert({
                tipo: data.tipo,
                descricao: data.descricao,
                valor: valorNumerico,
                data_transacao: data.data_transacao,
                data_vencimento: data.data_transacao,
                conta_id: data.conta_id,
                status: 'Pago',
                data_pagamento: data.data_transacao,
                observacao: data.observacoes,
                categoria_id: data.categoria_id || null,
                organizacao_id: organizacaoId,
                criado_por_usuario_id: user.id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patrimonio'] });
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
            toast.success(`${formData.tipo} registrado com sucesso!`);
            setFormData(getInitialState());
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => toast.error(`Erro: ${err.message}`),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.conta_id) return toast.error('Selecione uma Conta Patrimonial');
        if (!formData.descricao) return toast.error('Informe a descrição');
        mutation.mutate(formData);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    };

    if (!isOpen) return null;

    const isAtivo = formData.tipo === 'Ativo';
    const contasFiltradas = contasPatrimoniais.filter(c =>
        isAtivo ? c.tipo === 'Conta de Ativo' : c.tipo === 'Conta de Passivo'
    );
    const categsFiltradas = categorias.filter(c => c.tipo === formData.tipo);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Registrar Patrimônio</h3>
                        <p className="text-sm text-gray-500">Adicione um ativo ou passivo ao seu patrimônio</p>
                    </div>
                    <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600 p-2 rounded-full">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tipo — Ativo ou Passivo */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Natureza</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, tipo: 'Ativo', conta_id: '' }))}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold border-2 transition-all ${formData.tipo === 'Ativo'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-purple-300'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faChartLine} />
                                📈 Ativo
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, tipo: 'Passivo', conta_id: '' }))}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold border-2 transition-all ${formData.tipo === 'Passivo'
                                        ? 'bg-orange-600 text-white border-orange-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
                                    }`}
                            >
                                <FontAwesomeIcon icon={faChartBar} />
                                📉 Passivo
                            </button>
                        </div>
                    </div>

                    {/* Conta Patrimonial */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Conta {isAtivo ? 'de Ativo' : 'de Passivo'} *</label>
                        <select
                            name="conta_id"
                            value={formData.conta_id || ''}
                            onChange={handleChange}
                            required
                            className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-300"
                        >
                            <option value="">Selecione a conta patrimonial...</option>
                            {contasFiltradas.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                            {contasFiltradas.length === 0 && (
                                <option disabled>Nenhuma conta de {formData.tipo} cadastrada</option>
                            )}
                        </select>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descrição *</label>
                        <input
                            type="text"
                            name="descricao"
                            value={formData.descricao || ''}
                            onChange={handleChange}
                            required
                            placeholder={isAtivo ? 'Ex: Computadores adquiridos, Lote recebido em permuta...' : 'Ex: Empréstimo CEF, Financiamento de equipamento...'}
                            className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-300"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Valor */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Valor *</label>
                            <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', signed: false } }}
                                value={String(formData.valor || '')}
                                onAccept={(value) => setFormData(prev => ({ ...prev, valor: value }))}
                                required
                                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-300"
                            />
                        </div>
                        {/* Data */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Data de Registro</label>
                            <input
                                type="date"
                                name="data_transacao"
                                value={formData.data_transacao || ''}
                                onChange={handleChange}
                                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-300"
                            />
                        </div>
                    </div>

                    {/* Categoria */}
                    {categsFiltradas.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Categoria</label>
                            <select name="categoria_id" value={formData.categoria_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-lg">
                                <option value="">Sem categoria</option>
                                {categsFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Observações */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Observações</label>
                        <textarea
                            name="observacoes"
                            value={formData.observacoes || ''}
                            onChange={handleChange}
                            rows="2"
                            placeholder="Detalhes adicionais..."
                            className="mt-1 w-full p-2 border rounded-lg text-sm"
                        />
                    </div>

                    {/* Botões */}
                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className={`px-5 py-2 text-white rounded-lg font-bold flex items-center gap-2 ${isAtivo ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                        >
                            {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : `Registrar ${formData.tipo}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

//components\financeiro\ContaFormModal.js
"use client";

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

export default function ContaFormModal({ isOpen, onClose, onSave, initialData, empresas, contas }) {
    const isEditing = Boolean(initialData);
    
    const getInitialState = () => ({
        nome: '',
        tipo: 'Conta Corrente',
        saldo_inicial: '',
        instituicao: '',
        empresa_id: null,
        agencia: '',
        numero_conta: '',
        chaves_pix: [{ tipo: 'CNPJ', chave: '' }],
        limite_cheque_especial: '',
        limite_credito: '',
        dia_fechamento_fatura: '',
        dia_pagamento_fatura: '',
        conta_debito_fatura_id: null,
    });

    const [formData, setFormData] = useState(getInitialState());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const initial = isEditing ? { ...getInitialState(), ...initialData } : getInitialState();
            if (!initial.chaves_pix || !Array.isArray(initial.chaves_pix) || initial.chaves_pix.length === 0) {
                initial.chaves_pix = [{ tipo: 'CNPJ', chave: '' }];
            }
            setFormData(initial);
        }
    }, [isOpen, initialData, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? null : value }));
    };

    const handleMaskedChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePixChange = (index, field, value) => {
        const newChaves = [...formData.chaves_pix];
        newChaves[index][field] = value;
        setFormData(prev => ({ ...prev, chaves_pix: newChaves }));
    };

    const addPixField = () => {
        setFormData(prev => ({ ...prev, chaves_pix: [...prev.chaves_pix, { tipo: 'E-mail', chave: '' }] }));
    };

    const removePixField = (index) => {
        setFormData(prev => ({ ...prev, chaves_pix: prev.chaves_pix.filter((_, i) => i !== index) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const dataToSave = {
            ...formData,
            chaves_pix: formData.chaves_pix.filter(p => p.chave && p.chave.trim() !== '')
        };
        const success = await onSave(dataToSave);
        setLoading(false);
        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">
                    {isEditing ? 'Editar Conta' : 'Adicionar Nova Conta'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* --- DADOS GERAIS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nome da Conta *</label>
                            <input type="text" name="nome" value={formData.nome || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Conta Principal, Cartão Nubank" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Empresa Proprietária</label>
                            <select name="empresa_id" value={formData.empresa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option value="">Nenhuma</option>
                                {empresas.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.nome_fantasia || emp.razao_social}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Tipo de Conta</label>
                            <select name="tipo" value={formData.tipo} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                <option value="Conta Corrente">Conta Corrente</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Conta Investimento">Conta Investimento</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Saldo Inicial / Fatura Aberta *</label>
                             <IMaskInput
                                mask="R$ num"
                                blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', signed: true }}}
                                name="saldo_inicial"
                                value={String(formData.saldo_inicial || '')}
                                onAccept={(value) => handleMaskedChange('saldo_inicial', value)}
                                required
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Instituição Financeira</label>
                            <input type="text" name="instituicao" value={formData.instituicao || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: Bradesco, Itaú..." />
                        </div>
                    </div>
                    
                    {/* --- SEÇÃO PARA CONTA CORRENTE --- */}
                    {formData.tipo === 'Conta Corrente' && (
                        <div className="pt-4 border-t border-gray-200 space-y-4">
                            <h4 className="font-bold text-gray-800">Detalhes da Conta Corrente</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Agência</label>
                                    <input type="text" name="agencia" value={formData.agencia || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Número da Conta</label>
                                    <input type="text" name="numero_conta" value={formData.numero_conta || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" />
                                </div>
                            </div>
                            <div>
                               <label className="block text-sm font-medium">Limite do Cheque Especial</label>
                               <IMaskInput
                                   mask="R$ num"
                                   blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}}
                                   name="limite_cheque_especial"
                                   value={String(formData.limite_cheque_especial || '')}
                                   onAccept={(value) => handleMaskedChange('limite_cheque_especial', value)}
                                   className="mt-1 w-full p-2 border rounded-md"
                               />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Chaves PIX</label>
                                <div className="space-y-2">
                                    {formData.chaves_pix.map((pix, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <select value={pix.tipo} onChange={(e) => handlePixChange(index, 'tipo', e.target.value)} className="p-2 border rounded-md w-1/3">
                                                <option>CNPJ</option><option>CPF</option><option>E-mail</option><option>Telefone</option><option>Aleatória</option>
                                            </select>
                                            <input type="text" value={pix.chave} onChange={(e) => handlePixChange(index, 'chave', e.target.value)} placeholder="Insira a chave" className="p-2 border rounded-md flex-grow" />
                                            <button type="button" onClick={() => removePixField(index)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTrash} /></button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addPixField} className="text-blue-600 hover:text-blue-800 text-sm font-semibold mt-2 flex items-center gap-1">
                                    <FontAwesomeIcon icon={faPlus} /> Adicionar Chave PIX
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* --- SEÇÃO PARA CARTÃO DE CRÉDITO --- */}
                    {formData.tipo === 'Cartão de Crédito' && (
                        <div className="pt-4 border-t border-gray-200 space-y-4">
                            <h4 className="font-bold text-gray-800">Detalhes do Cartão de Crédito</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                   <label className="block text-sm font-medium">Limite de Crédito</label>
                                   <IMaskInput
                                       mask="R$ num"
                                       blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',' }}}
                                       name="limite_credito"
                                       value={String(formData.limite_credito || '')}
                                       onAccept={(value) => handleMaskedChange('limite_credito', value)}
                                       className="mt-1 w-full p-2 border rounded-md"
                                   />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Dia Fechamento Fatura</label>
                                    <input type="number" name="dia_fechamento_fatura" value={formData.dia_fechamento_fatura || ''} onChange={handleChange} min="1" max="31" className="mt-1 w-full p-2 border rounded-md" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Dia Pagamento Fatura</label>
                                    <input type="number" name="dia_pagamento_fatura" value={formData.dia_pagamento_fatura || ''} onChange={handleChange} min="1" max="31" className="mt-1 w-full p-2 border rounded-md" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Conta para Débito da Fatura</label>
                                <select name="conta_debito_fatura_id" value={formData.conta_debito_fatura_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                                    <option value="">Nenhuma / Pagamento Manual</option>
                                    {contas?.map(conta => (
                                        <option key={conta.id} value={conta.id}>{conta.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
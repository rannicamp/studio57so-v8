"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faCheckCircle, faCalendarDay, faCreditCard, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { IMaskInput } from 'react-imask';
// 1. IMPORTAÇÃO DO CARTEIRO (Adicionado)
import { enviarNotificacao } from '@/utils/notificacoes';

export default function PagamentoFaturaModal({ isOpen, onClose, onSuccess, contaCartao, contasDisponiveis = [] }) {
    const supabase = createClient();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        valor: '',
        data_pagamento: new Date().toISOString().split('T')[0],
        conta_origem_id: '',
        observacao: ''
    });

    // Inicializa o formulário quando o modal abre
    useEffect(() => {
        if (isOpen && contaCartao) {
            setFormData({
                // Sugere o valor total (módulo do saldo negativo)
                valor: Math.abs(contaCartao.saldoAtual || 0), 
                data_pagamento: new Date().toISOString().split('T')[0],
                // Sugere a conta padrão configurada, se houver
                conta_origem_id: contaCartao.conta_debito_fatura_id || '', 
                observacao: `Pagamento Fatura - ${contaCartao.nome}`
            });
        }
    }, [isOpen, contaCartao]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.conta_origem_id) return toast.warning("Selecione a conta de origem.");
        if (!formData.valor || formData.valor <= 0) return toast.warning("Informe um valor válido.");

        setLoading(true);
        const transferenciaId = crypto.randomUUID(); // ID único para vincular as duas pontas
        const organizacaoId = user.organizacao_id;

        try {
            // 1. Saída da Conta Corrente (Despesa)
            const lancamentoOrigem = {
                descricao: `Pagamento Fatura ${contaCartao.nome}`,
                valor: formData.valor,
                tipo: 'Despesa',
                conta_id: formData.conta_origem_id,
                data_transacao: formData.data_pagamento,
                data_pagamento: formData.data_pagamento,
                status: 'Pago',
                conciliado: true, // Já nasce conciliado pois é interno
                transferencia_id: transferenciaId,
                organizacao_id: organizacaoId,
                observacao: formData.observacao
            };

            // 2. Entrada no Cartão de Crédito (Receita/Pagamento)
            const lancamentoDestino = {
                descricao: `Pagamento Recebido - Fatura`,
                valor: formData.valor,
                tipo: 'Receita',
                conta_id: contaCartao.id,
                data_transacao: formData.data_pagamento,
                data_pagamento: formData.data_pagamento,
                status: 'Pago',
                conciliado: true,
                transferencia_id: transferenciaId,
                organizacao_id: organizacaoId,
                observacao: formData.observacao
            };

            const { error } = await supabase.from('lancamentos').insert([lancamentoOrigem, lancamentoDestino]);

            if (error) throw error;

            // 3. NOTIFICAÇÃO DE PAGAMENTO (Adicionado) 🔔
            const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.valor);
            await enviarNotificacao({
                userId: user.id, 
                titulo: "✅ Fatura Paga",
                mensagem: `Pagamento realizado: ${contaCartao.nome} - ${valorFormatado}`,
                link: '/financeiro',
                organizacaoId: organizacaoId,
                canal: 'financeiro'
            });

            toast.success("Pagamento de fatura realizado com sucesso!");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Erro ao pagar fatura:", error);
            toast.error("Erro ao processar pagamento.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                            <FontAwesomeIcon icon={faCreditCard} size="lg" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Pagar Fatura</h3>
                            <p className="text-sm text-gray-500">{contaCartao?.nome}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Valor do Pagamento</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">R$</span>
                            <IMaskInput
                                mask="num"
                                blocks={{
                                    num: { mask: Number, thousandsSeparator: '.', scale: 2, radix: ',', padFractionalZeros: true }
                                }}
                                value={String(formData.valor)}
                                unmask={true}
                                onAccept={(value) => setFormData({ ...formData, valor: value })}
                                className="w-full pl-10 p-2 border rounded-md text-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Data Pagamento</label>
                            <div className="relative">
                                <FontAwesomeIcon icon={faCalendarDay} className="absolute left-3 top-2.5 text-gray-400" />
                                <input 
                                    type="date" 
                                    value={formData.data_pagamento} 
                                    onChange={(e) => setFormData({...formData, data_pagamento: e.target.value})}
                                    className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Conta de Origem</label>
                            <select 
                                value={formData.conta_origem_id} 
                                onChange={(e) => setFormData({...formData, conta_origem_id: e.target.value})}
                                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                required
                            >
                                <option value="">Selecione...</option>
                                {contasDisponiveis.filter(c => c.tipo !== 'Cartão de Crédito').map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Observação (Opcional)</label>
                        <input 
                            type="text" 
                            value={formData.observacao} 
                            onChange={(e) => setFormData({...formData, observacao: e.target.value})}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: Pagamento parcial ref. Julho"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200 font-semibold">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-semibold flex items-center justify-center gap-2">
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCheckCircle} />}
                            Confirmar Pagamento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
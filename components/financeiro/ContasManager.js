"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';

export default function ContasManager({ initialContas, allLancamentos, onUpdate }) {
    const supabase = createClient();
    const [contas, setContas] = useState(initialContas || []);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setContas(initialContas || []);
    }, [initialContas]);

    const contasComSaldoAtual = useMemo(() => {
        if (!contas.length || !allLancamentos) return contas;

        return contas.map(conta => {
            const saldoInicial = parseFloat(conta.saldo_inicial) || 0;
            
            const totalLancamentos = allLancamentos
                .filter(l => l.conta_id === conta.id && l.status === 'Pago')
                .reduce((acc, lancamento) => {
                    const valor = parseFloat(lancamento.valor) || 0;
                    if (lancamento.tipo === 'Receita') {
                        return acc + valor;
                    }
                    if (lancamento.tipo === 'Despesa') {
                        return acc - valor;
                    }
                    return acc;
                }, 0);
            
            return {
                ...conta,
                saldo_atual: saldoInicial + totalLancamentos
            };
        });
    }, [contas, allLancamentos]);
    
    const handleSaveConta = async (formData) => {
        setLoading(true);
        const isEditing = Boolean(formData.id);
        const saldoNumerico = parseFloat(String(formData.saldo_inicial).replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0;
        const dataToSave = { ...formData, saldo_inicial: saldoNumerico };

        let error;
        if (isEditing) {
            const { id, ...updateData } = dataToSave;
            const { error: updateError } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
            error = updateError;
        } else {
            delete dataToSave.id;
            const { error: insertError } = await supabase.from('contas_financeiras').insert(dataToSave);
            error = insertError;
        }

        if (error) {
            setMessage(`Erro: ${error.message}`);
            setLoading(false);
            return false;
        }

        setMessage(`Conta ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
        setTimeout(() => setMessage(''), 3000);
        onUpdate();
        setLoading(false);
        return true;
    };

    const handleDeleteConta = async (contaId) => {
        if (!window.confirm("Tem certeza que deseja excluir esta conta? Todas as transações associadas também serão perdidas.")) return;
        
        const { error } = await supabase.from('contas_financeiras').delete().eq('id', contaId);
        if (error) {
            setMessage(`Erro ao excluir: ${error.message}`);
        } else {
            setMessage("Conta excluída com sucesso.");
            onUpdate();
        }
    };
    
    const handleOpenEditModal = (conta) => { setEditingConta(conta); setIsModalOpen(true); };
    const handleOpenAddModal = () => { setEditingConta(null); setIsModalOpen(true); };
    
    const getAccountIcon = (type) => {
        switch (type) {
            case 'Conta Corrente': return faUniversity;
            case 'Cartão de Crédito': return faCreditCard;
            case 'Dinheiro': return faMoneyBillWave;
            case 'Investimento': return faChartLine;
            default: return faUniversity;
        }
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <ContaFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveConta} initialData={editingConta} />
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Minhas Contas</h2>
                <button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <FontAwesomeIcon icon={faPlus} /> Nova Conta
                </button>
            </div>

            {message && <p className="text-center text-sm font-medium p-2 bg-blue-50 text-blue-800 rounded-md">{message}</p>}

            {loading ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) 
            : contasComSaldoAtual.length === 0 ? ( <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada.</p> ) 
            : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contasComSaldoAtual.map(conta => (
                        <div key={conta.id} className="border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow relative group">
                            <div className="flex items-center gap-4 mb-3">
                                <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-2xl text-blue-500" />
                                <div>
                                    <h3 className="font-bold text-lg">{conta.nome}</h3>
                                    <p className="text-xs text-gray-500">{conta.instituicao}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Saldo Atual</p>
                                <p className={`text-xl font-semibold ${conta.saldo_atual < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {formatCurrency(conta.saldo_atual)}
                                </p>
                            </div>
                             <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenEditModal(conta)} className="text-gray-500 hover:text-blue-600"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                <button onClick={() => handleDeleteConta(conta.id)} className="text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
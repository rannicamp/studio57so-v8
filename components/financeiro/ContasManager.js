"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, faPenToSquare, faTrash, faBuilding } from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';

export default function ContasManager({ initialContas, allLancamentos, onUpdate, empresas }) {
    const supabase = createClient();
    const [contas, setContas] = useState(initialContas || []);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setContas(initialContas || []);
    }, [initialContas]);

    // ***** INÍCIO DA CORREÇÃO *****
    // Lógica de cálculo de saldo simplificada para o novo modelo de dados
    const contasComSaldoAtual = useMemo(() => {
        if (!contas || !contas.length) return [];

        return contas.map(conta => {
            const saldoInicial = parseFloat(conta.saldo_inicial) || 0;
            
            const totalLancamentos = (allLancamentos || [])
                .filter(l => l.conta_id === conta.id) // Apenas filtramos pela conta_id agora
                .reduce((acc, lancamento) => {
                    const valor = parseFloat(lancamento.valor) || 0;
                    
                    if (lancamento.tipo === 'Receita') {
                        return acc + valor;
                    } else if (lancamento.tipo === 'Despesa') {
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
    // ***** FIM DA CORREÇÃO *****
    
    const handleSaveConta = async (formData) => {
        setMessage('Salvando...'); 
        try {
            const isEditing = Boolean(formData.id);
            const saldoNumerico = parseFloat(String(formData.saldo_inicial).replace(/[^0-9,.]/g, '').replace('.', '').replace(',', '.')) || 0;
            const dataToSave = { ...formData, saldo_inicial: saldoNumerico };

            let error;
            if (isEditing) {
                const { id, ...updateData } = dataToSave;
                delete updateData.empresa;
                delete updateData.saldo_atual;
                const { error: updateError } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
                error = updateError;
            } else {
                delete dataToSave.id;
                delete dataToSave.empresa;
                delete dataToSave.saldo_atual;
                const { error: insertError } = await supabase.from('contas_financeiras').insert(dataToSave);
                error = insertError;
            }

            if (error) {
                throw error;
            }

            setMessage(`Conta ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
            await onUpdate();
            setTimeout(() => setMessage(''), 3000);
            return true;

        } catch (error) {
            console.error("Erro ao salvar conta:", error);
            setMessage(`Erro ao salvar conta: ${error.message || 'Verifique os dados e tente novamente.'}`);
            setTimeout(() => setMessage(''), 5000);
            return false;
        }
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
            default: return faBuilding;
        }
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <ContaFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveConta} initialData={editingConta} empresas={empresas} />
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Minhas Contas</h2>
                <button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    <FontAwesomeIcon icon={faPlus} /> Nova Conta
                </button>
            </div>

            {message && <p className={`text-center text-sm font-medium p-2 rounded-md ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</p>}

            {loading && initialContas.length === 0 ? ( <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div> ) 
            : contasComSaldoAtual.length === 0 ? ( <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada.</p> ) 
            : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contasComSaldoAtual.map(conta => (
                        <div key={conta.id} className="border p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow relative group flex flex-col justify-between">
                            <div>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-4">
                                        <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-2xl text-blue-500 mt-1" />
                                        <div>
                                            <h3 className="font-bold text-lg">{conta.nome}</h3>
                                            <p className="text-xs text-gray-500">{conta.instituicao}</p>
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenEditModal(conta)} className="text-gray-500 hover:text-blue-600"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                        <button onClick={() => handleDeleteConta(conta.id)} className="text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTrash} /></button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs text-gray-600 border-t pt-3">
                                    <p><strong>Ag:</strong> {conta.agencia || 'N/A'} / <strong>CC:</strong> {conta.numero_conta || 'N/A'}</p>
                                    {conta.empresa && <p><strong>Empresa:</strong> {conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}
                                    {conta.chaves_pix && conta.chaves_pix.length > 0 && (
                                        <div><strong>PIX:</strong> {conta.chaves_pix.map(p => p.chave).join(', ')}</div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right mt-4 pt-3 border-t">
                                <p className="text-sm text-gray-600">Saldo Atual</p>
                                <p className={`text-xl font-semibold ${conta.saldo_atual < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {formatCurrency(conta.saldo_atual)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
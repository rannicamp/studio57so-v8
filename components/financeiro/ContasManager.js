"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, faPenToSquare, faTrash, faBuilding, faCalendarAlt, faWallet, faArrowCircleDown, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
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

    const contasComSaldoAtual = useMemo(() => {
        if (!contas || !contas.length) return [];

        return contas.map(conta => {
            const saldoInicial = parseFloat(conta.saldo_inicial) || 0;
            
            const totalLancamentos = (allLancamentos || [])
                .filter(l => l.conta_id === conta.id)
                .reduce((acc, lancamento) => {
                    const valor = parseFloat(lancamento.valor) || 0;
                    if (lancamento.tipo === 'Receita') return acc + valor;
                    if (lancamento.tipo === 'Despesa') return acc - valor;
                    return acc;
                }, 0);

            let saldoFinal = saldoInicial + totalLancamentos;
            let faturaAtual = 0;
            
            if (conta.tipo === 'Cartão de Crédito') {
                // Para cartão, o "saldo" é a fatura, que é a soma das despesas.
                // O saldo inicial pode ser uma fatura anterior não paga.
                faturaAtual = (allLancamentos || [])
                    .filter(l => l.conta_id === conta.id && l.tipo === 'Despesa')
                    .reduce((acc, l) => acc + (parseFloat(l.valor) || 0), saldoInicial);
                saldoFinal = -faturaAtual; // Representamos a fatura como um valor negativo (dívida)
            }
            
            return {
                ...conta,
                saldo_atual: saldoFinal,
                fatura_atual: faturaAtual
            };
        });
    }, [contas, allLancamentos]);
    
    const handleSaveConta = async (formData) => {
        setMessage('Salvando...'); 
        try {
            const isEditing = Boolean(formData.id);

            // Limpa e converte todos os campos numéricos
            const dataToSave = {
                ...formData,
                saldo_inicial: parseFloat(String(formData.saldo_inicial || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || 0,
                limite_credito: formData.limite_credito ? parseFloat(String(formData.limite_credito).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                limite_cheque_especial: formData.limite_cheque_especial ? parseFloat(String(formData.limite_cheque_especial).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                dia_fechamento_fatura: formData.dia_fechamento_fatura ? parseInt(formData.dia_fechamento_fatura, 10) : null,
                dia_pagamento_fatura: formData.dia_pagamento_fatura ? parseInt(formData.dia_pagamento_fatura, 10) : null,
                conta_debito_fatura_id: formData.conta_debito_fatura_id || null
            };

            // Remove campos que não devem ir pro DB ou que são nulos
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] === '' || dataToSave[key] === undefined) {
                    dataToSave[key] = null;
                }
            });


            let error;
            if (isEditing) {
                const { id, empresa, saldo_atual, fatura_atual, conta_debito_fatura, ...updateData } = dataToSave;
                const { error: updateError } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
                error = updateError;
            } else {
                delete dataToSave.id;
                const { error: insertError } = await supabase.from('contas_financeiras').insert(dataToSave);
                error = insertError;
            }

            if (error) throw error;

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
        if (!window.confirm("Tem certeza que deseja excluir esta conta? Os lançamentos associados a ela ficarão órfãos.")) return;
        
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
            case 'Conta Investimento': return faChartLine;
            default: return faBuilding;
        }
    };
    
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const getSaldoLabel = (conta) => {
        if (conta.tipo === 'Cartão de Crédito') return 'Fatura Atual';
        if (conta.tipo === 'Conta Corrente' && conta.limite_cheque_especial > 0) return 'Saldo + Ch. Especial';
        return 'Saldo Atual';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <ContaFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={handleSaveConta} 
                initialData={editingConta} 
                empresas={empresas}
                contas={contas.filter(c => c.tipo === 'Conta Corrente')} // Passa apenas contas correntes para o débito
            />

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
                                    {conta.empresa && <p><strong>Empresa:</strong> {conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}

                                    {/* Campos para Conta Corrente */}
                                    {(conta.tipo === 'Conta Corrente' || !conta.tipo) && (
                                        <>
                                            <p><strong>Ag:</strong> {conta.agencia || 'N/A'} / <strong>CC:</strong> {conta.numero_conta || 'N/A'}</p>
                                            {conta.limite_cheque_especial > 0 && 
                                                <p className='text-yellow-600 flex items-center gap-2'>
                                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                                    <strong>Cheque Esp.:</strong> {formatCurrency(conta.limite_cheque_especial)}
                                                </p>
                                            }
                                        </>
                                    )}

                                    {/* Campos para Cartão de Crédito */}
                                    {conta.tipo === 'Cartão de Crédito' && (
                                        <>
                                            <p className='flex items-center gap-2'><FontAwesomeIcon icon={faWallet} /> <strong>Limite:</strong> {formatCurrency(conta.limite_credito)}</p>
                                            <p className='flex items-center gap-2'><FontAwesomeIcon icon={faCalendarAlt} /> <strong>Fecha dia:</strong> {conta.dia_fechamento_fatura} | <strong>Paga dia:</strong> {conta.dia_pagamento_fatura}</p>
                                            {conta.conta_debito_fatura && 
                                                <p className='flex items-center gap-2 text-blue-600'>
                                                    <FontAwesomeIcon icon={faArrowCircleDown} />
                                                    <strong>Débito em:</strong> {conta.conta_debito_fatura.nome}
                                                </p>
                                            }
                                        </>
                                    )}

                                    {conta.chaves_pix && conta.chaves_pix.length > 0 && (
                                        <div><strong>PIX:</strong> {conta.chaves_pix.map(p => p.chave).join(', ')}</div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right mt-4 pt-3 border-t">
                                <p className="text-sm text-gray-600">{getSaldoLabel(conta)}</p>
                                <p className={`text-xl font-semibold ${conta.saldo_atual < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                    {formatCurrency(conta.tipo === 'Cartão de Crédito' ? conta.fatura_atual : conta.saldo_atual + (conta.limite_cheque_especial || 0))}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
// components/financeiro/ContasManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, 
    faPenToSquare, faTrash, faExclamationTriangle, faSpinner, 
    faWallet, faHandHoldingDollar, faLayerGroup, faMoneyBillTransfer, faFileInvoice
} from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';
import PagamentoFaturaModal from './PagamentoFaturaModal';
import KpiCard from '@/components/shared/KpiCard';
import { toast } from 'sonner';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const getAccountIcon = (type) => {
    switch (type) {
        case 'Conta Corrente': return faUniversity;
        case 'Cartão de Crédito': return faCreditCard;
        case 'Dinheiro': return faMoneyBillWave;
        case 'Conta Investimento': return faChartLine;
        default: return faUniversity;
    }
};

const fetchSaldosReais = async (contas, organizacaoId) => {
    if (!contas || contas.length === 0 || !organizacaoId) return {};
    const supabase = createClient();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dataCorte = tomorrow.toISOString().split('T')[0];

    const promises = contas.map(async (conta) => {
        const { data, error } = await supabase.rpc('calcular_saldo_anterior', {
            p_conta_id: conta.id,
            p_data_inicio: dataCorte,
            p_organizacao_id: organizacaoId
        });

        if (error) {
            console.error(`Erro ao calcular saldo da conta ${conta.nome}:`, error);
            return { id: conta.id, saldo: 0 };
        }
        return { id: conta.id, saldo: data };
    });

    const results = await Promise.all(promises);
    
    return results.reduce((acc, item) => {
        acc[item.id] = item.saldo;
        return acc;
    }, {});
};

export default function ContasManager({ initialContas, onUpdate, empresas, onVerExtrato }) {
    const supabase = createClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [contaParaPagar, setContaParaPagar] = useState(null);

    const { data: saldos = {}, isLoading: isLoadingSaldos } = useQuery({
        queryKey: ['saldosContasReais', initialContas.map(c => c.id), organizacaoId],
        queryFn: () => fetchSaldosReais(initialContas, organizacaoId),
        enabled: initialContas.length > 0 && !!organizacaoId,
        refetchOnWindowFocus: true
    });

    const kpis = useMemo(() => {
        let saldoLiquido = 0;
        let limiteChequeTotal = 0;
        let limiteChequeUsado = 0;
        let poderCompra = 0;

        initialContas.forEach(conta => {
            const saldo = saldos[conta.id] || 0;
            const limite = conta.limite_cheque_especial || 0;
            
            // Ignora cartões no cálculo do saldo líquido e poder de compra
            if (conta.tipo !== 'Cartão de Crédito') {
                
                // === LÓGICA ATUALIZADA AQUI ===
                // Saldo Líquido (Caixa): Soma apenas contas Positivas (Dinheiro Real)
                if (saldo > 0) {
                    saldoLiquido += saldo;
                }
                
                // Poder de Compra: (Saldo Atual + Limite) de todas as contas
                poderCompra += (saldo + limite);

                if (conta.tipo === 'Conta Corrente') {
                    limiteChequeTotal += limite;
                    if (saldo < 0) {
                        limiteChequeUsado += Math.min(Math.abs(saldo), limite);
                    }
                }
            }
        });

        return {
            saldoLiquido,
            limiteChequeTotal,
            limiteChequeUsado,
            percentualUsoCheque: limiteChequeTotal > 0 ? (limiteChequeUsado / limiteChequeTotal) * 100 : 0,
            poderCompra
        };
    }, [initialContas, saldos]);

    // Filtra os cartões para não aparecerem nesta lista
    const groupedContas = useMemo(() => {
        const groups = {
            'Conta Corrente': [],
            'Dinheiro': [],
            'Conta Investimento': [],
        };

        initialContas.forEach(conta => {
            // PULA se for cartão de crédito (já tem aba própria)
            if (conta.tipo === 'Cartão de Crédito') return;

            const tipo = conta.tipo || 'Conta Corrente';
            if (groups[tipo]) {
                groups[tipo].push(conta);
            } else {
                if (!groups['Outros']) groups['Outros'] = [];
                groups['Outros'].push(conta);
            }
        });

        return groups;
    }, [initialContas]);

    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            const isEditing = !!formData.id;
            let dataToSave;
            const { saldo_atual, fatura_atual, ...restOfData } = formData;
            
            dataToSave = {
                ...restOfData,
                saldo_inicial: parseFloat(String(formData.saldo_inicial || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || 0,
                limite_credito: formData.limite_credito ? parseFloat(String(formData.limite_credito).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                limite_cheque_especial: formData.limite_cheque_especial ? parseFloat(String(formData.limite_cheque_especial).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                dia_fechamento_fatura: formData.dia_fechamento_fatura ? parseInt(formData.dia_fechamento_fatura, 10) : null,
                dia_pagamento_fatura: formData.dia_pagamento_fatura ? parseInt(formData.dia_pagamento_fatura, 10) : null,
                conta_debito_fatura_id: formData.conta_debito_fatura_id || null,
                organizacao_id: organizacaoId,
            };
            Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '' || dataToSave[key] === undefined) dataToSave[key] = null; });

            let error;
            if (isEditing) {
                const { id, empresa, conta_debito_fatura, ...updateData } = dataToSave;
                const { error: updateError } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
                error = updateError;
            } else {
                delete dataToSave.id;
                const { error: insertError } = await supabase.from('contas_financeiras').insert(dataToSave);
                error = insertError;
            }
            if (error) throw error;
            return isEditing ? 'Conta atualizada' : 'Conta criada';
        },
        onSuccess: (message) => {
            toast.success(`${message} com sucesso!`);
            onUpdate();
            setIsModalOpen(false);
        },
        onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
    });

    const deleteMutation = useMutation({
        mutationFn: async (contaId) => {
            const { error } = await supabase.from('contas_financeiras').delete().eq('id', contaId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Conta excluída com sucesso.");
            onUpdate();
        },
        onError: (error) => toast.error(`Erro ao excluir: ${error.message}`),
    });

    const handleDeleteConta = (conta) => {
        toast.warning(`Tem certeza que deseja excluir a conta "${conta.nome}"?`, {
            description: "Os lançamentos associados a ela ficarão órfãos.",
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(conta.id) },
            cancel: { label: "Cancelar" },
        });
    };

    const handleOpenEditModal = (conta) => { setEditingConta(conta); setIsModalOpen(true); };
    const handleOpenAddModal = () => { setEditingConta(null); setIsModalOpen(true); };
    
    const handleOpenPagamentoModal = (conta) => {
        const contaComSaldo = { ...conta, saldoAtual: saldos[conta.id] || 0 };
        setContaParaPagar(contaComSaldo);
        setIsPagamentoModalOpen(true);
    };

    const handlePagamentoSuccess = () => {
        onUpdate(); 
        toast.success("Saldo atualizado!");
    };

    const getSaldoLabel = (conta) => {
        if (conta.tipo === 'Cartão de Crédito') return 'Fatura Atual';
        return 'Saldo Real';
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <ContaFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={(formData) => saveMutation.mutate(formData)}
                isSaving={saveMutation.isPending}
                initialData={editingConta} 
                empresas={empresas}
                contas={initialContas.filter(c => c.tipo === 'Conta Corrente')}
            />

            <PagamentoFaturaModal
                isOpen={isPagamentoModalOpen}
                onClose={() => setIsPagamentoModalOpen(false)}
                onSuccess={handlePagamentoSuccess}
                contaCartao={contaParaPagar}
                contasDisponiveis={initialContas.filter(c => c.tipo !== 'Cartão de Crédito')}
            />

            {initialContas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <KpiCard 
                        title="Saldo Líquido (Caixa)" 
                        value={isLoadingSaldos ? '...' : formatCurrency(kpis.saldoLiquido)} 
                        icon={faWallet} 
                        color={kpis.saldoLiquido >= 0 ? "blue" : "red"} 
                        subtext="Dinheiro real disponível"
                    />
                    <KpiCard 
                        title="Poder de Compra" 
                        value={isLoadingSaldos ? '...' : formatCurrency(kpis.poderCompra)} 
                        icon={faHandHoldingDollar} 
                        color="green" 
                        subtext="Caixa + Limites"
                    />
                    
                    <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-red-500 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Uso Cheque Especial</p>
                                <h3 className="text-lg font-bold text-gray-800 mt-1">
                                    {isLoadingSaldos ? '...' : formatCurrency(kpis.limiteChequeUsado)}
                                </h3>
                            </div>
                            <div className="bg-red-100 p-2 rounded-full text-red-600">
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                            </div>
                        </div>
                        <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                                <div 
                                    className="bg-red-600 h-2.5 rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(kpis.percentualUsoCheque, 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-500 text-right">
                                {kpis.percentualUsoCheque.toFixed(1)}% de {formatCurrency(kpis.limiteChequeTotal)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLayerGroup} className="text-blue-600" />
                        Minhas Contas
                    </h2>
                    {hasPermission('financeiro', 'pode_criar') && (
                        <button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                            <FontAwesomeIcon icon={faPlus} /> Nova Conta
                        </button>
                    )}
                </div>

                {initialContas.length === 0 ? ( 
                    <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada.</p> 
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedContas).map(([tipo, contasDoTipo]) => {
                            if (!contasDoTipo || contasDoTipo.length === 0) return null;

                            return (
                                <div key={tipo} className="animate-fade-in-up">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
                                        <FontAwesomeIcon icon={getAccountIcon(tipo)} className="text-gray-400 text-lg" />
                                        {tipo} 
                                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{contasDoTipo.length}</span>
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {contasDoTipo.map(conta => {
                                            const saldoReal = saldos[conta.id] ?? 0;
                                            const limite = conta.limite_cheque_especial || 0;
                                            const saldoDisponivel = saldoReal + limite;
                                            const isCartao = conta.tipo === 'Cartão de Crédito';
                                            
                                            const valorDisplay = isCartao ? Math.abs(saldoReal) : saldoReal;
                                            let colorClass = 'text-gray-800';
                                            if (saldoReal < 0) {
                                                colorClass = 'text-red-600';
                                            } else if (isCartao && saldoReal > 0) {
                                                colorClass = 'text-green-600';
                                            }

                                            return (
                                                <div key={conta.id} className="border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all hover:border-blue-300 relative group flex flex-col justify-between bg-white">
                                                    <div>
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`p-3 rounded-full ${isCartao ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                    <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-xl" />
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-lg text-gray-800 leading-tight">{conta.nome}</h3>
                                                                    <p className="text-xs text-gray-500 font-medium">{conta.instituicao}</p>
                                                                </div>
                                                            </div>
                                                            {hasPermission('financeiro', 'pode_editar') && (
                                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 rounded shadow-sm border border-gray-100">
                                                                    <button onClick={() => handleOpenEditModal(conta)} className="text-gray-400 hover:text-blue-600 p-1.5" title="Editar"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                                                    <button onClick={() => handleDeleteConta(conta)} className="text-gray-400 hover:text-red-600 p-1.5" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
                                                            {conta.empresa && <p className="truncate" title={conta.empresa.nome_fantasia}><strong className="text-gray-700">Empresa:</strong> {conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}
                                                            {(conta.tipo === 'Conta Corrente' || !conta.tipo) && (
                                                                <>
                                                                    <p><strong>Ag:</strong> {conta.agencia || '-'} / <strong>CC:</strong> {conta.numero_conta || '-'}</p>
                                                                    {limite > 0 && 
                                                                        <p className='text-orange-600 flex items-center gap-1 mt-1 bg-orange-50 p-1 rounded w-fit'>
                                                                            <FontAwesomeIcon icon={faExclamationTriangle} />
                                                                            <span>Limite: {formatCurrency(limite)}</span>
                                                                        </p>
                                                                    }
                                                                </>
                                                            )}
                                                            {isCartao && (
                                                                <p><strong>Vence dia:</strong> {conta.dia_pagamento_fatura || 'N/A'}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-right mt-4 pt-3 border-t border-gray-100">
                                                        <p className="text-xs uppercase font-bold text-gray-400 mb-1">{getSaldoLabel(conta)}</p>
                                                        <p className={`text-2xl font-bold ${colorClass}`}>
                                                            {isLoadingSaldos ? <FontAwesomeIcon icon={faSpinner} spin className="text-lg text-gray-300"/> : formatCurrency(valorDisplay)}
                                                        </p>
                                                        
                                                        {!isCartao && limite > 0 && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Disponível (c/ Limite): <span className="font-semibold text-green-600">{isLoadingSaldos ? '...' : formatCurrency(saldoDisponivel)}</span>
                                                            </p>
                                                        )}

                                                        <div className="flex gap-2 mt-2">
                                                            <button 
                                                                onClick={() => onVerExtrato(conta.id)}
                                                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-gray-300"
                                                                title="Ver Extrato dos últimos 30 dias"
                                                            >
                                                                <FontAwesomeIcon icon={faFileInvoice} /> Extrato
                                                            </button>

                                                            {isCartao && saldoReal < 0 && (
                                                                <button 
                                                                    onClick={() => handleOpenPagamentoModal(conta)}
                                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors"
                                                                >
                                                                    <FontAwesomeIcon icon={faMoneyBillTransfer} /> Pagar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
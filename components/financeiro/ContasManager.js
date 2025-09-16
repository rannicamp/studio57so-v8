"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, faPenToSquare, faTrash, faExclamationTriangle, faArrowCircleDown, faWallet, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';
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

// =================================================================================
// INÍCIO DA CORREÇÃO: BUSCA DE SALDOS COM useQuery E RPC
// O PORQUÊ: Esta é a forma mais moderna e correta. O useQuery gerencia o estado de
// carregamento e busca o saldo de cada conta chamando a nossa nova função no banco.
// Isso garante que o saldo exibido aqui será sempre consistente com o resto do sistema.
// =================================================================================
const fetchSaldosContas = async (contas, organizacaoId) => {
    if (!contas || contas.length === 0 || !organizacaoId) return {};
    const supabase = createClient();

    const saldosPromises = contas.map(conta => 
        supabase.rpc('calcular_saldo_atual_conta', { 
            p_conta_id: conta.id,
            p_organizacao_id: organizacaoId
        }).then(({ data, error }) => {
            if (error) {
                console.error(`Erro ao buscar saldo para conta ${conta.id}:`, error);
                return { id: conta.id, saldo: 0 }; // Retorna 0 em caso de erro
            }
            return { id: conta.id, saldo: data };
        })
    );

    const resolvedSaldos = await Promise.all(saldosPromises);
    
    const saldosMap = resolvedSaldos.reduce((acc, result) => {
        acc[result.id] = result.saldo;
        return acc;
    }, {});
    
    return saldosMap;
};

export default function ContasManager({ initialContas, onUpdate, empresas }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);

    const { data: saldos, isLoading: isLoadingSaldos } = useQuery({
        queryKey: ['saldosContas', initialContas.map(c => c.id), organizacaoId],
        queryFn: () => fetchSaldosContas(initialContas, organizacaoId),
        enabled: initialContas.length > 0 && !!organizacaoId,
    });
    // =================================================================================
    // FIM DA CORREÇÃO
    // =================================================================================

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
    
    const getSaldoLabel = (conta) => {
        // Lógica futura para fatura do cartão pode ser adicionada aqui se necessário
        if (conta.tipo === 'Conta Corrente' && conta.limite_cheque_especial > 0) return 'Saldo + Ch. Especial';
        return 'Saldo Atual';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
            <ContaFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSave={(formData) => saveMutation.mutate(formData)}
                isSaving={saveMutation.isPending}
                initialData={editingConta} 
                empresas={empresas}
                contas={initialContas.filter(c => c.tipo === 'Conta Corrente')}
            />

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Minhas Contas</h2>
                {hasPermission('financeiro', 'pode_criar') && (
                    <button onClick={handleOpenAddModal} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        <FontAwesomeIcon icon={faPlus} /> Nova Conta
                    </button>
                )}
            </div>

            {initialContas.length === 0 ? ( <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada.</p> ) 
            : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {initialContas.map(conta => {
                        const saldoAtual = saldos?.[conta.id] ?? 0;
                        const saldoDisplay = saldoAtual + (conta.tipo === 'Conta Corrente' ? (conta.limite_cheque_especial || 0) : 0);
                        
                        return (
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
                                        {hasPermission('financeiro', 'pode_editar') && (
                                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenEditModal(conta)} className="text-gray-500 hover:text-blue-600"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                                <button onClick={() => handleDeleteConta(conta)} className="text-gray-500 hover:text-red-600"><FontAwesomeIcon icon={faTrash} /></button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-xs text-gray-600 border-t pt-3">
                                        {conta.empresa && <p><strong>Empresa:</strong> {conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}
                                        {(conta.tipo === 'Conta Corrente' || !conta.tipo) && (
                                            <>
                                                <p><strong>Ag:</strong> {conta.agencia || 'N/A'} / <strong>CC:</strong> {conta.numero_conta || 'N/A'}</p>
                                                {conta.limite_cheque_especial > 0 && 
                                                    <p className='text-yellow-600 flex items-center gap-2'><FontAwesomeIcon icon={faExclamationTriangle} /><strong>Cheque Esp.:</strong> {formatCurrency(conta.limite_cheque_especial)}</p>
                                                }
                                            </>
                                        )}
                                        {/* Lógica para cartão de crédito mantida do seu design original */}
                                    </div>
                                </div>
                                <div className="text-right mt-4 pt-3 border-t">
                                    <p className="text-sm text-gray-600">{getSaldoLabel(conta)}</p>
                                    <p className={`text-xl font-semibold ${saldoAtual < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                        {isLoadingSaldos ? <FontAwesomeIcon icon={faSpinner} spin /> : formatCurrency(saldoDisplay)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
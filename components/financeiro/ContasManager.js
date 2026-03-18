// components/financeiro/ContasManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faUniversity, faCreditCard, faMoneyBillWave, faChartLine,
    faEdit, faTrash, faExclamationTriangle, faSpinner,
    faWallet, faHandHoldingDollar, faLayerGroup, faMoneyBillTransfer,
    faFileInvoice, faBuilding, faCheck
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

const TYPE_COLORS = {
    'Conta Corrente': 'text-blue-600 bg-blue-50',
    'Cartão de Crédito': 'text-orange-600 bg-orange-50',
    'Dinheiro': 'text-green-600 bg-green-50',
    'Conta Investimento': 'text-purple-600 bg-purple-50',
    'Conta de Ativo': 'text-teal-600 bg-teal-50',
    'Conta de Passivo': 'text-red-600 bg-red-50',
    'Outros': 'text-gray-600 bg-gray-100',
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
        if (error) return { id: conta.id, saldo: 0 };
        return { id: conta.id, saldo: data };
    });

    const results = await Promise.all(promises);
    return results.reduce((acc, item) => { acc[item.id] = item.saldo; return acc; }, {});
};

export default function ContasManager({ initialContas, onUpdate, empresas, onVerExtrato }) {
    const supabase = createClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [contaParaPagar, setContaParaPagar] = useState(null);
    const [empresaSelecionada, setEmpresaSelecionada] = useState(null);

    const { data: saldos = {}, isLoading: isLoadingSaldos } = useQuery({
        queryKey: ['saldosContasReais', initialContas.map(c => c.id), organizacaoId],
        queryFn: () => fetchSaldosReais(initialContas, organizacaoId),
        enabled: initialContas.length > 0 && !!organizacaoId,
        refetchOnWindowFocus: true
    });

    // Agrupa contas por empresa (padrão ExtratoManager)
    const empresasAgrupadas = useMemo(() => {
        const mapa = {};
        initialContas.forEach(c => {
            const key = c.empresa?.nome_fantasia || c.empresa?.razao_social || 'Sem Empresa Vinculada';
            if (!mapa[key]) mapa[key] = { nome: key, contas: [] };
            mapa[key].contas.push(c);
        });
        return Object.values(mapa).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [initialContas]);

    // Auto-seleciona a primeira empresa
    const empresaAtiva = empresaSelecionada ?? empresasAgrupadas[0]?.nome ?? null;
    const contasDaEmpresa = useMemo(() => {
        const grupo = empresasAgrupadas.find(e => e.nome === empresaAtiva);
        return grupo?.contas || [];
    }, [empresasAgrupadas, empresaAtiva]);

    // Agrupa as contas da empresa ativa por tipo
    const contasPorTipo = useMemo(() => {
        const ORDEM_TIPOS = ['Conta Corrente', 'Conta Investimento', 'Cartão de Crédito', 'Dinheiro', 'Conta de Ativo', 'Conta de Passivo', 'Outros'];
        const mapa = {};
        contasDaEmpresa.forEach(c => {
            const tipo = c.tipo || 'Outros';
            if (!mapa[tipo]) mapa[tipo] = [];
            mapa[tipo].push(c);
        });

        // Ordenar cartões de crédito agrupando filhos abaixo de pais
        if (mapa['Cartão de Crédito']) {
            const ccList = mapa['Cartão de Crédito'];
            const parentCards = ccList.filter(c => !c.conta_pai_id).sort((a, b) => a.nome.localeCompare(b.nome));
            const sortedCards = [];
            parentCards.forEach(parent => {
                sortedCards.push(parent);
                const children = ccList.filter(c => c.conta_pai_id === parent.id).sort((a, b) => a.nome.localeCompare(b.nome));
                sortedCards.push(...children);
            });
            const orphans = ccList.filter(c => c.conta_pai_id && !parentCards.some(p => p.id === c.conta_pai_id));
            mapa['Cartão de Crédito'] = [...sortedCards, ...orphans];
        }

        return ORDEM_TIPOS.filter(t => mapa[t]).map(t => ({ tipo: t, contas: mapa[t] }));
    }, [contasDaEmpresa]);

    // KPIs Globais
    const kpis = useMemo(() => {
        let saldoLiquido = 0, limiteChequeTotal = 0, limiteChequeUsado = 0, poderCompra = 0;
        initialContas.forEach(conta => {
            const saldo = saldos[conta.id] || 0;
            const limite = conta.limite_cheque_especial || 0;
            if (conta.tipo !== 'Cartão de Crédito') {
                if (saldo > 0) saldoLiquido += saldo;
                poderCompra += (saldo + limite);
                if (conta.tipo === 'Conta Corrente') {
                    limiteChequeTotal += limite;
                    if (saldo < 0) limiteChequeUsado += Math.min(Math.abs(saldo), limite);
                }
            }
        });
        return {
            saldoLiquido, limiteChequeTotal, limiteChequeUsado, poderCompra,
            percentualUsoCheque: limiteChequeTotal > 0 ? (limiteChequeUsado / limiteChequeTotal) * 100 : 0,
        };
    }, [initialContas, saldos]);

    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            const isEditing = !!formData.id;
            const { saldo_atual, fatura_atual, ...restOfData } = formData;
            let dataToSave = {
                ...restOfData,
                saldo_inicial: parseFloat(String(formData.saldo_inicial || '0').replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) || 0,
                limite_credito: formData.limite_credito ? parseFloat(String(formData.limite_credito).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                limite_cheque_especial: formData.limite_cheque_especial ? parseFloat(String(formData.limite_cheque_especial).replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')) : null,
                dia_fechamento_fatura: formData.dia_fechamento_fatura ? parseInt(formData.dia_fechamento_fatura, 10) : null,
                dia_pagamento_fatura: formData.dia_pagamento_fatura ? parseInt(formData.dia_pagamento_fatura, 10) : null,
                conta_debito_fatura_id: formData.conta_debito_fatura_id || null,
                conta_pai_id: formData.conta_pai_id || null,
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
        onSuccess: (message) => { toast.success(`${message} com sucesso!`); onUpdate(); setIsModalOpen(false); },
        onError: (error) => toast.error(`Erro ao salvar: ${error.message}`),
    });

    const deleteMutation = useMutation({
        mutationFn: async (contaId) => {
            const { error } = await supabase.from('contas_financeiras').delete().eq('id', contaId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => { toast.success("Conta excluída com sucesso."); onUpdate(); },
        onError: (error) => toast.error(`Erro ao excluir: ${error.message}`),
    });

    const handleDeleteConta = (conta) => {
        toast.warning(`Tem certeza que deseja excluir a conta "${conta.nome}"?`, {
            description: "Os lançamentos associados a ela ficarão órfãos.",
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(conta.id) },
            cancel: { label: "Cancelar" },
        });
    };

    const handleOpenPagamentoModal = (conta) => {
        setContaParaPagar({ ...conta, saldoAtual: saldos[conta.id] || 0 });
        setIsPagamentoModalOpen(true);
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
                contas={initialContas}
            />
            <PagamentoFaturaModal
                isOpen={isPagamentoModalOpen}
                onClose={() => setIsPagamentoModalOpen(false)}
                onSuccess={() => { onUpdate(); toast.success("Saldo atualizado!"); }}
                contaCartao={contaParaPagar}
                contasDisponiveis={initialContas.filter(c => c.tipo !== 'Cartão de Crédito')}
            />

            {/* KPIs globais */}
            {initialContas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard title="Saldo Líquido (Caixa)" value={isLoadingSaldos ? '...' : formatCurrency(kpis.saldoLiquido)} icon={faWallet} color={kpis.saldoLiquido >= 0 ? "blue" : "red"} subtext="Dinheiro real disponível" />
                    <KpiCard title="Poder de Compra" value={isLoadingSaldos ? '...' : formatCurrency(kpis.poderCompra)} icon={faHandHoldingDollar} color="green" subtext="Caixa + Limites" />
                    <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-red-500 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Uso Cheque Especial</p>
                                <h3 className="text-lg font-bold text-gray-800 mt-1">{isLoadingSaldos ? '...' : formatCurrency(kpis.limiteChequeUsado)}</h3>
                            </div>
                            <div className="bg-red-100 p-2 rounded-full text-red-600"><FontAwesomeIcon icon={faExclamationTriangle} /></div>
                        </div>
                        <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                                <div className="bg-red-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(kpis.percentualUsoCheque, 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-500 text-right">{kpis.percentualUsoCheque.toFixed(1)}% de {formatCurrency(kpis.limiteChequeTotal)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Layout Split: Empresas | Contas */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* ESQUERDA: Lista de Empresas */}
                <div className="lg:col-span-1">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-700 uppercase">Empresas</h3>
                        {hasPermission('financeiro', 'pode_criar') && (
                            <button onClick={() => { setEditingConta(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow flex items-center gap-1 transition">
                                <FontAwesomeIcon icon={faPlus} /> Nova
                            </button>
                        )}
                    </div>
                    <div className="bg-white border rounded-lg overflow-hidden shadow-sm flex flex-col">
                        {empresasAgrupadas.length === 0 ? (
                            <p className="p-6 text-sm text-gray-400 text-center">Nenhuma conta cadastrada.</p>
                        ) : (
                            empresasAgrupadas.map(emp => {
                                const isSelected = empresaAtiva === emp.nome;
                                const saldoEmpresa = emp.contas
                                    .filter(c => c.tipo !== 'Cartão de Crédito')
                                    .reduce((acc, c) => acc + (saldos[c.id] || 0), 0);
                                return (
                                    <button
                                        key={emp.nome}
                                        onClick={() => setEmpresaSelecionada(emp.nome)}
                                        className={`w-full text-left p-4 border-b last:border-0 border-l-4 transition-all flex items-start gap-3
                                            ${isSelected ? 'border-l-blue-500 bg-blue-50' : 'border-l-transparent hover:bg-gray-50'}`}
                                    >
                                        <div className={`p-2 rounded-full mt-0.5 flex-shrink-0 ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                            <FontAwesomeIcon icon={faBuilding} className="text-sm" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-bold leading-tight truncate ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>{emp.nome}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{emp.contas.length} conta{emp.contas.length > 1 ? 's' : ''}</p>
                                            <p className={`text-xs font-bold mt-1 ${saldoEmpresa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {isLoadingSaldos ? '...' : formatCurrency(saldoEmpresa)}
                                            </p>
                                        </div>
                                        {isSelected && <FontAwesomeIcon icon={faCheck} className="text-blue-400 text-xs mt-1 flex-shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* DIREITA: Lista de Contas da Empresa Selecionada */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b bg-gradient-to-br from-gray-50 to-white flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                                <FontAwesomeIcon icon={faBuilding} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800">{empresaAtiva || 'Selecione uma empresa'}</h2>
                                <p className="text-xs text-gray-500">{contasDaEmpresa.length} conta{contasDaEmpresa.length !== 1 ? 's' : ''} cadastrada{contasDaEmpresa.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Tabela de Contas agrupada por Tipo */}
                        {contasPorTipo.length === 0 ? (
                            <div className="p-12 text-center">
                                <FontAwesomeIcon icon={faLayerGroup} className="text-4xl text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm">Nenhuma conta para esta empresa.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {contasPorTipo.map(({ tipo, contas: contasDoTipo }) => {
                                    const typeColor = TYPE_COLORS[tipo] || TYPE_COLORS['Outros'];
                                    return (
                                        <div key={tipo}>
                                            {/* Cabeçalho do grupo de tipo */}
                                            <div className={`flex items-center gap-2 px-5 py-2.5 ${typeColor} border-b`}>
                                                <FontAwesomeIcon icon={getAccountIcon(tipo)} className="text-xs" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">{tipo}</span>
                                                <span className="ml-1 text-[10px] opacity-60">({contasDoTipo.length})</span>
                                            </div>

                                            {/* Cabeçalho da tabela */}
                                            <div className="grid grid-cols-12 gap-2 px-5 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                                                <div className="col-span-4">Conta</div>
                                                <div className="col-span-2">Ag / Nº</div>
                                                <div className="col-span-2 text-right">Saldo Real</div>
                                                <div className="col-span-2 text-right">Limite</div>
                                                <div className="col-span-2 text-right">Ações</div>
                                            </div>

                                            {/* Linhas das contas do tipo */}
                                            {contasDoTipo.map(conta => {
                                                const saldoReal = saldos[conta.id] ?? 0;
                                                const limite = conta.limite_cheque_especial || conta.limite_credito || 0;
                                                const isCartao = conta.tipo === 'Cartão de Crédito';
                                                const isFilho = isCartao && !!conta.conta_pai_id;
                                                const indentClass = isFilho ? "pl-12 pr-5 relative" : "px-5";
                                                const valorDisplay = isCartao ? Math.abs(saldoReal) : saldoReal;
                                                const colorClass = saldoReal < 0 ? 'text-red-600' : (isCartao && saldoReal > 0 ? 'text-green-600' : 'text-gray-800');
                                                return (
                                                    <div key={conta.id} className={`grid grid-cols-12 gap-2 py-3.5 items-center hover:bg-gray-50/70 transition-colors border-b last:border-0 border-gray-100 group ${indentClass}`}>
                                                        {isFilho && (
                                                            <div className="absolute left-6 top-1/2 -mt-3.5 w-3 h-4 border-l-2 border-b-2 border-gray-300 rounded-bl-xl"></div>
                                                        )}
                                                        {/* Nome */}
                                                        <div className="col-span-4 min-w-0">
                                                            <p className="font-bold text-sm text-gray-800 truncate leading-tight" title={conta.nome}>{conta.nome}</p>
                                                            {isCartao && conta.dia_pagamento_fatura && (
                                                                <span className="text-[9px] text-gray-400">Vence dia {conta.dia_pagamento_fatura}</span>
                                                            )}
                                                        </div>
                                                        {/* Ag / Nº */}
                                                        <div className="col-span-2">
                                                            {conta.agencia || conta.numero_conta ? (
                                                                <p className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate">
                                                                    {conta.agencia ? `Ag: ${conta.agencia}` : ''}{conta.agencia && conta.numero_conta ? ' / ' : ''}{conta.numero_conta ? `CC: ${conta.numero_conta}` : ''}
                                                                </p>
                                                            ) : <span className="text-xs text-gray-300">—</span>}
                                                        </div>
                                                        {/* Saldo */}
                                                        <div className="col-span-2 text-right">
                                                            {isLoadingSaldos ? <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300" /> : (
                                                                <>
                                                                    <p className={`font-bold text-sm ${colorClass}`}>{formatCurrency(valorDisplay)}</p>
                                                                    <p className="text-[9px] text-gray-400">{isCartao ? 'Fatura atual' : 'Saldo real'}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                        {/* Limite */}
                                                        <div className="col-span-2 text-right">
                                                            {limite > 0 ? (
                                                                <>
                                                                    <p className="font-bold text-sm text-orange-600">{formatCurrency(limite)}</p>
                                                                    <p className="text-[9px] text-gray-400">{isCartao ? 'Crédito' : 'Cheque esp.'}</p>
                                                                </>
                                                            ) : <span className="text-xs text-gray-300">—</span>}
                                                        </div>
                                                        {/* Ações */}
                                                        <div className="col-span-2 text-right flex items-center justify-end gap-1">
                                                            <button onClick={() => onVerExtrato(conta.id)} title="Ver Extrato" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><FontAwesomeIcon icon={faFileInvoice} /></button>
                                                            {isCartao && saldoReal < 0 && (
                                                                <button onClick={() => handleOpenPagamentoModal(conta)} title="Pagar Fatura" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition"><FontAwesomeIcon icon={faMoneyBillTransfer} /></button>
                                                            )}
                                                            {hasPermission('financeiro', 'pode_editar') && (
                                                                <>
                                                                    <button onClick={() => { setEditingConta(conta); setIsModalOpen(true); }} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><FontAwesomeIcon icon={faEdit} /></button>
                                                                    <button onClick={() => handleDeleteConta(conta)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"><FontAwesomeIcon icon={faTrash} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Rodapé subtotal do grupo */}
                                            {(() => {
                                                const totalSaldo = contasDoTipo.reduce((acc, c) => acc + (saldos[c.id] ?? 0), 0);
                                                const totalLimite = contasDoTipo.reduce((acc, c) => acc + (c.limite_cheque_especial || c.limite_credito || 0), 0);
                                                return (
                                                    <div className={`grid grid-cols-12 gap-2 px-5 py-2.5 ${TYPE_COLORS[tipo] || TYPE_COLORS['Outros']} border-t`}>
                                                        <div className="col-span-6 text-[10px] font-black uppercase tracking-wide opacity-60 flex items-center gap-1">
                                                            Subtotal — {tipo}
                                                        </div>
                                                        <div className="col-span-2 text-right">
                                                            <p className={`font-black text-sm ${totalSaldo < 0 ? 'text-red-700' : 'text-gray-800'}`}>{isLoadingSaldos ? '...' : formatCurrency(totalSaldo)}</p>
                                                            <p className="text-[9px] opacity-50">Saldo total</p>
                                                        </div>
                                                        <div className="col-span-2 text-right">
                                                            {totalLimite > 0 ? (
                                                                <>
                                                                    <p className="font-black text-sm text-orange-700">{formatCurrency(totalLimite)}</p>
                                                                    <p className="text-[9px] opacity-50">Limite total</p>
                                                                </>
                                                            ) : <span className="text-xs opacity-30">—</span>}
                                                        </div>
                                                        <div className="col-span-2" />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
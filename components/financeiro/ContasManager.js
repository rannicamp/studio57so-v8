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
    faFileInvoice, faBuilding, faChevronDown, faChevronRight
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
    'Conta Corrente':    { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
    'Cartão de Crédito': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'Dinheiro':          { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
    'Conta Investimento':{ bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Conta de Ativo':    { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
    'Conta de Passivo':  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    'Passivos':          { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    'Outros':            { bg: 'bg-gray-50',   text: 'text-gray-700',   border: 'border-gray-200' },
};

const ORDEM_TIPOS = ['Conta Corrente', 'Conta Investimento', 'Cartão de Crédito', 'Dinheiro', 'Conta de Ativo', 'Conta de Passivo', 'Passivos', 'Outros'];

const fetchSaldosReais = async (contas, organizacaoId) => {
    if (!contas || contas.length === 0 || !organizacaoId) return {};
    const supabase = createClient();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dataCorte = tomorrow.toISOString().split('T')[0];

    const results = await Promise.all(contas.map(async (conta) => {
        const { data } = await supabase.rpc('calcular_saldo_anterior', {
            p_conta_id: conta.id,
            p_data_inicio: dataCorte,
            p_organizacao_id: organizacaoId
        });
        return { id: conta.id, saldo: data || 0 };
    }));
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
    // Controla quais grupos de empresa estão colapsados
    const [collapsedEmpresas, setCollapsedEmpresas] = useState({});

    const { data: saldos = {}, isLoading: isLoadingSaldos } = useQuery({
        queryKey: ['saldosContasReais', initialContas.map(c => c.id), organizacaoId],
        queryFn: () => fetchSaldosReais(initialContas, organizacaoId),
        enabled: initialContas.length > 0 && !!organizacaoId,
        refetchOnWindowFocus: true
    });

    // Agrupa: Empresa → Tipo → Contas (usa nome do objeto empresa ou "Sem Empresa Vinculada")
    const agrupado = useMemo(() => {
        const mapaEmpresa = {};
        initialContas.forEach(c => {
            const empresaNome = c.empresa?.nome_fantasia || c.empresa?.razao_social || 'Sem Empresa Vinculada';
            if (!mapaEmpresa[empresaNome]) mapaEmpresa[empresaNome] = {};
            const tipo = c.tipo || 'Outros';
            if (!mapaEmpresa[empresaNome][tipo]) mapaEmpresa[empresaNome][tipo] = [];
            mapaEmpresa[empresaNome][tipo].push(c);
        });

        // Transforma em array ordenado
        return Object.entries(mapaEmpresa)
            .sort(([a], [b]) => {
                if (a === 'Sem Empresa Vinculada') return 1;
                if (b === 'Sem Empresa Vinculada') return -1;
                return a.localeCompare(b);
            })
            .map(([empresa, tipos]) => ({
                empresa,
                grupos: ORDEM_TIPOS
                    .filter(t => tipos[t])
                    .map(t => ({ tipo: t, contas: tipos[t].sort((a, b) => a.nome.localeCompare(b.nome)) }))
            }));
    }, [initialContas]);

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
        return { saldoLiquido, limiteChequeTotal, limiteChequeUsado, poderCompra, percentualUsoCheque: limiteChequeTotal > 0 ? (limiteChequeUsado / limiteChequeTotal) * 100 : 0 };
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
                organizacao_id: organizacaoId,
            };
            Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === '' || dataToSave[key] === undefined) dataToSave[key] = null; });
            let error;
            if (isEditing) {
                const { id, empresa, conta_debito_fatura, ...updateData } = dataToSave;
                const { error: e } = await supabase.from('contas_financeiras').update(updateData).eq('id', id);
                error = e;
            } else {
                delete dataToSave.id;
                const { error: e } = await supabase.from('contas_financeiras').insert(dataToSave);
                error = e;
            }
            if (error) throw error;
            return isEditing ? 'Conta atualizada' : 'Conta criada';
        },
        onSuccess: (msg) => { toast.success(`${msg} com sucesso!`); onUpdate(); setIsModalOpen(false); },
        onError: (e) => toast.error(`Erro ao salvar: ${e.message}`),
    });

    const deleteMutation = useMutation({
        mutationFn: async (contaId) => {
            const { error } = await supabase.from('contas_financeiras').delete().eq('id', contaId).eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => { toast.success("Conta excluída com sucesso."); onUpdate(); },
        onError: (e) => toast.error(`Erro ao excluir: ${e.message}`),
    });

    const handleDeleteConta = (conta) => {
        toast.warning(`Excluir conta "${conta.nome}"?`, {
            description: "Os lançamentos associados ficarão órfãos.",
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(conta.id) },
            cancel: { label: "Cancelar" },
        });
    };

    const toggleEmpresa = (nome) => {
        setCollapsedEmpresas(prev => ({ ...prev, [nome]: !prev[nome] }));
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
                onSuccess={() => { onUpdate(); toast.success("Saldo atualizado!"); }}
                contaCartao={contaParaPagar}
                contasDisponiveis={initialContas.filter(c => c.tipo !== 'Cartão de Crédito')}
            />

            {/* KPIs */}
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
                                <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${Math.min(kpis.percentualUsoCheque, 100)}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 text-right">{kpis.percentualUsoCheque.toFixed(1)}% de {formatCurrency(kpis.limiteChequeTotal)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header + Botão Nova Conta */}
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FontAwesomeIcon icon={faLayerGroup} className="text-blue-600" />
                    Todas as Contas
                    <span className="text-sm font-normal text-gray-400">({initialContas.length} contas)</span>
                </h2>
                {hasPermission('financeiro', 'pode_criar') && (
                    <button onClick={() => { setEditingConta(null); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow flex items-center gap-2 transition text-sm">
                        <FontAwesomeIcon icon={faPlus} /> Nova Conta
                    </button>
                )}
            </div>

            {/* Lista agrupada por Empresa → Tipo */}
            <div className="space-y-4">
                {agrupado.map(({ empresa, grupos }) => {
                    const isCollapsed = collapsedEmpresas[empresa];
                    const totalContas = grupos.reduce((acc, g) => acc + g.contas.length, 0);
                    const totalSaldoEmpresa = grupos.reduce((acc, g) =>
                        acc + g.contas.reduce((a, c) => a + (saldos[c.id] ?? 0), 0), 0);

                    return (
                        <div key={empresa} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Cabeçalho da Empresa */}
                            <button
                                onClick={() => toggleEmpresa(empresa)}
                                className="w-full flex items-center gap-3 px-5 py-3.5 bg-gray-800 text-white hover:bg-gray-700 transition"
                            >
                                <div className="bg-white/10 p-1.5 rounded-lg">
                                    <FontAwesomeIcon icon={faBuilding} className="text-sm" />
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="font-bold text-sm">{empresa}</span>
                                    <span className="ml-2 text-[10px] text-gray-400 font-normal">{totalContas} conta{totalContas !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="text-right mr-3">
                                    <p className={`font-bold text-sm ${totalSaldoEmpresa < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {isLoadingSaldos ? '...' : formatCurrency(totalSaldoEmpresa)}
                                    </p>
                                    <p className="text-[9px] text-gray-400">saldo consolidado</p>
                                </div>
                                <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronDown} className="text-gray-400 text-sm" />
                            </button>

                            {/* Grupos de tipo dentro da empresa */}
                            {!isCollapsed && grupos.map(({ tipo, contas: contasDoTipo }) => {
                                const tc = TYPE_COLORS[tipo] || TYPE_COLORS['Outros'];
                                const totalSaldoTipo = contasDoTipo.reduce((acc, c) => acc + (saldos[c.id] ?? 0), 0);
                                const totalLimiteTipo = contasDoTipo.reduce((acc, c) => acc + (c.limite_cheque_especial || c.limite_credito || 0), 0);

                                return (
                                    <div key={tipo}>
                                        {/* Linha de tipo */}
                                        <div className={`flex items-center gap-2 px-5 py-2 ${tc.bg} border-b ${tc.border}`}>
                                            <FontAwesomeIcon icon={getAccountIcon(tipo)} className={`text-xs ${tc.text}`} />
                                            <span className={`text-[11px] font-black uppercase tracking-widest ${tc.text}`}>{tipo}</span>
                                            <span className={`text-[10px] opacity-60 ${tc.text}`}>({contasDoTipo.length})</span>
                                        </div>

                                        {/* Cabeçalho da tabela */}
                                        <div className="grid grid-cols-12 gap-2 px-5 py-1.5 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                                            <div className="col-span-4">Conta</div>
                                            <div className="col-span-2">Ag / Nº</div>
                                            <div className="col-span-2 text-right">Saldo</div>
                                            <div className="col-span-2 text-right">Limite</div>
                                            <div className="col-span-2 text-right">Ações</div>
                                        </div>

                                        {/* Linhas de contas */}
                                        {contasDoTipo.map(conta => {
                                            const saldoReal = saldos[conta.id] ?? 0;
                                            const limite = conta.limite_cheque_especial || conta.limite_credito || 0;
                                            const isCartao = conta.tipo === 'Cartão de Crédito';
                                            const valorDisplay = isCartao ? Math.abs(saldoReal) : saldoReal;
                                            const colorClass = saldoReal < 0 ? 'text-red-600' : (isCartao && saldoReal > 0 ? 'text-green-600' : 'text-gray-800');

                                            return (
                                                <div key={conta.id} className="grid grid-cols-12 gap-2 px-5 py-3 items-center border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                                                    {/* Nome */}
                                                    <div className="col-span-4 min-w-0">
                                                        <p className="font-semibold text-sm text-gray-800 truncate" title={conta.nome}>{conta.nome}</p>
                                                        {isCartao && conta.dia_pagamento_fatura && (
                                                            <span className="text-[9px] text-gray-400">Vence dia {conta.dia_pagamento_fatura}</span>
                                                        )}
                                                    </div>
                                                    {/* Ag / Nº */}
                                                    <div className="col-span-2">
                                                        {conta.agencia || conta.numero_conta ? (
                                                            <p className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate">
                                                                {[conta.agencia ? `Ag: ${conta.agencia}` : null, conta.numero_conta ? `CC: ${conta.numero_conta}` : null].filter(Boolean).join(' / ')}
                                                            </p>
                                                        ) : <span className="text-xs text-gray-300">—</span>}
                                                    </div>
                                                    {/* Saldo */}
                                                    <div className="col-span-2 text-right">
                                                        {isLoadingSaldos
                                                            ? <FontAwesomeIcon icon={faSpinner} spin className="text-gray-300" />
                                                            : <>
                                                                <p className={`font-bold text-sm ${colorClass}`}>{formatCurrency(valorDisplay)}</p>
                                                                <p className="text-[9px] text-gray-400">{isCartao ? 'Fatura atual' : 'Saldo real'}</p>
                                                            </>
                                                        }
                                                    </div>
                                                    {/* Limite */}
                                                    <div className="col-span-2 text-right">
                                                        {limite > 0
                                                            ? <>
                                                                <p className="font-bold text-sm text-orange-600">{formatCurrency(limite)}</p>
                                                                <p className="text-[9px] text-gray-400">{isCartao ? 'Crédito' : 'Cheque esp.'}</p>
                                                            </>
                                                            : <span className="text-xs text-gray-300">—</span>
                                                        }
                                                    </div>
                                                    {/* Ações */}
                                                    <div className="col-span-2 flex justify-end gap-1">
                                                        <button onClick={() => onVerExtrato(conta.id)} title="Ver Extrato" className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition">
                                                            <FontAwesomeIcon icon={faFileInvoice} />
                                                        </button>
                                                        {isCartao && saldoReal < 0 && (
                                                            <button onClick={() => { setContaParaPagar({ ...conta, saldoAtual: saldoReal }); setIsPagamentoModalOpen(true); }} title="Pagar Fatura" className="p-1.5 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded transition">
                                                                <FontAwesomeIcon icon={faMoneyBillTransfer} />
                                                            </button>
                                                        )}
                                                        {hasPermission('financeiro', 'pode_editar') && (
                                                            <>
                                                                <button onClick={() => { setEditingConta(conta); setIsModalOpen(true); }} title="Editar" className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded transition">
                                                                    <FontAwesomeIcon icon={faEdit} />
                                                                </button>
                                                                <button onClick={() => handleDeleteConta(conta)} title="Excluir" className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition">
                                                                    <FontAwesomeIcon icon={faTrash} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Subtotal do tipo */}
                                        <div className={`grid grid-cols-12 gap-2 px-5 py-2 ${tc.bg} border-b ${tc.border}`}>
                                            <div className={`col-span-6 text-[10px] font-black uppercase tracking-wide ${tc.text} opacity-70`}>
                                                Subtotal {tipo}
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <p className={`font-black text-sm ${totalSaldoTipo < 0 ? 'text-red-700' : 'text-gray-800'}`}>
                                                    {isLoadingSaldos ? '...' : formatCurrency(totalSaldoTipo)}
                                                </p>
                                            </div>
                                            <div className="col-span-2 text-right">
                                                {totalLimiteTipo > 0
                                                    ? <p className="font-black text-sm text-orange-700">{formatCurrency(totalLimiteTipo)}</p>
                                                    : <span className="text-xs text-gray-300">—</span>
                                                }
                                            </div>
                                            <div className="col-span-2" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
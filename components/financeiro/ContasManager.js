"use client";

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, 
    faPenToSquare, faTrash, faExclamationTriangle, faSpinner, 
    faWallet, faHandHoldingDollar, faLayerGroup, faMoneyBillTransfer, faFileInvoice,
    faCheckCircle, faBuildingColumns, faLink
} from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';
import PagamentoFaturaModal from './PagamentoFaturaModal';
import KpiCard from '../KpiCard';
import BelvoWidget from './BelvoWidget';
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
    
    // Hooks para detectar retorno da Belvo
    const searchParams = useSearchParams();
    const router = useRouter();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [contaParaPagar, setContaParaPagar] = useState(null);

    // Estados para vincular a conta
    const [linkSelectionModalOpen, setLinkSelectionModalOpen] = useState(false);
    const [foundBelvoAccounts, setFoundBelvoAccounts] = useState([]);
    const [currentBelvoLink, setCurrentBelvoLink] = useState(null);

    const { data: saldos = {}, isLoading: isLoadingSaldos } = useQuery({
        queryKey: ['saldosContasReais', initialContas.map(c => c.id), organizacaoId],
        queryFn: () => fetchSaldosReais(initialContas, organizacaoId),
        enabled: initialContas.length > 0 && !!organizacaoId,
    });

    // --- CÁLCULO DOS KPIS (AQUI ESTAVA O ERRO, AGORA ESTÁ DE VOLTA!) ---
    const kpis = useMemo(() => {
        let saldoLiquido = 0;
        let limiteChequeTotal = 0;
        let limiteChequeUsado = 0;
        let poderCompra = 0;

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
            saldoLiquido,
            limiteChequeTotal,
            limiteChequeUsado,
            percentualUsoCheque: limiteChequeTotal > 0 ? (limiteChequeUsado / limiteChequeTotal) * 100 : 0,
            poderCompra
        };
    }, [initialContas, saldos]);

    // --- DETECTOR DE RETORNO DA BELVO ---
    useEffect(() => {
        const status = searchParams.get('status');
        const linkId = searchParams.get('link');
        const institution = searchParams.get('institution');

        if (status === 'success' && linkId) {
            toast.success("Conexão bancária realizada! Processando...");
            handleBelvoSuccess(linkId, institution);
            // Limpa a URL para não processar de novo ao recarregar
            router.replace('/financeiro/contas');
        } else if (status === 'exit' || status === 'error') {
            toast.info("Processo bancário cancelado ou falhou.");
            router.replace('/financeiro/contas');
        }
    }, [searchParams]);

    const handleBelvoSuccess = async (linkId, institution) => {
        setCurrentBelvoLink({ id: linkId, institution });
        const toastId = toast.loading("Buscando contas disponíveis...");

        try {
            const accountsRes = await fetch(`/api/belvo/accounts?link_id=${linkId}`);
            const accountsData = await accountsRes.json();

            if (!accountsRes.ok) throw new Error(accountsData.error);

            if (accountsData.length === 0) {
                toast.warning("Nenhuma conta encontrada neste banco.", { id: toastId });
                return;
            }

            setFoundBelvoAccounts(accountsData);
            setLinkSelectionModalOpen(true);
            toast.dismiss(toastId);

        } catch (error) {
            toast.error("Erro ao listar contas: " + error.message, { id: toastId });
        }
    };

    const handleStartLink = (conta) => {
        // Salva quem estamos editando para recuperar na volta do redirecionamento
        localStorage.setItem('belvo_linking_conta_id', conta.id);
    };

    const confirmLink = (belvoAccount) => {
        const contaSistemaId = localStorage.getItem('belvo_linking_conta_id');
        if (!contaSistemaId) return toast.error("Erro: Identificação da conta perdida. Tente novamente.");

        linkAccountMutation.mutate({
            contaId: contaSistemaId,
            belvoLinkId: currentBelvoLink.id,
            belvoAccountId: belvoAccount.id,
            instituicao: belvoAccount.institution?.name || currentBelvoLink.institution
        });
    };

    const linkAccountMutation = useMutation({
        mutationFn: async ({ contaId, belvoLinkId, belvoAccountId, instituicao }) => {
            const { error } = await supabase
                .from('contas_financeiras')
                .update({ 
                    belvo_link_id: belvoLinkId,
                    belvo_account_id: belvoAccountId,
                    instituicao: instituicao 
                })
                .eq('id', contaId)
                .eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Conta vinculada com sucesso!");
            setLinkSelectionModalOpen(false);
            setFoundBelvoAccounts([]);
            localStorage.removeItem('belvo_linking_conta_id');
            onUpdate();
        },
        onError: (err) => toast.error("Erro ao vincular: " + err.message)
    });

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

            if (isEditing) {
                const { id, empresa, conta_debito_fatura, ...updateData } = dataToSave;
                await supabase.from('contas_financeiras').update(updateData).eq('id', id);
            } else {
                delete dataToSave.id;
                await supabase.from('contas_financeiras').insert(dataToSave);
            }
        },
        onSuccess: () => { toast.success("Salvo!"); onUpdate(); setIsModalOpen(false); },
        onError: (e) => toast.error(e.message),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => { await supabase.from('contas_financeiras').delete().eq('id', id); },
        onSuccess: () => { toast.success("Excluído!"); onUpdate(); }
    });

    const groupedContas = useMemo(() => {
        const groups = { 'Conta Corrente': [], 'Dinheiro': [], 'Conta Investimento': [] };
        initialContas.forEach(conta => {
            if (conta.tipo === 'Cartão de Crédito') return;
            const tipo = conta.tipo || 'Conta Corrente';
            if (groups[tipo]) groups[tipo].push(conta); else { if (!groups['Outros']) groups['Outros'] = []; groups['Outros'].push(conta); }
        });
        return groups;
    }, [initialContas]);

    const renderContaCard = (conta) => {
        const saldoReal = saldos[conta.id] ?? 0;
        const isCartao = conta.tipo === 'Cartão de Crédito';
        const isConnected = !!conta.belvo_account_id;
        const colorClass = saldoReal < 0 ? 'text-red-600' : (isCartao && saldoReal > 0 ? 'text-green-600' : 'text-gray-800');

        return (
            <div key={conta.id} className="border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all bg-white relative group flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${isCartao ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 leading-tight flex items-center gap-2">
                                    {conta.nome}
                                    {isConnected && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-sm" title="Conectado" />}
                                </h3>
                                <p className="text-xs text-gray-500">{conta.instituicao || 'Não conectado'}</p>
                            </div>
                        </div>
                        {hasPermission('financeiro', 'pode_editar') && (
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2">
                                <button onClick={() => { setEditingConta(conta); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-1"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                <button onClick={() => deleteMutation.mutate(conta.id)} className="text-gray-400 hover:text-red-600 p-1"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="text-right mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">{isCartao ? 'Fatura Atual' : 'Saldo Real'}</p>
                    <p className={`text-2xl font-bold ${colorClass}`}>{isLoadingSaldos ? '...' : formatCurrency(isCartao ? Math.abs(saldoReal) : saldoReal)}</p>
                    
                    <div className="flex gap-2 mt-3">
                        {!isConnected ? (
                            <div onClick={() => handleStartLink(conta)} className="flex-1">
                                <BelvoWidget />
                            </div>
                        ) : (
                            <button onClick={() => onVerExtrato(conta.id)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded flex items-center justify-center gap-2">
                                <FontAwesomeIcon icon={faFileInvoice} /> Extrato
                            </button>
                        )}
                        {isCartao && saldoReal < 0 && (
                            <button onClick={() => { setContaParaPagar({...conta, saldoAtual: saldoReal}); setIsPagamentoModalOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"><FontAwesomeIcon icon={faMoneyBillTransfer} /></button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <ContaFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(d) => saveMutation.mutate(d)} isSaving={saveMutation.isPending} initialData={editingConta} empresas={empresas} contas={initialContas.filter(c => c.tipo === 'Conta Corrente')} />
            <PagamentoFaturaModal isOpen={isPagamentoModalOpen} onClose={() => setIsPagamentoModalOpen(false)} onSuccess={() => { onUpdate(); toast.success("Saldo atualizado!"); }} contaCartao={contaParaPagar} contasDisponiveis={initialContas.filter(c => c.tipo !== 'Cartão de Crédito')} />

            {/* MODAL DE VINCULAR CONTA ENCONTRADA */}
            {linkSelectionModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><FontAwesomeIcon icon={faBuildingColumns} className="text-blue-600"/> Vincular Conta</h3>
                        <p className="text-gray-600 text-sm mb-4">Selecione a conta do banco que deseja vincular:</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {foundBelvoAccounts.map(acc => (
                                <button key={acc.id} onClick={() => confirmLink(acc)} className="w-full text-left p-3 border rounded hover:bg-blue-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800">{acc.name} <span className="text-xs font-normal text-gray-500">({acc.type})</span></p>
                                        <p className="text-xs text-gray-500">Saldo: {formatCurrency(acc.balance?.current)}</p>
                                    </div>
                                    <FontAwesomeIcon icon={faLink} className="text-gray-300" />
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 text-right"><button onClick={() => setLinkSelectionModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-sm font-semibold">Cancelar</button></div>
                    </div>
                </div>
            )}

            {initialContas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <KpiCard title="Saldo Líquido" value={isLoadingSaldos ? '...' : formatCurrency(kpis.saldoLiquido)} icon={faWallet} color={kpis.saldoLiquido >= 0 ? "blue" : "red"} />
                    <KpiCard title="Poder de Compra" value={isLoadingSaldos ? '...' : formatCurrency(kpis.poderCompra)} icon={faHandHoldingDollar} color="green" />
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between mb-6">
                    <h2 className="text-xl font-bold flex gap-2"><FontAwesomeIcon icon={faLayerGroup} className="text-blue-600" /> Minhas Contas</h2>
                    {hasPermission('financeiro', 'pode_criar') && <button onClick={() => { setEditingConta(null); setIsModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2 items-center"><FontAwesomeIcon icon={faPlus} /> Nova Conta</button>}
                </div>
                {initialContas.length === 0 ? <p className="text-center text-gray-500">Nenhuma conta.</p> : (
                    <div className="space-y-8">
                        {Object.entries(groupedContas).map(([tipo, contas]) => (
                            contas.length > 0 && (
                                <div key={tipo}>
                                    <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 border-b pb-2">{tipo}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{contas.map(renderContaCard)}</div>
                                </div>
                            )
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
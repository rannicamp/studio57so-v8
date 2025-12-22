"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import Script from 'next/script';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faUniversity, faCreditCard, faMoneyBillWave, faChartLine, 
    faPenToSquare, faTrash, faExclamationTriangle, faSpinner, 
    faWallet, faHandHoldingDollar, faLayerGroup, faMoneyBillTransfer, faFileInvoice,
    faLink, faCheckCircle, faBuildingColumns, faShieldAlt, faSync
} from '@fortawesome/free-solid-svg-icons';
import ContaFormModal from './ContaFormModal';
import PagamentoFaturaModal from './PagamentoFaturaModal';
import KpiCard from '../KpiCard';
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

    // Estados Modais Normais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConta, setEditingConta] = useState(null);
    const [isPagamentoModalOpen, setIsPagamentoModalOpen] = useState(false);
    const [contaParaPagar, setContaParaPagar] = useState(null);

    // Estados Belvo (Conexão Bancária)
    const [isBelvoLoading, setIsBelvoLoading] = useState(false);
    const [isWidgetReady, setIsWidgetReady] = useState(false); 
    const [linkSelectionModalOpen, setLinkSelectionModalOpen] = useState(false);
    const [foundBelvoAccounts, setFoundBelvoAccounts] = useState([]);
    const [currentLinkingConta, setCurrentLinkingConta] = useState(null);
    const [currentBelvoLink, setCurrentBelvoLink] = useState(null);
    
    // Ref para evitar loops
    const belvoCheckInterval = useRef(null);

    // Função para verificar se a Belvo realmente carregou
    const checkBelvoAvailability = () => {
        if (typeof window !== 'undefined' && window.belvo) {
            console.log("✅ Belvo detectada globalmente!");
            setIsWidgetReady(true);
            if (belvoCheckInterval.current) clearInterval(belvoCheckInterval.current);
            return true;
        }
        return false;
    };

    useEffect(() => {
        // Tenta detectar imediatamente
        if (checkBelvoAvailability()) return;

        // Se não achou, tenta a cada 1 segundo por 10 segundos
        belvoCheckInterval.current = setInterval(() => {
            checkBelvoAvailability();
        }, 1000);

        // Limpeza
        return () => {
            if (belvoCheckInterval.current) clearInterval(belvoCheckInterval.current);
        };
    }, []);

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

    const groupedContas = useMemo(() => {
        const groups = { 'Conta Corrente': [], 'Dinheiro': [], 'Conta Investimento': [] };
        initialContas.forEach(conta => {
            if (conta.tipo === 'Cartão de Crédito') return;
            const tipo = conta.tipo || 'Conta Corrente';
            if (groups[tipo]) groups[tipo].push(conta);
            else { if (!groups['Outros']) groups['Outros'] = []; groups['Outros'].push(conta); }
        });
        return groups;
    }, [initialContas]);

    // --- MUTAÇÕES ---

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
            toast.success("Conta bancária conectada com sucesso!");
            setLinkSelectionModalOpen(false);
            setFoundBelvoAccounts([]);
            onUpdate();
        },
        onError: (err) => toast.error("Erro ao vincular conta: " + err.message)
    });

    // --- FUNÇÕES DE NEGÓCIO ---

    const handleDeleteConta = (conta) => {
        toast.warning(`Tem certeza que deseja excluir a conta "${conta.nome}"?`, {
            description: "Os lançamentos associados a ela ficarão órfãos.",
            action: { label: "Excluir", onClick: () => deleteMutation.mutate(conta.id) },
            cancel: { label: "Cancelar" },
        });
    };

    const handleOpenPagamentoModal = (conta) => {
        const contaComSaldo = { ...conta, saldoAtual: saldos[conta.id] || 0 };
        setContaParaPagar(contaComSaldo);
        setIsPagamentoModalOpen(true);
    };

    // --- LÓGICA BELVO ---

    const handleConnectBelvo = async (conta) => {
        if (!isWidgetReady || typeof window.belvo === 'undefined') {
            const stillNotReady = !checkBelvoAvailability();
            if (stillNotReady) {
                return toast.error("O sistema bancário não carregou. Tente atualizar a página.");
            }
        }

        setIsBelvoLoading(true);
        setCurrentLinkingConta(conta);

        try {
            const tokenRes = await fetch('/api/belvo/token', { method: 'POST' });
            const tokenData = await tokenRes.json();

            if (!tokenRes.ok) throw new Error(tokenData.error || "Erro ao obter token");

            const belvo = window.belvo.createWidget(
                tokenData.access,
                {
                    locale: 'pt',
                    country_codes: ['BR'],
                    callback: (link, institution) => handleBelvoSuccess(link, institution),
                    onExit: () => setIsBelvoLoading(false),
                    onEvent: (event) => console.log('Belvo Event:', event)
                },
                'belvo' 
            );
            
            belvo.build();

        } catch (error) {
            console.error(error);
            toast.error("Erro ao iniciar conexão bancária: " + error.message);
            setIsBelvoLoading(false);
        }
    };

    const handleBelvoSuccess = async (linkId, institution) => {
        try {
            setCurrentBelvoLink({ id: linkId, institution });
            toast.info("Login bancário realizado! Buscando contas...");

            const accountsRes = await fetch(`/api/belvo/accounts?link_id=${linkId}`);
            const accountsData = await accountsRes.json();

            if (!accountsRes.ok) throw new Error(accountsData.error);

            if (accountsData.length === 0) {
                toast.warning("Nenhuma conta encontrada neste banco.");
                setIsBelvoLoading(false);
                return;
            }

            setFoundBelvoAccounts(accountsData);
            setLinkSelectionModalOpen(true);
            setIsBelvoLoading(false);

        } catch (error) {
            toast.error("Erro ao listar contas do banco: " + error.message);
            setIsBelvoLoading(false);
        }
    };

    const confirmLink = (belvoAccount) => {
        if (!currentLinkingConta || !currentBelvoLink) return;
        
        linkAccountMutation.mutate({
            contaId: currentLinkingConta.id,
            belvoLinkId: currentBelvoLink.id,
            belvoAccountId: belvoAccount.id,
            instituicao: belvoAccount.institution?.name || currentBelvoLink.institution
        });
    };

    const getSaldoLabel = (conta) => {
        if (conta.tipo === 'Cartão de Crédito') return 'Fatura Atual';
        return 'Saldo Real';
    };

    // Renderiza Card de Conta
    const renderContaCard = (conta) => {
        const saldoReal = saldos[conta.id] ?? 0;
        const limite = conta.limite_cheque_especial || 0;
        const saldoDisponivel = saldoReal + limite;
        const isCartao = conta.tipo === 'Cartão de Crédito';
        const isConnected = !!conta.belvo_account_id;
        
        const valorDisplay = isCartao ? Math.abs(saldoReal) : saldoReal;
        let colorClass = 'text-gray-800';
        if (saldoReal < 0) colorClass = 'text-red-600';
        else if (isCartao && saldoReal > 0) colorClass = 'text-green-600';

        return (
            <div key={conta.id} className="border border-gray-200 p-4 rounded-lg shadow-sm hover:shadow-md transition-all hover:border-blue-300 relative group flex flex-col justify-between bg-white">
                <div>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${isCartao ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                <FontAwesomeIcon icon={getAccountIcon(conta.tipo)} className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 leading-tight flex items-center gap-2">
                                    {conta.nome}
                                    {isConnected && <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-sm" title="Conectado ao Banco" />}
                                </h3>
                                <p className="text-xs text-gray-500 font-medium">{conta.instituicao || 'Instituição não informada'}</p>
                            </div>
                        </div>
                        {hasPermission('financeiro', 'pode_editar') && (
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 rounded shadow-sm border border-gray-100">
                                <button onClick={() => { setEditingConta(conta); setIsModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-1.5" title="Editar"><FontAwesomeIcon icon={faPenToSquare} /></button>
                                <button onClick={() => handleDeleteConta(conta)} className="text-gray-400 hover:text-red-600 p-1.5" title="Excluir"><FontAwesomeIcon icon={faTrash} /></button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 text-xs text-gray-600 border-t border-gray-100 pt-3">
                        {conta.empresa && <p className="truncate"><strong className="text-gray-700">Empresa:</strong> {conta.empresa.nome_fantasia || conta.empresa.razao_social}</p>}
                        {(conta.tipo === 'Conta Corrente' || !conta.tipo) && (
                            <>
                                <p><strong>Ag:</strong> {conta.agencia || '-'} / <strong>CC:</strong> {conta.numero_conta || '-'}</p>
                                {limite > 0 && <p className='text-orange-600 flex items-center gap-1 mt-1 bg-orange-50 p-1 rounded w-fit'><FontAwesomeIcon icon={faExclamationTriangle} /><span>Limite: {formatCurrency(limite)}</span></p>}
                            </>
                        )}
                        {isCartao && <p><strong>Vence dia:</strong> {conta.dia_pagamento_fatura || 'N/A'}</p>}
                    </div>
                </div>
                
                <div className="text-right mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs uppercase font-bold text-gray-400 mb-1">{getSaldoLabel(conta)}</p>
                    <p className={`text-2xl font-bold ${colorClass}`}>
                        {isLoadingSaldos ? <FontAwesomeIcon icon={faSpinner} spin className="text-lg text-gray-300"/> : formatCurrency(valorDisplay)}
                    </p>
                    
                    {!isCartao && limite > 0 && (
                        <p className="text-xs text-gray-500 mt-1">Disponível: <span className="font-semibold text-green-600">{isLoadingSaldos ? '...' : formatCurrency(saldoDisponivel)}</span></p>
                    )}

                    <div className="flex gap-2 mt-3">
                        {!isConnected ? (
                            <button 
                                onClick={() => handleConnectBelvo(conta)}
                                disabled={isBelvoLoading} 
                                className={`flex-1 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border ${!isWidgetReady ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}
                            >
                                <FontAwesomeIcon icon={(isBelvoLoading || !isWidgetReady) ? faSpinner : faLink} spin={isBelvoLoading || !isWidgetReady} />
                                {!isWidgetReady ? 'Carregando...' : (isBelvoLoading ? 'Abrindo...' : 'Conectar Banco')}
                            </button>
                        ) : (
                            <button 
                                onClick={() => onVerExtrato(conta.id)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors border border-gray-300"
                            >
                                <FontAwesomeIcon icon={faFileInvoice} /> Extrato
                            </button>
                        )}

                        {isCartao && saldoReal < 0 && (
                            <button onClick={() => handleOpenPagamentoModal(conta)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded transition-colors"><FontAwesomeIcon icon={faMoneyBillTransfer} /></button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* CARREGAMENTO ROBUSTO DO SCRIPT */}
            <Script 
                src="https://cdn.belvo.io/belvo-widget-1-stable.js"
                strategy="lazyOnload" // Carrega sem bloquear a página
                onLoad={() => checkBelvoAvailability()}
            />

            {/* MODAIS */}
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

            {/* MODAL DE SELEÇÃO DE CONTA BELVO */}
            {linkSelectionModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <FontAwesomeIcon icon={faBuildingColumns} className="text-blue-600"/>
                            Vincular Conta
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Encontramos as seguintes contas no banco. Qual delas corresponde à conta <strong>{currentLinkingConta?.nome}</strong> do sistema?
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {foundBelvoAccounts.map(acc => (
                                <button
                                    key={acc.id}
                                    onClick={() => confirmLink(acc)}
                                    className="w-full text-left p-3 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors flex justify-between items-center"
                                >
                                    <div>
                                        <p className="font-bold text-gray-800">{acc.name} <span className="text-xs font-normal text-gray-500">({acc.type})</span></p>
                                        <p className="text-xs text-gray-500">Número: {acc.number || 'Oculto'} • Saldo: {formatCurrency(acc.balance?.current)}</p>
                                    </div>
                                    <FontAwesomeIcon icon={faLink} className="text-gray-300" />
                                </button>
                            ))}
                        </div>
                        <div className="mt-4 text-right">
                            <button onClick={() => setLinkSelectionModalOpen(false)} className="text-gray-500 hover:text-gray-700 text-sm font-semibold">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI CARDS E LISTA DE CONTAS (Mantidos igual) */}
            {initialContas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <KpiCard title="Saldo Líquido (Caixa)" value={isLoadingSaldos ? '...' : formatCurrency(kpis.saldoLiquido)} icon={faWallet} color={kpis.saldoLiquido >= 0 ? "blue" : "red"} subtext="Dinheiro real disponível" />
                    <KpiCard title="Poder de Compra" value={isLoadingSaldos ? '...' : formatCurrency(kpis.poderCompra)} icon={faHandHoldingDollar} color="green" subtext="Caixa + Limites" />
                    <div className="bg-white p-4 rounded-lg shadow-md border-l-4 border-red-500 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Uso Cheque Especial</p><h3 className="text-lg font-bold text-gray-800 mt-1">{isLoadingSaldos ? '...' : formatCurrency(kpis.limiteChequeUsado)}</h3></div>
                            <div className="bg-red-100 p-2 rounded-full text-red-600"><FontAwesomeIcon icon={faExclamationTriangle} /></div>
                        </div>
                        <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1"><div className="bg-red-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(kpis.percentualUsoCheque, 100)}%` }}></div></div>
                            <p className="text-xs text-gray-500 text-right">{kpis.percentualUsoCheque.toFixed(1)}% de {formatCurrency(kpis.limiteChequeTotal)}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FontAwesomeIcon icon={faLayerGroup} className="text-blue-600" /> Minhas Contas</h2>
                    {hasPermission('financeiro', 'pode_criar') && (
                        <button onClick={() => { setEditingConta(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"><FontAwesomeIcon icon={faPlus} /> Nova Conta</button>
                    )}
                </div>

                {initialContas.length === 0 ? ( <p className="text-center text-gray-500 py-10">Nenhuma conta cadastrada.</p> ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedContas).map(([tipo, contasDoTipo]) => {
                            if (!contasDoTipo || contasDoTipo.length === 0) return null;
                            return (
                                <div key={tipo} className="animate-fade-in-up">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 border-b border-gray-200 pb-2 flex items-center gap-2">
                                        <FontAwesomeIcon icon={getAccountIcon(tipo)} className="text-gray-400 text-lg" /> {tipo} <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{contasDoTipo.length}</span>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {contasDoTipo.map(conta => renderContaCard(conta))}
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
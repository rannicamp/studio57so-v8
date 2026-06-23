'use client';

import { useState, useEffect } from 'react';
import { useLayout } from '@/contexts/LayoutContext';
import { createClient } from '@/utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCreditCard,
    faCheckCircle,
    faExclamationTriangle,
    faClock,
    faSpinner,
    faExternalLinkAlt,
    faLock,
    faHistory,
    faReceipt,
    faTimes,
    faCalendarAlt,
    faUser
} from '@fortawesome/free-solid-svg-icons';

export default function AssinaturaPage() {
    const { setPageTitle } = useLayout();
    const searchParams = useSearchParams();
    const isBloqueado = searchParams.get('bloqueado') === 'true';
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    // Estados locais
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const [errorCheckout, setErrorCheckout] = useState(null);
    const [isModalCardOpen, setIsModalCardOpen] = useState(false);
    
    // Estados do Formulário do Cartão
    const [holderName, setHolderName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCcv, setCardCcv] = useState('');
    const [submittingCard, setSubmittingCard] = useState(false);
    const [errorCard, setErrorCard] = useState(null);
    const [successCard, setSuccessCard] = useState(false);

    useEffect(() => {
        setPageTitle('Faturamento & Assinatura');
    }, [setPageTitle]);

    // 1. Buscar os detalhes completos de faturamento do Asaas + Supabase
    const { data: faturamento, isLoading: loadingDetalhes, error: errorDetalhes } = useQuery({
        queryKey: ['faturamento-detalhes'],
        queryFn: async () => {
            const res = await fetch('/api/subscriptions/details');
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Erro ao carregar detalhes de faturamento.');
            }
            return res.json();
        }
    });

    // 2. Mutation para gerar o Link de Checkout do Asaas (Assinar plano pela primeira vez)
    const checkoutMutation = useMutation({
        mutationFn: async () => {
            setLoadingCheckout(true);
            setErrorCheckout(null);

            const res = await fetch('/api/subscriptions/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Erro ao gerar checkout.');
            }

            return data;
        },
        onSuccess: (data) => {
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        },
        onError: (err) => {
            setErrorCheckout(err.message);
            setLoadingCheckout(false);
        }
    });

    // 3. Mutation para atualizar o Cartão de Crédito
    const updateCardMutation = useMutation({
        mutationFn: async (cardData) => {
            setSubmittingCard(true);
            setErrorCard(null);
            setSuccessCard(false);

            const res = await fetch('/api/subscriptions/update-card', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cardData)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Erro ao atualizar dados do cartão de crédito.');
            }

            return data;
        },
        onSuccess: () => {
            setSuccessCard(true);
            // Limpa o formulário
            setHolderName('');
            setCardNumber('');
            setCardExpiry('');
            setCardCcv('');
            // Recarrega os dados de faturamento
            queryClient.invalidateQueries(['faturamento-detalhes']);
            
            // Fecha o modal após 1.5s
            setTimeout(() => {
                setIsModalCardOpen(false);
                setSuccessCard(false);
                setSubmittingCard(false);
            }, 1500);
        },
        onError: (err) => {
            setErrorCard(err.message);
            setSubmittingCard(false);
        }
    });

    const handleAssinar = () => {
        checkoutMutation.mutate();
    };

    // Máscara para número do cartão (0000 0000 0000 0000)
    const handleCardNumberChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 16);
        const parts = [];
        for (let i = 0; i < value.length; i += 4) {
            parts.push(value.substring(i, i + 4));
        }
        setCardNumber(parts.join(' '));
    };

    // Máscara para validade (MM/AA)
    const handleCardExpiryChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 4);
        if (value.length > 2) {
            setCardExpiry(`${value.substring(0, 2)}/${value.substring(2, 4)}`);
        } else {
            setCardExpiry(value);
        }
    };

    // Máscara para CVV (0000)
    const handleCardCcvChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setCardCcv(value.substring(0, 4));
    };

    // Enviar formulário de alteração de cartão
    const handleUpdateCardSubmit = (e) => {
        e.preventDefault();
        
        if (!holderName || !cardNumber || !cardExpiry || !cardCcv) {
            setErrorCard('Preencha todos os campos do cartão.');
            return;
        }

        const expiryClean = cardExpiry.replace(/\D/g, '');
        if (expiryClean.length !== 4) {
            setErrorCard('Validade do cartão deve ser no formato MM/AA.');
            return;
        }

        const expiryMonth = parseInt(expiryClean.substring(0, 2), 10);
        const expiryYearShort = expiryClean.substring(2, 4);
        const expiryYear = parseInt(`20${expiryYearShort}`, 10);

        if (expiryMonth < 1 || expiryMonth > 12) {
            setErrorCard('Mês de validade inválido (deve ser de 01 a 12).');
            return;
        }

        updateCardMutation.mutate({
            holderName,
            number: cardNumber,
            expiryMonth,
            expiryYear,
            ccv: cardCcv
        });
    };

    if (loadingDetalhes) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-3xl" />
                    <p className="text-gray-500 font-medium">Carregando informações de faturamento...</p>
                </div>
            </div>
        );
    }

    if (errorDetalhes) {
        return (
            <div className="w-full max-w-lg mx-auto p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl my-10">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-rose-500 text-4xl mb-4" />
                <h3 className="text-lg font-bold text-rose-900 mb-2">Falha ao Carregar Faturamento</h3>
                <p className="text-sm text-rose-700 mb-4">{errorDetalhes.message}</p>
                <button 
                    onClick={() => queryClient.invalidateQueries(['faturamento-detalhes'])}
                    className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition-all"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const { organizacao, cartao, faturas } = faturamento;

    const diasRestantesTrial = () => {
        if (!organizacao?.trialEndsAt) return 0;
        const diffTime = new Date(organizacao.trialEndsAt) - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const formatarData = (dataStr) => {
        if (!dataStr) return 'Não definida';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    const formatarMoeda = (valor) => {
        if (valor === undefined || valor === null) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    };

    // Renderiza o badge de status da assinatura
    const renderStatusBadge = () => {
        const status = organizacao?.status || 'trialing';
        switch (status) {
            case 'active':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <FontAwesomeIcon icon={faCheckCircle} /> Assinatura Ativa
                    </span>
                );
            case 'trialing':
                const dias = diasRestantesTrial();
                if (dias > 0) {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <FontAwesomeIcon icon={faClock} /> Período de Testes ({dias} dias)
                        </span>
                    );
                } else {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Testes Expirado
                        </span>
                    );
                }
            case 'overdue':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <FontAwesomeIcon icon={faExclamationTriangle} /> Aguardando Pagamento
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
                        <FontAwesomeIcon icon={faLock} /> Inativa / Cancelada
                    </span>
                );
        }
    };

    // Mapeador de Status da Fatura Asaas para português
    const renderFaturaStatus = (status) => {
        switch (status) {
            case 'RECEIVED':
            case 'CONFIRMED':
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">Pago</span>;
            case 'PENDING':
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">Pendente</span>;
case 'OVERDUE':
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">Vencido</span>;
            case 'REFUNDED':
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-100">Estornado</span>;
            default:
                return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-100">{status}</span>;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-6 animate-in fade-in duration-300">
            {/* Banner de Suspensão por Inadimplência */}
            {isBloqueado && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-6 rounded-r-xl shadow-sm mb-8 flex items-start gap-4">
                    <div className="bg-rose-100 text-rose-600 p-2.5 rounded-lg shrink-0">
                        <FontAwesomeIcon icon={faLock} size="lg" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-rose-900 mb-1">Acesso Bloqueado</h2>
                        <p className="text-sm text-rose-700 leading-relaxed">
                            O período de testes da sua organização ({organizacao?.nome}) se encerrou ou identificamos faturas vencidas em aberto. Para reativar o acesso total aos módulos e dados da sua conta no Elo 57, por favor regularize o pagamento ou cadastre um cartão de crédito ativo.
                        </p>
                    </div>
                </div>
            )}

            {/* Banner Discreto de Segurança Asaas */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl shadow-sm mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-start gap-3.5">
                    <div className="bg-slate-100 text-slate-500 p-2.5 rounded-xl shrink-0 mt-0.5 md:mt-0">
                        <FontAwesomeIcon icon={faLock} className="text-sm" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Pagamento Criptografado & Seguro</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                            O Elo 57 não armazena os dados do seu cartão de crédito. Todo o processamento e a custódia das informações ocorrem em ambiente altamente seguro e criptografado nos servidores do <strong>Asaas</strong>, instituição autorizada pelo Banco Central do Brasil.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto bg-white border border-slate-100/80 py-2 px-4 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tecnologia</span>
                    {/* Imagem Oficial do Logo do Asaas */}
                    <img 
                        src="https://docs.asaas.com/img/logo.svg" 
                        alt="Logo Asaas" 
                        className="h-5 w-auto object-contain" 
                        onError={(e) => {
                            // Fallback caso a imagem externa falhe
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'inline-block';
                        }}
                    />
                    <span className="hidden font-extrabold text-sm text-slate-800 tracking-tighter select-none font-sans">
                        <span className="text-[#0066FF]">as</span>aas
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {/* 1. Status do Plano Atual */}
                <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Seu Plano</span>
                                <h2 className="text-2xl font-bold text-gray-800 mt-1">Plano Premium Mensal</h2>
                            </div>
                            {renderStatusBadge()}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <span className="text-xs text-gray-400 font-semibold block">Organização Beneficiária</span>
                                <span className="text-gray-800 font-bold text-sm mt-1 block">{organizacao?.nome}</span>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <span className="text-xs text-gray-400 font-semibold block">Valor de Cobrança</span>
                                <span className="text-gray-800 font-bold text-sm mt-1 block">R$ 297,00 / mês</span>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <span className="text-xs text-gray-400 font-semibold block">Próxima Renovação</span>
                                <span className="text-gray-800 font-bold text-sm mt-1 block">
                                    {organizacao?.status === 'trialing' 
                                        ? formatarData(organizacao.trialEndsAt) 
                                        : formatarData(organizacao.expiresAt)}
                                </span>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <span className="text-xs text-gray-400 font-semibold block">Método de Recorrência</span>
                                <span className="text-gray-800 font-bold text-sm mt-1 block">Cartão de Crédito</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        {errorCheckout && (
                            <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg mb-4 text-center border border-rose-100 font-medium">
                                {errorCheckout}
                            </div>
                        )}

                        {/* Se não possuir assinatura ativa no Asaas, exibe botão para Iniciar Assinatura */}
                        {(!organizacao?.status || ['canceled', 'inactive'].includes(organizacao.status) || (organizacao.status === 'trialing' && !cartao)) ? (
                            <button
                                onClick={handleAssinar}
                                disabled={loadingCheckout}
                                className="w-full py-4 px-6 bg-black text-white hover:bg-gray-900 transition-all font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
                            >
                                {loadingCheckout ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                        <span>Conectando ao Checkout do Asaas...</span>
                                    </>
                                ) : (
                                    <>
                                        <FontAwesomeIcon icon={faCreditCard} />
                                        <span>Assinar Plano Premium (Checkout Seguro)</span>
                                        <FontAwesomeIcon icon={faExternalLinkAlt} size="xs" className="ml-1" />
                                    </>
                                )}
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* 2. Cartão de Crédito Cadastrado */}
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4">Cartão de Cobrança</span>
                        
                        {cartao ? (
                            <div className="bg-gradient-to-br from-gray-950 to-gray-800 text-white p-6 rounded-xl shadow-md flex flex-col justify-between h-40 relative overflow-hidden mb-6">
                                <div className="absolute right-4 top-4 opacity-15">
                                    <FontAwesomeIcon icon={faCreditCard} size="4x" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold tracking-widest text-gray-300 uppercase">{cartao.brand}</span>
                                    <div className="w-8 h-5 bg-yellow-400/80 rounded-sm"></div>
                                </div>
                                <div>
                                    <span className="text-lg font-mono tracking-widest block">•••• •••• •••• {cartao.lastDigits}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-gray-400">
                                    <span>CARTÃO VINCULADO</span>
                                    <span>ATIVO</span>
                                </div>
                            </div>
                        ) : (
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center h-40 mb-6 bg-gray-50/50">
                                <FontAwesomeIcon icon={faCreditCard} className="text-gray-300 text-3xl mb-2" />
                                <p className="text-xs text-gray-400 font-medium">Nenhum cartão cadastrado para cobrança.</p>
                            </div>
                        )}
                    </div>

                    {cartao ? (
                        <button
                            onClick={() => setIsModalCardOpen(true)}
                            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all border border-gray-200/50 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                            <FontAwesomeIcon icon={faCreditCard} className="text-gray-500" />
                            <span>Alterar Cartão</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsModalCardOpen(true)}
                            className="w-full py-3 px-4 bg-black hover:bg-gray-900 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                        >
                            <FontAwesomeIcon icon={faCreditCard} />
                            <span>Cadastrar Cartão</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 3. Histórico de Pagamentos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                <div className="flex items-center gap-2 mb-6">
                    <FontAwesomeIcon icon={faHistory} className="text-gray-400 text-lg" />
                    <h3 className="text-lg font-bold text-gray-800">Histórico de Faturamentos</h3>
                </div>

                {faturas && faturas.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm text-gray-600">
                            <thead>
                                <tr className="border-b border-gray-100 text-gray-400 font-bold">
                                    <th className="py-3 px-4">Vencimento</th>
                                    <th className="py-3 px-4">Forma</th>
                                    <th className="py-3 px-4">Valor</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Documento / Link</th>
                                </tr>
                            </thead>
                            <tbody>
                                {faturas.map((fatura) => (
                                    <tr key={fatura.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-all">
                                        <td className="py-3.5 px-4 font-semibold text-gray-700">
                                            {formatarData(fatura.dueDate)}
                                        </td>
                                        <td className="py-3.5 px-4 capitalize text-xs font-medium">
                                            {fatura.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : 
                                             fatura.billingType === 'BOLETO' ? 'Boleto Bancário' : 
                                             fatura.billingType === 'PIX' ? 'PIX' : fatura.billingType}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-gray-800">
                                            {formatarMoeda(fatura.value)}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {renderFaturaStatus(fatura.status)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            {/* Exibe botão de comprovante se pago, ou botão de pagamento se pendente */}
                                            {['RECEIVED', 'CONFIRMED'].includes(fatura.status) && fatura.confirmedBillingUrl ? (
                                                <a 
                                                    href={fatura.confirmedBillingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-black transition-all bg-gray-50 hover:bg-gray-100 py-1.5 px-3 rounded-lg border border-gray-100"
                                                >
                                                    <FontAwesomeIcon icon={faReceipt} size="xs" />
                                                    <span>Comprovante</span>
                                                </a>
                                            ) : ['PENDING', 'OVERDUE'].includes(fatura.status) && fatura.invoiceUrl ? (
                                                <a 
                                                    href={fatura.invoiceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-all bg-blue-50 hover:bg-blue-100 py-1.5 px-3 rounded-lg border border-blue-100"
                                                >
                                                    <span>Pagar Fatura</span>
                                                    <FontAwesomeIcon icon={faExternalLinkAlt} size="2xs" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">Sem link disponível</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400 flex flex-col items-center justify-center">
                        <FontAwesomeIcon icon={faReceipt} className="text-gray-200 text-4xl mb-2" />
                        <p className="text-sm">Nenhuma fatura encontrada no histórico.</p>
                    </div>
                )}
            </div>

            {/* ========================================== */}
            {/* MODAL DE ATUALIZAÇÃO DE CARTÃO DE CRÉDITO */}
            {/* ========================================== */}
            {isModalCardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <FontAwesomeIcon icon={faCreditCard} className="text-gray-700" />
                                <h3 className="text-md font-bold text-gray-800">Alterar Cartão de Crédito</h3>
                            </div>
                            <button 
                                onClick={() => setIsModalCardOpen(false)}
                                className="text-gray-400 hover:text-gray-700 transition-all p-1.5 rounded-lg hover:bg-gray-100"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleUpdateCardSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome Impresso no Cartão</label>
                                    <div className="relative">
                                        <FontAwesomeIcon icon={faUser} className="absolute left-3.5 top-3.5 text-gray-400 text-sm" />
                                        <input 
                                            type="text" 
                                            placeholder="Nome Completo"
                                            value={holderName}
                                            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-black focus:bg-white outline-none transition-all font-medium placeholder-gray-400"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Número do Cartão</label>
                                    <div className="relative">
                                        <FontAwesomeIcon icon={faCreditCard} className="absolute left-3.5 top-3.5 text-gray-400 text-sm" />
                                        <input 
                                            type="text" 
                                            placeholder="0000 0000 0000 0000"
                                            value={cardNumber}
                                            onChange={handleCardNumberChange}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-black focus:bg-white outline-none transition-all font-mono placeholder-gray-400"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Validade (MM/AA)</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3.5 top-3.5 text-gray-400 text-sm" />
                                            <input 
                                                type="text" 
                                                placeholder="MM/AA"
                                                value={cardExpiry}
                                                onChange={handleCardExpiryChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-black focus:bg-white outline-none transition-all font-mono placeholder-gray-400"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Código CVV</label>
                                        <div className="relative">
                                            <FontAwesomeIcon icon={faLock} className="absolute left-3.5 top-3.5 text-gray-400 text-sm" />
                                            <input 
                                                type="password" 
                                                placeholder="CVV"
                                                value={cardCcv}
                                                onChange={handleCardCcvChange}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-black focus:bg-white outline-none transition-all font-mono placeholder-gray-400"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mensagem de Erro do Modal */}
                            {errorCard && (
                                <div className="mt-4 text-xs text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-lg font-medium">
                                    {errorCard}
                                </div>
                            )}

                            {/* Mensagem de Sucesso do Modal */}
                            {successCard && (
                                <div className="mt-4 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-lg font-medium text-center">
                                    💳 Cartão atualizado com sucesso!
                                </div>
                            )}

                            {/* Ações */}
                            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalCardOpen(false)}
                                    disabled={submittingCard}
                                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-all disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submittingCard || successCard}
                                    className="px-5 py-2.5 bg-black hover:bg-gray-900 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    {submittingCard ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                            <span>Processando...</span>
                                        </>
                                    ) : (
                                        <span>Confirmar Alteração</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

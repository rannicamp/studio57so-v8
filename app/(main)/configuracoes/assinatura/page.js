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
    faLock
} from '@fortawesome/free-solid-svg-icons';

export default function AssinaturaPage() {
    const { setPageTitle } = useLayout();
    const searchParams = useSearchParams();
    const isBloqueado = searchParams.get('bloqueado') === 'true';
    const supabase = createClient();
    const queryClient = useQueryClient();
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const [errorCheckout, setErrorCheckout] = useState(null);

    useEffect(() => {
        setPageTitle('Assinatura do Sistema');
    }, [setPageTitle]);

    // 1. Buscar a organização do usuário logado (TanStack Query)
    const { data: userOrgData, isLoading: loadingOrg } = useQuery({
        queryKey: ['usuario-organizacao'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Não autenticado');

            const { data: usuario, error: userError } = await supabase
                .from('usuarios')
                .select('organizacao_id')
                .eq('id', user.id)
                .single();

            if (userError || !usuario) throw new Error('Erro ao carregar perfil do usuário');

            const { data: org, error: orgError } = await supabase
                .from('organizacoes')
                .select('id, nome, subscription_status, subscription_expires_at, trial_ends_at, asaas_subscription_id')
                .eq('id', usuario.organizacao_id)
                .single();

            if (orgError || !org) throw new Error('Erro ao carregar organização');

            return org;
        }
    });

    // 2. Mutation para gerar o Checkout do Asaas
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
            // Redireciona o usuário para a página de faturamento seguro do Asaas
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        },
        onError: (err) => {
            setErrorCheckout(err.message);
            setLoadingCheckout(false);
        }
    });

    const handleAssinar = () => {
        checkoutMutation.mutate();
    };

    if (loadingOrg) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-3xl" />
                    <p className="text-gray-500 font-medium">Carregando informações da assinatura...</p>
                </div>
            </div>
        );
    }

    const org = userOrgData;

    // Calcular dias restantes do trial
    const diasRestantesTrial = () => {
        if (!org?.trial_ends_at) return 0;
        const diffTime = new Date(org.trial_ends_at) - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    // Formatar data para exibição
    const formatarData = (dataStr) => {
        if (!dataStr) return 'Não definida';
        return new Date(dataStr).toLocaleDateString('pt-BR');
    };

    // Obter Badge de status
    const renderStatusBadge = () => {
        const status = org?.subscription_status || 'trialing';
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
                            <FontAwesomeIcon icon={faClock} /> Período de Testes ({dias} dias restantes)
                        </span>
                    );
                } else {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <FontAwesomeIcon icon={faExclamationTriangle} /> Período de Testes Expirado
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
                        <FontAwesomeIcon icon={faLock} /> Suspenso / Cancelado
                    </span>
                );
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 animate-in fade-in duration-300">
            {/* Banner de Bloqueio se aplicável */}
            {isBloqueado && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-6 rounded-r-xl shadow-sm mb-8 flex items-start gap-4">
                    <div className="bg-rose-100 text-rose-600 p-2.5 rounded-lg">
                        <FontAwesomeIcon icon={faLock} size="lg" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-rose-900 mb-1">Acesso Temporariamente Suspenso</h2>
                        <p className="text-sm text-rose-700 leading-relaxed">
                            O período de testes da sua organização ({org?.nome}) se encerrou ou identificamos que o pagamento da última mensalidade está pendente. Para reativar o acesso total aos seus dados e módulos do Elo 57, insira seus dados de cartão de crédito no botão de assinatura abaixo.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-8">
                {/* Lado Esquerdo: Status da Assinatura */}
                <div className="flex-1 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Sua Assinatura</h2>
                            {renderStatusBadge()}
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between py-3 border-b border-gray-50">
                                <span className="text-gray-500 text-sm">Organização</span>
                                <span className="text-gray-800 font-semibold text-sm">{org?.nome}</span>
                            </div>
                            <div className="flex justify-between py-3 border-b border-gray-50">
                                <span className="text-gray-500 text-sm">Valor do Plano</span>
                                <span className="text-gray-800 font-semibold text-sm">R$ 297,00 / mês</span>
                            </div>
                            <div className="flex justify-between py-3 border-b border-gray-50">
                                <span className="text-gray-500 text-sm">Próximo Vencimento</span>
                                <span className="text-gray-800 font-semibold text-sm">
                                    {org?.subscription_status === 'trialing' 
                                        ? formatarData(org.trial_ends_at) 
                                        : formatarData(org.subscription_expires_at)}
                                </span>
                            </div>
                            <div className="flex justify-between py-3">
                                <span className="text-gray-500 text-sm">Método de Recorrência</span>
                                <span className="text-gray-800 font-semibold text-sm">Cartão de Crédito</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        {errorCheckout && (
                            <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg mb-4 text-center border border-rose-100 font-medium">
                                {errorCheckout}
                            </div>
                        )}

                        <button
                            onClick={handleAssinar}
                            disabled={loadingCheckout}
                            className="w-full py-4 px-6 bg-black text-white hover:bg-gray-900 transition-all font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
                        >
                            {loadingCheckout ? (
                                <>
                                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                    <span>Conectando ao Asaas...</span>
                                </>
                            ) : org?.asaas_subscription_id ? (
                                <>
                                    <span>Gerenciar Assinatura (Asaas)</span>
                                    <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faCreditCard} />
                                    <span>Assinar Plano Mensal</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Lado Direito: Informações e Benefícios do Elo 57 */}
                <div className="w-full md:w-80 bg-gray-50 p-8 rounded-2xl border border-gray-100 flex flex-col justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Plano Premium Elo 57</h3>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">
                            Acesso completo a todas as ferramentas e integrações do sistema para revolucionar a sua construtora ou incorporadora.
                        </p>

                        <ul className="space-y-3.5 text-sm text-gray-700">
                            <li className="flex items-center gap-2">
                                <span className="text-emerald-500">✔</span> Gestão de Obras & RDO
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-emerald-500">✔</span> CRM Multi-Funil & Leads Meta
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-emerald-500">✔</span> API Oficial de WhatsApp Integrada
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-emerald-500">✔</span> Módulo Financeiro & Fluxo de Caixa
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-emerald-500">✔</span> BIM Manager & Quantitativos
                            </li>
                        </ul>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-200/60 text-center">
                        <p className="text-xs text-gray-400">
                            Pagamento processado em ambiente 100% seguro em parceria com a tecnologia do <strong>Asaas</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

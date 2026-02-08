// components/contratos/FichaContrato.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react'; 
import { createClient } from '../../utils/supabase/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'; 
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faFileSignature, faSpinner,
    faFileLines, faHandshake, faDollarSign,
    faCheckCircle, faCalendarCheck, faBuilding,
    faFileContract, faLock, faCogs, faMoneyCheckDollar // Adicionei o ícone aqui
} from '@fortawesome/free-solid-svg-icons';

import DetalhesVendaContrato from './DetalhesVendaContrato';
import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import PlanoPagamentoContrato from './PlanoPagamentoContrato';
import KpiCard from '@/components/shared/KpiCard';
import GeradorContrato from './GeradorContrato';
import ExtratoFinanceiroCliente from './ExtratoFinanceiroCliente'; // Importação do novo componente

// Chave para persistência da aba ativa
const CONTRATO_TAB_KEY = 'STUDIO57_CONTRATO_ACTIVE_TAB';

// --- FUNÇÕES DE BUSCA ---
const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    if (!contratoId || !organizacaoId) return null;
    const { data: contratoData, error } = await supabase
        .from('contratos')
        .select(`
            *,
            contato:contato_id ( *, telefones(telefone), emails(email) ),
            conjuge:conjuge_id ( *, telefones(telefone), emails(email) ),
            representante:representante_id ( *, telefones(telefone), emails(email) ),
            corretor:corretor_id (*),
            empreendimento:empreendimento_id( *, empresa_proprietaria_id(*) ),
            conta_financeira:conta_bancaria_id(*),
            contrato_parcelas (*),
            contrato_permutas (*)
        `)
        .eq('id', contratoId)
        .eq('organizacao_id', organizacaoId)
        .single();
    if (error) { console.error("Erro ao buscar dados do contrato:", error); throw error; }
    if (!contratoData) return null;
    const { data: produtosDoContrato, error: produtosError } = await supabase
        .from('contrato_produtos')
        .select('produtos_empreendimento (*)')
        .eq('contrato_id', contratoId);
    if (produtosError) {
        console.error("Erro ao buscar produtos do contrato:", produtosError);
        contratoData.produtos = [];
    } else {
        contratoData.produtos = produtosDoContrato?.map(item => item.produtos_empreendimento) || [];
    }
    return contratoData;
};

const fetchModelosContrato = async (supabase, empreendimentoId, organizacaoId) => {
    if (!empreendimentoId || !organizacaoId) return [];
    const { data, error } = await supabase
        .from('modelos_contrato')
        .select('id, nome_modelo')
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId)
        .order('nome_modelo');
    if (error) {
        console.error("Erro ao buscar modelos de contrato:", error);
        toast.error("Erro ao carregar modelos de contrato.");
        return [];
    }
    return data;
};

export default function FichaContrato({ 
    initialContratoData, 
    user, 
    clientSearchScope 
}) {
    const supabase = createClient();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();
    const hasMounted = useRef(false);

    // --- PERSISTÊNCIA DA ABA ---
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(CONTRATO_TAB_KEY) || 'resumo';
        }
        return 'resumo';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CONTRATO_TAB_KEY, activeTab);
        }
    }, [activeTab]);

    const { 
        data: contrato, 
        isLoading: isLoadingContrato,
        isError: isErrorContrato,
        error: errorContrato,
        isRefetching,
    } = useQuery({
        queryKey: ['contrato', initialContratoData.id, organizacaoId],
        queryFn: () => fetchContratoData(supabase, initialContratoData.id, organizacaoId),
        initialData: initialContratoData, 
        enabled: !!initialContratoData.id && !!organizacaoId,
        staleTime: 1000 * 60 * 5, 
    });

    useEffect(() => {
        if (hasMounted.current) {
            if (!isRefetching && !isLoadingContrato && !isErrorContrato) {
                // Atualização silenciosa
            }
        } else {
            hasMounted.current = true;
        }
    }, [isRefetching, isLoadingContrato, isErrorContrato]);

    useEffect(() => {
        if (isErrorContrato) {
            toast.error(`Erro ao atualizar dados: ${errorContrato.message}`);
        }
    }, [isErrorContrato, errorContrato]);

    const { data: modelosContrato = [], isLoading: loadingModelos } = useQuery({
        queryKey: ['modelosContratoFicha', contrato?.empreendimento_id, organizacaoId],
        queryFn: () => fetchModelosContrato(supabase, contrato?.empreendimento_id, organizacaoId),
        enabled: !!contrato?.empreendimento_id && !!organizacaoId, 
    });

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const refreshContratoData = () => {
        queryClient.invalidateQueries({ queryKey: ['contrato', initialContratoData.id, organizacaoId] }); 
        queryClient.invalidateQueries({ queryKey: ['modelosContratoFicha', contrato?.empreendimento_id, organizacaoId]});
        // Invalida também o financeiro se houver alteração
        if (contrato?.contato_id) {
            queryClient.invalidateQueries({ queryKey: ['extratoFinanceiroCliente', contrato.contato_id, organizacaoId] });
        }
    };
    
    const descontoConcedido = useMemo(() => {
        const somaProdutos = (contrato.produtos || []).reduce((sum, p) => sum + parseFloat(p.valor_venda_calculado || 0), 0);
        const valorFinal = parseFloat(contrato.valor_final_venda || 0);
        return somaProdutos > valorFinal ? somaProdutos - valorFinal : 0;
    }, [contrato.produtos, contrato.valor_final_venda]);
    
    const kpiData = useMemo(() => {
        const valorTotal = parseFloat(contrato.valor_final_venda) || 0;
        const parcelasPagas = (contrato.contrato_parcelas || []).filter(p => p.status_pagamento === 'Pago');
        const totalPago = parcelasPagas.reduce((sum, p) => sum + parseFloat(p.valor_parcela || 0), 0);
        const saldoDevedor = valorTotal - totalPago;
        const proximaParcela = (contrato.contrato_parcelas || [])
            .filter(p => p.status_pagamento === 'Pendente')
            .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0];
        return {
            valorTotal: formatCurrency(valorTotal),
            totalPago: formatCurrency(totalPago),
            saldoDevedor: formatCurrency(saldoDevedor),
            proximaParcela: proximaParcela ? `${formatCurrency(proximaParcela.valor_parcela)} em ${formatDateForDisplay(proximaParcela.data_vencimento)}` : 'Nenhuma'
        };
    }, [contrato]);

    const updateModeloMutation = useMutation({
        mutationFn: async (modeloId) => {
            const { error } = await supabase
                .from('contratos')
                .update({ modelo_contrato_id: modeloId || null }) 
                .eq('id', contrato.id)
                .eq('organizacao_id', organizacaoId); 
            if (error) throw error;
        },
        onSuccess: () => { 
            toast.success("Modelo de contrato selecionado!"); 
            refreshContratoData();
        },
        onError: (error) => { toast.error(`Erro ao selecionar modelo: ${error.message}`); }
    });
    const handleModeloChange = (event) => {
        const selectedModelId = event.target.value;
        updateModeloMutation.mutate(selectedModelId);
    };

    const isClienteDefined = !!contrato?.contato_id;
    
    const TabButton = ({ tabId, label, icon, disabled = false }) => {
        let finalDisabled = disabled;
        // Habilita a aba Financeiro junto com a Cronograma
        if (tabId === 'cronograma' || tabId === 'financeiro') {
            finalDisabled = false; 
        }
        const isDisabled = finalDisabled && !isClienteDefined;

        return (
            <button
                onClick={() => !isDisabled && setActiveTab(tabId)}
                disabled={isDisabled}
                title={isDisabled ? "Defina um cliente na aba 'Resumo da Venda' para habilitar" : ""}
                className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-all duration-200 outline-none whitespace-nowrap
                    ${activeTab === tabId ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`
                }
            >
                <FontAwesomeIcon icon={isDisabled ? faLock : icon} /> {label}
            </button>
        );
    };

    if (!contrato) {
        return <div className="flex justify-center items-center h-64"><FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-blue-500" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header do Contrato - Escondido na Impressão */}
            <div className="print:hidden bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {contrato.tipo_documento === 'TERMO_DE_INTERESSE' ? 'Termo de Interesse' : 'Contrato'} 
                                <span className="text-blue-600 ml-2">#{contrato.numero_contrato || contrato.id}</span>
                            </h2>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${contrato.status_contrato === 'Rascunho' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
                                {contrato.status_contrato}
                            </span>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                            <p>Cliente: <span className="font-medium text-gray-800">{contrato.contato?.nome || contrato.contato?.razao_social || 'NÃO DEFINIDO'}</span></p>
                            <p>Empreendimento: <span className="font-medium text-gray-800">{contrato.empreendimento?.nome}</span></p>
                        </div>
                    </div>
                    
                    <div className="w-full md:w-auto bg-gray-50 p-3 rounded-md border border-gray-100">
                        <label htmlFor="modeloContratoSelect" className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Modelo de Cláusulas</label>
                        <div className="flex items-center gap-2">
                            <select 
                                id="modeloContratoSelect"
                                value={contrato.modelo_contrato_id || ''} 
                                onChange={handleModeloChange}
                                className="w-full md:w-64 p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                disabled={loadingModelos || updateModeloMutation.isPending || modelosContrato.length === 0}
                            >
                                <option value="">{loadingModelos ? 'Carregando...' : (modelosContrato.length === 0 ? 'Nenhum modelo disponível' : '-- Selecione --')}</option>
                                {modelosContrato.map(modelo => (
                                    <option key={modelo.id} value={modelo.id}>
                                        {modelo.nome_modelo}
                                    </option>
                                ))}
                            </select>
                            {updateModeloMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs - Escondido na Impressão */}
            <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor do Contrato" value={kpiData.valorTotal} icon={faFileSignature} color="blue" />
                <KpiCard title="Total Pago" value={kpiData.totalPago} icon={faCheckCircle} color="green" />
                <KpiCard title="Saldo Devedor" value={kpiData.saldoDevedor} icon={faDollarSign} color="yellow" />
                <KpiCard title="Próxima Parcela" value={kpiData.proximaParcela} icon={faCalendarCheck} color="purple" />
            </div>

            {/* ÁREA PRINCIPAL DAS ABAS */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
                
                {/* Menu de Navegação - Escondido na Impressão */}
                <div className="print:hidden border-b border-gray-200 bg-gray-50/50">
                    <nav className="flex gap-1 overflow-x-auto px-2 pt-2 scrollbar-hide">
                        <TabButton tabId="resumo" label="Resumo da Venda" icon={faHandshake} />
                        
                        {contrato.tipo_documento === 'CONTRATO' && (
                            <TabButton tabId="cronograma" label="Plano e Cronograma" icon={faFileInvoiceDollar} /> 
                        )}

                        {/* NOVA ABA: Financeiro / Faturamento */}
                        <TabButton tabId="financeiro" label="Financeiro" icon={faMoneyCheckDollar} />
                        
                        <TabButton tabId="gerador" label="Gerar Documento" icon={faFileContract} disabled={false} />
                        <TabButton tabId="documentos" label="Anexos e Documentos" icon={faFileLines} disabled={false} />
                    </nav>
                </div>

                {/* Conteúdo das Abas - Visível na Impressão */}
                <div className="p-6 min-h-[400px] print:p-0">
                    {activeTab === 'resumo' && (
                        <DetalhesVendaContrato 
                            contratoData={contrato} 
                            onUpdate={refreshContratoData} 
                            user={user} 
                            clientSearchScope={clientSearchScope} 
                        />
                    )}

                    {activeTab === 'cronograma' && isClienteDefined && contrato.tipo_documento === 'CONTRATO' && (
                        <div className="animate-fade-in space-y-8">
                            <div className="print:hidden">
                                <PlanoPagamentoContrato contrato={contrato} onRecalculateSuccess={refreshContratoData} onUpdate={refreshContratoData} /> 
                            </div>
                            <div className="border-t pt-6">
                                <CronogramaFinanceiro
                                    contrato={contrato}
                                    desconto={descontoConcedido}
                                    onUpdate={refreshContratoData}
                                />
                            </div>
                        </div>
                    )}

                    {/* CONTEÚDO DA NOVA ABA FINANCEIRO */}
                    {activeTab === 'financeiro' && isClienteDefined && (
                        <div className="animate-fade-in">
                            <ExtratoFinanceiroCliente contatoId={contrato.contato_id} contrato={contrato} />
                        </div>
                    )}

                    {activeTab === 'gerador' && isClienteDefined && (
                        <div className="animate-fade-in">
                            <GeradorContrato contrato={contrato} modeloContratoId={contrato.modelo_contrato_id} /> 
                        </div>
                    )}
                    {activeTab === 'documentos' && isClienteDefined && (
                        <div className="print:hidden animate-fade-in">
                            <ContratoAnexos contratoId={contrato.id} onUpdate={refreshContratoData} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
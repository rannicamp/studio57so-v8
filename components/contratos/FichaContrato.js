// components/contratos/FichaContrato.js
"use client";

import { useState, useMemo, useEffect, useRef } from 'react'; 
import { createClient } from '../../utils/supabase/client';
// 1. REMOVIDO o useAuth
// import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'; 
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faFileSignature, faSpinner,
    faFileLines, faHandshake, faDollarSign,
    faCheckCircle, faCalendarCheck, faBuilding,
    faFileContract, faLock, faCogs 
} from '@fortawesome/free-solid-svg-icons';

import DetalhesVendaContrato from './DetalhesVendaContrato';
import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import PlanoPagamentoContrato from './PlanoPagamentoContrato';
import KpiCard from '../KpiCard';
import GeradorContrato from './GeradorContrato';

// --- FUNÇÕES DE BUSCA (Inalteradas) ---
const fetchContratoData = async (supabase, contratoId, organizacaoId) => {
    // (Código inalterado)
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
    // (Código inalterado)
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
// --- FIM DAS FUNÇÕES DE BUSCA ---


// 2. ADICIONADAS as props `user` e `clientSearchScope`
export default function FichaContrato({ 
    initialContratoData, 
    user, // <-- Prop obrigatória
    clientSearchScope // <-- Prop obrigatória
}) {
    const supabase = createClient();
    // 3. REMOVIDO useAuth, 'organizacaoId' vem do 'user' da prop
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();
    const hasMounted = useRef(false);

    const [activeTab, setActiveTab] = useState('resumo');

    // (useQuery 'fetchContratoData' inalterado, pois 'organizacaoId' está correto)
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

    // (useEffect de Notificação inalterado)
    useEffect(() => {
        if (hasMounted.current) {
            if (!isRefetching && !isLoadingContrato && !isErrorContrato) {
                toast("Página atualizada!", {
                    description: "Os dados foram sincronizados em segundo plano.",
                    icon: <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                });
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

    // (useQuery 'fetchModelosContrato' inalterado)
    const { data: modelosContrato = [], isLoading: loadingModelos } = useQuery({
        queryKey: ['modelosContratoFicha', contrato?.empreendimento_id, organizacaoId],
        queryFn: () => fetchModelosContrato(supabase, contrato?.empreendimento_id, organizacaoId),
        enabled: !!contrato?.empreendimento_id && !!organizacaoId, 
    });

    // (Funções de formatação inalteradas)
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // (Função 'refreshContratoData' inalterada)
    const refreshContratoData = () => {
        queryClient.invalidateQueries({ queryKey: ['contrato', initialContratoData.id, organizacaoId] }); 
        queryClient.invalidateQueries({ queryKey: ['modelosContratoFicha', contrato?.empreendimento_id, organizacaoId]});
    };
    
    // (useMemo 'descontoConcedido' e 'kpiData' inalterados)
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

    // (useMutation 'updateModeloMutation' e 'handleModeloChange' inalterados)
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

    // (Lógica de Abas 'TabButton' inalterada)
    const isClienteDefined = !!contrato?.contato_id;
    const TabButton = ({ tabId, label, icon, disabled = false }) => {
        const isDisabled = disabled && !isClienteDefined;
        return (
            <button
                onClick={() => !isDisabled && setActiveTab(tabId)}
                disabled={isDisabled}
                title={isDisabled ? "Defina um cliente na aba 'Resumo da Venda' para habilitar" : ""}
                className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-4 transition-colors
                    ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent'}
                    ${isDisabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-500 hover:text-gray-700'
                    }`
                }
            >
                <FontAwesomeIcon icon={isDisabled ? faLock : icon} /> {label}
            </button>
        );
    };

    if (!contrato) {
        return <div className="flex justify-center items-center h-64"><FontAwesomeIcon icon={faSpinner} spin size="3x" /> Carregando...</div>;
    }

    // --- RENDERIZAÇÃO ---
    return (
        <div className="space-y-8">
            {/* Bloco de Header (inalterado) */}
            <div className="print:hidden bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contrato #{contrato.id}</h2>
                        <p className="text-gray-600"><strong>Cliente:</strong> <span className={contrato.contato ? 'font-semibold text-gray-800' : 'font-semibold text-red-500'}>{contrato.contato?.nome || contrato.contato?.razao_social || 'NÃO DEFINIDO'}</span></p>
                        <p className="text-gray-600"><strong>Empreendimento:</strong> {contrato.empreendimento?.nome}</p>
                    </div>
                     <div className='flex flex-col items-end gap-2'>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${contrato.status_contrato === 'Rascunho' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
                            {contrato.status_contrato}
                        </span>
                        <div>
                            <label htmlFor="modeloContratoSelect" className="block text-xs font-medium text-gray-500 mb-1 text-right">Modelo de Cláusulas</label>
                            <select 
                                id="modeloContratoSelect"
                                value={contrato.modelo_contrato_id || ''} 
                                onChange={handleModeloChange}
                                className="p-2 border rounded-md text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                disabled={loadingModelos || updateModeloMutation.isPending || modelosContrato.length === 0}
                            >
                                <option value="">{loadingModelos ? 'Carregando...' : (modelosContrato.length === 0 ? 'Nenhum modelo cadastrado' : '-- Selecione --')}</option>
                                {modelosContrato.map(modelo => (
                                    <option key={modelo.id} value={modelo.id}>
                                        {modelo.nome_modelo}
                                    </option>
                                ))}
                            </select>
                           {updateModeloMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="ml-2 text-gray-500" />}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs (inalterado) */}
            <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor do Contrato" value={kpiData.valorTotal} icon={faFileSignature} colorClass="text-blue-500" />
                <KpiCard title="Total Pago" value={kpiData.totalPago} icon={faCheckCircle} colorClass="text-green-500" />
                <KpiCard title="Saldo Devedor" value={kpiData.saldoDevedor} icon={faDollarSign} colorClass="text-yellow-500" />
                <KpiCard title="Próxima Parcela" value={kpiData.proximaParcela} icon={faCalendarCheck} colorClass="text-purple-500" />
            </div>

            {/* Abas (inalterado) */}
            <div className="print:hidden border-b border-gray-200">
                <nav className="flex gap-4 overflow-x-auto">
                    <TabButton tabId="resumo" label="Resumo da Venda" icon={faHandshake} />
                    <TabButton tabId="cronograma" label="Plano e Cronograma" icon={faFileInvoiceDollar} disabled={true} /> 
                    <TabButton tabId="gerador" label="Gerar Contrato" icon={faFileContract} disabled={true} />
                    <TabButton tabId="documentos" label="Documentos" icon={faFileLines} disabled={true} />
                </nav>
            </div>

            {/* Conteúdo das Abas */}
            <div>
                {activeTab === 'resumo' && (
                    // 4. PASSANDO AS NOVAS PROPS PARA O FILHO
                    <DetalhesVendaContrato 
                        contratoData={contrato} 
                        onUpdate={refreshContratoData} 
                        user={user} // <-- Passa o usuário
                        clientSearchScope={clientSearchScope} // <-- Passa o escopo
                    />
                )}
                {activeTab === 'cronograma' && isClienteDefined && (
                    // (Restante inalterado)
                    <div className="animate-fade-in space-y-6">
                        <div className="print:hidden">
                            <PlanoPagamentoContrato contrato={contrato} onRecalculateSuccess={refreshContratoData} onUpdate={refreshContratoData} /> 
                        </div>
                        <CronogramaFinanceiro
                            contrato={contrato}
                            desconto={descontoConcedido}
                            onUpdate={refreshContratoData}
                        />
                    </div>
                )}
                {activeTab === 'gerador' && isClienteDefined && (
                    <GeradorContrato contrato={contrato} modeloContratoId={contrato.modelo_contrato_id} /> 
                )}
                {activeTab === 'documentos' && isClienteDefined && (
                    <div className="print:hidden animate-fade-in">
                        <ContratoAnexos contratoId={contrato.id} onUpdate={refreshContratoData} />
                    </div>
                )}
            </div>
        </div>
    );
}
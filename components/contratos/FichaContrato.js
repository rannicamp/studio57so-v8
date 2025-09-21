"use client";

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faFileSignature, faSpinner,
    faFileLines, faHandshake, faDollarSign,
    faCheckCircle, faCalendarCheck, faBuilding,
    faFileContract // Ícone corrigido e mais apropriado
} from '@fortawesome/free-solid-svg-icons';

import DetalhesVendaContrato from './DetalhesVendaContrato'; 
import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import PlanoPagamentoContrato from './PlanoPagamentoContrato';
import KpiCard from '../KpiCard';
// A MÁGICA DA CORREÇÃO: A linha abaixo importa o 'export default' de GeradorContrato.
import GeradorContrato from './GeradorContrato'; 

export default function FichaContrato({ initialContratoData }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    const [empreendimentos, setEmpreendimentos] = useState([]);

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    const refreshContratoData = () => {
        queryClient.invalidateQueries({ queryKey: ['contrato', initialContratoData.id] });
    };

    useEffect(() => {
        const fetchEmpreendimentos = async () => {
            if (organizacaoId) {
                const { data } = await supabase.from('empreendimentos').select('id, nome').eq('organizacao_id', organizacaoId).order('nome', { ascending: true });
                setEmpreendimentos(data || []);
            }
        };
        fetchEmpreendimentos();
    }, [supabase, organizacaoId]);

    useEffect(() => {
        setContrato(initialContratoData);
    }, [initialContratoData]);
    
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
    
    const updateFieldMutation = useMutation({
        mutationFn: async ({ fieldName, value }) => {
            const { error } = await supabase.from('contratos').update({ [fieldName]: value }).eq('id', contrato.id);
            if (error) throw error;
        },
        onSuccess: () => { toast.success("Empreendimento selecionado!"); refreshContratoData(); },
        onError: (error) => { toast.error(`Erro: ${error.message}`); }
    });

    const TabButton = ({ tabId, label, icon }) => (
        <button onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-4 transition-colors ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <FontAwesomeIcon icon={icon} /> {label}
        </button>
    );
    
    if (!contrato.empreendimento_id) {
        return (
            <div className="print:hidden bg-white p-8 rounded-lg shadow-md border text-center animate-fade-in">
                <FontAwesomeIcon icon={faBuilding} size="3x" className="text-gray-300 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Primeiro Passo</h2>
                <p className="text-gray-600 mb-6">Para começar, selecione o empreendimento deste contrato.</p>
                <div className="max-w-md mx-auto">
                    <select
                        defaultValue=""
                        onChange={(e) => updateFieldMutation.mutate({ fieldName: 'empreendimento_id', value: e.target.value })}
                        className="w-full p-3 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        disabled={updateFieldMutation.isPending}
                    >
                        <option value="" disabled>Selecione...</option>
                        {empreendimentos.map(emp => <option key={emp.id} value={emp.id}>{emp.nome}</option>)}
                    </select>
                    {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="mt-4 text-gray-500" />}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="print:hidden bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contrato #{contrato.id}</h2>
                        <p className="text-gray-600"><strong>Cliente:</strong> <span className={contrato.contato ? 'font-semibold text-gray-800' : 'font-semibold text-red-500'}>{contrato.contato?.nome || contrato.contato?.razao_social || 'NÃO DEFINIDO'}</span></p>
                        <p className="text-gray-600"><strong>Empreendimento:</strong> {contrato.empreendimento?.nome}</p>
                    </div>
                    <div>
                         <span className={`px-3 py-1 text-sm font-semibold rounded-full ${contrato.status_contrato === 'Rascunho' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}`}>
                             {contrato.status_contrato}
                         </span>
                    </div>
                </div>
            </div>

            <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor do Contrato" value={kpiData.valorTotal} icon={faFileSignature} color="blue" />
                <KpiCard title="Total Pago" value={kpiData.totalPago} icon={faCheckCircle} color="green" />
                <KpiCard title="Saldo Devedor" value={kpiData.saldoDevedor} icon={faDollarSign} color="yellow" />
                <KpiCard title="Próxima Parcela" value={kpiData.proximaParcela} icon={faCalendarCheck} color="purple" />
            </div>

            <div className="print:hidden border-b border-gray-200">
                <nav className="flex gap-4">
                    <TabButton tabId="resumo" label="Resumo da Venda" icon={faHandshake} />
                    <TabButton tabId="cronograma" label="Plano e Cronograma" icon={faFileInvoiceDollar} />
                    <TabButton tabId="gerador" label="Gerar Contrato" icon={faFileContract} />
                    <TabButton tabId="documentos" label="Documentos" icon={faFileLines} />
                </nav>
            </div>

            <div>
                {activeTab === 'resumo' && (
                    <DetalhesVendaContrato contratoData={contrato} onUpdate={refreshContratoData} />
                )}
                {activeTab === 'cronograma' && (
                    <div className="animate-fade-in space-y-6">
                        <div className="print:hidden">
                            <PlanoPagamentoContrato contrato={contrato} onRecalculateSuccess={refreshContratoData} />
                        </div>
                        <CronogramaFinanceiro 
                            contrato={contrato} 
                            desconto={descontoConcedido}
                            onUpdate={refreshContratoData} 
                        />
                    </div>
                )}
                {activeTab === 'gerador' && (
                    <GeradorContrato contrato={contrato} />
                )}
                {activeTab === 'documentos' && (
                    <div className="print:hidden animate-fade-in">
                        <ContratoAnexos contratoId={contrato.id} onUpdate={refreshContratoData} />
                    </div>
                )}
            </div>
        </div>
    );
}
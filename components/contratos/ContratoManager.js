"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileInvoiceDollar, faFileSignature, faIdCard, faSpinner, faPlus,
    faTrash, faSave, faCalculator, faPen, faTimes, faExclamationTriangle,
    faSyncAlt, faHandshake, faUserTie, faDollarSign, faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';
import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import KpiCard from '../KpiCard'; // Importando o KpiCard

// --- COMPONENTE PRINCIPAL (MANAGER) ---
export default function ContratoManager({ initialContratoData, onUpdate }) {
    const supabase = createClient();
    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    const [loading, setLoading] = useState(false);

    // Estado para o campo de corretor
    const [corretores, setCorretores] = useState([]);
    const [selectedCorretorId, setSelectedCorretorId] = useState(initialContratoData.corretor_id || '');

    // Carrega a lista de contatos que podem ser corretores
    useEffect(() => {
        const fetchCorretores = async () => {
            const { data, error } = await supabase
                .from('contatos')
                .select('id, nome, razao_social')
                .in('tipo_contato', ['Parceiro', 'Fornecedor']) // Ajuste os tipos conforme necessário
                .order('nome');
            
            if (error) {
                toast.error('Falha ao carregar lista de corretores.');
            } else {
                setCorretores(data);
            }
        };
        fetchCorretores();
    }, [supabase]);

    useEffect(() => {
        setContrato(initialContratoData);
        setSelectedCorretorId(initialContratoData.corretor_id || '');
    }, [initialContratoData]);
    
    // --- KPIs Calculados ---
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
            proximaParcela: proximaParcela ? `${formatCurrency(proximaParcela.valor_parcela)} em ${new Date(proximaParcela.data_vencimento + 'T00:00:00Z').toLocaleDateString('pt-BR')}` : 'Nenhuma'
        };
    }, [contrato]);
    
    const handleSaveCorretor = async () => {
        setLoading(true);
        const { error } = await supabase
            .from('contratos')
            .update({ corretor_id: selectedCorretorId || null })
            .eq('id', contrato.id);
        
        if (error) {
            toast.error("Erro ao salvar corretor: " + error.message);
        } else {
            toast.success("Corretor atualizado com sucesso!");
            onUpdate();
        }
        setLoading(false);
    };

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const TabButton = ({ tabId, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-4 transition-colors ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );

    return (
        <div className="space-y-8">
            {/* CABEÇALHO DA FICHA */}
            <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contrato #{contrato.id}</h2>
                        <p className="text-gray-600">
                            <strong>Cliente:</strong> {contrato.contato.nome || contrato.contato.razao_social}
                        </p>
                        <p className="text-gray-600">
                            <strong>Produto:</strong> Unidade {contrato.produto.unidade} ({contrato.empreendimento.nome})
                        </p>
                    </div>
                    <div>
                         <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            contrato.status_contrato === 'Ativo' ? 'bg-green-100 text-green-800' : 
                            contrato.status_contrato === 'Quitado' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                         }`}>
                            {contrato.status_contrato}
                        </span>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor do Contrato" value={kpiData.valorTotal} icon={faFileSignature} color="blue" />
                <KpiCard title="Total Pago" value={kpiData.totalPago} icon={faCheckCircle} color="green" />
                <KpiCard title="Saldo Devedor" value={kpiData.saldoDevedor} icon={faDollarSign} color="yellow" />
                <KpiCard title="Próxima Parcela" value={kpiData.proximaParcela} icon={faCalendarCheck} color="purple" />
            </div>

            {/* SISTEMA DE ABAS */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <TabButton tabId="resumo" label="Resumo da Venda" icon={faHandshake} />
                    <TabButton tabId="cronograma" label="Cronograma Financeiro" icon={faFileInvoiceDollar} />
                    <TabButton tabId="documentos" label="Documentos" icon={faFileLines} />
                </nav>
            </div>

            {/* CONTEÚDO DAS ABAS */}
            <div>
                {activeTab === 'resumo' && (
                    <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in space-y-4">
                        <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Data da Venda</label>
                                <p className="text-lg font-semibold">{new Date(contrato.data_venda + 'T00:00:00Z').toLocaleDateString('pt-BR')}</p>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Valor Efetivo da Venda</label>
                                <p className="text-lg font-semibold">{formatCurrency(contrato.valor_final_venda)}</p>
                            </div>
                            <div>
                                <label htmlFor="corretor" className="block text-sm font-medium text-gray-600">Corretor Responsável</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <select 
                                        id="corretor"
                                        value={selectedCorretorId}
                                        onChange={(e) => setSelectedCorretorId(e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                    >
                                        <option value="">-- Nenhum --</option>
                                        {corretores.map(c => (
                                            <option key={c.id} value={c.id}>{c.nome || c.razao_social}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleSaveCorretor}
                                        disabled={loading}
                                        className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                                    >
                                        <FontAwesomeIcon icon={loading ? faSpinner : faSave} spin={loading} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'cronograma' && (
                    <div className="animate-fade-in">
                        <CronogramaFinanceiro 
                            contratoId={contrato.id}
                            initialParcelas={contrato.contrato_parcelas}
                            valorTotalContrato={contrato.valor_final_venda}
                            onUpdate={onUpdate}
                        />
                    </div>
                )}

                {activeTab === 'documentos' && (
                    <div className="animate-fade-in">
                        <ContratoAnexos 
                            contratoId={contrato.id} 
                            onUpdate={onUpdate} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
// --- CORREÇÃO APLICADA AQUI ---
import { 
    faFileInvoiceDollar, faFileSignature, faIdCard, faSpinner, faSave, 
    faCalendarCheck, faUserTie, faDollarSign, faFileLines, faHandshake,
    faCheckCircle // Ícone que estava faltando
} from '@fortawesome/free-solid-svg-icons';

import KpiCard from '../KpiCard';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import ContratoAnexos from './ContratoAnexos';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Subcomponente para a busca de contatos
const ContatoSearch = ({ label, tipo, contatosList, selectedId, onSelect, onSave }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const selectedName = useMemo(() => {
        if (!selectedId) return '';
        const contato = contatosList.find(c => c.id === selectedId);
        return contato ? (contato.nome || contato.razao_social) : '';
    }, [selectedId, contatosList]);

    const filteredContatos = useMemo(() => {
        if (searchTerm.length < 2) return [];
        return contatosList.filter(c => 
            (c.nome?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, contatosList]);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(tipo, selectedId);
        setIsSaving(false);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-600">{label}</label>
            <div className="flex items-center gap-2 mt-1 relative">
                <select
                    value={selectedId || ''}
                    onChange={(e) => onSelect(tipo, e.target.value)}
                    className="w-full p-2 border rounded-md bg-gray-50"
                >
                    <option value="">-- {selectedId ? `Atual: ${selectedName}` : 'Selecione...'} --</option>
                    {contatosList.map(c => (
                        <option key={c.id} value={c.id}>{c.nome || c.razao_social}</option>
                    ))}
                </select>
                <button 
                    onClick={handleSave}
                    disabled={isSaving || !selectedId}
                    className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    title={`Salvar ${label}`}
                >
                    <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} spin={isSaving} />
                </button>
            </div>
             <input
                type="text"
                placeholder={`Digite para buscar ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-1 border rounded-md text-xs mt-1"
            />
        </div>
    );
};

export default function FichaContrato({ initialContratoData, onUpdate }) {
    const supabase = createClient();
    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    
    const [allContatos, setAllContatos] = useState([]);

    useEffect(() => {
        const fetchContatos = async () => {
            const { data } = await supabase.from('contatos').select('id, nome, razao_social').order('nome');
            setAllContatos(data || []);
        };
        fetchContatos();
    }, [supabase]);
    
    useEffect(() => {
        setContrato(initialContratoData);
    }, [initialContratoData]);

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

    const handleFieldUpdate = async (fieldName, value) => {
        const { error } = await supabase
            .from('contratos')
            .update({ [fieldName]: value || null })
            .eq('id', contrato.id);
        
        if (error) {
            toast.error(`Erro ao salvar ${fieldName}: ${error.message}`);
        } else {
            toast.success(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} atualizado com sucesso!`);
            onUpdate();
        }
    };

    const handleSelectChange = (tipo, id) => {
        setContrato(prev => ({...prev, [`${tipo}_id`]: id}));
    };

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
            <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contrato #{contrato.id}</h2>
                        <p className="text-gray-600"><strong>Cliente:</strong> <span className={contrato.contato ? 'font-semibold text-gray-800' : 'font-semibold text-red-500'}>{contrato.contato?.nome || contrato.contato?.razao_social || 'NÃO DEFINIDO'}</span></p>
                        <p className="text-gray-600"><strong>Produto:</strong> Unidade {contrato.produto?.unidade} ({contrato.empreendimento?.nome})</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Valor do Contrato" value={kpiData.valorTotal} icon={faFileSignature} color="blue" />
                <KpiCard title="Total Pago" value={kpiData.totalPago} icon={faCheckCircle} color="green" />
                <KpiCard title="Saldo Devedor" value={kpiData.saldoDevedor} icon={faDollarSign} color="yellow" />
                <KpiCard title="Próxima Parcela" value={kpiData.proximaParcela} icon={faCalendarCheck} color="purple" />
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <TabButton tabId="resumo" label="Resumo da Venda" icon={faHandshake} />
                    <TabButton tabId="cronograma" label="Cronograma Financeiro" icon={faFileInvoiceDollar} />
                    <TabButton tabId="documentos" label="Documentos" icon={faFileLines} />
                </nav>
            </div>

            <div>
                {activeTab === 'resumo' && (
                    <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in space-y-4">
                        <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ContatoSearch label="Comprador" tipo="contato" contatosList={allContatos} selectedId={contrato.contato_id} onSelect={handleSelectChange} onSave={handleFieldUpdate} />
                            <ContatoSearch label="Corretor" tipo="corretor" contatosList={allContatos} selectedId={contrato.corretor_id} onSelect={handleSelectChange} onSave={handleFieldUpdate} />
                        </div>
                    </div>
                )}
                {activeTab === 'cronograma' && (
                    <div className="animate-fade-in">
                        <CronogramaFinanceiro contratoId={contrato.id} initialParcelas={contrato.contrato_parcelas} valorTotalContrato={contrato.valor_final_venda} onUpdate={onUpdate} />
                    </div>
                )}
                {activeTab === 'documentos' && (
                    <div className="animate-fade-in">
                        <ContratoAnexos contratoId={contrato.id} onUpdate={onUpdate} />
                    </div>
                )}
            </div>
        </div>
    );
}
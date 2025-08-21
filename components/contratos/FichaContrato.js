"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileInvoiceDollar, faFileSignature, faIdCard, faSpinner, faSave, 
    faCalendarCheck, faUserTie, faDollarSign, faFileLines, faHandshake,
    faCheckCircle, faTimes
} from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

import KpiCard from '../KpiCard';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import ContratoAnexos from './ContratoAnexos';

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const ContatoSearch = ({ label, tipo, contatosList, selectedId, onSelect, onSave, onClear }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const selectedName = useMemo(() => {
        if (!selectedId) return '';
        const contato = contatosList.find(c => c.id.toString() === selectedId.toString());
        return contato ? (contato.nome || contato.razao_social) : 'Contato não encontrado';
    }, [selectedId, contatosList]);

    useEffect(() => {
        if (selectedId) {
            setSearchTerm(selectedName);
        } else {
            setSearchTerm('');
        }
    }, [selectedId, selectedName]);
    
    const filteredContatos = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        return contatosList.filter(c => 
            (c.nome?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [searchTerm, contatosList]);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(`${tipo}_id`, selectedId);
        setIsSaving(false);
    };
    
    const handleSelect = (contato) => {
        onSelect(tipo, contato.id);
        setSearchTerm(contato.nome || contato.razao_social);
        setIsDropdownOpen(false);
    };
    
    const handleClear = () => {
        setSearchTerm('');
        onClear(tipo);
    };

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-600">{label}</label>
            {selectedId ? (
                <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                    <span className="font-semibold text-gray-800">{selectedName}</span>
                    <div className="flex items-center gap-2">
                         <button type="button" onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 disabled:text-gray-400" title={`Salvar ${label}`}>
                            <FontAwesomeIcon icon={isSaving ? faSpinner : faSave} spin={isSaving} />
                        </button>
                        <button type="button" onClick={handleClear} className="text-red-500 hover:text-red-700" title="Limpar Seleção">
                            <FontAwesomeIcon icon={faTimes}/>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <input type="text" placeholder={`Digite para buscar ${label.toLowerCase()}...`} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} className="mt-1 w-full p-2 border rounded-md" />
                    {isDropdownOpen && filteredContatos.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto mt-1">
                            {filteredContatos.map(c => ( <li key={c.id} onClick={() => handleSelect(c)} className="p-2 hover:bg-gray-100 cursor-pointer"> <HighlightedText text={c.nome || c.razao_social} highlight={searchTerm} /> </li> ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default function FichaContrato({ initialContratoData, onUpdate }) {
    const supabase = createClient();
    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    
    const [allContatos, setAllContatos] = useState([]);
    const [loading, setLoading] = useState({});

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
        setLoading(prev => ({...prev, [fieldName]: true}));
        const { error } = await supabase
            .from('contratos')
            .update({ [fieldName]: value || null })
            .eq('id', contrato.id);
        
        if (error) {
            toast.error(`Erro ao salvar ${fieldName}: ${error.message}`);
        } else {
            toast.success(`${fieldName.replace(/_/g, ' ').replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase())} atualizado!`);
            onUpdate();
        }
        setLoading(prev => ({...prev, [fieldName]: false}));
    };
    
    const handleInputChange = (fieldName, value) => {
        setContrato(prev => ({ ...prev, [fieldName]: value }));
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
                    <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in space-y-6">
                        <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ContatoSearch label="Comprador" tipo="contato" contatosList={allContatos} selectedId={contrato.contato_id} onSelect={(tipo, id) => handleInputChange('contato_id', id)} onSave={handleFieldUpdate} onClear={() => handleInputChange('contato_id', null)} />
                            <ContatoSearch label="Corretor" tipo="corretor" contatosList={allContatos} selectedId={contrato.corretor_id} onSelect={(tipo, id) => handleInputChange('corretor_id', id)} onSave={handleFieldUpdate} onClear={() => handleInputChange('corretor_id', null)} />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Valor Efetivo da Venda</label>
                                <IMaskInput
                                    mask="R$ num"
                                    blocks={{ num: { mask: Number, thousandsSeparator: '.', scale: 2, padFractionalZeros: true, radix: ',', mapToRadix: ['.'] }}}
                                    unmask={true}
                                    value={String(contrato.valor_final_venda || '')}
                                    onAccept={(value) => handleInputChange('valor_final_venda', value)}
                                    onBlur={() => handleFieldUpdate('valor_final_venda', contrato.valor_final_venda)}
                                    className="mt-1 w-full p-2 border rounded-md font-semibold"
                                />
                            </div>
                            {/* --- CAMPO DE DATA DE CELEBRAÇÃO REMOVIDO E DATA DA VENDA ADICIONADO --- */}
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Data da Venda</label>
                                <input type="date" value={contrato.data_venda || ''} onChange={(e) => handleInputChange('data_venda', e.target.value)} onBlur={() => handleFieldUpdate('data_venda', contrato.data_venda)} className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Índice de Reajuste</label>
                                <input type="text" value={contrato.indice_reajuste || ''} onChange={(e) => handleInputChange('indice_reajuste', e.target.value)} onBlur={() => handleFieldUpdate('indice_reajuste', contrato.indice_reajuste)} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: INCC"/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Multa por Atraso (%)</label>
                                <input type="number" step="0.01" value={contrato.multa_inadimplencia_percentual || ''} onChange={(e) => handleInputChange('multa_inadimplencia_percentual', e.target.value)} onBlur={() => handleFieldUpdate('multa_inadimplencia_percentual', contrato.multa_inadimplencia_percentual)} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 2"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Juros de Mora ao Mês (%)</label>
                                <input type="number" step="0.01" value={contrato.juros_mora_inadimplencia_percentual || ''} onChange={(e) => handleInputChange('juros_mora_inadimplencia_percentual', e.target.value)} onBlur={() => handleFieldUpdate('juros_mora_inadimplencia_percentual', contrato.juros_mora_inadimplencia_percentual)} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 1"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Cláusula Penal (%)</label>
                                <input type="number" step="0.01" value={contrato.clausula_penal_percentual || ''} onChange={(e) => handleInputChange('clausula_penal_percentual', e.target.value)} onBlur={() => handleFieldUpdate('clausula_penal_percentual', contrato.clausula_penal_percentual)} className="mt-1 w-full p-2 border rounded-md" placeholder="Ex: 10"/>
                            </div>
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
// Caminho: components/contratos/FichaContrato.js

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Importado useMutation
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileInvoiceDollar, faFileSignature, faSpinner, faSave, 
    faFileLines, faHandshake, faTimes, faCashRegister, faBuilding,
    faPlusCircle, faBalanceScale, faCheckCircle, faCalendarCheck, faDollarSign,
    faCalculator
} from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import PlanoPagamentoContrato from './PlanoPagamentoContrato';
import KpiCard from '../KpiCard';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const SearchableField = ({ label, selectedName, onClear, children }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-600">{label}</label>
            {selectedName ? (
                <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                    <span className="font-semibold text-gray-800">{selectedName}</span>
                    <button type="button" onClick={onClear} className="text-red-500 hover:text-red-700" title="Limpar Seleção">
                        <FontAwesomeIcon icon={faTimes}/>
                    </button>
                </div>
            ) : (
                <div className="mt-1">{children}</div>
            )}
        </div>
    );
};

export default function FichaContrato({ initialContratoData, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth(); // Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    
    const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
    
    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [] });

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    
    // ATUALIZAÇÃO DA REGRA DE DATAS
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    useEffect(() => {
        const fetchRelatedData = async () => {
            if (contrato.empreendimento_id && organizacaoId) {
                // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
                const { data: produtosData } = await supabase
                    .from('produtos_empreendimento')
                    .select('id, unidade, tipo, valor_venda_calculado')
                    .eq('empreendimento_id', contrato.empreendimento_id)
                    .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
                    .eq('status', 'Disponível');
                setProdutosDisponiveis(produtosData || []);
            }
        };
        fetchRelatedData();
    }, [supabase, contrato.empreendimento_id, organizacaoId]);
    
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
            // ATUALIZAÇÃO DA REGRA DE DATAS
            proximaParcela: proximaParcela ? `${formatCurrency(proximaParcela.valor_parcela)} em ${formatDateForDisplay(proximaParcela.data_vencimento)}` : 'Nenhuma'
        };
    }, [contrato]);
    
    // ATUALIZAÇÃO DE PADRÃO (useMutation)
    const updateFieldMutation = useMutation({
        mutationFn: async ({ fieldName, value }) => {
            const { error } = await supabase
                .from('contratos')
                .update({ [fieldName]: value || null })
                .eq('id', contrato.id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Campo atualizado com sucesso!");
            onUpdate(); // Chama a função do pai para recarregar tudo
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        }
    });

    const handleFieldUpdate = (fieldName, value) => {
        updateFieldMutation.mutate({ fieldName, value });
    };

    const handleProductChange = async (newProductId) => {
        const originalProductId = contrato.produto_id;
        const newProduct = produtosDisponiveis.find(p => p.id.toString() === newProductId);
        if (!newProduct || !originalProductId || newProductId == originalProductId) return;

        toast.promise(
            new Promise(async (resolve, reject) => {
                const { error: updateContractError } = await supabase.from('contratos').update({ produto_id: newProductId, valor_final_venda: newProduct.valor_venda_calculado }).eq('id', contrato.id);
                if (updateContractError) return reject(updateContractError);
                await supabase.from('produtos_empreendimento').update({ status: 'Disponível' }).eq('id', originalProductId);
                await supabase.from('produtos_empreendimento').update({ status: 'Vendido' }).eq('id', newProductId);
                resolve("Unidade do contrato alterada com sucesso!");
            }),
            {
                loading: 'Alterando unidade...',
                success: (msg) => { onUpdate(); return msg; },
                error: (err) => `Erro: ${err.message}`
            }
        );
    };

    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) { setSearchResults(prev => ({ ...prev, [type]: [] })); return; }
        // ATUALIZAÇÃO DE SEGURANÇA (organização_id)
        const { data } = await supabase.rpc('buscar_contatos_geral', { 
            p_search_term: term,
            p_organizacao_id: organizacaoId // <-- FILTRO DE SEGURANÇA!
        });
        setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }, [supabase, organizacaoId]);

    const handleSelectContato = (type, contato) => {
        const fieldName = type === 'comprador' ? 'contato_id' : 'corretor_id';
        handleFieldUpdate(fieldName, contato.id);
        setSearchResults(prev => ({ ...prev, [type]: [] }));
        setSearchTerms(prev => ({ ...prev, [type]: '' }));
    };

    const handleClearContato = (type) => {
        const fieldName = type === 'comprador' ? 'contato_id' : 'corretor_id';
        handleFieldUpdate(fieldName, null);
    };

    const TabButton = ({ tabId, label, icon }) => (
        <button onClick={() => setActiveTab(tabId)} className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-4 transition-colors ${activeTab === tabId ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <FontAwesomeIcon icon={icon} /> {label}
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
                     <div>
                        <span className={`px-3 py-1 text-sm font-semibold rounded-full ${contrato.status_contrato === 'Rascunho' ? 'bg-gray-100 text-gray-800' : contrato.status_contrato === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {contrato.status_contrato}
                        </span>
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
                    <TabButton tabId="cronograma" label="Plano e Cronograma" icon={faFileInvoiceDollar} />
                    <TabButton tabId="documentos" label="Documentos" icon={faFileLines} />
                </nav>
            </div>

            <div>
                {activeTab === 'resumo' && (
                    <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in space-y-6">
                        <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>
                        
                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <SearchableField 
                                label="Cliente / Comprador" 
                                selectedName={contrato.contato?.nome || contrato.contato?.razao_social} 
                                onClear={() => handleClearContato('comprador')}
                            >
                                <div className="relative">
                                    <input type="text" value={searchTerms.comprador} onChange={(e) => handleSearchContato('comprador', e.target.value)} placeholder="Buscar cliente..." className="w-full p-2 border rounded-md" />
                                    {searchResults.comprador.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.comprador.map(c => <li key={c.id} onClick={() => handleSelectContato('comprador', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.comprador} /></li>)}</ul>}
                                </div>
                            </SearchableField>

                            <SearchableField 
                                label="Corretor Responsável" 
                                selectedName={contrato.corretor?.nome || contrato.corretor?.razao_social} 
                                onClear={() => handleClearContato('corretor')}
                            >
                               <div className="relative">
                                    <input type="text" value={searchTerms.corretor} onChange={(e) => handleSearchContato('corretor', e.target.value)} placeholder="Buscar corretor..." className="w-full p-2 border rounded-md" />
                                    {searchResults.corretor.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.corretor.map(c => <li key={c.id} onClick={() => handleSelectContato('corretor', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.corretor} /></li>)}</ul>}
                                </div>
                            </SearchableField>
                        </fieldset>

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                            <div>
                                <label className="block text-sm font-medium">Unidade Vinculada</label>
                                <select value={contrato.produto_id || ''} onChange={(e) => handleProductChange(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                    {contrato.produto && <option value={contrato.produto.id}>{contrato.produto.unidade} ({contrato.produto.tipo}) - Atual</option>}
                                    <optgroup label="Unidades Disponíveis">
                                        {produtosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.unidade} ({p.tipo}) - {formatCurrency(p.valor_venda_calculado)}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        </fieldset>

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Data da Venda</label>
                                <input type="date" value={formatDate(contrato.data_venda)} onChange={(e) => setContrato(prev => ({...prev, data_venda: e.target.value}))} onBlur={(e) => handleFieldUpdate('data_venda', e.target.value)} disabled={updateFieldMutation.isPending} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-600">Valor Efetivo da Venda</label>
                                <div className="relative">
                                     <IMaskInput
                                        mask="R$ num"
                                        blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}}
                                        unmask={true}
                                        value={String(contrato.valor_final_venda || '')}
                                        onAccept={(value) => setContrato(prev => ({...prev, valor_final_venda: value}))}
                                        onBlur={(e) => handleFieldUpdate('valor_final_venda', e.target.value.replace(/[^0-9,]/g, '').replace(',', '.'))}
                                        disabled={updateFieldMutation.isPending}
                                        className="mt-1 w-full p-2 border rounded-md"
                                    />
                                    {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-3 text-gray-400"/>}
                                </div>
                            </div>
                        </fieldset>
                    </div>
                )}
                {activeTab === 'cronograma' && (
                    <div className="animate-fade-in space-y-6">
                        <PlanoPagamentoContrato contrato={contrato} onRecalculateSuccess={onUpdate} />
                        <CronogramaFinanceiro
                            contrato={contrato}
                            onUpdate={onUpdate}
                        />
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
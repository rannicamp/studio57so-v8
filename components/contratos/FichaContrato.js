// components/contratos/FichaContrato.js

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFileInvoiceDollar, faFileSignature, faSpinner, faTrash, faPlus,
    faFileLines, faHandshake, faTimes, faDollarSign, faInfoCircle,
    faPlusCircle, faBalanceScale, faCheckCircle, faCalendarCheck, faCalculator
} from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

import ContratoAnexos from './ContratoAnexos';
import CronogramaFinanceiro from './CronogramaFinanceiro';
import PlanoPagamentoContrato from './PlanoPagamentoContrato';
import KpiCard from '../KpiCard';

// ... (Componentes HighlightedText e SearchableField permanecem os mesmos)
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


export default function FichaContrato({ initialContratoData }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [contrato, setContrato] = useState(initialContratoData);
    const [activeTab, setActiveTab] = useState('resumo');
    const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [] });

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    const formatDateForDisplay = (dateStr) => {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // O PORQUÊ: Esta função é chamada para forçar a recarga de todos os dados do contrato.
    // Ela invalida o cache do React Query, que então busca os dados mais recentes do servidor.
    const refreshContratoData = () => {
        queryClient.invalidateQueries(['contrato', contrato.id]);
        // Para simplicidade, podemos também recarregar a página
        window.location.reload();
    };
    
    // O PORQUÊ: Buscamos os produtos disponíveis para serem adicionados ao contrato.
    // A lista exclui os produtos que já estão vinculados a este contrato.
    useEffect(() => {
        const fetchProdutosDisponiveis = async () => {
            if (contrato.empreendimento_id && organizacaoId) {
                const { data: produtosData } = await supabase
                    .from('produtos_empreendimento')
                    .select('id, unidade, tipo, valor_venda_calculado, matricula')
                    .eq('empreendimento_id', contrato.empreendimento_id)
                    .eq('organizacao_id', organizacaoId)
                    .eq('status', 'Disponível');
                
                // Filtra produtos já presentes no contrato
                const idsProdutosNoContrato = contrato.produtos.map(p => p.id);
                setProdutosDisponiveis((produtosData || []).filter(p => !idsProdutosNoContrato.includes(p.id)));
            }
        };
        fetchProdutosDisponiveis();
    }, [supabase, contrato.empreendimento_id, organizacaoId, contrato.produtos]);

    useEffect(() => {
        setContrato(initialContratoData);
    }, [initialContratoData]);
    
    // O PORQUÊ: Calculamos a soma dos valores de tabela de todos os produtos
    // vinculados ao contrato. Este valor é apenas para exibição.
    const somaProdutosTabela = useMemo(() => {
        return (contrato.produtos || []).reduce((sum, p) => sum + parseFloat(p.valor_venda_calculado || 0), 0);
    }, [contrato.produtos]);


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
    
    // O PORQUÊ: Mutation para atualizar campos simples do contrato.
    const updateFieldMutation = useMutation({
        mutationFn: async ({ fieldName, value }) => {
            const { error } = await supabase.from('contratos').update({ [fieldName]: value || null }).eq('id', contrato.id);
            if (error) throw error;
        },
        onSuccess: () => { toast.success("Campo atualizado com sucesso!"); refreshContratoData(); },
        onError: (error) => { toast.error(`Erro ao salvar: ${error.message}`); }
    });

    const handleFieldUpdate = (fieldName, value) => updateFieldMutation.mutate({ fieldName, value });

    // O PORQUÊ: NOVA Mutation para ADICIONAR um produto ao contrato.
    // Ela insere na nova tabela 'contrato_produtos' e atualiza o status do produto.
    const addProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            // Adiciona na tabela de ligação
            const { error: insertError } = await supabase.from('contrato_produtos').insert({
                contrato_id: contrato.id,
                produto_id: produtoId,
                organizacao_id: organizacaoId
            });
            if (insertError) throw insertError;

            // Atualiza status do produto para 'Vendido'
            const { error: updateError } = await supabase.from('produtos_empreendimento').update({ status: 'Vendido' }).eq('id', produtoId);
            if (updateError) throw updateError;
        },
        onSuccess: () => { toast.success("Produto adicionado ao contrato!"); refreshContratoData(); },
        onError: (error) => { toast.error(`Erro ao adicionar produto: ${error.message}`); }
    });

    // O PORQUÊ: NOVA Mutation para REMOVER um produto do contrato.
    // Ela remove da tabela 'contrato_produtos' e devolve o status do produto para 'Disponível'.
    const removeProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            // Remove da tabela de ligação
            const { error: deleteError } = await supabase.from('contrato_produtos').delete().match({ contrato_id: contrato.id, produto_id: produtoId });
            if (deleteError) throw deleteError;

            // Atualiza status do produto para 'Disponível'
            const { error: updateError } = await supabase.from('produtos_empreendimento').update({ status: 'Disponível' }).eq('id', produtoId);
            if (updateError) throw updateError;
        },
        onSuccess: () => { toast.success("Produto removido do contrato!"); refreshContratoData(); },
        onError: (error) => { toast.error(`Erro ao remover produto: ${error.message}`); }
    });


    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) { setSearchResults(prev => ({ ...prev, [type]: [] })); return; }
        const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId });
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
                        {/* O PORQUÊ: Atualizado para mostrar o primeiro produto como referência */}
                        <p className="text-gray-600"><strong>Empreendimento:</strong> {contrato.empreendimento?.nome}</p>
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
                            <SearchableField label="Cliente / Comprador" selectedName={contrato.contato?.nome || contrato.contato?.razao_social} onClear={() => handleClearContato('comprador')}>
                                <div className="relative"><input type="text" value={searchTerms.comprador} onChange={(e) => handleSearchContato('comprador', e.target.value)} placeholder="Buscar cliente..." className="w-full p-2 border rounded-md" />{searchResults.comprador.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.comprador.map(c => <li key={c.id} onClick={() => handleSelectContato('comprador', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.comprador} /></li>)}</ul>}</div>
                            </SearchableField>

                            <SearchableField label="Corretor Responsável" selectedName={contrato.corretor?.nome || contrato.corretor?.razao_social} onClear={() => handleClearContato('corretor')}>
                               <div className="relative"><input type="text" value={searchTerms.corretor} onChange={(e) => handleSearchContato('corretor', e.target.value)} placeholder="Buscar corretor..." className="w-full p-2 border rounded-md" />{searchResults.corretor.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.corretor.map(c => <li key={c.id} onClick={() => handleSelectContato('corretor', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.corretor} /></li>)}</ul>}</div>
                            </SearchableField>
                        </fieldset>
                        
                        {/* ================================================================================= */}
                        {/* INÍCIO DA NOVA SEÇÃO DE PRODUTOS DO CONTRATO                                      */}
                        {/* ================================================================================= */}
                        <fieldset className="space-y-4 pt-6 border-t">
                            <h4 className="text-lg font-semibold text-gray-700">Produtos do Contrato</h4>
                            
                            {contrato.produtos?.length > 0 ? (
                                <ul className="space-y-2">
                                    {contrato.produtos.map(p => (
                                        <li key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
                                            <div>
                                                <p className="font-semibold text-gray-800">{p.unidade} ({p.tipo})</p>
                                                <p className="text-sm text-gray-500">Matrícula: {p.matricula || 'N/A'} - Valor de Tabela: {formatCurrency(p.valor_venda_calculado)}</p>
                                            </div>
                                            <button 
                                                onClick={() => removeProdutoMutation.mutate(p.id)} 
                                                disabled={removeProdutoMutation.isPending}
                                                className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 italic">Nenhum produto vinculado a este contrato.</p>
                            )}

                            <div className="flex items-end gap-4">
                                <div className="flex-grow">
                                    <label className="block text-sm font-medium">Adicionar Produto</label>
                                    <select 
                                        defaultValue=""
                                        onChange={(e) => addProdutoMutation.mutate(e.target.value)}
                                        className="mt-1 w-full p-2 border rounded-md"
                                        disabled={addProdutoMutation.isPending || produtosDisponiveis.length === 0}
                                    >
                                        <option value="" disabled>{produtosDisponiveis.length > 0 ? 'Selecione um produto para adicionar...' : 'Nenhum produto disponível'}</option>
                                        {produtosDisponiveis.map(p => (
                                            <option key={p.id} value={p.id}>{p.unidade} ({p.tipo}) - {formatCurrency(p.valor_venda_calculado)}</option>
                                        ))}
                                    </select>
                                </div>
                                {(addProdutoMutation.isPending || removeProdutoMutation.isPending) && <FontAwesomeIcon icon={faSpinner} spin />}
                            </div>
                        </fieldset>
                        {/* ================================================================================= */}
                        {/* FIM DA NOVA SEÇÃO DE PRODUTOS DO CONTRATO                                         */}
                        {/* ================================================================================= */}

                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Soma dos Produtos (Valor de Tabela)</label>
                                <p className="mt-1 text-lg font-bold text-gray-800 p-2 border rounded-md bg-gray-100">{formatCurrency(somaProdutosTabela)}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Desconto Concedido</label>
                                <p className="mt-1 text-lg font-bold text-red-600 p-2 border rounded-md bg-red-50">{formatCurrency(somaProdutosTabela - (contrato.valor_final_venda || 0))}</p>
                            </div>
                        </fieldset>
                        
                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Data da Venda</label>
                                <input type="date" value={formatDate(contrato.data_venda)} onChange={(e) => setContrato(prev => ({...prev, data_venda: e.target.value}))} onBlur={(e) => handleFieldUpdate('data_venda', e.target.value)} disabled={updateFieldMutation.isPending} className="mt-1 w-full p-2 border rounded-md"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600">Valor Final Negociado da Venda</label>
                                <div className="relative">
                                     <IMaskInput
                                        mask="R$ num"
                                        blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}}
                                        unmask={true}
                                        value={String(contrato.valor_final_venda || '')}
                                        onAccept={(value) => setContrato(prev => ({...prev, valor_final_venda: value}))}
                                        onBlur={(e) => handleFieldUpdate('valor_final_venda', e.target._unmaskedValue)}
                                        disabled={updateFieldMutation.isPending}
                                        className="mt-1 w-full p-2 border rounded-md font-semibold text-blue-600"
                                    />
                                    {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-3 text-gray-400"/>}
                                </div>
                            </div>
                        </fieldset>
                    </div>
                )}
                {activeTab === 'cronograma' && (
                    <div className="animate-fade-in space-y-6">
                        {somaProdutosTabela > 0 && contrato.valor_final_venda > 0 && somaProdutosTabela !== contrato.valor_final_venda && (
                             <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
                                 <div className="flex">
                                     <div className="flex-shrink-0"><FontAwesomeIcon icon={faInfoCircle} className="h-5 w-5 text-yellow-400" /></div>
                                     <div className="ml-3"><p className="text-sm text-yellow-700">O valor final negociado é diferente da soma dos produtos. O cronograma será calculado com base no <strong>valor final negociado</strong>.</p></div>
                                 </div>
                             </div>
                        )}
                        <PlanoPagamentoContrato contrato={contrato} onRecalculateSuccess={refreshContratoData} />
                        <CronogramaFinanceiro contrato={contrato} onUpdate={refreshContratoData} />
                    </div>
                )}
                {activeTab === 'documentos' && (
                    <div className="animate-fade-in">
                        <ContratoAnexos contratoId={contrato.id} onUpdate={refreshContratoData} />
                    </div>
                )}
            </div>
        </div>
    );
}
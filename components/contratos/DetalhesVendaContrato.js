// components/contratos/DetalhesVendaContrato.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${'}'}()|[\]\\]/g, '\\$&')})`, 'gi');
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

export default function DetalhesVendaContrato({ contratoData, onUpdate }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [contrato, setContrato] = useState(contratoData);
    const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '', conjuge: '', representante: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [], conjuge: [], representante: [] });
    const [contasBancarias, setContasBancarias] = useState([]);
    const [loadingContas, setLoadingContas] = useState(true);

    // MUDANÇA: Adicionada verificação para evitar erro se o contrato ainda não carregou.
    if (!contrato) {
        return (
            <div className="flex justify-center items-center p-10 bg-white rounded-lg shadow-md border">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                <span className="ml-4 text-gray-600">Carregando detalhes da venda...</span>
            </div>
        );
    }

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

    useEffect(() => {
        setContrato(contratoData);
    }, [contratoData]);
    
    useEffect(() => {
        const fetchContas = async () => {
            if (!organizacaoId) return;
            setLoadingContas(true);
            const { data, error } = await supabase
                .from('contas_financeiras')
                .select('id, nome, instituicao')
                .eq('organizacao_id', organizacaoId)
                .order('nome');
            
            if (error) {
                console.error("Erro ao buscar contas bancárias:", error);
                toast.error("Erro ao carregar contas bancárias.");
            } else {
                setContasBancarias(data || []);
            }
            setLoadingContas(false);
        };
        fetchContas();
    }, [organizacaoId, supabase]);

    useEffect(() => {
        const fetchProdutosDisponiveis = async () => {
            if (contrato.empreendimento_id && organizacaoId) {
                const { data: produtosData } = await supabase
                    .from('produtos_empreendimento')
                    .select('id, unidade, tipo, valor_venda_calculado, matricula')
                    .eq('empreendimento_id', contrato.empreendimento_id)
                    .eq('organizacao_id', organizacaoId)
                    .eq('status', 'Disponível')
                    .order('unidade', { ascending: true });
                
                const idsProdutosNoContrato = (contrato.produtos || []).map(p => p.id);
                setProdutosDisponiveis((produtosData || []).filter(p => !idsProdutosNoContrato.includes(p.id)));
            }
        };
        fetchProdutosDisponiveis();
    }, [supabase, contrato.empreendimento_id, organizacaoId, contrato.produtos]);

    const somaProdutosTabela = useMemo(() => {
        return (contrato.produtos || []).reduce((sum, p) => sum + parseFloat(p.valor_venda_calculado || 0), 0);
    }, [contrato.produtos]);

    const descontoConcedido = useMemo(() => {
        const valorFinal = parseFloat(contrato.valor_final_venda || 0);
        return somaProdutosTabela > valorFinal ? somaProdutosTabela - valorFinal : 0;
    }, [somaProdutosTabela, contrato.valor_final_venda]);
    
    const updateFieldMutation = useMutation({
        mutationFn: async ({ fieldName, value }) => {
            let valorParaAtualizar = value;

            if (['valor_final_venda', 'percentual_comissao_corretagem'].includes(fieldName)) {
                valorParaAtualizar = parseFloat(String(value).replace(/[^0-9,]/g, '').replace(',', '.')) || null;
            } else if (value === '') {
                valorParaAtualizar = null;
            }
            const { error } = await supabase.from('contratos').update({ [fieldName]: valorParaAtualizar }).eq('id', contrato.id);
            if (error) throw error;
        },
        onSuccess: () => { 
            toast.success("Campo atualizado!");
            onUpdate();
        },
        onError: (error) => { toast.error(`Erro ao salvar: ${error.message}`); }
    });

    const handleFieldUpdate = (fieldName, value) => {
        updateFieldMutation.mutate({ fieldName, value });
    };

    const addProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            const { error: insertError } = await supabase.from('contrato_produtos').insert({ contrato_id: contrato.id, produto_id: produtoId, organizacao_id: organizacaoId });
            if (insertError) throw insertError;
        },
        onSuccess: () => { toast.success("Produto adicionado ao contrato!"); onUpdate(); },
        onError: (error) => { toast.error(`Erro ao adicionar produto: ${error.message}`); }
    });

    const removeProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            const { error: deleteError } = await supabase.from('contrato_produtos').delete().match({ contrato_id: contrato.id, produto_id: produtoId });
            if (deleteError) throw deleteError;
        },
        onSuccess: () => { toast.success("Produto removido do contrato!"); onUpdate(); },
        onError: (error) => { toast.error(`Erro ao remover produto: ${error.message}`); }
    });

    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) { setSearchResults(prev => ({ ...prev, [type]: [] })); return; }
        const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term, p_organizacao_id: organizacaoId });
        setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }, [supabase, organizacaoId]);

    const handleSelectContato = (type, contato) => {
        const fieldNameMap = {
            comprador: 'contato_id',
            corretor: 'corretor_id',
            conjuge: 'conjuge_id',
            representante: 'representante_id'
        };
        const fieldName = fieldNameMap[type];
        handleFieldUpdate(fieldName, contato.id);
        setSearchResults(prev => ({ ...prev, [type]: [] }));
        setSearchTerms(prev => ({ ...prev, [type]: '' }));
    };
    
    const handleClearContato = (type) => {
        const fieldNameMap = {
            comprador: 'contato_id',
            corretor: 'corretor_id',
            conjuge: 'conjuge_id',
            representante: 'representante_id'
        };
        const fieldName = fieldNameMap[type];
        handleFieldUpdate(fieldName, null);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border animate-fade-in space-y-6">
            <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>
            
            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SearchableField label="Cliente / Comprador" selectedName={contrato.contato?.nome || contrato.contato?.razao_social} onClear={() => handleClearContato('comprador')}>
                    <div className="relative"><input type="text" value={searchTerms.comprador} onChange={(e) => handleSearchContato('comprador', e.target.value)} placeholder="Buscar cliente..." className="w-full p-2 border rounded-md" />{searchResults.comprador.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.comprador.map(c => <li key={c.id} onClick={() => handleSelectContato('comprador', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.comprador} /></li>)}</ul>}</div>
                </SearchableField>

                <SearchableField label="Cônjuge / Companheiro(a)" selectedName={contrato.conjuge?.nome || contrato.conjuge?.razao_social} onClear={() => handleClearContato('conjuge')}>
                    <div className="relative"><input type="text" value={searchTerms.conjuge} onChange={(e) => handleSearchContato('conjuge', e.target.value)} placeholder="Buscar contato..." className="w-full p-2 border rounded-md" />{searchResults.conjuge.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.conjuge.map(c => <li key={c.id} onClick={() => handleSelectContato('conjuge', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.conjuge} /></li>)}</ul>}</div>
                </SearchableField>

                <div>
                    <label className="block text-sm font-medium text-gray-600">Regime de Bens</label>
                    <input 
                        type="text" 
                        value={contrato.regime_bens || ''} 
                        onChange={(e) => setContrato(prev => ({...prev, regime_bens: e.target.value}))} 
                        onBlur={(e) => handleFieldUpdate('regime_bens', e.target.value)} 
                        disabled={updateFieldMutation.isPending} 
                        className="mt-1 w-full p-2 border rounded-md"
                        placeholder="Ex: Comunhão Parcial de Bens"
                    />
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <SearchableField label="Representante (se houver)" selectedName={contrato.representante?.nome || contrato.representante?.razao_social} onClear={() => handleClearContato('representante')}>
                    <div className="relative"><input type="text" value={searchTerms.representante} onChange={(e) => handleSearchContato('representante', e.target.value)} placeholder="Buscar contato do representante..." className="w-full p-2 border rounded-md" />{searchResults.representante.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.representante.map(c => <li key={c.id} onClick={() => handleSelectContato('representante', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.representante} /></li>)}</ul>}</div>
                </SearchableField>
                <SearchableField label="Corretor Responsável" selectedName={contrato.corretor?.nome || contrato.corretor?.razao_social} onClear={() => handleClearContato('corretor')}>
                   <div className="relative"><input type="text" value={searchTerms.corretor} onChange={(e) => handleSearchContato('corretor', e.target.value)} placeholder="Buscar corretor..." className="w-full p-2 border rounded-md" />{searchResults.corretor.length > 0 && <ul className="absolute z-20 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">{searchResults.corretor.map(c => <li key={c.id} onClick={() => handleSelectContato('corretor', c)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.corretor} /></li>)}</ul>}</div>
                </SearchableField>
            </fieldset>
            
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

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div>
                    <label className="block text-sm font-medium text-gray-600">Soma dos Produtos (Valor de Tabela)</label>
                    <p className="mt-1 text-lg font-bold text-gray-800 p-2 border rounded-md bg-gray-100">{formatCurrency(somaProdutosTabela)}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600">Desconto Concedido</label>
                    <p className="mt-1 text-lg font-bold text-red-600 p-2 border rounded-md bg-red-50">{formatCurrency(descontoConcedido)}</p>
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
                            onBlur={() => handleFieldUpdate('valor_final_venda', contrato.valor_final_venda)}
                            disabled={updateFieldMutation.isPending}
                            className="mt-1 w-full p-2 border rounded-md font-semibold text-blue-600"
                        />
                        {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-3 text-gray-400"/>}
                    </div>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t">
                <div>
                    <label className="block text-sm font-medium text-gray-600">Percentual da Comissão (%)</label>
                    <IMaskInput
                        mask={Number}
                        scale={2}
                        padFractionalZeros={true}
                        radix=","
                        value={String(contrato.percentual_comissao_corretagem || '').replace('.', ',')}
                        onAccept={(value) => setContrato(prev => ({...prev, percentual_comissao_corretagem: value}))}
                        onBlur={() => handleFieldUpdate('percentual_comissao_corretagem', contrato.percentual_comissao_corretagem)}
                        disabled={updateFieldMutation.isPending}
                        className="mt-1 w-full p-2 border rounded-md"
                        placeholder="Ex: 5,00"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-600">Valor da Comissão (Calculado)</label>
                    <p className="mt-1 text-lg font-bold text-gray-800 p-2 border rounded-md bg-gray-100 h-[42px] flex items-center">
                        {formatCurrency(contrato.valor_comissao_corretagem)}
                    </p>
                </div>
                <div className="md:col-span-3">
                     <label className="block text-sm font-medium text-gray-600">Forma de Pagamento da Comissão</label>
                     <input
                        type="text"
                        value={contrato.forma_pagamento_corretagem || ''}
                        onChange={(e) => setContrato(prev => ({...prev, forma_pagamento_corretagem: e.target.value}))}
                        onBlur={() => handleFieldUpdate('forma_pagamento_corretagem', contrato.forma_pagamento_corretagem)}
                        disabled={updateFieldMutation.isPending}
                        className="mt-1 w-full p-2 border rounded-md"
                        placeholder="Ex: PIX em 3 parcelas"
                    />
                </div>
                <div className="md:col-span-3">
                    <label htmlFor="contaBancariaSelect" className="block text-sm font-medium text-gray-600">
                        Conta Bancária para Pagamentos (Exibida no Contrato)
                    </label>
                    <select
                        id="contaBancariaSelect"
                        value={contrato.conta_bancaria_id || ''}
                        onChange={(e) => handleFieldUpdate('conta_bancaria_id', e.target.value || null)}
                        className="w-full p-2 border rounded-md mt-1"
                        disabled={loadingContas || updateFieldMutation.isPending}
                    >
                        <option value="">{loadingContas ? 'Carregando contas...' : '-- Nenhuma (não exibir no contrato) --'}</option>
                        {contasBancarias.map(conta => (
                            <option key={conta.id} value={conta.id}>{conta.nome} ({conta.instituicao})</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-3">
                     <label className="block text-sm font-medium text-gray-600">Observações do Contrato</label>
                     <textarea
                        value={contrato.observacoes_contrato || ''}
                        onChange={(e) => setContrato(prev => ({...prev, observacoes_contrato: e.target.value}))}
                        onBlur={() => handleFieldUpdate('observacoes_contrato', contrato.observacoes_contrato)}
                        disabled={updateFieldMutation.isPending}
                        className="mt-1 w-full p-2 border rounded-md"
                        rows={3}
                        placeholder="Adicione qualquer cláusula ou observação especial sobre este contrato aqui."
                    />
                </div>
            </fieldset>
        </div>
    );
}
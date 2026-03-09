// components/contratos/DetalhesVendaContrato.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
// 1. REMOVIDO o useAuth - Este componente não deve depender do contexto
// import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrash, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

// --- FUNÇÕES DE BUSCA (Isoladas para useQuery) ---
const fetchContasBancarias = async (supabase, organizacaoId) => {
    // (Código inalterado)
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('contas_financeiras')
        .select('id, nome, instituicao')
        .eq('organizacao_id', organizacaoId)
        .order('nome');
    if (error) {
        console.error("Erro ao buscar contas bancárias:", error);
        toast.error("Erro ao carregar contas bancárias.");
        return [];
    }
    return data || [];
};

const fetchProdutosDisponiveis = async (supabase, empreendimentoId, organizacaoId) => {
    // (Código inalterado)
    if (!empreendimentoId || !organizacaoId) return [];
    const { data, error } = await supabase
        .from('produtos_empreendimento')
        .select('id, unidade, tipo, valor_venda_calculado, matricula')
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId)
        .eq('status', 'Disponível')
        .order('unidade', { ascending: true });
    if (error) {
        console.error("Erro ao buscar produtos:", error);
        toast.error("Erro ao carregar produtos disponíveis.");
        return [];
    }
    return data || [];
};


// --- COMPONENTES AUXILIARES (Inalterados) ---
const HighlightedText = ({ text = '', highlight = '' }) => {
    // (Código inalterado)
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${'}'}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200 px-0 rounded">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const SearchableField = ({ label, selectedName, onClear, children }) => {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">{label}</label>
            {selectedName ? (
                <div className="flex items-center justify-between mt-1 w-full p-2 bg-gray-50 border border-gray-200 rounded-md group transition-all">
                    <span className="font-semibold text-gray-700 text-sm truncate pl-1">{selectedName}</span>
                    <button type="button" onClick={onClear} className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-gray-200 text-red-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" title="Limpar Seleção">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
            ) : (
                <div className="mt-1 relative">{children}</div>
            )}
        </div>
    );
};

// --- COMPONENTE PRINCIPAL ---

// 2. ADICIONADO `user` e `clientSearchScope` nas props
export default function DetalhesVendaContrato({
    contratoData,
    onUpdate,
    user, // <-- Prop obrigatória vinda do "pai"
    clientSearchScope = "organization" // <-- Escopo padrão (organization)
}) {
    const supabase = createClient();
    // 3. O 'organizacaoId' agora vem do 'user' passado como prop
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [contrato, setContrato] = useState(contratoData);
    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '', conjuge: '', representante: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [], conjuge: [], representante: [] });

    useEffect(() => {
        setContrato(contratoData);
    }, [contratoData]);

    // (useQuery para Contas e Produtos inalterado, pois 'organizacaoId' está correto)
    const { data: contasBancarias = [], isLoading: loadingContas } = useQuery({
        queryKey: ['contasBancarias', organizacaoId],
        queryFn: () => fetchContasBancarias(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });
    const { data: todosProdutosDisponiveis = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtosDisponiveisEmpreendimento', contrato?.empreendimento_id, organizacaoId],
        queryFn: () => fetchProdutosDisponiveis(supabase, contrato.empreendimento_id, organizacaoId),
        enabled: !!contrato?.empreendimento_id && !!organizacaoId,
    });

    // (useMemo para filtrar produtos inalterado)
    const idsProdutosNoContrato = useMemo(() => (contrato.produtos || []).map(p => p.id), [contrato.produtos]);
    const produtosDisponiveis = useMemo(() => {
        return todosProdutosDisponiveis.filter(p => !idsProdutosNoContrato.includes(p.id));
    }, [todosProdutosDisponiveis, idsProdutosNoContrato]);

    // (useMemo para soma e desconto inalterados)
    const somaProdutosTabela = useMemo(() => {
        return (contrato?.produtos || []).reduce((sum, p) => sum + parseFloat(p.valor_venda_calculado || 0), 0);
    }, [contrato?.produtos]);
    const descontoConcedido = useMemo(() => {
        const valorFinal = Number(contrato?.valor_final_venda || 0);
        return somaProdutosTabela > valorFinal ? somaProdutosTabela - valorFinal : 0;
    }, [somaProdutosTabela, contrato?.valor_final_venda]);

    // (Mutations inalteradas, pois 'organizacaoId' está correto)
    const updateFieldMutation = useMutation({
        mutationFn: async ({ fieldName, value }) => {
            if (!organizacaoId) throw new Error("Organização não identificada.");
            let valorParaAtualizar = value;
            if (['valor_final_venda', 'percentual_comissao_corretagem'].includes(fieldName)) {
                const valorNumerico = Number(value || 0);
                valorParaAtualizar = isNaN(valorNumerico) ? null : valorNumerico;
            } else if (value === '') {
                valorParaAtualizar = null;
            }
            const { data, error } = await supabase
                .from('contratos')
                .update({ [fieldName]: valorParaAtualizar })
                .eq('id', contrato.id)
                .eq('organizacao_id', organizacaoId)
                .select()
                .single();
            if (error) throw error;
            if (!data) throw new Error("A atualização falhou (0 linhas afetadas). Verifique as permissões (RLS).");
        },
        onSuccess: () => {
            toast.success("Campo atualizado!");
            onUpdate();
        },
        onError: (error) => { toast.error(`Erro ao salvar: ${error.message}`); }
    });
    const addProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            const { error: insertError } = await supabase.from('contrato_produtos').insert({ contrato_id: contrato.id, produto_id: produtoId, organizacao_id: organizacaoId });
            if (insertError) throw insertError;
        },
        onSuccess: () => {
            toast.success("Produto adicionado ao contrato!");
            onUpdate();
        },
        onError: (error) => { toast.error(`Erro ao adicionar produto: ${error.message}`); }
    });
    const removeProdutoMutation = useMutation({
        mutationFn: async (produtoId) => {
            const { error: deleteError } = await supabase.from('contrato_produtos').delete().match({ contrato_id: contrato.id, produto_id: produtoId });
            if (deleteError) throw deleteError;
        },
        onSuccess: () => {
            toast.success("Produto removido do contrato!");
            onUpdate();
        },
        onError: (error) => { toast.error(`Erro ao remover produto: ${error.message}`); }
    });

    // --- 4. A CORREÇÃO DE SEGURANÇA NA BUSCA ---
    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));

        if (term.length < 2 || !organizacaoId) {
            setSearchResults(prev => ({ ...prev, [type]: [] }));
            return;
        }

        // Substituímos o RPC por uma query direta para aplicar o filtro
        let query = supabase
            .from('contatos')
            .select('id, nome, razao_social')
            .or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%`)
            .eq('organizacao_id', organizacaoId);

        // --- A MÁGICA! ---
        // Se o escopo for "user" (Corretor), filtramos pelo ID do usuário
        if (clientSearchScope === 'user' && user?.id) {
            query = query.eq('criado_por_usuario_id', user.id);
        }

        // Se for busca por Corretor, filtramos o tipo de contato
        if (type === 'corretor') {
            query = query.eq('tipo_contato', 'Corretor');
        }

        query = query.limit(10);

        const { data, error } = await query;

        if (error) {
            console.error(`Erro ao buscar contatos (${type}):`, error.message);
            setSearchResults(prev => ({ ...prev, [type]: [] }));
        } else {
            setSearchResults(prev => ({ ...prev, [type]: data || [] }));
        }

    }, [supabase, organizacaoId, user, clientSearchScope]); // Adicionadas as novas dependências
    // --- FIM DA CORREÇÃO ---


    if (!contrato) {
        return (
            <div className="flex justify-center items-center p-10 bg-white rounded-lg shadow-md border">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                <span className="ml-4 text-gray-600">Carregando detalhes da venda...</span>
            </div>
        );
    }

    // (Funções de formatação e handlers inalterados)
    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';

    const handleFieldUpdate = (fieldName, value) => {
        updateFieldMutation.mutate({ fieldName, value });
    };

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
        <div className="animate-fade-in space-y-8">
            <h3 className="text-xl font-bold text-gray-800">Detalhes da Venda</h3>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SearchableField label="Cliente / Comprador" selectedName={contrato.contato?.nome || contrato.contato?.razao_social} onClear={() => handleClearContato('comprador')}>
                    <div className="relative"><input type="text" value={searchTerms.comprador} onChange={(e) => handleSearchContato('comprador', e.target.value)} placeholder="Buscar cliente..." className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />{searchResults.comprador.length > 0 && <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 custom-scrollbar p-1">{searchResults.comprador.map(c => <li key={c.id} onClick={() => handleSelectContato('comprador', c)} className="p-2.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 font-medium"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.comprador} /></li>)}</ul>}</div>
                </SearchableField>
                <SearchableField label="Cônjuge / Companheiro(a)" selectedName={contrato.conjuge?.nome || contrato.conjuge?.razao_social} onClear={() => handleClearContato('conjuge')}>
                    <div className="relative"><input type="text" value={searchTerms.conjuge} onChange={(e) => handleSearchContato('conjuge', e.target.value)} placeholder="Buscar contato..." className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />{searchResults.conjuge.length > 0 && <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 custom-scrollbar p-1">{searchResults.conjuge.map(c => <li key={c.id} onClick={() => handleSelectContato('conjuge', c)} className="p-2.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 font-medium"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.conjuge} /></li>)}</ul>}</div>
                </SearchableField>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Regime de Bens</label>
                    <input type="text" value={contrato.regime_bens || ''} onChange={(e) => setContrato(prev => ({ ...prev, regime_bens: e.target.value }))} onBlur={(e) => handleFieldUpdate('regime_bens', e.target.value)} disabled={updateFieldMutation.isPending} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ex: Comunhão Parcial de Bens" />
                </div>
            </fieldset>
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100">
                <SearchableField label="Representante (se houver)" selectedName={contrato.representante?.nome || contrato.representante?.razao_social} onClear={() => handleClearContato('representante')}>
                    <div className="relative"><input type="text" value={searchTerms.representante} onChange={(e) => handleSearchContato('representante', e.target.value)} placeholder="Buscar representante..." className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />{searchResults.representante.length > 0 && <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 custom-scrollbar p-1">{searchResults.representante.map(c => <li key={c.id} onClick={() => handleSelectContato('representante', c)} className="p-2.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 font-medium"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.representante} /></li>)}</ul>}</div>
                </SearchableField>
                <SearchableField label="Corretor Responsável" selectedName={contrato.corretor?.nome || contrato.corretor?.razao_social} onClear={() => handleClearContato('corretor')}>
                    <div className="relative"><input type="text" value={searchTerms.corretor} onChange={(e) => handleSearchContato('corretor', e.target.value)} placeholder="Buscar corretor..." className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />{searchResults.corretor.length > 0 && <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1 custom-scrollbar p-1">{searchResults.corretor.map(c => <li key={c.id} onClick={() => handleSelectContato('corretor', c)} className="p-2.5 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 font-medium"><HighlightedText text={c.nome || c.razao_social} highlight={searchTerms.corretor} /></li>)}</ul>}</div>
                </SearchableField>
            </fieldset>

            <fieldset className="space-y-4 pt-8 border-t border-gray-100">
                <h4 className="text-sm font-bold text-gray-700">Produtos e Lotes no Contrato</h4>
                {contrato.produtos?.length > 0 ? (
                    <ul className="space-y-3">{contrato.produtos.map(p => (<li key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"><div><p className="font-bold text-gray-800 text-sm">{p.unidade} <span className="text-gray-500 font-medium">({p.tipo})</span></p><p className="text-xs font-semibold text-gray-500 mt-1">Matrícula: {p.matricula || 'N/A'} &bull; Tabela: {formatCurrency(p.valor_venda_calculado)}</p></div><button onClick={() => removeProdutoMutation.mutate(p.id)} disabled={removeProdutoMutation.isPending} className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-gray-200 text-red-500 hover:text-red-700 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"><FontAwesomeIcon icon={faTrash} /></button></li>))}</ul>
                ) : (<p className="text-xs font-semibold text-red-500 p-4 border border-red-200 bg-red-50 rounded-lg">Nenhum produto vinculado a este contrato.</p>)}
                <div className="flex items-end gap-3 pt-2">
                    <div className="flex-grow">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Adicionar Novo Produto</label>
                        <select
                            defaultValue=""
                            onChange={(e) => addProdutoMutation.mutate(e.target.value)}
                            className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors disabled:bg-gray-100"
                            disabled={addProdutoMutation.isPending || loadingProdutos || produtosDisponiveis.length === 0}
                        >
                            <option value="" disabled>
                                {loadingProdutos ? 'Localizando disponíveis...' : (produtosDisponiveis.length > 0 ? 'Selecione um produto...' : 'Nenhum disponível')}
                            </option>
                            {produtosDisponiveis.map(p => (<option key={p.id} value={p.id}>{p.unidade} {p.tipo !== p.unidade && `(${p.tipo})`} &bull; {formatCurrency(p.valor_venda_calculado)}</option>))}
                        </select>
                    </div>
                    {(addProdutoMutation.isPending || removeProdutoMutation.isPending) && <div className="p-2 text-blue-500 flex items-center justify-center"><FontAwesomeIcon icon={faSpinner} spin /></div>}
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-gray-100">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Soma (Valor de Tabela)</label>
                    <p className="w-full p-2 bg-gray-50 border border-gray-200 text-lg font-bold text-gray-600 rounded-md">{formatCurrency(somaProdutosTabela)}</p>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-red-400 uppercase mb-1.5">Desconto Concedido</label>
                    <p className="w-full p-2 bg-red-50 border border-red-100 text-lg font-bold text-red-600 rounded-md">{formatCurrency(descontoConcedido)}</p>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Tipo do Documento</label>
                    <div className="relative">
                        <select
                            value={contrato.tipo_documento || 'TERMO_DE_INTERESSE'}
                            onChange={(e) => {
                                setContrato(prev => ({ ...prev, tipo_documento: e.target.value }));
                                handleFieldUpdate('tipo_documento', e.target.value);
                            }}
                            disabled={updateFieldMutation.isPending}
                            className="w-full p-2 bg-green-50 border border-green-200 text-sm font-bold text-green-800 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500 transition-colors"
                        >
                            <option value="TERMO_DE_INTERESSE">Termo de Interesse</option>
                            <option value="CONTRATO">Contrato (Efetivado)</option>
                        </select>
                        {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-8 top-3 text-green-600" />}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Data da Venda</label>
                    <input type="date" value={formatDate(contrato.data_venda)} onChange={(e) => setContrato(prev => ({ ...prev, data_venda: e.target.value }))} onBlur={(e) => handleFieldUpdate('data_venda', e.target.value)} disabled={updateFieldMutation.isPending} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Valor Final Fechado (Venda)</label>
                    <div className="relative">
                        <IMaskInput
                            mask="R$ num"
                            blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] } }}
                            unmask={'typed'}
                            value={String(contrato.valor_final_venda || '')}
                            onAccept={(value) => setContrato(prev => ({ ...prev, valor_final_venda: value }))}
                            onBlur={() => handleFieldUpdate('valor_final_venda', contrato.valor_final_venda)}
                            disabled={updateFieldMutation.isPending}
                            className="w-full p-2 bg-blue-50 border border-blue-200 text-lg font-bold text-blue-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 transition-colors"
                        />
                        {updateFieldMutation.isPending && <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-3 text-blue-400" />}
                    </div>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Comissão (%)</label>
                    <IMaskInput
                        mask={Number}
                        scale={2}
                        padFractionalZeros={true}
                        radix=","
                        unmask={'typed'}
                        value={String(contrato.percentual_comissao_corretagem || '')}
                        onAccept={(value) => setContrato(prev => ({ ...prev, percentual_comissao_corretagem: value }))}
                        onBlur={() => handleFieldUpdate('percentual_comissao_corretagem', contrato.percentual_comissao_corretagem)}
                        disabled={updateFieldMutation.isPending}
                        className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        placeholder="Ex: 5,00"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Valor Comissão</label>
                    <p className="w-full p-2 bg-gray-100 border border-gray-200 text-sm font-bold text-gray-600 rounded-md flex items-center h-[38px]">
                        {formatCurrency(contrato.valor_comissao_corretagem)}
                    </p>
                </div>

                <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Forma de Pagto da Comissão</label>
                    <input type="text" value={contrato.forma_pagamento_corretagem || ''} onChange={(e) => setContrato(prev => ({ ...prev, forma_pagamento_corretagem: e.target.value }))} onBlur={() => handleFieldUpdate('forma_pagamento_corretagem', contrato.forma_pagamento_corretagem)} disabled={updateFieldMutation.isPending} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ex: PIX recebido em sua totalidade no ato." />
                </div>
                <div className="md:col-span-3">
                    <label htmlFor="contaBancariaSelect" className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Conta para Recebimento</label>
                    <select
                        id="contaBancariaSelect"
                        value={contrato.conta_bancaria_id || ''}
                        onChange={(e) => handleFieldUpdate('conta_bancaria_id', e.target.value || null)}
                        className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                        disabled={loadingContas || updateFieldMutation.isPending}
                    >
                        <option value="">{loadingContas ? 'Carregando contas...' : '-- Nenhuma declarada (Não exibir no contrato)--'}</option>
                        {contasBancarias.map(conta => (<option key={conta.id} value={conta.id}>{conta.nome} ({conta.instituicao})</option>))}
                    </select>
                </div>
                <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Observações Adicionais</label>
                    <textarea value={contrato.observacoes_contrato || ''} onChange={(e) => setContrato(prev => ({ ...prev, observacoes_contrato: e.target.value }))} onBlur={() => handleFieldUpdate('observacoes_contrato', contrato.observacoes_contrato)} disabled={updateFieldMutation.isPending} className="w-full p-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" rows={4} placeholder="Adicione cláusula especial, combinados orais ou termos aqui..." />
                </div>
            </fieldset>
        </div>
    );
}
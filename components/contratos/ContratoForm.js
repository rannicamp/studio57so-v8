"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IMaskInput } from 'react-imask';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${'}'}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

const fetchEmpreendimentos = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .eq('organizacao_id', organizacaoId)
        .order('nome');
    if (error) throw new Error("Falha ao buscar empreendimentos.");
    return data || [];
};

export default function ContratoForm() {
    const supabase = createClient();
    const router = useRouter();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [isSaving, setIsSaving] = useState(false);
    const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
    
    const [formData, setFormData] = useState({
        empreendimento_id: '',
        produto_id: '',
        tipo_documento: 'TERMO_DE_INTERESSE', 
        data_venda: new Date().toISOString().split('T')[0],
        valor_final_venda: '',
        contato_id: null,
        corretor_id: null,
    });

    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [] });
    
    const { data: empreendimentos = [], isLoading: loading } = useQuery({
        queryKey: ['empreendimentosContrato', organizacaoId],
        queryFn: () => fetchEmpreendimentos(supabase, organizacaoId),
        enabled: !!organizacaoId,
    });

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    useEffect(() => {
        const fetchProdutos = async () => {
            if (!formData.empreendimento_id) {
                setProdutosDisponiveis([]);
                setFormData(prev => ({ ...prev, produto_id: '' }));
                return;
            }
            const { data } = await supabase
                .from('produtos_empreendimento')
                .select('id, unidade, tipo, valor_venda_calculado')
                .eq('empreendimento_id', formData.empreendimento_id)
                .eq('status', 'Disponível')
                .order('unidade');
            setProdutosDisponiveis(data || []);
        };
        fetchProdutos();
    }, [formData.empreendimento_id, supabase]);

    useEffect(() => {
        if (formData.produto_id) {
            const produto = produtosDisponiveis.find(p => p.id.toString() === formData.produto_id);
            setFormData(prev => ({ ...prev, valor_final_venda: produto?.valor_venda_calculado || '' }));
        } else {
            setFormData(prev => ({ ...prev, valor_final_venda: '' }));
        }
    }, [formData.produto_id, produtosDisponiveis]);

    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) {
            setSearchResults(prev => ({ ...prev, [type]: [] }));
            return;
        }
        const { data } = await supabase.rpc('buscar_contatos_geral', { 
            p_search_term: term,
            p_organizacao_id: organizacaoId
        });
        setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }, [supabase, organizacaoId]);

    const handleSelectContato = (type, contato) => {
        const fieldName = type === 'comprador' ? 'contato_id' : 'corretor_id';
        setFormData(prev => ({ ...prev, [fieldName]: contato.id }));
        setSearchTerms(prev => ({ ...prev, [type]: contato.nome || contato.razao_social }));
        setSearchResults(prev => ({ ...prev, [type]: [] }));
    };

    const handleClearContato = (type) => {
        const fieldName = type === 'comprador' ? 'contato_id' : 'corretor_id';
        setFormData(prev => ({ ...prev, [fieldName]: null }));
        setSearchTerms(prev => ({ ...prev, [type]: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.produto_id || !formData.contato_id) {
            toast.error("Selecione o Produto e o Comprador.");
            return;
        }
        if (!organizacaoId) {
            toast.error("Erro de segurança: Organização não identificada.");
            return;
        }
        setIsSaving(true);
        
        const promise = new Promise(async (resolve, reject) => {
            // 1. CRIA O CONTRATO COMO RASCUNHO (Correção Solicitada)
            const { data: newContract, error: contractError } = await supabase
                .from('contratos')
                .insert({
                    empreendimento_id: formData.empreendimento_id,
                    contato_id: formData.contato_id,
                    corretor_id: formData.corretor_id,
                    data_venda: formData.data_venda,
                    valor_final_venda: formData.valor_final_venda,
                    tipo_documento: formData.tipo_documento, 
                    status_contrato: 'Rascunho', // <--- MUDANÇA AQUI: Nasce como Rascunho
                    organizacao_id: organizacaoId
                })
                .select('id')
                .single();

            if (contractError) return reject(contractError);
            
            const { error: productLinkError } = await supabase
                .from('contrato_produtos')
                .insert({
                    contrato_id: newContract.id,
                    produto_id: formData.produto_id,
                    organizacao_id: organizacaoId
                });

            if (productLinkError) {
                await supabase.from('contratos').delete().eq('id', newContract.id);
                return reject(productLinkError);
            }
            
            // 2. DEFINE STATUS DA UNIDADE NA CRIAÇÃO
            // Vamos marcar como RESERVADO para garantir que a unidade saia da lista de disponíveis
            // (evita vendas duplicadas). Se o usuário cancelar depois, volta para Disponível.
            await supabase
                .from('produtos_empreendimento')
                .update({ status: 'Reservado' })
                .eq('id', formData.produto_id);
            
            resolve(newContract.id);
        });

        toast.promise(promise, {
            loading: 'Salvando...',
            success: (newContractId) => {
                router.push(`/contratos/${newContractId}`);
                return `Salvo com sucesso!`;
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsSaving(false)
        });
    };

    const renderContatoSearch = (type, label) => {
        const fieldName = type === 'comprador' ? 'contato_id' : 'corretor_id';
        const contatoId = formData[fieldName];
        const searchTerm = searchTerms[type];
        const results = searchResults[type];
        
        return (
            <div className="relative">
                <label className="block text-sm font-medium">{label} *</label>
                {contatoId ? (
                    <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                        <span className="font-semibold text-gray-800">{searchTerm}</span>
                        <button type="button" onClick={() => handleClearContato(type)} className="text-red-500 hover:text-red-700"><FontAwesomeIcon icon={faTimes}/></button>
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => handleSearchContato(type, e.target.value)}
                                placeholder="Digite para buscar..."
                                className="mt-1 w-full p-2 border rounded-md"
                            />
                        </div>
                        {results.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                                {results.map(c => (
                                    <li key={c.id} onClick={() => handleSelectContato(type, c)} className="p-2 hover:bg-gray-100 cursor-pointer">
                                        <HighlightedText text={c.nome || c.razao_social} highlight={searchTerm} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
        );
    };

    if (loading) return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-4">Nova Venda ou Reserva</h2>
            
            <fieldset className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium">Tipo de Documento *</label>
                    <select
                        name="tipo_documento"
                        value={formData.tipo_documento}
                        onChange={handleFormChange}
                        className="mt-1 w-full p-2 border rounded-md bg-blue-50 font-semibold text-blue-800"
                    >
                        <option value="TERMO_DE_INTERESSE">Termo de Interesse (Reserva)</option>
                        <option value="CONTRATO">Contrato de Venda (Venda)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Empreendimento *</label>
                    <select
                        name="empreendimento_id"
                        value={formData.empreendimento_id}
                        onChange={handleFormChange}
                        required
                        className="mt-1 w-full p-2 border rounded-md"
                    >
                        <option value="">-- Escolha --</option>
                        {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">Unidade *</label>
                    <select
                        name="produto_id"
                        value={formData.produto_id}
                        onChange={handleFormChange}
                        required
                        disabled={!formData.empreendimento_id}
                        className="mt-1 w-full p-2 border rounded-md"
                    >
                        <option value="">-- Escolha --</option>
                        {produtosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.unidade} ({p.tipo})</option>)}
                    </select>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                {renderContatoSearch('comprador', 'Cliente / Comprador')}
                {renderContatoSearch('corretor', 'Corretor Responsável')}
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div>
                    <label className="block text-sm font-medium">Data do Registro *</label>
                    <input type="date" name="data_venda" value={formData.data_venda} onChange={handleFormChange} required className="mt-1 w-full p-2 border rounded-md"/>
                </div>
                 <div>
                    <label className="block text-sm font-medium">Valor Negociado (R$) *</label>
                    <IMaskInput
                        mask="R$ num"
                        blocks={{ num: { mask: Number, scale: 2, padFractionalZeros: true, thousandsSeparator: '.', radix: ',', mapToRadix: ['.'] }}}
                        unmask={true}
                        value={String(formData.valor_final_venda || '')}
                        onAccept={(value) => setFormData(prev => ({ ...prev, valor_final_venda: value }))}
                        className="mt-1 w-full p-2 border rounded-md"
                    />
                </div>
            </fieldset>

            <div className="flex justify-end gap-4 pt-6 border-t">
                <button type="button" onClick={() => router.push('/contratos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2">
                    {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Rascunho'}
                </button>
            </div>
        </form>
    );
}
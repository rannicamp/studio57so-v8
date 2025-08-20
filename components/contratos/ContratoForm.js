"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';

// Componente para destacar texto (reutilizado)
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight.trim() || !text) { return <span>{text}</span>; }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (<span>{parts.map((part, i) => regex.test(part) ? <mark key={i} className="bg-yellow-200">{part}</mark> : <span key={i}>{part}</span>)}</span>);
};

export default function ContratoForm() {
    const supabase = createClient();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Dados para os dropdowns
    const [empreendimentos, setEmpreendimentos] = useState([]);
    const [produtosDisponiveis, setProdutosDisponiveis] = useState([]);
    
    // Estado do formulário
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [selectedProdutoId, setSelectedProdutoId] = useState('');
    const [formData, setFormData] = useState({
        data_venda: new Date().toISOString().split('T')[0],
        valor_final_venda: '',
        contato_id: null,
        corretor_id: null,
    });

    // Estados para busca de contatos (comprador e corretor)
    const [searchTerms, setSearchTerms] = useState({ comprador: '', corretor: '' });
    const [searchResults, setSearchResults] = useState({ comprador: [], corretor: [] });
    
    // Carrega dados iniciais
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            const { data: empreendimentosData } = await supabase.from('empreendimentos').select('id, nome').order('nome');
            setEmpreendimentos(empreendimentosData || []);
            setLoading(false);
        };
        fetchInitialData();
    }, [supabase]);

    // Busca produtos quando um empreendimento é selecionado
    useEffect(() => {
        const fetchProdutos = async () => {
            if (!selectedEmpreendimentoId) {
                setProdutosDisponiveis([]);
                return;
            }
            const { data } = await supabase
                .from('produtos_empreendimento')
                .select('id, unidade, tipo, valor_venda_calculado')
                .eq('empreendimento_id', selectedEmpreendimentoId)
                .eq('status', 'Disponível')
                .order('unidade');
            setProdutosDisponiveis(data || []);
        };
        fetchProdutos();
    }, [selectedEmpreendimentoId, supabase]);

    // Atualiza o valor de venda quando um produto é selecionado
    useEffect(() => {
        if (selectedProdutoId) {
            const produto = produtosDisponiveis.find(p => p.id.toString() === selectedProdutoId);
            setFormData(prev => ({ ...prev, valor_final_venda: produto?.valor_venda_calculado || '' }));
        } else {
            setFormData(prev => ({ ...prev, valor_final_venda: '' }));
        }
    }, [selectedProdutoId, produtosDisponiveis]);

    // Busca de contatos (comprador/corretor)
    const handleSearchContato = useCallback(async (type, term) => {
        setSearchTerms(prev => ({ ...prev, [type]: term }));
        if (term.length < 2) {
            setSearchResults(prev => ({ ...prev, [type]: [] }));
            return;
        }
        const { data } = await supabase.rpc('buscar_contatos_geral', { p_search_term: term });
        setSearchResults(prev => ({ ...prev, [type]: data || [] }));
    }, [supabase]);

    const handleSelectContato = (type, contato) => {
        setFormData(prev => ({ ...prev, [`${type}_id`]: contato.id }));
        setSearchTerms(prev => ({ ...prev, [type]: contato.nome || contato.razao_social }));
        setSearchResults(prev => ({ ...prev, [type]: [] }));
    };

    const handleClearContato = (type) => {
        setFormData(prev => ({ ...prev, [`${type}_id`]: null }));
        setSearchTerms(prev => ({ ...prev, [type]: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedProdutoId || !formData.contato_id) {
            toast.error("Selecione o Produto, Comprador e Corretor antes de salvar.");
            return;
        }
        setIsSaving(true);
        
        const promise = new Promise(async (resolve, reject) => {
            const { data: newContract, error: contractError } = await supabase
                .from('contratos')
                .insert({
                    empreendimento_id: selectedEmpreendimentoId,
                    produto_id: selectedProdutoId,
                    contato_id: formData.contato_id,
                    corretor_id: formData.corretor_id,
                    data_venda: formData.data_venda,
                    valor_final_venda: formData.valor_final_venda,
                    status_contrato: 'Em assinatura'
                })
                .select('id')
                .single();

            if (contractError) return reject(contractError);

            const { error: productError } = await supabase
                .from('produtos_empreendimento')
                .update({ status: 'Vendido' })
                .eq('id', selectedProdutoId);

            if (productError) {
                await supabase.from('contratos').delete().eq('id', newContract.id); // Reverte
                return reject(productError);
            }
            resolve(newContract.id);
        });

        toast.promise(promise, {
            loading: 'Criando contrato...',
            success: (newContractId) => {
                router.push(`/contratos/${newContractId}`);
                return `Contrato #${newContractId} criado com sucesso!`;
            },
            error: (err) => `Erro: ${err.message}`,
            finally: () => setIsSaving(false)
        });
    };

    const renderContatoSearch = (type, label) => {
        const contatoId = formData[`${type}_id`];
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
                            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => handleSearchContato(type, e.target.value)}
                                placeholder="Digite para buscar..."
                                className="mt-1 w-full p-2 pl-10 border rounded-md"
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

    if (loading) {
        return <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></div>
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b pb-4">Detalhes da Venda</h2>
            
            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium">1. Selecione o Empreendimento *</label>
                    <select
                        value={selectedEmpreendimentoId}
                        onChange={(e) => { setSelectedEmpreendimentoId(e.target.value); setSelectedProdutoId(''); }}
                        required
                        className="mt-1 w-full p-2 border rounded-md"
                    >
                        <option value="">-- Escolha --</option>
                        {empreendimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium">2. Selecione a Unidade *</label>
                    <select
                        value={selectedProdutoId}
                        onChange={(e) => setSelectedProdutoId(e.target.value)}
                        required
                        disabled={!selectedEmpreendimentoId}
                        className="mt-1 w-full p-2 border rounded-md"
                    >
                        <option value="">-- Escolha --</option>
                        {produtosDisponiveis.map(p => <option key={p.id} value={p.id}>{p.unidade} ({p.tipo})</option>)}
                    </select>
                </div>
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                {renderContatoSearch('comprador', '3. Comprador')}
                {renderContatoSearch('corretor', '4. Corretor Responsável')}
            </fieldset>

            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div>
                    <label className="block text-sm font-medium">5. Data da Venda *</label>
                    <input
                        type="date"
                        value={formData.data_venda}
                        onChange={(e) => setFormData(prev => ({...prev, data_venda: e.target.value}))}
                        required
                        className="mt-1 w-full p-2 border rounded-md"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium">6. Valor Final da Venda (R$) *</label>
                    <input
                        type="number"
                        step="0.01"
                        value={formData.valor_final_venda}
                        onChange={(e) => setFormData(prev => ({...prev, valor_final_venda: e.target.value}))}
                        required
                        className="mt-1 w-full p-2 border rounded-md"
                    />
                </div>
            </fieldset>

            <div className="flex justify-end gap-4 pt-6 border-t">
                <button type="button" onClick={() => router.push('/contratos')} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                    Cancelar
                </button>
                <button type="submit" disabled={isSaving} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                    {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Criar Contrato e Vender'}
                </button>
            </div>
        </form>
    );
}
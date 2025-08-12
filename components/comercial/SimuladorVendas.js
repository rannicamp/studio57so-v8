"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSave, faCalculator, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';

const formatCurrency = (value) => {
    if (value == null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Componente de Seleção de Contatos (sem biblioteca externa)
const ContatoSelector = ({ onSelect, initialValue }) => {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (initialValue) {
            setSearchTerm(initialValue.label);
        }
    }, [initialValue]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowResults(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const handleSearch = async (term) => {
        setSearchTerm(term);
        if (term.length < 2) {
            setResults([]);
            setShowResults(false);
            return;
        }
        setIsLoading(true);
        setShowResults(true);
        const { data } = await supabase.from('contatos').select('id, nome, razao_social').or(`nome.ilike.%${term}%,razao_social.ilike.%${term}%`).limit(10);
        setResults(data || []);
        setIsLoading(false);
    };

    const handleSelect = (contato) => {
        onSelect({ value: contato.id, label: contato.nome || contato.razao_social });
        setSearchTerm(contato.nome || contato.razao_social);
        setShowResults(false);
    };

    const handleCreate = async () => {
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('contatos')
            .insert({ nome: searchTerm, tipo_contato: 'Lead' })
            .select('id, nome')
            .single();
        setIsLoading(false);

        if (error) {
            toast.error("Erro ao criar contato: " + error.message);
        } else {
            toast.success(`Contato "${searchTerm}" criado!`);
            handleSelect(data);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setShowResults(true)}
                placeholder="Digite para buscar ou criar um cliente..."
                className="w-full p-2 border rounded-md"
            />
            {showResults && (
                <div className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1">
                    {isLoading ? (
                        <div className="p-2 text-center text-gray-500">Buscando...</div>
                    ) : (
                        <ul className="max-h-60 overflow-y-auto">
                            {results.map(contact => (
                                <li key={contact.id} onClick={() => handleSelect(contact)} className="p-2 hover:bg-gray-100 cursor-pointer">
                                    {contact.nome || contact.razao_social}
                                </li>
                            ))}
                            {results.length === 0 && searchTerm.length > 1 && (
                                <li className="p-2">
                                    <button type="button" onClick={handleCreate} className="w-full text-left text-blue-600 font-semibold flex items-center gap-2 p-2 hover:bg-blue-50 rounded-md">
                                        <FontAwesomeIcon icon={faPlus} /> Criar novo contato: &quot;{searchTerm}&quot;
                                    </button>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};


export default function SimuladorVendas() {
    const supabase = createClient();
    const { user } = useAuth();
    const { selectedEmpreendimento } = useEmpreendimento();

    const [produtos, setProdutos] = useState([]);
    const [selectedContato, setSelectedContato] = useState(null);
    const [selectedProduto, setSelectedProduto] = useState(null);
    
    const [plano, setPlano] = useState({
        desconto_percentual: 0,
        entrada_percentual: 20,
        num_parcelas_entrada: 3,
        parcelas_obra_percentual: 40,
        num_parcelas_obra: 36,
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            let productQuery = supabase
                .from('produtos_empreendimento')
                .select('*, empreendimento:empreendimentos(nome)')
                .eq('status', 'Disponível');

            if (selectedEmpreendimento && selectedEmpreendimento !== 'all') {
                productQuery = productQuery.eq('empreendimento_id', selectedEmpreendimento);
            }

            const { data: produtosData, error } = await productQuery.order('unidade');
            
            if(error){
                    toast.error("Erro ao carregar produtos: " + error.message);
            } else {
                    setProdutos(produtosData || []);
            }
            setLoading(false);
        };
        fetchProducts();
    }, [supabase, selectedEmpreendimento]);

    const handleSaveSimulacao = async () => {
        if (!selectedContato || !selectedProduto) {
            toast.error("Selecione um cliente e um produto para salvar a simulação.");
            return;
        }

        const dados_simulacao = {
            produto_id: selectedProduto.id,
            valor_venda: selectedProduto.valor_venda_calculado,
            plano_pagamento: plano
        };

        toast.promise(
            supabase.from('simulacoes').insert({
                contato_id: selectedContato.value,
                empreendimento_id: selectedProduto.empreendimento_id,
                usuario_id: user.id,
                dados_simulacao: dados_simulacao,
                status: 'Em negociação'
            }),
            {
                loading: 'Salvando simulação...',
                success: 'Simulação salva com sucesso!',
                error: (err) => `Erro ao salvar: ${err.message}`
            }
        );
    };
    
    const handlePlanoChange = (e) => {
        const { name, value } = e.target;
        setPlano(prev => ({...prev, [name]: parseFloat(value) || 0 }));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Criar Nova Simulação de Pagamento</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                <div>
                    <label className="block text-sm font-medium mb-1">Cliente</label>
                    <ContatoSelector
                        onSelect={(option) => setSelectedContato(option)}
                        initialValue={selectedContato}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Produto</label>
                    <select 
                        onChange={(e) => setSelectedProduto(produtos.find(p => p.id == e.target.value))} 
                        className="w-full p-2 border rounded-md" 
                        disabled={loading}
                    >
                        <option value="">
                            {loading ? 'Carregando produtos...' : (produtos.length > 0 ? 'Selecione um produto' : 'Nenhum produto disponível para este filtro')}
                        </option>
                        {produtos.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.empreendimento.nome} - Unidade {p.unidade} - {formatCurrency(p.valor_venda_calculado)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedProduto && (
                <div className="p-4 border rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">Condições de Pagamento</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className="block text-sm font-medium">Desconto (%)</label><input type="number" name="desconto_percentual" value={plano.desconto_percentual} onChange={handlePlanoChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Entrada (%)</label><input type="number" name="entrada_percentual" value={plano.entrada_percentual} onChange={handlePlanoChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Nº Parcelas Entrada</label><input type="number" name="num_parcelas_entrada" value={plano.num_parcelas_entrada} onChange={handlePlanoChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div></div>
                        <div><label className="block text-sm font-medium">Parcelas Obra (%)</label><input type="number" name="parcelas_obra_percentual" value={plano.parcelas_obra_percentual} onChange={handlePlanoChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium">Nº Parcelas Obra</label><input type="number" name="num_parcelas_obra" value={plano.num_parcelas_obra} onChange={handlePlanoChange} className="mt-1 w-full p-2 border rounded-md" /></div>
                    </div>
                </div>
            )}

            <div className="flex justify-end">
                <button 
                    onClick={handleSaveSimulacao} 
                    disabled={!selectedContato || !selectedProduto || loading} 
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={loading ? faSpinner : faSave} spin={loading} />
                    Salvar Simulação
                </button>
            </div>
        </div>
    );
}
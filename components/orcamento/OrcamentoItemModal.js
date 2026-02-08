'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faPlus, faDatabase, faBuilding } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useDebounce } from 'use-debounce'; 

// Componente auxiliar para destacar o texto buscado
const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight || !text) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 px-0 py-0 rounded">{part}</mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

export default function OrcamentoItemModal({ isOpen, onClose, onSave, etapas, itemToEdit, organizacaoId }) {
    const supabase = createClient();
    const isEditing = Boolean(itemToEdit?.id);
    const subetapaInputRef = useRef(null);

    // --- ESTADOS ---
    
    // Estado inicial do formulário
    const getInitialState = useCallback(() => ({
        id: null,
        material_id: null,
        sinapi_id: null,
        descricao: '',
        quantidade: 1,
        unidade: 'UN',
        preco_unitario: 0,
        etapa_id: '',
        subetapa_id: '',
    }), []);

    const [formData, setFormData] = useState(getInitialState());
    
    // Controle de Busca e Exibição
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Seletor de Banco de Dados: 'sinapi' ou 'proprio'
    // Se estiver editando, tentamos adivinhar a origem, senão padrão é 'sinapi'
    const [bancoOrigem, setBancoOrigem] = useState('sinapi'); 

    // Debounce para evitar muitas requisições enquanto digita (500ms)
    const [debouncedSearchTerm] = useDebounce(searchTerm, 500);

    // Estados para Subetapas (Dropdown inteligente)
    const [subetapaSearch, setSubetapaSearch] = useState('');
    const [filteredSubetapas, setFilteredSubetapas] = useState([]);
    const [showSubetapaDropdown, setShowSubetapaDropdown] = useState(false);

    // --- EFEITOS (USEEFFECT) ---

    // 1. Carregar dados ao abrir o Modal
    useEffect(() => {
        if (isOpen) {
            if (itemToEdit) {
                setFormData({
                    ...itemToEdit,
                    etapa_id: itemToEdit.etapa_id || '',
                    subetapa_id: itemToEdit.subetapa_id || ''
                });

                // Tenta definir a origem visualmente baseada nos dados do item
                if (itemToEdit.sinapi_id) {
                    setBancoOrigem('sinapi');
                } else if (itemToEdit.material_id) {
                    setBancoOrigem('proprio');
                }
            } else {
                setFormData(getInitialState());
                setSearchTerm('');
                setSearchResults([]);
                setBancoOrigem('sinapi'); // Padrão para novos itens
            }
        }
    }, [isOpen, itemToEdit, getInitialState]);

    // 2. Busca Inteligente de Materiais (Carregamento Mágico)
    useEffect(() => {
        const searchMateriais = async () => {
            // Só busca se tiver 3 ou mais letras
            if (!debouncedSearchTerm || debouncedSearchTerm.length < 3) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Define qual tabela buscar baseado na escolha do botão
                const tabelaAlvo = bancoOrigem === 'sinapi' ? 'sinapi' : 'materiais';
                
                let query = supabase
                    .from(tabelaAlvo)
                    .select('id, nome, descricao, preco_unitario, unidade_medida, "Origem", "Código da Composição"')
                    .ilike('descricao', `%${debouncedSearchTerm}%`)
                    .limit(20);

                // Se for banco próprio, FILTRA pela organização. 
                // SINAPI é público, então traz tudo.
                if (bancoOrigem === 'proprio' && organizacaoId) {
                   query = query.eq('organizacao_id', organizacaoId);
                }

                const { data, error } = await query;

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error('Erro ao buscar materiais:', error);
                toast.error('Erro ao buscar materiais. Tente novamente.');
            } finally {
                setIsSearching(false);
            }
        };

        searchMateriais();
    }, [debouncedSearchTerm, bancoOrigem, supabase, organizacaoId]);

    // 3. Filtragem de Subetapas baseada na Etapa selecionada
    useEffect(() => {
        if (!formData.etapa_id) {
            setFilteredSubetapas([]);
            return;
        }

        const etapaSelecionada = etapas.find(e => e.id == formData.etapa_id);
        if (etapaSelecionada?.subetapas) {
            const filtered = etapaSelecionada.subetapas.filter(sub =>
                sub.nome.toLowerCase().includes(subetapaSearch.toLowerCase())
            );
            setFilteredSubetapas(filtered);
        }
    }, [formData.etapa_id, subetapaSearch, etapas]);

    // --- HANDLERS (FUNÇÕES DE AÇÃO) ---

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Quando o usuário clica em um item da lista de busca
    const handleMaterialSelect = (material) => {
        // Atualiza o formulário com os dados do item selecionado
        setFormData(prev => ({
            ...prev,
            material_id: material.id, // Guardamos o ID temporariamente aqui, no save decidimos a coluna
            descricao: material.descricao || material.nome, 
            unidade: material.unidade_medida,
            preco_unitario: material.preco_unitario,
        }));
        
        setSearchTerm(''); // Limpa a busca para fechar a lista
        setSearchResults([]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Lógica para Criar Nova Subetapa (se digitou uma que não existe)
            let finalSubetapaId = formData.subetapa_id;

            if (!finalSubetapaId && subetapaSearch && formData.etapa_id) {
                const { data: newSub, error: subError } = await supabase
                    .from('subetapas')
                    .insert([{
                        nome: subetapaSearch,
                        etapa_id: formData.etapa_id,
                        organizacao_id: organizacaoId
                    }])
                    .select()
                    .single();

                if (subError) throw subError;
                finalSubetapaId = newSub.id;
            }

            // Preparação do Objeto para Salvar
            const itemPayload = {
                orcamento_id: formData.orcamento_id, // Mantém o ID do orçamento pai (se vier da edição)
                descricao: formData.descricao,
                quantidade: parseFloat(formData.quantidade),
                unidade: formData.unidade,
                preco_unitario: parseFloat(formData.preco_unitario),
                etapa_id: formData.etapa_id,
                subetapa_id: finalSubetapaId,
                organizacao_id: organizacaoId,
                custo_total: (parseFloat(formData.quantidade) * parseFloat(formData.preco_unitario))
            };

            // A MÁGICA DOS DOIS BANCOS:
            // Se estamos no modo SINAPI, salvamos o ID na coluna sinapi_id
            // Se estamos no modo PRÓPRIO, salvamos na coluna material_id
            if (bancoOrigem === 'sinapi') {
                itemPayload.sinapi_id = formData.material_id; // O ID selecionado vai para cá
                itemPayload.material_id = null;               // Garante que o outro fique nulo
            } else {
                itemPayload.material_id = formData.material_id; // O ID selecionado vai para cá
                itemPayload.sinapi_id = null;                   // Garante que o outro fique nulo
            }
            
            // Envia para o componente pai salvar no banco
            await onSave(itemPayload);
            onClose();
        } catch (error) {
            console.error("Erro no handleSave:", error);
            toast.error("Erro ao salvar item. Verifique os dados.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                
                {/* Cabeçalho do Modal */}
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                    <h3 className="text-xl font-bold text-gray-800">
                        {isEditing ? 'Editar Item' : 'Adicionar Novo Item'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <FontAwesomeIcon icon={faTimes} size="lg" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    
                    {/* --- ÁREA DE BUSCA INTELIGENTE (Só aparece se não estiver editando) --- */}
                    {!isEditing && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-sm font-bold text-blue-800 mb-2">
                                Fonte de Dados (Onde buscar?)
                            </label>
                            
                            {/* Botões de Alternância (Toggle) */}
                            <div className="flex gap-4 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setBancoOrigem('sinapi')}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
                                        ${bancoOrigem === 'sinapi' 
                                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
                                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <FontAwesomeIcon icon={faDatabase} />
                                    Base SINAPI
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBancoOrigem('proprio')}
                                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2
                                        ${bancoOrigem === 'proprio' 
                                            ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300' 
                                            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                                >
                                    <FontAwesomeIcon icon={faBuilding} />
                                    Meus Materiais
                                </button>
                            </div>

                            {/* Campo de Busca */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={bancoOrigem === 'sinapi' ? "Digite nome do serviço SINAPI ou código..." : "Busque em seus materiais..."}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-3 text-gray-400">
                                        <FontAwesomeIcon icon={faSpinner} spin />
                                    </div>
                                )}
                            </div>

                            {/* Lista de Resultados */}
                            {searchResults.length > 0 && (
                                <ul className="mt-2 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg divide-y divide-gray-100">
                                    {searchResults.map((item) => (
                                        <li 
                                            key={item.id} 
                                            onClick={() => handleMaterialSelect(item)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                                        >
                                            <div className="font-semibold text-gray-800 group-hover:text-blue-700">
                                                <HighlightedText text={item.descricao} highlight={debouncedSearchTerm} />
                                            </div>
                                            <div className="text-xs text-gray-500 flex justify-between mt-1">
                                                <span>{item.unidade_medida} | Cód: {item['Código da Composição'] || item.id}</span>
                                                <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.preco_unitario)}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* --- FORMULÁRIO DE DETALHES --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Descrição (Ocupa 2 colunas) */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Descrição do Item</label>
                            <textarea
                                name="descricao"
                                rows="2"
                                value={formData.descricao}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        {/* Seleção de Etapa */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Etapa</label>
                            <select
                                name="etapa_id"
                                value={formData.etapa_id}
                                onChange={(e) => {
                                    handleChange(e);
                                    setSubetapaSearch(''); 
                                    setFormData(prev => ({ ...prev, subetapa_id: '' }));
                                }}
                                required
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white"
                            >
                                <option value="">Selecione uma etapa</option>
                                {etapas.map(etapa => (
                                    <option key={etapa.id} value={etapa.id}>{etapa.nome}</option>
                                ))}
                            </select>
                        </div>

                        {/* Seleção de Subetapa (Com Criar Nova) */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700">Subetapa</label>
                            <div className="relative">
                                <input
                                    ref={subetapaInputRef}
                                    type="text"
                                    placeholder={formData.etapa_id ? "Selecione ou digite para criar..." : "Selecione uma etapa primeiro"}
                                    value={subetapaSearch}
                                    disabled={!formData.etapa_id}
                                    onFocus={() => setShowSubetapaDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowSubetapaDropdown(false), 200)} 
                                    onChange={(e) => {
                                        setSubetapaSearch(e.target.value);
                                        setShowSubetapaDropdown(true);
                                        if (e.target.value === '') setFormData(prev => ({ ...prev, subetapa_id: '' }));
                                    }}
                                    className="mt-1 w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
                                />
                                {formData.subetapa_id && (
                                     <button 
                                        type="button"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, subetapa_id: '' }));
                                            setSubetapaSearch('');
                                        }}
                                        className="absolute right-2 top-3 text-gray-400 hover:text-red-500"
                                        title="Limpar subetapa"
                                     >
                                        <FontAwesomeIcon icon={faTimes} />
                                     </button>
                                )}
                            </div>

                            {/* Dropdown Flutuante de Subetapas */}
                            {showSubetapaDropdown && formData.etapa_id && (
                                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {filteredSubetapas.map(sub => (
                                        <li
                                            key={sub.id}
                                            onMouseDown={() => {
                                                setFormData(prev => ({ ...prev, subetapa_id: sub.id }));
                                                setSubetapaSearch(sub.nome);
                                                setShowSubetapaDropdown(false);
                                            }}
                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                        >
                                            {sub.nome}
                                        </li>
                                    ))}
                                    {/* Opção de Criar Nova */}
                                    {subetapaSearch && !filteredSubetapas.some(s => s.nome.toLowerCase() === subetapaSearch.toLowerCase()) && (
                                        <li className="px-4 py-2 bg-green-50 hover:bg-green-100 cursor-pointer flex items-center gap-2 text-green-700 border-t border-green-100">
                                            <FontAwesomeIcon icon={faPlus} />
                                            <span>Criar nova: <strong>{subetapaSearch}</strong></span>
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>

                        {/* Quantidade */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Quantidade</label>
                            <input
                                type="number"
                                name="quantidade"
                                min="0"
                                step="0.01"
                                value={formData.quantidade}
                                onChange={handleChange}
                                required
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                            />
                        </div>

                        {/* Preço Unitário */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Preço Unitário</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-500 font-medium">R$</span>
                                <input
                                    type="number"
                                    name="preco_unitario"
                                    min="0"
                                    step="0.01"
                                    value={formData.preco_unitario}
                                    onChange={handleChange}
                                    className="mt-1 w-full pl-8 p-2 border border-gray-300 rounded-md"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rodapé com Botões */}
                    <div className="flex justify-end gap-4 pt-4 border-t mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2 shadow-sm"
                        >
                            {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : null}
                            {isEditing ? 'Atualizar Item' : 'Adicionar Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
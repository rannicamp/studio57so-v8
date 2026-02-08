// components/PedidoItemModal.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faPenToSquare, faTimes } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

const HighlightedText = ({ text = '', highlight = '' }) => {
    if (!highlight || !text || !highlight.trim()) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <mark key={i} className="bg-yellow-200 px-0 py-0 rounded">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const fetchEtapas = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data, error } = await supabase
        .from('etapa_obra')
        .select('id, nome_etapa, codigo_etapa')
        .eq('organizacao_id', organizacaoId)
        .order('codigo_etapa');

    if (error) {
        toast.error("Erro ao buscar etapas da obra.");
        throw new Error(error.message);
    }
    return data || [];
};

const fetchSubetapas = async (supabase, etapaId, organizacaoId) => {
    if (!etapaId || !organizacaoId) return [];
    
    const { data, error } = await supabase
        .from('subetapas')
        .select('id, nome_subetapa')
        .eq('etapa_id', etapaId)
        .eq('organizacao_id', organizacaoId)
        .order('nome_subetapa');

    if (error) {
        toast.error("Erro ao buscar subetapas.");
        throw new Error(error.message);
    }
    return data || [];
};

const getInitialState = () => ({
    id: null,
    material_id: null,
    descricao_item: '',
    quantidade_solicitada: 1,
    unidade_medida: 'unid.',
    etapa_id: '',
    subetapa_id: '', 
    fornecedor_id: null,
    fornecedor_nome: '',
    preco_unitario_real: '',
    tipo_operacao: 'Compra',
    dias_aluguel: null
});

export default function PedidoItemModal({ isOpen, onClose, onSave, itemToEdit }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const isEditing = Boolean(itemToEdit);
    
    const [filteredSubetapas, setFilteredSubetapas] = useState([]);
    const [subetapaSearch, setSubetapaSearch] = useState('');
    const [isSubetapaDropdownOpen, setIsSubetapaDropdownOpen] = useState(false);
    
    const [item, setItem] = useState(getInitialState);
    const [isItemSelected, setIsItemSelected] = useState(false);
    const [materialSearchResults, setMaterialSearchResults] = useState([]);
    const [fornecedorSearchResults, setFornecedorSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState({ material: false, fornecedor: false });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [fornecedorSearchTerm, setFornecedorSearchTerm] = useState('');
    
    const [newMaterialClassification, setNewMaterialClassification] = useState('Insumo');

    const { data: etapas = [], isLoading: isLoadingEtapas } = useQuery({
        queryKey: ['etapas', organizacaoId],
        queryFn: () => fetchEtapas(supabase, organizacaoId),
        enabled: isOpen && !!organizacaoId,
    });

    const { data: subetapas = [] } = useQuery({
        queryKey: ['subetapas', item.etapa_id, organizacaoId],
        queryFn: () => fetchSubetapas(supabase, item.etapa_id, organizacaoId),
        enabled: isOpen && !!item.etapa_id && !!organizacaoId,
    });


    useEffect(() => {
        if (isOpen) {
            if (isEditing) {
                const initialFornecedorName = itemToEdit.fornecedor?.razao_social || itemToEdit.fornecedor?.nome || '';
                setItem({
                    id: itemToEdit.id,
                    material_id: itemToEdit.material_id,
                    descricao_item: itemToEdit.descricao_item || '',
                    quantidade_solicitada: itemToEdit.quantidade_solicitada || 1,
                    unidade_medida: itemToEdit.unidade_medida || 'unid.',
                    etapa_id: itemToEdit.etapa_id || '',
                    subetapa_id: itemToEdit.subetapa_id || '',
                    fornecedor_id: itemToEdit.fornecedor_id,
                    fornecedor_nome: initialFornecedorName,
                    preco_unitario_real: itemToEdit.preco_unitario_real || '',
                    tipo_operacao: itemToEdit.tipo_operacao || 'Compra',
                    dias_aluguel: itemToEdit.dias_aluguel || null
                });
                setIsItemSelected(!!itemToEdit.material_id || !!itemToEdit.descricao_item);
                setSearchTerm(itemToEdit.descricao_item || '');
                setFornecedorSearchTerm(initialFornecedorName);

            } else {
                setItem(getInitialState());
                setSearchTerm('');
                setFornecedorSearchTerm('');
                setIsItemSelected(false);
            }
             setMaterialSearchResults([]);
             setFornecedorSearchResults([]);
             setMessage('');
             setSubetapaSearch('');
        }
    }, [isOpen, isEditing, itemToEdit]);
    
    useEffect(() => {
        if (isEditing && itemToEdit.subetapa_id && subetapas.length > 0) {
            const selectedSub = subetapas.find(s => s.id === itemToEdit.subetapa_id);
            if (selectedSub) {
                setSubetapaSearch(selectedSub.nome_subetapa);
            }
        }
    }, [isEditing, itemToEdit, subetapas]);


    useEffect(() => {
        if (!subetapaSearch) {
            setFilteredSubetapas(subetapas);
        } else {
            const searchLower = subetapaSearch.toLowerCase();
            const filtered = subetapas.filter(s => s.nome_subetapa.toLowerCase().includes(searchLower));
            setFilteredSubetapas(filtered);
            
            const exactMatch = subetapas.find(s => s.nome_subetapa.toLowerCase() === searchLower);
            if (!exactMatch) {
                setItem(prev => ({ ...prev, subetapa_id: '' }));
            }
        }
    }, [subetapaSearch, subetapas]);

    const handleMaterialSearchChange = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length < 2) { setMaterialSearchResults([]); return; }
        setIsSearching(prev => ({ ...prev, material: true }));
        
        const { data, error } = await supabase
            .from('materiais')
            .select('id, descricao, unidade_medida, preco_unitario, nome')
            .eq('organizacao_id', organizacaoId)
            .ilike('descricao', `%${value}%`)
            .limit(10);

        if (error) console.error("Erro na busca de materiais:", error);
        setMaterialSearchResults(data || []);
        setIsSearching(prev => ({ ...prev, material: false }));
    };
    
    const handleFornecedorSearchChange = async (e) => {
        const value = e.target.value;
        setFornecedorSearchTerm(value);
        if (value.length < 2) { setFornecedorSearchResults([]); return; }
        
        setIsSearching(prev => ({ ...prev, fornecedor: true }));
        
        const { data, error } = await supabase
            .from('contatos')
            .select('id, nome, razao_social, nome_fantasia')
            .eq('organizacao_id', organizacaoId)
            .eq('tipo_contato', 'Fornecedor')
            .or(`nome.ilike.%${value}%,razao_social.ilike.%${value}%,nome_fantasia.ilike.%${value}%`)
            .limit(10);

        if (error) {
            console.error("Erro na busca de fornecedores:", error);
            setFornecedorSearchResults([]);
        } else {
            setFornecedorSearchResults(data || []);
        }
        
        setIsSearching(prev => ({ ...prev, fornecedor: false }));
    };

    const handleSelectMaterial = (material) => {
        setItem(prev => ({ ...prev, material_id: material.id, descricao_item: material.descricao || material.nome, unidade_medida: material.unidade_medida || 'unid.' }));
        setIsItemSelected(true);
        setMaterialSearchResults([]);
        setSearchTerm(material.descricao || material.nome);
    };

    // O PORQUÊ DA MUDANÇA: A função de criar material agora é mais robusta.
    // Ela apenas cria o material e retorna o objeto completo. A lógica de o que
    // fazer com esse material (selecionar na UI ou salvar direto) fica a cargo
    // de quem a chama (handleCreateAndSelectMaterial ou handleSaveClick).
    const createMaterialMutation = useMutation({
        mutationFn: async ({ nome, descricao, classificacao }) => {
            if (!organizacaoId) throw new Error("A organização não foi identificada.");
            const { data, error } = await supabase
                .from('materiais')
                .insert({ 
                    nome: nome.trim(), 
                    descricao: descricao.trim(),
                    classificacao, 
                    organizacao_id: organizacaoId
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materiais', organizacaoId] });
        },
        onError: (error) => {
            toast.error(`Erro ao criar material: ${error.message}`);
        }
    });
    
    const handleCreateAndSelectMaterial = async () => {
        try {
            const newMaterial = await createMaterialMutation.mutateAsync({
                nome: searchTerm.trim(),
                descricao: searchTerm.trim(),
                classificacao: newMaterialClassification
            });
            toast.success(`Material "${newMaterial.nome}" criado com sucesso!`);
            handleSelectMaterial(newMaterial);
        } catch (error) {
            // O erro já é exibido pelo onError da mutação.
        }
    };

    const handleResetItemSelection = () => {
        setIsItemSelected(false);
        setItem(prev => ({...prev, material_id: null, descricao_item: ''}));
        setSearchTerm('');
    }

    const handleSelectFornecedor = (fornecedor) => {
        setItem(prev => ({ ...prev, fornecedor_id: fornecedor.id }));
        setFornecedorSearchTerm(fornecedor.razao_social || fornecedor.nome);
        setFornecedorSearchResults([]);
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        
        if (name === 'etapa_id') {
            setItem(prev => ({ ...prev, etapa_id: value, subetapa_id: '' }));
            setSubetapaSearch('');
        } else {
            setItem(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
        }
    };
    
    const handleSelectSubetapa = (subetapa) => {
        setItem(prev => ({ ...prev, subetapa_id: subetapa.id }));
        setSubetapaSearch(subetapa.nome_subetapa);
        setIsSubetapaDropdownOpen(false);
    };
    
    const createSubetapaMutation = useMutation({
        mutationFn: async ({ nome, etapa_id }) => {
            const { data, error } = await supabase
                .from('subetapas')
                .insert({ 
                    nome_subetapa: nome, 
                    etapa_id: etapa_id,
                    organizacao_id: organizacaoId
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (newSubetapa) => {
            queryClient.invalidateQueries({ queryKey: ['subetapas', item.etapa_id, organizacaoId] });
            handleSelectSubetapa(newSubetapa);
        },
    });

    const handleCreateSubetapa = async () => {
        if (!subetapaSearch.trim() || !item.etapa_id || !organizacaoId) return;

        toast.promise(
            createSubetapaMutation.mutateAsync({
                nome: subetapaSearch.trim(),
                etapa_id: item.etapa_id
            }),
            {
                loading: 'Criando subetapa...',
                success: 'Subetapa criada com sucesso!',
                error: (error) => `Erro ao criar subetapa: ${error.message}`
            }
        );
    };

    // ========================================================================
    // INÍCIO DA CORREÇÃO DEFINITIVA
    // O PORQUÊ: Esta função agora é 'async' para poder esperar (await) a criação
    // do material antes de continuar.
    // 1. Ela verifica se o usuário apenas digitou um novo item sem selecionar/criar.
    // 2. Se sim, ela PRIMEIRO chama a função para criar o material na tabela 'materiais'.
    // 3. Ela ESPERA o retorno com o novo ID.
    // 4. SÓ ENTÃO, ela monta o objeto 'itemToSave' completo, já com o 'material_id' correto.
    // 5. Finalmente, ela chama a função onSave, enviando o dado completo e correto para o PedidoForm.
    // Este fluxo sequencial impede o erro de 'material_id' nulo.
    // ========================================================================
    const handleSaveClick = async () => {
        if (!isItemSelected && !searchTerm) { 
            setMessage('A descrição do item é obrigatória.'); 
            return; 
        }
        
        if (item.tipo_operacao === 'Aluguel' && (!item.dias_aluguel || item.dias_aluguel <= 0)) {
            setMessage('Para aluguel, a quantidade de dias é obrigatória e deve ser maior que zero.');
            return;
        }

        setIsSaving(true);
        setMessage('');
        let itemToSave = { ...item };

        try {
            // PASSO 1: Verifica se o item é novo e precisa ser criado.
            if (!isItemSelected && searchTerm) {
                itemToSave.descricao_item = searchTerm.trim();
                
                // PASSO 2: Chama a criação do material e ESPERA o resultado.
                const newMaterial = await createMaterialMutation.mutateAsync({
                    nome: searchTerm.trim(),
                    descricao: searchTerm.trim(),
                    classificacao: newMaterialClassification
                });
                
                // PASSO 3: Atualiza nosso objeto com o ID recém-criado.
                itemToSave.material_id = newMaterial.id;
            }

            // Prepara o resto do objeto para ser salvo, agora com a garantia do material_id.
            if (itemToSave.tipo_operacao !== 'Aluguel') {
                itemToSave.dias_aluguel = null;
            }
            
            itemToSave.etapa_id = itemToSave.etapa_id || null;
            itemToSave.subetapa_id = itemToSave.subetapa_id || null;

            delete itemToSave.fornecedor_nome;
            
            // PASSO 4: Envia o objeto COMPLETO para a função de salvar.
            onSave(itemToSave);

        } catch (error) {
            // Se a criação do material falhar, a operação é interrompida.
            console.error("Falha na sequência de salvamento do item:", error);
        } finally {
            setIsSaving(false);
        }
    };
    // ========================================================================
    // FIM DA CORREÇÃO DEFINITIVA
    // ========================================================================

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{isEditing ? 'Editar Item do Pedido' : 'Adicionar Item ao Pedido'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                {message && <p className="text-sm text-red-500 mb-4">{message}</p>}
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Material / Descrição do Item</label>
                        {isItemSelected ? (
                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                                <span className="font-semibold text-gray-800">{item.descricao_item}</span>
                                <button onClick={handleResetItemSelection} className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1"> <FontAwesomeIcon icon={faPenToSquare} /> Alterar </button>
                            </div>
                        ) : (
                            <>
                                <input type="text" value={searchTerm} onChange={handleMaterialSearchChange} placeholder="Digite para buscar ou descrever..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                                {isSearching.material && <p className="text-xs text-gray-500">Buscando...</p>}
                                {materialSearchResults.length > 0 && (
                                    <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {materialSearchResults.map(material => 
                                            <li key={material.id} onClick={() => handleSelectMaterial(material)} className="p-3 hover:bg-gray-100 cursor-pointer">
                                                <HighlightedText text={material.descricao || material.nome} highlight={searchTerm} />
                                            </li>
                                        )}
                                    </ul>
                                )}
                                {!isSearching.material && searchTerm.length > 2 && materialSearchResults.length === 0 && (
                                    <div className="absolute z-20 w-full bg-white border rounded-md shadow-lg p-3 space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Classificar novo material como:</label>
                                            <select 
                                                value={newMaterialClassification} 
                                                onChange={(e) => setNewMaterialClassification(e.target.value)}
                                                className="w-full p-2 border rounded-md text-sm"
                                            >
                                                <option value="Insumo">Insumo (Consumível)</option>
                                                <option value="Equipamento">Equipamento (Retornável)</option>
                                            </select>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleCreateAndSelectMaterial} 
                                            disabled={createMaterialMutation.isPending}
                                            className="text-blue-600 font-semibold flex items-center gap-2 disabled:text-gray-400"
                                        > 
                                            {createMaterialMutation.isPending ? (
                                                <><FontAwesomeIcon icon={faSpinner} spin /> Criando...</>
                                            ) : (
                                                <><FontAwesomeIcon icon={faPlus} /> Criar e usar &quot;{searchTerm}&quot;</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="relative mt-2">
                        <label className="block text-sm font-medium">Fornecedor</label>
                        <input type="text" value={fornecedorSearchTerm} onChange={handleFornecedorSearchChange} placeholder="Buscar por Nome, Razão Social ou Fantasia..." className="mt-1 w-full p-2 border rounded-md" autoComplete="off" />
                        {isSearching.fornecedor && <p className="text-xs text-gray-500">Buscando...</p>}
                        {fornecedorSearchResults.length > 0 && (
                            <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {fornecedorSearchResults.map(f => <li key={f.id} onClick={() => handleSelectFornecedor(f)} className="p-2 hover:bg-gray-100 cursor-pointer"><HighlightedText text={f.razao_social || f.nome} highlight={fornecedorSearchTerm} /> <span className="text-xs text-gray-500">{f.nome_fantasia && `(${f.nome_fantasia})`}</span></li>)}
                            </ul>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Tipo de Operação</label>
                        <select name="tipo_operacao" value={item.tipo_operacao} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md">
                            <option value="Compra">Compra</option>
                            <option value="Aluguel">Aluguel</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div> <label className="block text-sm font-medium">Quantidade</label> <input type="number" name="quantidade_solicitada" value={item.quantidade_solicitada} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                        <div> <label className="block text-sm font-medium">Unidade</label> <input type="text" name="unidade_medida" value={item.unidade_medida} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                        <div> <label className="block text-sm font-medium">Preço Unitário</label> <input type="number" step="0.01" name="preco_unitario_real" value={item.preco_unitario_real || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" /> </div>
                    </div>
                    
                    {item.tipo_operacao === 'Aluguel' && (
                        <div>
                            <label className="block text-sm font-medium">Dias de Aluguel</label>
                            <input type="number" name="dias_aluguel" value={item.dias_aluguel || ''} onChange={handleChange} min="1" className="mt-1 w-full p-2 border rounded-md" required />
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Etapa da Obra</label>
                            <select name="etapa_id" value={item.etapa_id || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" disabled={isLoadingEtapas}>
                                <option value="">{isLoadingEtapas ? 'Carregando...' : 'Selecione a etapa'}</option>
                                {etapas.map(e => <option key={e.id} value={e.id}>{e.codigo_etapa} - {e.nome_etapa}</option>)}
                            </select>
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium">Subetapa (Opcional)</label>
                            <input
                                type="text"
                                value={subetapaSearch}
                                onChange={(e) => setSubetapaSearch(e.target.value)}
                                onFocus={() => setIsSubetapaDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsSubetapaDropdownOpen(false), 200)}
                                disabled={!item.etapa_id}
                                placeholder={!item.etapa_id ? "Selecione uma etapa" : "Digite para buscar ou criar"}
                                className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-100"
                                autoComplete="off"
                            />
                            {isSubetapaDropdownOpen && item.etapa_id && (
                                <ul className="absolute z-30 w-full bg-white border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                    {filteredSubetapas.map(sub => (
                                        <li key={sub.id} onMouseDown={() => handleSelectSubetapa(sub)} className="p-2 border-b hover:bg-gray-100 cursor-pointer">
                                            <HighlightedText text={sub.nome_subetapa} highlight={subetapaSearch} />
                                        </li>
                                    ))}
                                    {filteredSubetapas.length === 0 && subetapaSearch && (
                                        <li className='p-2 text-sm text-gray-500'>Nenhuma subetapa encontrada.</li>
                                    )}
                                    {subetapaSearch && !filteredSubetapas.some(s => s.nome_subetapa.toLowerCase() === subetapaSearch.toLowerCase()) && (
                                        <li 
                                            onMouseDown={handleCreateSubetapa} 
                                            className="p-2 border-t bg-green-50 hover:bg-green-100 cursor-pointer flex items-center gap-2"
                                        >
                                            {createSubetapaMutation.isPending ? (
                                                <><FontAwesomeIcon icon={faSpinner} spin /> Criando...</>
                                            ) : (
                                                <><FontAwesomeIcon icon={faPlus} className="text-green-600" /> <span className="text-green-800 font-semibold">Criar: &quot;{subetapaSearch}&quot;</span></>
                                            )}
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                     <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">Cancelar</button>
                     <button onClick={handleSaveClick} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={isSaving}> {isSaving ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Item'} </button>
                 </div>
            </div>
        </div>
    );
}
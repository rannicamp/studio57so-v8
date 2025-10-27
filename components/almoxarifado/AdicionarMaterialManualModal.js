"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faTimes, faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';

const adicionarMaterialEstoque = async ({ supabase, empreendimentoId, usuarioId, organizacaoId, materialData }) => {
    let materialId = materialData.material_id;

    // 1. Cria o material se ele for novo
    if (!materialId) {
        const { data: novoMaterial, error: materialError } = await supabase
            .from('materiais')
            .insert({
                nome: materialData.descricao,
                descricao: materialData.descricao,
                classificacao: materialData.classificacao,
                unidade_medida: materialData.unidade_medida,
                organizacao_id: organizacaoId, // <-- Segurança OK
            })
            .select('id')
            .single();

        if (materialError) throw new Error(`Falha ao criar o material: ${materialError.message}`);
        materialId = novoMaterial.id;
    }

    // 2. Verifica se já existe no estoque para este empreendimento
    const { data: estoqueExistente, error: estoqueSelectError } = await supabase
        .from('estoque')
        .select('id, quantidade_atual')
        .eq('empreendimento_id', empreendimentoId)
        .eq('material_id', materialId)
        .single();

    // Ignora o erro se for 'nenhum resultado encontrado', o que é esperado para itens novos
    if (estoqueSelectError && estoqueSelectError.code !== 'PGRST116') {
        throw new Error(`Falha ao verificar o estoque: ${estoqueSelectError.message}`);
    }

    let estoqueId;
    if (estoqueExistente) {
        // 2a. Atualiza a quantidade se já existe
        estoqueId = estoqueExistente.id;
        const novaQuantidade = Number(estoqueExistente.quantidade_atual) + Number(materialData.quantidade);
        const { error: updateError } = await supabase
            .from('estoque')
            .update({ quantidade_atual: novaQuantidade, ultima_atualizacao: new Date().toISOString() })
            .eq('id', estoqueId);
        if (updateError) throw new Error(`Falha ao atualizar o estoque: ${updateError.message}`);
    } else {
        // 2b. Cria a entrada no estoque se não existe
        const { data: novoEstoque, error: insertError } = await supabase
            .from('estoque')
            .insert({
                empreendimento_id: empreendimentoId,
                material_id: materialId,
                quantidade_atual: materialData.quantidade,
                unidade_medida: materialData.unidade_medida,
                organizacao_id: organizacaoId, // <-- Segurança OK
            })
            .select('id')
            .single();
        if (insertError) throw new Error(`Falha ao criar entrada no estoque: ${insertError.message}`);
        estoqueId = novoEstoque.id;
    }

    // 3. Registra a movimentação de entrada
    const { error: movimentacaoError } = await supabase
        .from('movimentacoes_estoque')
        .insert({
            estoque_id: estoqueId,
            // ======================= CORREÇÃO APLICADA =======================
            tipo: 'Entrada por Compra', // <-- Usando um tipo VÁLIDO do CHECK constraint
            // ===============================================================
            quantidade: materialData.quantidade,
            usuario_id: usuarioId,
            observacao: `Adição manual de material: ${materialData.descricao}`,
            organizacao_id: organizacaoId, // <-- Segurança OK
        });

    // Se a inserção da movimentação falhar, lança o erro
    if (movimentacaoError) throw new Error(`Falha ao registrar a movimentação: ${movimentacaoError.message}`);

    // Se chegou até aqui, tudo deu certo
    return { success: true };
};


export default function AdicionarMaterialManualModal({ isOpen, onClose, onSuccess, empreendimentoId }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;
    const queryClient = useQueryClient();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isItemSelected, setIsItemSelected] = useState(false);
    const [item, setItem] = useState({
        material_id: null,
        descricao: '',
        quantidade: 1,
        unidade_medida: 'unid.',
        classificacao: 'Equipamento',
    });

    const mutation = useMutation({
        mutationFn: adicionarMaterialEstoque,
        onSuccess: () => {
            toast.success("Material adicionado ao estoque com sucesso!"); // Mensagem adicionada aqui
            onSuccess(); // Chama a função de sucesso do Manager (que invalida a query)
            onClose(); // Fecha o modal
        },
        onError: (error) => {
            // Exibe a mensagem de erro específica que veio da mutationFn
            toast.error(error.message); 
        },
    });

    // Função para resetar o estado do modal
    const resetState = () => {
        setSearchTerm('');
        setSearchResults([]);
        setIsSearching(false);
        setIsItemSelected(false);
        setItem({
            material_id: null,
            descricao: '',
            quantidade: 1,
            unidade_medida: 'unid.',
            classificacao: 'Equipamento',
        });
        mutation.reset(); // Reseta o estado da mutation (isPending, etc.)
    };

    // Reseta o estado sempre que o modal for aberto
    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen]);

    // Lógica de busca de materiais existentes
    const handleSearchChange = async (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (isItemSelected) {
            setIsItemSelected(false);
            setItem(prev => ({ ...prev, material_id: null, descricao: '' }));
        }
        if (value.length < 2) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const { data } = await supabase
            .from('materiais')
            .select('id, nome, descricao, unidade_medida, classificacao')
            .eq('organizacao_id', organizacaoId) // <-- Filtro de segurança OK
            .or(`nome.ilike.%${value}%,descricao.ilike.%${value}%`)
            .limit(10);
        setSearchResults(data || []);
        setIsSearching(false);
    };

    // Lógica para selecionar um material da busca
    const handleSelectMaterial = (material) => {
        setSearchTerm(material.descricao || material.nome);
        setItem({
            material_id: material.id,
            descricao: material.descricao || material.nome,
            quantidade: 1,
            unidade_medida: material.unidade_medida || 'unid.',
            classificacao: material.classificacao || 'Equipamento',
        });
        setIsItemSelected(true);
        setSearchResults([]);
    };

    // Lógica para criar um novo material na hora
    const handleCreateAndSelectMaterial = async () => {
        const toastId = toast.loading("Criando novo material...");
        const { data: newMaterial, error } = await supabase
            .from('materiais')
            .insert({ 
                nome: searchTerm.trim(), 
                descricao: searchTerm.trim(),
                classificacao: item.classificacao,
                unidade_medida: item.unidade_medida,
                organizacao_id: organizacaoId, // <-- Segurança OK
            })
            .select()
            .single();
    
        if (error) {
            toast.error(`Erro ao criar material: ${error.message}`, { id: toastId });
            return;
        }
        
        toast.success(`Material "${newMaterial.nome}" criado com sucesso!`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['materiais', organizacaoId] }); // Invalida cache de materiais
        handleSelectMaterial(newMaterial); // Seleciona o material recém-criado
    };

    // Lógica para salvar (chama a mutation)
    const handleSave = () => {
        const finalDescription = isItemSelected ? item.descricao : searchTerm;
        if (!finalDescription.trim()) {
            toast.warning('A descrição do material é obrigatória.');
            return;
        }
        if (!item.quantidade || item.quantidade <= 0) {
            toast.warning('A quantidade deve ser maior que zero.');
            return;
        }
        
        const materialDataPayload = {
            ...item,
            descricao: finalDescription // Garante que a descrição correta seja enviada
        };

        // Chama a mutation com todos os parâmetros necessários
        mutation.mutate({ supabase, empreendimentoId, usuarioId: user.id, organizacaoId, materialData: materialDataPayload });
    };

    if (!isOpen) return null;

    // JSX do Modal (sem alterações significativas, apenas a correção na função de salvar)
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Adicionar Material ao Estoque</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" title="Fechar">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-sm font-medium">Material / Descrição</label>
                        {isItemSelected ? (
                            <div className="flex items-center justify-between mt-1 w-full p-2 border rounded-md bg-gray-100">
                                <span className="font-semibold text-gray-800">{item.descricao}</span>
                                <button onClick={() => { setIsItemSelected(false); setSearchTerm(''); resetState(); /* Reseta tudo ao alterar */ }} className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1">
                                    <FontAwesomeIcon icon={faPenToSquare} /> Alterar
                                </button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    placeholder="Digite para buscar um material ou criar um novo"
                                    className="mt-1 w-full p-2 border rounded-md"
                                />
                                {isSearching && <p className="text-xs text-gray-500 absolute">Buscando...</p>}
                                
                                {searchTerm.length >= 2 && (
                                    <div className="absolute z-10 w-full bg-white border rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                                        {searchResults.length > 0 && searchResults.map(material => (
                                            <div key={material.id} onClick={() => handleSelectMaterial(material)} className="p-2 hover:bg-gray-100 cursor-pointer">
                                                {material.descricao || material.nome}
                                            </div>
                                        ))}
                                        {!isSearching && searchResults.length === 0 && (
                                            <div className="p-3">
                                                <button 
                                                    type="button" 
                                                    onClick={handleCreateAndSelectMaterial} 
                                                    className="text-blue-600 font-semibold flex items-center gap-2 w-full text-left hover:text-blue-800"
                                                > 
                                                    <FontAwesomeIcon icon={faPlus} /> Criar e usar &quot;{searchTerm}&quot;
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium">Quantidade</label>
                            <input
                                type="number"
                                value={item.quantidade}
                                onChange={(e) => setItem({ ...item, quantidade: parseFloat(e.target.value) || 0 })}
                                className="mt-1 w-full p-2 border rounded-md"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Unidade</label>
                            <input
                                type="text"
                                value={item.unidade_medida}
                                onChange={(e) => setItem({ ...item, unidade_medida: e.target.value })}
                                // Desabilita se o item foi selecionado, pois a unidade vem do material
                                disabled={isItemSelected} 
                                className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-200"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Classificação</label>
                            <select
                                value={item.classificacao}
                                onChange={(e) => setItem({ ...item, classificacao: e.target.value })}
                                // Desabilita se o item foi selecionado, pois a classificação vem do material
                                disabled={isItemSelected} 
                                className="mt-1 w-full p-2 border rounded-md disabled:bg-gray-200"
                            >
                                <option value="Equipamento">Equipamento</option>
                                <option value="Insumo">Insumo</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-4 pt-6 mt-4 border-t">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400" disabled={mutation.isPending || (!isItemSelected && !searchTerm.trim())}>
                        {mutation.isPending ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Salvar Material'}
                    </button>
                </div>
            </div>
        </div>
    );
}
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlus, faArrowLeft, faEdit, faTrash } from '@fortawesome/free-solid-svg-icons';
import OrcamentoItemModal from './OrcamentoItemModal'; // Importando o modal

export default function OrcamentoDetalhes({ orcamento, onBack }) {
    const supabase = createClient();
    const [itens, setItens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    // Estados para controlar o modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const fetchItens = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orcamento_itens')
            .select('*')
            .eq('orcamento_id', orcamento.id)
            .order('categoria', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Erro ao buscar itens do orçamento:", error);
            setMessage('Não foi possível carregar os itens.');
        } else {
            setItens(data || []);
        }
        setLoading(false);
    }, [supabase, orcamento.id]);

    useEffect(() => {
        fetchItens();
    }, [fetchItens]);

    const custoTotal = useMemo(() => {
        return itens.reduce((acc, item) => acc + (item.custo_total || 0), 0);
    }, [itens]);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const handleOpenModal = (item = null) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingItem(null);
        setIsModalOpen(false);
    };

    const handleSaveItem = () => {
        fetchItens(); // Simplesmente recarrega a lista de itens
    };

    const handleDeleteItem = async (itemId) => {
        if (window.confirm('Tem certeza que deseja excluir este item?')) {
            const { error } = await supabase.from('orcamento_itens').delete().eq('id', itemId);
            if (error) {
                setMessage(`Erro ao excluir: ${error.message}`);
            } else {
                setMessage('Item excluído com sucesso.');
                fetchItens();
            }
        }
    };

    if (loading) {
        return (
            <div className="text-center py-10">
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            </div>
        );
    }

    return (
        <>
            <OrcamentoItemModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveItem}
                orcamentoId={orcamento.id}
                itemToEdit={editingItem}
            />
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-2">
                            <FontAwesomeIcon icon={faArrowLeft} />
                            Voltar para a lista de orçamentos
                        </button>
                        <h2 className="text-2xl font-bold text-gray-800">{orcamento.nome_orcamento}</h2>
                        <p className="text-sm text-gray-500">Versão {orcamento.versao} - Status: {orcamento.status}</p>
                    </div>
                    <button 
                        onClick={() => handleOpenModal()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-600 flex items-center gap-2"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                        Adicionar Item
                    </button>
                </div>

                {message && <p className="text-center font-medium text-sm p-2 bg-green-50 text-green-700 rounded-md">{message}</p>}

                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Un.</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Qtd.</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Preço Unit.</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Custo Total</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {itens.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-10 text-gray-500">Nenhum item adicionado a este orçamento ainda.</td>
                                </tr>
                            ) : (
                                itens.map(item => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.categoria}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{item.descricao}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">{item.unidade}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">{item.quantidade}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatCurrency(item.preco_unitario)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-700">{formatCurrency(item.custo_total)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center space-x-4">
                                            <button onClick={() => handleOpenModal(item)} title="Editar Item" className="text-blue-500 hover:text-blue-700">
                                                <FontAwesomeIcon icon={faEdit} />
                                            </button>
                                            <button onClick={() => handleDeleteItem(item.id)} title="Excluir Item" className="text-red-500 hover:text-red-700">
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot className="bg-gray-100">
                            <tr>
                                <td colSpan="6" className="px-6 py-3 text-right text-sm font-bold text-gray-700 uppercase">Custo Total Previsto:</td>
                                <td className="px-6 py-3 text-right text-base font-bold text-gray-900">{formatCurrency(custoTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );
}
// components/almoxarifado/AlmoxarifadoManager.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWarehouse, faFilter, faTimes, faArrowDown, faHistory } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BaixaEstoqueModal from './BaixaEstoqueModal';
import HistoricoMovimentacoesModal from './HistoricoMovimentacoesModal';

// Função para buscar os dados do banco
const fetchEstoqueData = async (supabase, empreendimentoId) => {
    if (!empreendimentoId) return { estoque: [], empreendimentos: [] };

    const { data: empreendimentos, error: empError } = await supabase.from('empreendimentos').select('id, nome');
    if (empError) throw new Error('Falha ao buscar empreendimentos.');

    const { data: estoque, error: estError } = await supabase
        .from('estoque')
        .select(`
            *,
            material:materiais(id, nome, descricao),
            empreendimento:empreendimentos(id, nome)
        `)
        .eq('empreendimento_id', empreendimentoId)
        .order('ultima_atualizacao', { ascending: false });

    if (estError) throw new Error('Falha ao buscar dados do estoque.');
    
    return { estoque: estoque || [], empreendimentos: empreendimentos || [] };
};

export default function AlmoxarifadoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
    const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
    const [selectedEstoqueItem, setSelectedEstoqueItem] = useState(null);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['estoque', selectedEmpreendimentoId],
        queryFn: () => fetchEstoqueData(supabase, selectedEmpreendimentoId),
        enabled: !!selectedEmpreendimentoId, // A busca só é ativada quando um empreendimento é selecionado
    });

    // Busca a lista de empreendimentos na primeira carga
    const { data: empreendimentosList, isLoading: isLoadingEmpreendimentos } = useQuery({
        queryKey: ['empreendimentosList'],
        queryFn: async () => {
            const { data, error } = await supabase.from('empreendimentos').select('id, nome').order('nome');
            if (error) throw new Error('Falha ao buscar empreendimentos.');
            return data;
        },
    });

    const handleOpenBaixaModal = (item) => {
        setSelectedEstoqueItem(item);
        setIsBaixaModalOpen(true);
    };

    const handleOpenHistoricoModal = (item) => {
        setSelectedEstoqueItem(item);
        setIsHistoricoModalOpen(true);
    };

    const handleSuccess = () => {
        toast.success("Operação realizada com sucesso!");
        // Invalida a query para forçar a atualização dos dados do estoque na tela
        queryClient.invalidateQueries({ queryKey: ['estoque', selectedEmpreendimentoId] });
    };

    return (
        <div className="space-y-4">
            {selectedEstoqueItem && (
                <>
                    <BaixaEstoqueModal 
                        isOpen={isBaixaModalOpen}
                        onClose={() => setIsBaixaModalOpen(false)}
                        estoqueItem={selectedEstoqueItem}
                        onSuccess={handleSuccess}
                    />
                    <HistoricoMovimentacoesModal
                        isOpen={isHistoricoModalOpen}
                        onClose={() => setIsHistoricoModalOpen(false)}
                        estoqueItem={selectedEstoqueItem}
                    />
                </>
            )}

            <div className="p-4 border rounded-lg bg-gray-50 flex items-end gap-4">
                <div className="flex-1">
                    <label htmlFor="empreendimento-select" className="block text-sm font-medium text-gray-700">
                        <FontAwesomeIcon icon={faFilter} /> Filtrar por Empreendimento
                    </label>
                    <select
                        id="empreendimento-select"
                        value={selectedEmpreendimentoId}
                        onChange={(e) => setSelectedEmpreendimentoId(e.target.value)}
                        disabled={isLoadingEmpreendimentos}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">{isLoadingEmpreendimentos ? 'Carregando...' : 'Selecione uma obra'}</option>
                        {empreendimentosList?.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading && <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando estoque...</div>}
            {isError && <div className="text-center p-10 text-red-600">Erro ao carregar dados: {error.message}</div>}

            {selectedEmpreendimentoId && !isLoading && !isError && (
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left font-bold uppercase">Material</th>
                                <th className="px-6 py-3 text-center font-bold uppercase">Qtd. Atual</th>
                                <th className="px-6 py-3 text-center font-bold uppercase">Unidade</th>
                                <th className="px-6 py-3 text-right font-bold uppercase">Custo Médio</th>
                                <th className="px-6 py-3 text-center font-bold uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data?.estoque.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-10 text-gray-500">
                                        <FontAwesomeIcon icon={faWarehouse} size="3x" className="mb-2" />
                                        <p>Nenhum item em estoque para esta obra.</p>
                                    </td>
                                </tr>
                            ) : (
                                data?.estoque.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-semibold">{item.material.nome}</td>
                                        <td className="px-6 py-4 text-center font-bold text-xl">{item.quantidade_atual}</td>
                                        <td className="px-6 py-4 text-center">{item.unidade_medida}</td>
                                        <td className="px-6 py-4 text-right font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.custo_medio)}</td>
                                        <td className="px-6 py-4 text-center space-x-2">
                                            <button onClick={() => handleOpenBaixaModal(item)} className="bg-red-500 text-white px-3 py-1 rounded-md text-xs hover:bg-red-600 font-bold" title="Dar Baixa no Estoque">
                                                <FontAwesomeIcon icon={faArrowDown} /> Baixar
                                            </button>
                                            <button onClick={() => handleOpenHistoricoModal(item)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs hover:bg-gray-300 font-bold" title="Ver Histórico">
                                                <FontAwesomeIcon icon={faHistory} /> Histórico
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

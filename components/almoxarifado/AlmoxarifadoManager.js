// components/almoxarifado/AlmoxarifadoManager.js
"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faWarehouse, faFilter, faTimes, faArrowDown, faHistory, faArrowUp, faTools, faBox } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BaixaEstoqueModal from './BaixaEstoqueModal';
import HistoricoMovimentacoesModal from './HistoricoMovimentacoesModal';

// Função de busca foi atualizada para trazer a classificação do material e a quantidade em uso
const fetchEstoqueData = async (supabase, empreendimentoId) => {
    if (!empreendimentoId) return { estoque: [] };

    const { data: estoque, error: estError } = await supabase
        .from('estoque')
        .select(`
            *,
            material:materiais(id, nome, descricao, classificacao),
            empreendimento:empreendimentos(id, nome)
        `)
        .eq('empreendimento_id', empreendimentoId)
        .order('ultima_atualizacao', { ascending: false });

    if (estError) throw new Error('Falha ao buscar dados do estoque.');
    
    return { estoque: estoque || [] };
};

export default function AlmoxarifadoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    
    const [selectedEmpreendimentoId, setSelectedEmpreendimentoId] = useState('');
    const [activeTab, setActiveTab] = useState('disponivel'); // 'disponivel' ou 'em_uso'
    const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
    const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
    const [selectedEstoqueItem, setSelectedEstoqueItem] = useState(null);

    // Query principal para o estoque disponível
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['estoque', selectedEmpreendimentoId],
        queryFn: () => fetchEstoqueData(supabase, selectedEmpreendimentoId),
        enabled: !!selectedEmpreendimentoId,
    });
    const estoqueDisponivel = data?.estoque || [];

    // Query separada para os equipamentos em uso
    const { data: equipamentosEmUso, isLoading: isLoadingEmUso } = useQuery({
        queryKey: ['equipamentosEmUso', selectedEmpreendimentoId],
        queryFn: async () => {
            if (!selectedEmpreendimentoId) return [];
            const { data, error } = await supabase
                .from('estoque')
                .select('*, material:materiais(*)')
                .eq('empreendimento_id', selectedEmpreendimentoId)
                .eq('material.classificacao', 'Equipamento')
                .gt('quantidade_em_uso', 0);
            if (error) throw new Error("Falha ao buscar equipamentos em uso.");
            return data;
        },
        enabled: !!selectedEmpreendimentoId,
    });


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
    
    // Futuramente, teremos modais separados para Retirada, Devolução, etc.
    const handleOpenRetiradaModal = (item) => toast.info("Funcionalidade 'Registrar Retirada' será implementada no próximo passo.");
    const handleOpenDevolucaoModal = (item) => toast.info("Funcionalidade 'Devolver' será implementada no próximo passo.");
    const handleOpenBaixaQuebraModal = (item) => toast.info("Funcionalidade 'Baixa por Quebra' será implementada no próximo passo.");


    const handleSuccess = () => {
        toast.success("Operação realizada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['estoque', selectedEmpreendimentoId] });
        queryClient.invalidateQueries({ queryKey: ['equipamentosEmUso', selectedEmpreendimentoId] });
    };

    const TabButton = ({ tabName, label, icon, count }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center gap-2 py-2 px-4 font-semibold text-sm rounded-t-lg border-b-2 ${
                activeTab === tabName
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            <FontAwesomeIcon icon={icon} /> {label}
            {count > 0 && <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{count}</span>}
        </button>
    );

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

            {selectedEmpreendimentoId && (
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-4">
                        <TabButton tabName="disponivel" label="Estoque Disponível" icon={faWarehouse} count={estoqueDisponivel.length} />
                        <TabButton tabName="em_uso" label="Equipamentos em Uso" icon={faTools} count={equipamentosEmUso?.length || 0} />
                    </nav>
                </div>
            )}


            {isLoading && <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando estoque...</div>}
            {isError && <div className="text-center p-10 text-red-600">Erro ao carregar dados: {error.message}</div>}

            {selectedEmpreendimentoId && !isLoading && !isError && (
                <>
                    {activeTab === 'disponivel' && (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-bold uppercase">Material</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Classificação</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Qtd. Disponível</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Qtd. em Uso</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {estoqueDisponivel.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-10 text-gray-500"><FontAwesomeIcon icon={faWarehouse} size="3x" className="mb-2" /><p>Nenhum item em estoque para esta obra.</p></td></tr>
                                    ) : (
                                        estoqueDisponivel.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-800">{item.material.nome}</div>
                                                    <div className="text-xs text-gray-500">{item.material.descricao}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${item.material.classificacao === 'Equipamento' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'}`}>
                                                        {item.material.classificacao}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-xl">{item.quantidade_atual} <span className="text-xs font-normal text-gray-500">{item.unidade_medida}</span></td>
                                                <td className="px-6 py-4 text-center font-bold text-lg text-gray-500">{item.quantidade_em_uso > 0 ? item.quantidade_em_uso : '-'}</td>
                                                <td className="px-6 py-4 text-center space-x-2">
                                                    {item.material.classificacao === 'Insumo' ? (
                                                        <button onClick={() => handleOpenBaixaModal(item)} className="bg-red-500 text-white px-3 py-1 rounded-md text-xs hover:bg-red-600 font-bold" title="Dar Baixa por Uso">
                                                            <FontAwesomeIcon icon={faArrowDown} /> Dar Baixa (Uso)
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleOpenRetiradaModal(item)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600 font-bold" title="Registrar Retirada de Equipamento">
                                                            <FontAwesomeIcon icon={faArrowUp} rotation={180} /> Registrar Retirada
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleOpenHistoricoModal(item)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs hover:bg-gray-300 font-bold" title="Ver Histórico">
                                                        <FontAwesomeIcon icon={faHistory} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'em_uso' && (
                        <div className="overflow-x-auto border rounded-lg">
                           <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-bold uppercase">Equipamento</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Qtd. em Uso</th>
                                        <th className="px-6 py-3 text-center font-bold uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoadingEmUso ? (
                                        <tr><td colSpan="3" className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /></td></tr>
                                    ) : equipamentosEmUso.length === 0 ? (
                                        <tr><td colSpan="3" className="text-center py-10 text-gray-500"><FontAwesomeIcon icon={faTools} size="3x" className="mb-2" /><p>Nenhum equipamento em uso no momento.</p></td></tr>
                                    ) : (
                                        equipamentosEmUso.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-800">{item.material.nome}</div>
                                                    <div className="text-xs text-gray-500">{item.material.descricao}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-xl">{item.quantidade_em_uso}</td>
                                                <td className="px-6 py-4 text-center space-x-2">
                                                    <button onClick={() => handleOpenDevolucaoModal(item)} className="bg-green-500 text-white px-3 py-1 rounded-md text-xs hover:bg-green-600 font-bold">
                                                        Devolver
                                                    </button>
                                                    <button onClick={() => handleOpenBaixaQuebraModal(item)} className="bg-orange-500 text-white px-3 py-1 rounded-md text-xs hover:bg-orange-600 font-bold">
                                                        Baixa (Quebra)
                                                    </button>
                                                     <button onClick={() => handleOpenHistoricoModal(item)} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs hover:bg-gray-300 font-bold" title="Ver Histórico">
                                                        <FontAwesomeIcon icon={faHistory} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                           </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
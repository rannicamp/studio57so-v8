//components\almoxarifado\AlmoxarifadoManager.js
"use client";

import { useState, useMemo } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faWarehouse, faFilter, faTimes, faArrowDown, faHistory, 
    faArrowUp, faTools, faBox, faBoxOpen, faSearch, faPlus
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BaixaEstoqueModal from './BaixaEstoqueModal';
import HistoricoMovimentacoesModal from './HistoricoMovimentacoesModal';
import RegistrarRetiradaModal from './RegistrarRetiradaModal';
import RegistrarDevolucaoModal from './RegistrarDevolucaoModal';
import AdicionarMaterialManualModal from './AdicionarMaterialManualModal';
import { useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useDebounce } from 'use-debounce';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organização_id)
// O PORQUÊ: A função de busca agora também recebe o `organizacaoId` para adicionar
// um filtro explícito na consulta. Isso cria uma dupla camada de segurança,
// garantindo que apenas o estoque da organização correta seja exibido.
// =================================================================================
const fetchEstoqueData = async (supabase, empreendimentoId, organizacaoId) => {
    if (!empreendimentoId || empreendimentoId === 'all' || !organizacaoId) return [];

    const { data, error } = await supabase
        .from('estoque')
        .select(`
            *,
            material:materiais(id, nome, descricao, classificacao)
        `)
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .order('material(nome)', { ascending: true });

    if (error) throw new Error('Falha ao buscar dados do estoque.');
    
    return data?.map(item => ({ ...item, quantidade_em_uso: item.quantidade_em_uso || 0 })) || [];
};

export default function AlmoxarifadoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth(); // 2. Obter o usuário para pegar o ID da organização
    const organizacaoId = user?.organizacao_id;

    const { selectedEmpreendimento: empreendimentoId } = useEmpreendimento();
    
    const [filtroClassificacao, setFiltroClassificacao] = useState('Todos');
    const [termoBusca, setTermoBusca] = useState('');
    const [debouncedBusca] = useDebounce(termoBusca, 300);

    const [activeTab, setActiveTab] = useState('disponivel');
    const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
    const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
    const [isRetiradaModalOpen, setIsRetiradaModalOpen] = useState(false);
    const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
    const [isAdicionarMaterialModalOpen, setIsAdicionarMaterialModalOpen] = useState(false);
    const [selectedEstoqueItem, setSelectedEstoqueItem] = useState(null);

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (queryKey e queryFn)
    // O PORQUÊ: Adicionamos o `organizacaoId` na `queryKey` para que o cache seja
    // único por organização, e o passamos para a função de busca.
    // =================================================================================
    const { data: estoqueCompleto, isLoading, isError, error } = useQuery({
        queryKey: ['estoque', empreendimentoId, organizacaoId],
        queryFn: () => fetchEstoqueData(supabase, empreendimentoId, organizacaoId),
        enabled: !!empreendimentoId && empreendimentoId !== 'all' && !!organizacaoId,
    });

    const itensFiltrados = useMemo(() => {
        if (!estoqueCompleto) return [];
        return estoqueCompleto.filter(item => {
            const correspondeClassificacao = filtroClassificacao === 'Todos' || item.material.classificacao === filtroClassificacao;
            const correspondeBusca = !debouncedBusca || 
                (item.material.nome && item.material.nome.toLowerCase().includes(debouncedBusca.toLowerCase())) ||
                (item.material.descricao && item.material.descricao.toLowerCase().includes(debouncedBusca.toLowerCase()));
            return correspondeClassificacao && correspondeBusca;
        });
    }, [estoqueCompleto, filtroClassificacao, debouncedBusca]);

    const equipamentosEmUso = useMemo(() => {
        if (!estoqueCompleto) return [];
        return estoqueCompleto.filter(item => 
            item.material.classificacao === 'Equipamento' && item.quantidade_em_uso > 0
        );
    }, [estoqueCompleto]);

    const handleSuccess = () => {
        toast.success("Operação realizada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['estoque', empreendimentoId, organizacaoId] }); // Atualiza a queryKey
    };

    const handleOpenBaixaModal = (item) => { setSelectedEstoqueItem(item); setIsBaixaModalOpen(true); };
    const handleOpenHistoricoModal = (item) => { setSelectedEstoqueItem(item); setIsHistoricoModalOpen(true); };
    const handleOpenRetiradaModal = (item) => { setSelectedEstoqueItem(item); setIsRetiradaModalOpen(true); };
    const handleOpenDevolucaoModal = (item) => { setSelectedEstoqueItem(item); setIsDevolucaoModalOpen(true); };
    const handleOpenBaixaQuebraModal = (item) => toast.info("Funcionalidade 'Baixa por Quebra' será implementada.");

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
    
    const FilterButton = ({ value, label, icon }) => (
        <button
            onClick={() => setFiltroClassificacao(value)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                filtroClassificacao === value
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );

    if (!empreendimentoId || empreendimentoId === 'all') {
        return (
            <div className="text-center p-10 bg-gray-50 rounded-lg">
                <FontAwesomeIcon icon={faWarehouse} size="3x" className="text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-700">Selecione uma Obra</h2>
                <p className="text-gray-500">Por favor, selecione uma obra no cabeçalho para visualizar o estoque.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            <AdicionarMaterialManualModal 
                isOpen={isAdicionarMaterialModalOpen} 
                onClose={() => setIsAdicionarMaterialModalOpen(false)} 
                onSuccess={handleSuccess}
                empreendimentoId={empreendimentoId}
            />
            {selectedEstoqueItem && (
                <>
                    <BaixaEstoqueModal isOpen={isBaixaModalOpen} onClose={() => setIsBaixaModalOpen(false)} estoqueItem={selectedEstoqueItem} onSuccess={handleSuccess} />
                    <HistoricoMovimentacoesModal isOpen={isHistoricoModalOpen} onClose={() => setIsHistoricoModalOpen(false)} estoqueItem={selectedEstoqueItem} />
                    <RegistrarRetiradaModal isOpen={isRetiradaModalOpen} onClose={() => setIsRetiradaModalOpen(false)} estoqueItem={selectedEstoqueItem} onSuccess={handleSuccess} />
                    <RegistrarDevolucaoModal isOpen={isDevolucaoModalOpen} onClose={() => setIsDevolucaoModalOpen(false)} estoqueItem={selectedEstoqueItem} onSuccess={handleSuccess} />
                </>
            )}

            <div className="flex justify-end">
                <button 
                    onClick={() => setIsAdicionarMaterialModalOpen(true)}
                    className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    Adicionar Material
                </button>
            </div>

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FilterButton value="Todos" label="Todos" icon={faWarehouse} />
                        <FilterButton value="Insumo" label="Insumos" icon={faBoxOpen} />
                        <FilterButton value="Equipamento" label="Equipamentos" icon={faTools} />
                    </div>
                    <div className="relative w-full md:w-1/3">
                        <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Buscar por nome ou descrição..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full p-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex space-x-4">
                    <TabButton tabName="disponivel" label="Estoque Disponível" icon={faWarehouse} count={itensFiltrados.length} />
                    <TabButton tabName="em_uso" label="Equipamentos em Uso" icon={faTools} count={equipamentosEmUso.length} />
                </nav>
            </div>

            {isLoading && <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando estoque...</div>}
            {isError && <div className="text-center p-10 text-red-600">Erro ao carregar dados: {error.message}</div>}

            {!isLoading && !isError && (
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
                                    {itensFiltrados.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center py-10 text-gray-500"><FontAwesomeIcon icon={faSearch} size="3x" className="mb-2" /><p>Nenhum item encontrado com os filtros aplicados.</p></td></tr>
                                    ) : (
                                        itensFiltrados.map(item => (
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
                                    {equipamentosEmUso.length === 0 ? (
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
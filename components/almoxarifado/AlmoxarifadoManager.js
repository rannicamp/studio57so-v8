"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faWarehouse, faFilter, faTimes, faArrowDown, faHistory,
    faArrowUp, faTools, faBox, faBoxOpen, faSearch, faPlus, faSyncAlt,
    faCheckSquare, faSquare, faListAlt, faExchangeAlt
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';
import BaixaEstoqueModal from './BaixaEstoqueModal';
import HistoricoMovimentacoesModal from './HistoricoMovimentacoesModal';
import RegistrarRetiradaModal from './RegistrarRetiradaModal';
import RegistrarDevolucaoModal from './RegistrarDevolucaoModal';
import AdicionarMaterialManualModal from './AdicionarMaterialManualModal';
import PainelMovimentacoes from './PainelMovimentacoes'; // <--- O NOVO IMPORT ESTÁ AQUI
import { useEmpreendimento } from '../../contexts/EmpreendimentoContext';
import { useDebounce } from 'use-debounce';
import { useAuth } from '../../contexts/AuthContext';

// Funções de cache e busca (Mantidas originais)
const getAlmoxarifadoCacheKey = (empreendimentoId) => `almoxarifadoEstoqueData_${empreendimentoId}`;

const fetchEstoqueData = async (supabase, empreendimentoId, organizacaoId) => {
    if (!empreendimentoId || empreendimentoId === 'all' || !organizacaoId) return [];

    const { data, error } = await supabase
        .from('estoque')
        .select(`
            *,
            material:materiais(id, nome, descricao, classificacao, unidade_medida)
        `)
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId)
        .order('material(nome)', { ascending: true });

    if (error) throw new Error('Falha ao buscar dados do estoque.');

    return data?.map(item => ({ ...item, quantidade_em_uso: item.quantidade_em_uso || 0 })) || [];
};

const getCachedEstoqueData = (empreendimentoId) => {
    if (!empreendimentoId) return undefined;
    try {
        const cacheKey = getAlmoxarifadoCacheKey(empreendimentoId);
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    } catch (error) {
        console.error("Erro ao ler o cache do Almoxarifado:", error);
        localStorage.removeItem(getAlmoxarifadoCacheKey(empreendimentoId));
    }
    return undefined;
};

export default function AlmoxarifadoManager() {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const { selectedEmpreendimento: empreendimentoId } = useEmpreendimento();

    // --- NOVO ESTADO: Controla qual tela principal está visível ---
    const [modoVisualizacao, setModoVisualizacao] = useState('estoque'); // 'estoque' ou 'movimentacoes'

    const isInitialFetchCompleted = useRef(false);

    // Estados do Estoque (Mantidos)
    const [filtroClassificacao, setFiltroClassificacao] = useState('Todos');
    const [termoBusca, setTermoBusca] = useState('');
    const [debouncedBusca] = useDebounce(termoBusca, 300);
    const [mostrarZerados, setMostrarZerados] = useState(false);
    const [activeTab, setActiveTab] = useState('disponivel'); // Sub-abas do estoque
    
    // Estados dos Modais (Mantidos)
    const [isBaixaModalOpen, setIsBaixaModalOpen] = useState(false);
    const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
    const [isRetiradaModalOpen, setIsRetiradaModalOpen] = useState(false);
    const [isDevolucaoModalOpen, setIsDevolucaoModalOpen] = useState(false);
    const [isAdicionarMaterialModalOpen, setIsAdicionarMaterialModalOpen] = useState(false);
    const [selectedEstoqueItem, setSelectedEstoqueItem] = useState(null);

    // Mutação para classificação (Mantida)
    const [updatingMaterialId, setUpdatingMaterialId] = useState(null);
    const updateClassificacaoMutation = useMutation({
        mutationFn: async ({ materialId, novaClassificacao }) => {
            const { error } = await supabase
                .from('materiais')
                .update({ classificacao: novaClassificacao })
                .eq('id', materialId);
            if (error) throw new Error(error.message);
            return { materialId, novaClassificacao };
        },
        onMutate: ({ materialId }) => { setUpdatingMaterialId(materialId); },
        onSuccess: (data, variables) => {
            toast.success(`Material "${variables.materialNome}" atualizado para ${variables.novaClassificacao}.`);
            queryClient.invalidateQueries({ queryKey: ['estoque', empreendimentoId, organizacaoId] });
        },
        onError: (error) => { toast.error(`Erro ao atualizar classificação: ${error.message}`); },
        onSettled: () => { setUpdatingMaterialId(null); },
    });

    const handleChangeClassificacao = (material) => {
        if (updatingMaterialId) return;
        const novaClassificacao = material.classificacao === 'Insumo' ? 'Equipamento' : 'Insumo';
        updateClassificacaoMutation.mutate({ materialId: material.id, novaClassificacao, materialNome: material.nome });
    };

    // Query de Estoque (Mantida)
    const { data: estoqueCompleto, isLoading, isError, error, isSuccess } = useQuery({
        queryKey: ['estoque', empreendimentoId, organizacaoId],
        queryFn: () => fetchEstoqueData(supabase, empreendimentoId, organizacaoId),
        enabled: !!empreendimentoId && empreendimentoId !== 'all' && !!organizacaoId,
        placeholderData: () => getCachedEstoqueData(empreendimentoId),
    });

    // Cache Effect (Mantido)
    useEffect(() => {
        if (estoqueCompleto && isSuccess) {
            try {
                const cacheKey = getAlmoxarifadoCacheKey(empreendimentoId);
                localStorage.setItem(cacheKey, JSON.stringify(estoqueCompleto));
                if (!isInitialFetchCompleted.current) {
                    isInitialFetchCompleted.current = true;
                }
            } catch (error) {
                console.error("Erro ao salvar o cache do Almoxarifado:", error);
            }
        }
    }, [estoqueCompleto, isSuccess, empreendimentoId]);

    // Lógica de Filtragem (Mantida)
    const itensFiltrados = useMemo(() => {
        if (!estoqueCompleto) return [];
        let items = estoqueCompleto;
        if (filtroClassificacao !== 'Todos') {
            items = items.filter(item => item.material.classificacao === filtroClassificacao);
        }
        if (debouncedBusca) {
            items = items.filter(item =>
                (item.material.nome && item.material.nome.toLowerCase().includes(debouncedBusca.toLowerCase())) ||
                (item.material.descricao && item.material.descricao.toLowerCase().includes(debouncedBusca.toLowerCase()))
            );
        }
        if (!mostrarZerados) {
            items = items.filter(item =>
                item.quantidade_atual > 0 ||
                (item.material.classificacao === 'Equipamento' && item.quantidade_em_uso > 0)
            );
        }
        return items;
    }, [estoqueCompleto, filtroClassificacao, debouncedBusca, mostrarZerados]);

    const equipamentosEmUso = useMemo(() => {
        if (!estoqueCompleto) return [];
        return estoqueCompleto.filter(item =>
            item.material.classificacao === 'Equipamento' && item.quantidade_em_uso > 0
        );
    }, [estoqueCompleto]);

    const handleSuccess = () => {
        toast.success("Operação realizada com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['estoque', empreendimentoId, organizacaoId] });
        // Força atualização das movimentações também
        queryClient.invalidateQueries({ queryKey: ['movimentacoes_geral'] });
    };

    const handleOpenBaixaModal = (item) => { setSelectedEstoqueItem(item); setIsBaixaModalOpen(true); };
    const handleOpenHistoricoModal = (item) => { setSelectedEstoqueItem(item); setIsHistoricoModalOpen(true); };
    const handleOpenRetiradaModal = (item) => { setSelectedEstoqueItem(item); setIsRetiradaModalOpen(true); };
    const handleOpenDevolucaoModal = (item) => { setSelectedEstoqueItem(item); setIsDevolucaoModalOpen(true); };
    const handleOpenBaixaQuebraModal = (item) => toast.info("Funcionalidade 'Baixa por Quebra' será implementada.");

    // Componentes Auxiliares
    const TabButton = ({ tabName, label, icon, count }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex items-center gap-2 py-2 px-4 font-semibold text-sm rounded-t-lg border-b-2 ${activeTab === tabName
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
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${filtroClassificacao === value
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
        >
            <FontAwesomeIcon icon={icon} />
            {label}
        </button>
    );

    // --- RENDERIZAÇÃO ---

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
        <div className="space-y-6">
            
            {/* === NOVA NAVEGAÇÃO DE TOPO (Estoque vs Movimentações) === */}
            <div className="bg-white p-1.5 rounded-lg border border-gray-200 inline-flex shadow-sm gap-1">
                <button
                    onClick={() => setModoVisualizacao('estoque')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                        modoVisualizacao === 'estoque'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FontAwesomeIcon icon={faBox} />
                    Gerenciar Estoque
                </button>
                <button
                    onClick={() => setModoVisualizacao('movimentacoes')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${
                        modoVisualizacao === 'movimentacoes'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FontAwesomeIcon icon={faExchangeAlt} />
                    Histórico de Movimentações
                </button>
            </div>

            {/* ================================================================= */}
            {/* VISÃO 1: PAINEL DE MOVIMENTAÇÕES (NOVO)                           */}
            {/* ================================================================= */}
            {modoVisualizacao === 'movimentacoes' && (
                <div className="animate-in fade-in duration-300">
                    <PainelMovimentacoes empreendimentoId={empreendimentoId} />
                </div>
            )}

            {/* ================================================================= */}
            {/* VISÃO 2: GERENCIAMENTO DE ESTOQUE (ANTIGO)                        */}
            {/* ================================================================= */}
            {modoVisualizacao === 'estoque' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    {/* Modais */}
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

                    {/* Botão Adicionar Material */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsAdicionarMaterialModalOpen(true)}
                            className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            Adicionar Material
                        </button>
                    </div>

                    {/* Área de Filtros */}
                    <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-600 mr-2">Filtrar por:</span>
                                <FilterButton value="Todos" label="Todos" icon={faWarehouse} />
                                <FilterButton value="Insumo" label="Insumos" icon={faBoxOpen} />
                                <FilterButton value="Equipamento" label="Equipamentos" icon={faTools} />
                                <button
                                    onClick={() => setMostrarZerados(!mostrarZerados)}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${mostrarZerados
                                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                    title={mostrarZerados ? "Ocultar itens com estoque zerado" : "Mostrar itens com estoque zerado"}
                                >
                                    <FontAwesomeIcon icon={mostrarZerados ? faCheckSquare : faSquare} />
                                    Incluir Zerados
                                </button>
                            </div>
                            <div className="relative w-full sm:w-auto md:w-1/3 flex-grow sm:flex-grow-0">
                                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nome ou descrição..."
                                    value={termoBusca}
                                    onChange={(e) => setTermoBusca(e.target.value)}
                                    className="w-full p-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sub-Abas do Estoque */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-4">
                            <TabButton tabName="disponivel" label="Estoque Disponível" icon={faWarehouse} count={itensFiltrados.length} />
                            <TabButton tabName="em_uso" label="Equipamentos em Uso" icon={faTools} count={equipamentosEmUso.length} />
                        </nav>
                    </div>

                    {/* Estados de Loading/Erro */}
                    {isLoading && !estoqueCompleto && <div className="text-center p-10"><FontAwesomeIcon icon={faSpinner} spin size="2x" /> Carregando estoque...</div>}
                    {isError && <div className="text-center p-10 text-red-600">Erro ao carregar dados: {error.message}</div>}

                    {/* Tabelas */}
                    {(isSuccess || estoqueCompleto) && (
                        <>
                            {/* Tabela Estoque Disponível */}
                            {activeTab === 'disponivel' && (
                                <div className="overflow-x-auto border rounded-lg bg-white">
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
                                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-semibold text-gray-800">{item.material.nome}</div>
                                                            <div className="text-xs text-gray-500">{item.material.descricao}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <button
                                                                onClick={() => handleChangeClassificacao(item.material)}
                                                                disabled={updatingMaterialId === item.material.id}
                                                                className={`w-28 text-center px-2 py-1 text-xs font-semibold rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 group relative ${item.material.classificacao === 'Equipamento' ? 'bg-orange-100 text-orange-800' : 'bg-teal-100 text-teal-800'}`}
                                                                title="Clique para alterar a classificação"
                                                            >
                                                                {updatingMaterialId === item.material.id ? (
                                                                    <FontAwesomeIcon icon={faSpinner} spin />
                                                                ) : (
                                                                    <>
                                                                        <span className="group-hover:opacity-0 transition-opacity">{item.material.classificacao}</span>
                                                                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                            <FontAwesomeIcon icon={faSyncAlt} className="mr-1" /> Alterar
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-bold text-xl">{item.quantidade_atual} <span className="text-xs font-normal text-gray-500">{item.material.unidade_medida}</span></td>
                                                        <td className="px-6 py-4 text-center font-bold text-lg text-gray-500">{item.quantidade_em_uso > 0 ? item.quantidade_em_uso : '-'}</td>
                                                        <td className="px-6 py-4 text-center space-x-2">
                                                            {item.material.classificacao === 'Insumo' ? (
                                                                <button onClick={() => handleOpenBaixaModal(item)} className="bg-red-500 text-white px-3 py-1 rounded-md text-xs hover:bg-red-600 font-bold" title="Dar Baixa por Uso">
                                                                    <FontAwesomeIcon icon={faArrowDown} /> Baixa (Uso)
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleOpenRetiradaModal(item)} className="bg-blue-500 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-600 font-bold" title="Registrar Retirada de Equipamento">
                                                                    <FontAwesomeIcon icon={faArrowUp} rotation={180} /> Retirada
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
                            {/* Tabela Equipamentos em Uso */}
                            {activeTab === 'em_uso' && (
                                <div className="overflow-x-auto border rounded-lg bg-white">
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
                                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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
            )}
        </div>
    );
}
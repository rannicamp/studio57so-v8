"use client";

import { useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, 
    faArrowUp, 
    faArrowDown, 
    faFilter, 
    faUser, 
    faCalendarAlt,
    faSearch,
    faExclamationTriangle,
    faTimes
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from 'use-debounce'; // Importante para não travar a digitação

// Busca simples de funcionários para o filtro (dropdown)
const fetchFuncionarios = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data } = await supabase
        .from('funcionarios')
        .select('id, full_name')
        .eq('organizacao_id', organizacaoId)
        .order('full_name');
    return data || [];
};

// --- NOVA FUNÇÃO DE BUSCA VIA RPC (BANCO DE DADOS) ---
const fetchMovimentacoesRPC = async (supabase, organizacaoId, empreendimentoId, filtros, termoBusca) => {
    if (!organizacaoId || !empreendimentoId) return [];

    const { funcionarioId, dataInicio, dataFim, tipoMovimentacao } = filtros;

    // Prepara os parâmetros para a função SQL
    const params = {
        p_organizacao_id: organizacaoId,
        p_empreendimento_id: empreendimentoId,
        p_termo_busca: termoBusca || null,
        p_tipo: tipoMovimentacao === 'Todos' ? null : tipoMovimentacao,
        p_data_inicio: dataInicio ? `${dataInicio}T00:00:00` : null,
        p_data_fim: dataFim ? `${dataFim}T23:59:59` : null,
        p_funcionario_id: funcionarioId || null
    };

    // Chama a função no banco
    const { data, error } = await supabase
        .rpc('buscar_movimentacoes_estoque', params);

    if (error) {
        console.error("Erro RPC:", error);
        throw new Error('Erro ao buscar dados: ' + error.message);
    }
    return data || [];
};

export default function PainelMovimentacoes({ empreendimentoId }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // --- ESTADOS ---
    const [filtroTexto, setFiltroTexto] = useState('');
    // O debounce espera você parar de digitar por 500ms antes de buscar no banco
    const [termoBuscaDebounced] = useDebounce(filtroTexto, 500);

    const [filtrosQuery, setFiltrosQuery] = useState({
        funcionarioId: '',
        tipoMovimentacao: 'Todos',
        dataInicio: '',
        dataFim: ''
    });

    const handleFilterChange = (campo, valor) => {
        setFiltrosQuery(prev => ({ ...prev, [campo]: valor }));
    };

    const limparFiltros = () => {
        setFiltroTexto('');
        setFiltrosQuery({
            funcionarioId: '',
            tipoMovimentacao: 'Todos',
            dataInicio: '',
            dataFim: ''
        });
    };

    // Carrega Funcionários
    const { data: funcionarios } = useQuery({
        queryKey: ['funcionarios_filtro', organizacaoId],
        queryFn: () => fetchFuncionarios(supabase, organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 10,
    });

    // Carrega Movimentações (Reage a qualquer mudança de filtro ou texto)
    const { data: movimentacoes, isLoading, isError, error } = useQuery({
        queryKey: ['movimentacoes_rpc', organizacaoId, empreendimentoId, filtrosQuery, termoBuscaDebounced],
        queryFn: () => fetchMovimentacoesRPC(supabase, organizacaoId, empreendimentoId, filtrosQuery, termoBuscaDebounced),
        enabled: !!organizacaoId && !!empreendimentoId,
    });

    const formatarData = (dataIso) => {
        if (!dataIso) return '-';
        return new Date(dataIso).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getTipoConfig = (tipo) => {
        switch (tipo) {
            case 'Entrada por Compra':
            case 'Devolução ao Estoque':
                return { color: 'text-green-700 bg-green-50 border-green-200', icon: faArrowUp };
            case 'Saída por Uso':
            case 'Retirada por Funcionário':
            case 'Baixa por Quebra':
                return { color: 'text-red-700 bg-red-50 border-red-200', icon: faArrowDown };
            default:
                return { color: 'text-gray-700 bg-gray-50 border-gray-200', icon: faFilter };
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-220px)] min-h-[600px]">
            
            {/* === BARRA DE FERRAMENTAS === */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-4">
                
                {/* Título e Ações */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-2 text-gray-700">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-500" />
                        <h2 className="font-semibold text-lg">Histórico de Movimentações</h2>
                        {!isLoading && movimentacoes && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                {movimentacoes.length} encontrados
                            </span>
                        )}
                    </div>
                    
                    {/* Botão Limpar */}
                    {(filtroTexto || filtrosQuery.funcionarioId || filtrosQuery.dataInicio || filtrosQuery.dataFim || filtrosQuery.tipoMovimentacao !== 'Todos') && (
                        <button 
                            onClick={limparFiltros}
                            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 hover:underline transition-all"
                        >
                            <FontAwesomeIcon icon={faTimes} /> Limpar Filtros
                        </button>
                    )}
                </div>

                {/* Grid de Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3">
                    
                    {/* 1. Pesquisa de Texto (Maior destaque) */}
                    <div className="lg:col-span-4 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                        </div>
                        <input
                            type="text"
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            placeholder="Buscar item, pessoa, obs..."
                            className="pl-10 w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                        />
                    </div>

                    {/* 2. Filtro de Tipo */}
                    <div className="lg:col-span-2">
                        <select
                            value={filtrosQuery.tipoMovimentacao}
                            onChange={(e) => handleFilterChange('tipoMovimentacao', e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
                        >
                            <option value="Todos">Todos os Tipos</option>
                            <optgroup label="Entradas">
                                <option value="Entrada por Compra">Entrada (Compra)</option>
                                <option value="Devolução ao Estoque">Devolução</option>
                            </optgroup>
                            <optgroup label="Saídas">
                                <option value="Retirada por Funcionário">Retirada (Func.)</option>
                                <option value="Saída por Uso">Uso na Obra</option>
                                <option value="Baixa por Quebra">Quebra/Perda</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* 3. Funcionario */}
                    <div className="lg:col-span-3 relative">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                        </div>
                        <select
                            value={filtrosQuery.funcionarioId}
                            onChange={(e) => handleFilterChange('funcionarioId', e.target.value)}
                            className="pl-10 w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
                        >
                            <option value="">Todos os Funcionários</option>
                            {funcionarios?.map(func => (
                                <option key={func.id} value={func.id}>{func.full_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 4. Datas */}
                    <div className="lg:col-span-3 flex gap-2">
                        <div className="relative w-full">
                            <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-medium">De</span>
                            <input
                                type="date"
                                value={filtrosQuery.dataInicio}
                                onChange={(e) => handleFilterChange('dataInicio', e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                            />
                        </div>
                        <div className="relative w-full">
                            <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-medium">Até</span>
                            <input
                                type="date"
                                value={filtrosQuery.dataFim}
                                onChange={(e) => handleFilterChange('dataFim', e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* === CONTEÚDO DA TABELA === */}
            <div className="flex-grow overflow-auto bg-gray-50/30">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" /> 
                        <p>Consultando banco de dados...</p>
                    </div>
                ) : isError ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-500 p-8 text-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
                        <p>Ops! {error.message}</p>
                    </div>
                ) : movimentacoes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                        <FontAwesomeIcon icon={faSearch} className="text-4xl mb-3 text-gray-200" />
                        <p>Nenhum registro encontrado.</p>
                        <p className="text-sm mt-1 text-gray-400">Tente mudar os filtros ou o termo de busca.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left relative border-collapse">
                        <thead className="bg-gray-100 text-gray-600 font-bold border-b sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Data / Hora</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Material</th>
                                <th className="px-4 py-3 text-center">Qtd.</th>
                                <th className="px-4 py-3">Responsável / Detalhes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {movimentacoes.map((mov) => {
                                const config = getTipoConfig(mov.tipo);
                                return (
                                    <tr key={mov.id} className="hover:bg-blue-50 transition-colors group">
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs font-medium">
                                            {formatarData(mov.data_movimentacao)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${config.color}`}>
                                                <FontAwesomeIcon icon={config.icon} className="text-[10px]" />
                                                {mov.tipo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-800">
                                                {mov.material_nome}
                                            </div>
                                            {mov.observacao && (
                                                <div className="text-[11px] text-gray-400 italic mt-1 max-w-[300px] truncate" title={mov.observacao}>
                                                    Obs: {mov.observacao}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-bold text-gray-800 text-base">{mov.quantidade}</span>
                                            <span className="text-[10px] text-gray-500 ml-1 block">
                                                {mov.unidade_medida}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {mov.funcionario_nome && (
                                                <div className="flex items-center gap-1 mb-1">
                                                    <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                                                    <span className="font-semibold text-blue-700">{mov.funcionario_nome}</span>
                                                </div>
                                            )}
                                            {mov.pedido_compra_id && (
                                                <div className="mb-1 text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded w-max">
                                                    Pedido #{mov.pedido_compra_id}
                                                </div>
                                            )}
                                            <div className="text-gray-400 text-[10px] mt-1 border-t pt-1 w-max">
                                                Reg. por: {mov.usuario_nome || 'Sistema'}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
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
    faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';

// Busca simples de funcionários para o filtro
const fetchFuncionarios = async (supabase, organizacaoId) => {
    if (!organizacaoId) return [];
    const { data } = await supabase
        .from('funcionarios')
        .select('id, full_name')
        .eq('organizacao_id', organizacaoId)
        .order('full_name');
    return data || [];
};

// --- A NOVA LÓGICA DE BUSCA BLINDADA ---
const fetchMovimentacoes = async (supabase, organizacaoId, empreendimentoId, funcionarioId) => {
    if (!organizacaoId || !empreendimentoId) return [];

    // PASSO 1: Descobrir quais IDs de estoque pertencem a esta obra (Empreendimento)
    // Isso garante que não misturamos dados de outras obras.
    const { data: itensEstoque, error: erroEstoque } = await supabase
        .from('estoque')
        .select('id')
        .eq('empreendimento_id', empreendimentoId)
        .eq('organizacao_id', organizacaoId);

    if (erroEstoque) {
        console.error("Erro ao buscar itens do estoque:", erroEstoque);
        throw new Error("Falha ao identificar itens da obra.");
    }

    // Se a obra não tem itens cadastrados, não tem movimentação para mostrar.
    if (!itensEstoque || itensEstoque.length === 0) return [];

    const idsEstoqueDaObra = itensEstoque.map(item => item.id);

    // PASSO 2: Buscar as movimentações usando a lista de IDs encontrados
    let query = supabase
        .from('movimentacoes_estoque')
        .select(`
            id,
            tipo,
            quantidade,
            data_movimentacao,
            observacao,
            funcionario_id,
            pedido_compra_id,
            usuario_id,
            estoque (
                id,
                materiais (
                    nome,
                    unidade_medida
                )
            ),
            funcionarios (
                full_name
            ),
            usuarios (
                nome
            )
        `)
        .in('estoque_id', idsEstoqueDaObra) // <--- O SEGREDO: Filtra apenas pelos itens desta obra
        .order('data_movimentacao', { ascending: false });

    // Aplica filtro de funcionário se houver
    if (funcionarioId) {
        query = query.eq('funcionario_id', funcionarioId);
    }

    const { data, error } = await query;

    if (error) throw new Error('Erro ao carregar movimentações: ' + error.message);
    return data;
};

export default function PainelMovimentacoes({ empreendimentoId }) {
    const supabase = createClient();
    const { user } = useAuth();
    const organizacaoId = user?.organizacao_id;

    const [filtroFuncionario, setFiltroFuncionario] = useState('');

    const { data: funcionarios } = useQuery({
        queryKey: ['funcionarios_filtro', organizacaoId],
        queryFn: () => fetchFuncionarios(supabase, organizacaoId),
        enabled: !!organizacaoId,
        staleTime: 1000 * 60 * 10,
    });

    const { data: movimentacoes, isLoading, isError, error } = useQuery({
        queryKey: ['movimentacoes_geral', organizacaoId, empreendimentoId, filtroFuncionario],
        queryFn: () => fetchMovimentacoes(supabase, organizacaoId, empreendimentoId, filtroFuncionario),
        enabled: !!organizacaoId && !!empreendimentoId,
    });

    const formatarData = (dataIso) => {
        if (!dataIso) return '-';
        return new Date(dataIso).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTipoConfig = (tipo) => {
        switch (tipo) {
            case 'Entrada por Compra':
            case 'Devolução ao Estoque':
                return { color: 'text-green-700 bg-green-50 border-green-200', icon: faArrowUp, label: 'Entrada' };
            case 'Saída por Uso':
            case 'Retirada por Funcionário':
            case 'Baixa por Quebra':
                return { color: 'text-red-700 bg-red-50 border-red-200', icon: faArrowDown, label: 'Saída' };
            default:
                return { color: 'text-gray-700 bg-gray-50 border-gray-200', icon: faFilter, label: tipo };
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-gray-700">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-blue-500" />
                    <h2 className="font-semibold">Linha do Tempo</h2>
                    {movimentacoes && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">{movimentacoes.length}</span>}
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                        </div>
                        <select
                            value={filtroFuncionario}
                            onChange={(e) => setFiltroFuncionario(e.target.value)}
                            className="pl-10 w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Todas as Pessoas</option>
                            {funcionarios?.map(func => (
                                <option key={func.id} value={func.id}>{func.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabela */}
            <div className="flex-grow overflow-auto">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" /> 
                        <p>Buscando histórico...</p>
                    </div>
                ) : isError ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-500 p-8 text-center">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-3xl mb-3" />
                        <p>Ops! {error.message}</p>
                        <p className="text-sm text-gray-400 mt-2">Verifique se há itens cadastrados nesta obra.</p>
                    </div>
                ) : movimentacoes?.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                        <FontAwesomeIcon icon={faSearch} className="text-4xl mb-3 text-gray-200" />
                        <p>Nenhuma movimentação registrada para esta obra ainda.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left relative border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-medium border-b sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Data</th>
                                <th className="px-4 py-3">Ação</th>
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3 text-center">Qtd.</th>
                                <th className="px-4 py-3">Envolvidos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {movimentacoes.map((mov) => {
                                const config = getTipoConfig(mov.tipo);
                                return (
                                    <tr key={mov.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                                            {formatarData(mov.data_movimentacao)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${config.color}`}>
                                                <FontAwesomeIcon icon={config.icon} className="text-[10px]" />
                                                {mov.tipo}
                                            </span>
                                            {mov.observacao && (
                                                <div className="text-[11px] text-gray-400 italic mt-1 max-w-[200px] truncate" title={mov.observacao}>
                                                    {mov.observacao}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {mov.estoque?.materiais?.nome || `Item ID: ${mov.estoque_id}`}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-bold text-gray-700">{mov.quantidade}</span>
                                            <span className="text-[10px] text-gray-400 ml-1">{mov.estoque?.materiais?.unidade_medida}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs">
                                            {mov.funcionarios?.full_name && (
                                                <div className="font-semibold text-blue-700 mb-1">
                                                    👷 {mov.funcionarios.full_name}
                                                </div>
                                            )}
                                            {mov.pedido_compra_id && (
                                                <div className="font-semibold text-green-700 mb-1">
                                                    🛒 Pedido #{mov.pedido_compra_id}
                                                </div>
                                            )}
                                            <div className="text-gray-400 text-[10px]">
                                                Reg: {mov.usuarios?.nome || 'Sistema'}
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
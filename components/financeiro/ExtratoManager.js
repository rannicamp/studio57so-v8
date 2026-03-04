"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faArrowUp, faArrowDown, faAngleRight, faTrash } from '@fortawesome/free-solid-svg-icons';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';

const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function ExtratoManager({ contas }) {
    const supabase = createClient();
    const queryClient = useQueryClient();
    const { user, hasPermission } = useAuth();
    const organizacaoId = user?.organizacao_id;

    // Gerar lista dos últimos 12 meses
    const mesesDisponiveis = useMemo(() => {
        const meses = [];
        const hoje = new Date();
        for (let i = 0; i < 12; i++) {
            const dataBase = subMonths(hoje, i);
            meses.push(startOfMonth(dataBase));
        }
        return meses;
    }, []);

    // Estados
    const [contaSelecionadaId, setContaSelecionadaId] = useState(contas?.[0]?.id || '');
    const [mesSelecionado, setMesSelecionado] = useState(mesesDisponiveis[0]); // Padrão: Mês atual
    const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const contaSelecionada = contas?.find(c => c.id == contaSelecionadaId);

    // Queries
    const { data: extratoData, isLoading } = useQuery({
        queryKey: ['extrato', contaSelecionadaId, mesSelecionado.toISOString(), organizacaoId],
        queryFn: async () => {
            if (!contaSelecionadaId || !organizacaoId) return null;

            const startDate = format(startOfMonth(mesSelecionado), 'yyyy-MM-dd');
            const endDate = format(endOfMonth(mesSelecionado), 'yyyy-MM-dd');

            // 1. Busca Saldo Anterior RPC
            const { data: saldoAnteriorAux, error: saldoError } = await supabase.rpc('calcular_saldo_anterior', {
                p_conta_id: Number(contaSelecionadaId),
                p_data_inicio: startDate,
                p_organizacao_id: organizacaoId
            });
            if (saldoError) throw saldoError;

            const saldoAnterior = saldoAnteriorAux || 0;

            // 2. Busca Lançamentos do Mês
            const { data: lancamentos, error: lancamentosError } = await supabase
                .from('lancamentos')
                .select('*, favorecido:contatos!favorecido_contato_id(*), categoria:categorias_financeiras(*), anexos:lancamentos_anexos(*)')
                .eq('conta_id', Number(contaSelecionadaId))
                .eq('organizacao_id', organizacaoId)
                .gte('data_pagamento', startDate)
                .lte('data_pagamento', endDate)
                .in('status', ['Pago', 'Conciliado'])
                .order('data_pagamento', { ascending: true })
                .order('created_at', { ascending: true });

            if (lancamentosError) throw lancamentosError;

            // 3. Processa Itens e Totais
            let saldoCorrente = saldoAnterior;
            let totalEntradas = 0;
            let totalSaidas = 0;

            const itens = (lancamentos || []).map(lanc => {
                const entrada = lanc.tipo === 'Receita' ? Number(lanc.valor) : 0;
                const saida = lanc.tipo === 'Despesa' ? Number(lanc.valor) : 0;

                saldoCorrente += entrada - saida;
                totalEntradas += entrada;
                totalSaidas += saida;

                return {
                    ...lanc,
                    entrada,
                    saida,
                    saldo_acumulado: saldoCorrente
                };
            });

            return {
                saldoAnterior,
                entradas: totalEntradas,
                saidas: totalSaidas,
                saldoFinal: saldoCorrente,
                itens
            };
        },
        enabled: !!contaSelecionadaId && !!mesSelecionado && !!organizacaoId
    });

    // Exclusão usa useMutation para integrar com o cache
    const exclusaoMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('lancamentos')
                .delete()
                .eq('id', id)
                .eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamento excluído com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
            queryClient.invalidateQueries({ queryKey: ['lancamentos'] }); // Invalida caso exista
        },
        onError: (err) => {
            toast.error(`Erro ao excluir: ${err.message}`);
        }
    });

    const handleDelete = (e, item) => {
        e.stopPropagation(); // Evita abrir o sidebar se clicar no botão de apagar
        if (window.confirm(`Deseja realmente excluir o lançamento "${item.descricao}"?`)) {
            exclusaoMutation.mutate(item.id);
        }
    };

    const handleRowClick = (item) => {
        setLancamentoSelecionado(item);
        setIsSidebarOpen(true);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* CABEÇALHO UNIFICADO DE CONTA (Estilo Nubank) */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600 hidden md:block">
                    <FontAwesomeIcon icon={faLandmark} size="lg" />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Conta</label>
                    <select
                        value={contaSelecionadaId}
                        onChange={(e) => setContaSelecionadaId(e.target.value)}
                        className="w-full md:w-auto min-w-[300px] p-2 border border-gray-300 rounded-md font-medium text-gray-700 focus:ring-2 focus:ring-blue-500"
                    >
                        {contas.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                    </select>
                </div>

                {contaSelecionada && (
                    <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="bg-gray-50 p-2 md:p-3 rounded-lg border">
                            <p className="text-[10px] md:text-xs text-gray-500 uppercase font-semibold">Saldo Atual na Conta</p>
                            <p className="text-sm md:text-lg font-bold text-gray-700">
                                {formatCurrency(contaSelecionada.saldo_inicial || 0)}
                                {/* O saldo atual exato hoje pode ser complexo, por enquanto mantendo como no modal original que não possuia esse dado. */}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* CONTEÚDO: Grid 1/4 - 3/4 */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

                {/* LADO ESQUERDO: Seletor de Meses */}
                <div className="lg:col-span-1 space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase mb-2">Período de Referência</h3>
                    <div className="bg-white border text-sm rounded-lg overflow-hidden flex flex-col max-h-[500px] overflow-y-auto shadow-sm">
                        {mesesDisponiveis.map((mes, idx) => {
                            const isSelected = isSameMonth(mes, mesSelecionado);
                            const isCurrentMonth = isSameMonth(mes, new Date());

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setMesSelecionado(mes)}
                                    className={`text-left p-4 border-b last:border-0 transition-all flex items-center justify-between
                                        ${isSelected
                                            ? 'bg-blue-50 border-blue-200 border-l-4 border-l-blue-500'
                                            : 'hover:bg-gray-50 bg-white border-l-4 border-l-transparent'
                                        }
                                    `}
                                >
                                    <div>
                                        <div className={`font-bold capitalize ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                            {format(mes, 'MMMM', { locale: ptBR })} <span className="font-normal opacity-70">{format(mes, 'yyyy')}</span>
                                        </div>
                                    </div>
                                    {isCurrentMonth && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide
                                            ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                                        `}>
                                            Atual
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* LADO DIREITO: O Extrato */}
                <div className="lg:col-span-3">
                    {isLoading ? (
                        <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 text-center">
                            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-blue-500" />
                            <p className="text-gray-500 mt-2">Carregando movimentações do mês...</p>
                        </div>
                    ) : extratoData ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Resumo do Mês (TopBar) */}
                            <div className="p-6 border-b bg-gradient-to-br from-gray-50 to-white">
                                <h2 className="text-xl font-bold text-gray-800 capitalize mb-4">
                                    Movimentações de {format(mesSelecionado, 'MMMM / yyyy', { locale: ptBR })}
                                </h2>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Saldo Anterior</p>
                                        <p className="text-sm font-semibold text-gray-800 mt-1" title="Balanço inicial no começo deste mês">
                                            {formatCurrency(extratoData.saldoAnterior)}
                                        </p>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-green-700 uppercase"><FontAwesomeIcon icon={faArrowUp} className="mr-1" /> Entradas (No Mês)</p>
                                        <p className="text-sm font-semibold text-green-700 mt-1">+{formatCurrency(extratoData.entradas)}</p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-red-700 uppercase"><FontAwesomeIcon icon={faArrowDown} className="mr-1" /> Saídas (No Mês)</p>
                                        <p className="text-sm font-semibold text-red-700 mt-1">-{formatCurrency(extratoData.saidas)}</p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 shadow-sm">
                                        <p className="text-[10px] font-bold text-blue-700 uppercase">Saldo Final (No Período)</p>
                                        <p className={`text-sm font-bold mt-1 ${extratoData.saldoFinal < 0 ? 'text-red-600' : 'text-blue-800'}`}>
                                            {formatCurrency(extratoData.saldoFinal)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de Movimentações */}
                            <div className="divide-y divide-gray-100">
                                {extratoData.itens.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        Nenhuma movimentação identificada para o período.
                                    </div>
                                ) : (
                                    extratoData.itens.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleRowClick(item)}
                                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between group"
                                        >
                                            {/* Data */}
                                            <div className="flex-shrink-0 w-16 text-center">
                                                <div className="text-sm font-bold text-gray-700">{format(parseISO(item.data_pagamento), 'dd')}</div>
                                                <div className="text-[10px] uppercase font-semibold text-gray-400">{format(parseISO(item.data_pagamento), 'MMM', { locale: ptBR })}</div>
                                            </div>

                                            {/* Descrição e Infos */}
                                            <div className="flex-1 px-4 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-sm font-bold text-gray-800 truncate" title={item.descricao}>{item.descricao}</p>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.categoria?.nome || 'Sem Categoria'}
                                                    {item.favorecido?.nome ? ` • ${item.favorecido.nome}` : ''}
                                                </p>
                                            </div>

                                            {/* Valores e Saldo */}
                                            <div className="flex-shrink-0 flex items-center gap-6 pr-4">
                                                {/* Coluna 1: Valor */}
                                                <div className="text-right min-w-[100px]">
                                                    {item.tipo === 'Receita' ? (
                                                        <p className="text-sm font-bold text-green-600">+{formatCurrency(item.entrada)}</p>
                                                    ) : (
                                                        <p className="text-sm font-bold text-gray-800">-{formatCurrency(item.saida)}</p>
                                                    )}
                                                </div>

                                                {/* Coluna 2: Saldo */}
                                                <div className="text-right min-w-[100px] border-l border-gray-100 pl-4">
                                                    <p className="text-[10px] text-gray-400 font-semibold uppercase mb-0.5">Saldo</p>
                                                    <p className={`text-sm font-bold ${item.saldo_acumulado < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                        {formatCurrency(item.saldo_acumulado)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Ações / Ícone Sidebar */}
                                            <div className="flex-shrink-0 flex items-center gap-2 text-gray-300 group-hover:text-blue-500 transition-colors">
                                                {hasPermission('financeiro', 'pode_excluir') && (
                                                    <button
                                                        onClick={(e) => handleDelete(e, item)}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                                        title="Excluir Lançamento"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} size="sm" />
                                                    </button>
                                                )}
                                                <FontAwesomeIcon icon={faAngleRight} />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Visualizador de Detalhes (Sidebar) */}
            <LancamentoDetalhesSidebar
                open={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                lancamento={lancamentoSelecionado}
            />
        </div>
    );
}

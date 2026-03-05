"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faLandmark, faArrowUp, faArrowDown, faAngleRight, faTrash, faHandHoldingDollar, faCheckCircle, faExclamationTriangle, faFileAlt, faChevronDown, faChevronRight, faTimes } from '@fortawesome/free-solid-svg-icons';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import LancamentoDetalhesSidebar from './LancamentoDetalhesSidebar';
import OfxUploader from './OfxUploader';
import PanelConciliacaoOFX from './PanelConciliacaoOFX';

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
    const [ofxPainelAberto, setOfxPainelAberto] = useState(false);
    const [arquivoOfxExpandido, setArquivoOfxExpandido] = useState(null); // id do arq selecionado
    const [modoConciliacaoMes, setModoConciliacaoMes] = useState(null); // ativa o painel duplo e esconde extrato

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

            // 2. Busca Lançamentos Oficiais do Mês
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

            // 3. Calcular Saldo e Totais
            let saldoCorrente = saldoAnterior;
            let totalEntradas = 0;
            let totalSaidas = 0;

            const itens = (lancamentos || []).map(lanc => {
                const entrada = lanc.tipo === 'Receita' ? Number(lanc.valor) : 0;
                const saida = lanc.tipo === 'Despesa' ? Number(lanc.valor) : 0;
                saldoCorrente += entrada - saida;
                totalEntradas += entrada;
                totalSaidas += saida;

                // Status visual: Se tem fitid_banco vinculado -> está conciliado com o OFX
                const status_exibicao = lanc.fitid_banco ? 'Conciliado' : lanc.status;

                return { ...lanc, entrada, saida, saldo_acumulado: saldoCorrente, status_exibicao };
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

    // Query: TODOS os Arquivos OFX da conta (filtragem por mes feita localmente no card)
    const { data: arquivosOfxMes } = useQuery({
        queryKey: ['ofx_arquivos', contaSelecionadaId, organizacaoId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('banco_arquivos_ofx')
                .select('*')
                .eq('conta_id', Number(contaSelecionadaId))
                .eq('organizacao_id', organizacaoId)
                .order('periodo_inicio', { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!contaSelecionadaId && !!organizacaoId
    });

    // Query: Transaçoes do Arquivo OFX selecionado (drilldown)
    const { data: ofxTransacoes, isLoading: isLoadingOfxTransacoes } = useQuery({
        queryKey: ['ofx_transacoes', arquivoOfxExpandido],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('banco_transacoes_ofx')
                .select('*')
                .eq('arquivo_id', arquivoOfxExpandido)
                .order('data_transacao', { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!arquivoOfxExpandido
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

    // Exclusão de Arquivos OFX (Limpa transações orfãs via banco)
    const exclusaoOfxMutation = useMutation({
        mutationFn: async (arquivoId) => {
            const { error } = await supabase
                .from('banco_arquivos_ofx')
                .delete()
                .eq('id', arquivoId)
                .eq('organizacao_id', organizacaoId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Arquivo OFX e suas transações excluídos!');
            setArquivoOfxExpandido(null);
            queryClient.invalidateQueries({ queryKey: ['ofx_arquivos'] });
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
        },
        onError: (err) => {
            toast.error(`Erro ao excluir arquivo OFX: ${err.message}`);
        }
    });

    const handleDeleteOfx = (e, arq) => {
        e.stopPropagation();
        if (window.confirm(`Deseja realmente excluir o arquivo "${arq.nome_arquivo}"? Todas as suas transações serão apagadas da base.`)) {
            exclusaoOfxMutation.mutate(arq.id);
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
                    <div className="text-right flex items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-4 md:mt-0">

                        <div className="hidden sm:block">
                            <OfxUploader
                                organizacaoId={organizacaoId}
                                contas={contas}
                                onUploadSuccess={() => {
                                    queryClient.invalidateQueries({ queryKey: ['extrato'] });
                                }}
                            />
                        </div>
                        {contaSelecionada.limite_cheque_especial > 0 && (
                            <div className="bg-red-50 p-2 md:p-3 rounded-lg border border-red-100 flex items-center gap-3">
                                <div className="bg-red-100 p-2 rounded-full text-red-600 hidden md:block">
                                    <FontAwesomeIcon icon={faHandHoldingDollar} />
                                </div>
                                <div className="text-right sm:text-left">
                                    <p className="text-[10px] md:text-xs text-red-700 uppercase font-semibold">Cheque Especial</p>
                                    <p className="text-sm md:text-lg font-bold text-red-600">
                                        {formatCurrency(contaSelecionada.limite_cheque_especial)}
                                    </p>
                                </div>
                            </div>
                        )}

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
                    <div className="bg-white border text-sm rounded-lg overflow-hidden flex flex-col shadow-sm">
                        {mesesDisponiveis.map((mes, idx) => {
                            const isSelected = isSameMonth(mes, mesSelecionado);
                            const isCurrentMonth = isSameMonth(mes, new Date());
                            const mesKey = mes.toISOString();
                            const ofxDesteMes = (arquivosOfxMes || []).filter(a => {
                                if (!a.periodo_inicio || !a.periodo_fim) return false;
                                const startDate = format(startOfMonth(mes), 'yyyy-MM-dd');
                                const endDate = format(endOfMonth(mes), 'yyyy-MM-dd');
                                return a.periodo_inicio <= endDate && a.periodo_fim >= startDate;
                            });
                            const ofxAberto = ofxPainelAberto === mesKey;

                            return (
                                <div key={idx} className={`border-b last:border-0 transition-all border-l-4 ${isSelected ? 'border-l-blue-500' : 'border-l-transparent'}`}>
                                    {/* Linha principal do mês */}
                                    <div className={`flex items-center ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}>
                                        <button
                                            onClick={() => { setMesSelecionado(mes); setModoConciliacaoMes(null); setArquivoOfxExpandido(null); }}
                                            className="flex-1 text-left p-4"
                                        >
                                            <div className={`font-bold capitalize ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                {format(mes, 'MMMM', { locale: ptBR })} <span className="font-normal opacity-70">{format(mes, 'yyyy')}</span>
                                            </div>
                                            {isCurrentMonth && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide mt-1 inline-block
                                                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                    Atual
                                                </span>
                                            )}
                                        </button>

                                        {/* Botão de Conciliar - Ativa a Direita */}
                                        {ofxDesteMes.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMesSelecionado(mes);
                                                    setModoConciliacaoMes(mesKey);
                                                }}
                                                className={`mr-2 px-3 py-1.5 transition-all text-xs font-bold rounded-lg border flex items-center gap-1 shadow-sm
                                                    ${modoConciliacaoMes === mesKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                                                title={`Conciliar Lançamentos de ${format(mes, 'MMMM', { locale: ptBR })}`}
                                            >
                                                <FontAwesomeIcon icon={faHandHoldingDollar} />
                                                <span className="hidden sm:inline">Conciliar</span>
                                            </button>
                                        )}

                                        {/* Seta do OFX (Para apenas visualizar e deletar arquivos) */}
                                        {ofxDesteMes.length > 0 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setOfxPainelAberto(ofxAberto ? null : mesKey); setArquivoOfxExpandido(null); }}
                                                className={`pr-3 pl-2 py-4 transition-colors flex items-center gap-1 text-[10px] font-bold border-l
                                                    ${ofxAberto ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}
                                                title="Ver arquivos OFX deste mês"
                                            >
                                                <FontAwesomeIcon icon={faFileAlt} />
                                                <span>{ofxDesteMes.length}</span>
                                                <FontAwesomeIcon icon={ofxAberto ? faChevronDown : faChevronRight} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Expansão dos Arquivos OFX (Apenas Gerenciamento Visual agora) */}
                                    {ofxAberto && (
                                        <div className="bg-indigo-50/60 border-t border-indigo-100 px-3 py-2 flex flex-col gap-1.5">
                                            {ofxDesteMes.map(arq => (
                                                <div
                                                    key={arq.id}
                                                    className={`w-full group rounded-lg border transition-all flex items-stretch overflow-hidden bg-white/70 border-indigo-100 hover:border-indigo-300`}
                                                >
                                                    <div className="flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 min-w-0">
                                                        <FontAwesomeIcon icon={faFileAlt} className={`flex-shrink-0 text-xs text-indigo-300`} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-bold text-gray-800 truncate text-[11px]" title={arq.nome_arquivo}>{arq.nome_arquivo}</p>
                                                            <p className="text-[9px] text-gray-400">
                                                                {arq.periodo_inicio ? format(parseISO(arq.periodo_inicio), 'dd/MM/yy') : '?'} → {arq.periodo_fim ? format(parseISO(arq.periodo_fim), 'dd/MM/yy') : '?'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteOfx(e, arq)}
                                                        className="px-3 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-transparent group-hover:border-indigo-100"
                                                        title="Apagar arquivo OFX do banco"
                                                    >
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* LADO DIREITO: Extrato ou Painel de Conciliação */}
                <div className="lg:col-span-3">

                    {modoConciliacaoMes ? (
                        // === MODO CONCILIADOR: DUAL PANEL (Novo Componente) ===
                        <PanelConciliacaoOFX
                            contaId={contaSelecionadaId}
                            isCartaoCredito={contaSelecionada?.tipo === 'Cartão de Crédito'}
                            arquivosOfxIds={(arquivosOfxMes || [])
                                .filter(a => {
                                    const mesAlvo = new Date(modoConciliacaoMes);
                                    const startDate = format(startOfMonth(mesAlvo), 'yyyy-MM-dd');
                                    const endDate = format(endOfMonth(mesAlvo), 'yyyy-MM-dd');
                                    return a.periodo_inicio <= endDate && a.periodo_fim >= startDate;
                                })
                                .map(arq => arq.id)}
                            onClosePanel={() => setModoConciliacaoMes(null)}
                        />
                    ) : isLoading ? (
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
                                            className={`p-4 cursor-pointer transition-colors flex items-center justify-between group 
                                                ${item.isOfxStandalone ? 'bg-orange-50/50 hover:bg-orange-50 border-l-4 border-l-orange-400' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                                        >
                                            {/* Data */}
                                            <div className="flex-shrink-0 w-16 text-center">
                                                <div className={`text-sm font-bold ${item.isOfxStandalone ? 'text-orange-800' : 'text-gray-700'}`}>
                                                    {format(parseISO(item.data_pagamento), 'dd')}
                                                </div>
                                                <div className={`text-[10px] uppercase font-semibold ${item.isOfxStandalone ? 'text-orange-400' : 'text-gray-400'}`}>
                                                    {format(parseISO(item.data_pagamento), 'MMM', { locale: ptBR })}
                                                </div>
                                                {item.isOfxStandalone && (
                                                    <div className="text-[10px] text-orange-500 mt-1" title="Apenas no OFX">
                                                        <FontAwesomeIcon icon={faExclamationTriangle} /> OFX
                                                    </div>
                                                )}
                                            </div>

                                            {/* Descrição e Infos */}
                                            <div className="flex-1 px-4 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className={`text-sm font-bold truncate ${item.isOfxStandalone ? 'text-orange-900' : 'text-gray-800'}`} title={item.descricao}>
                                                        {item.descricao}
                                                    </p>
                                                    {item.status_exibicao === 'Conciliado' && (
                                                        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" title="Lançamento Conciliado">
                                                            <FontAwesomeIcon icon={faCheckCircle} className="mr-1" />
                                                            Conciliado
                                                        </span>
                                                    )}
                                                    {item.isOfxStandalone && (
                                                        <span className="text-[9px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider" title="Transação orfã. Adicione no sistema para conciliar.">
                                                            Pendente Oficialização
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.isOfxStandalone
                                                        ? 'Lançamento presente apenas no extrato bancário (Sem categoria e Favorecido)'
                                                        : `${item.categoria?.nome || 'Sem Categoria'}${item.favorecido?.nome ? ` • ${item.favorecido.nome}` : ''}`
                                                    }
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

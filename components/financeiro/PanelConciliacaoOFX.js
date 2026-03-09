// components/financeiro/PanelConciliacaoOFX.js
"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faCheckCircle, faPlus,
    faUndo, faEye, faEyeSlash, faTrash, faCalculator, faTimes,
    faCalendarCheck, faLink, faPenToSquare
} from '@fortawesome/free-solid-svg-icons';
import LancamentoFormModal from './LancamentoFormModal';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';

// --- Funções Auxiliares ---
const formatDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.split('T')[0])) return 'N/A';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const getColorForPair = (pairId) => {
    const colors = ['border-yellow-400 bg-yellow-100', 'border-purple-400 bg-purple-100', 'border-pink-400 bg-pink-100', 'border-indigo-400 bg-indigo-100', 'border-teal-400 bg-teal-100'];
    return colors[pairId % colors.length];
};

const daysBetween = (date1, date2) => {
    if (!date1 || !date2) return 999;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// --- Funções de Busca (Data Fetching) ---
const fetchLancamentosSistema = async (supabase, contaId, organizacaoId, startDate, endDate) => {
    if (!contaId || !organizacaoId || !startDate || !endDate) return [];
    const { data, error } = await supabase
        .from('lancamentos')
        .select(`*, favorecido:favorecido_contato_id ( id, nome, razao_social )`)
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId)
        .or(`data_pagamento.gte.${startDate},data_vencimento.gte.${startDate},data_transacao.gte.${startDate}`)
        .or(`data_pagamento.lte.${endDate},data_vencimento.lte.${endDate},data_transacao.lte.${endDate}`);

    if (error) throw new Error(error.message);
    return data;
};

const fetchTransacoesOfx = async (supabase, arrayDeArquivoIds) => {
    if (!arrayDeArquivoIds || arrayDeArquivoIds.length === 0) return [];

    const { data, error } = await supabase
        .from('banco_transacoes_ofx')
        .select('*')
        .in('arquivo_id', arrayDeArquivoIds)
        .order('data_transacao', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
};


// Componente Sub-Modal (Toast Helper)
const DeletionToast = ({ toastId, onSingleDelete, onFutureDelete }) => (
    <div className="w-full">
        <p className="font-semibold">Este lançamento faz parte de uma série.</p>
        <p className="text-sm text-gray-600 mb-3">O que você gostaria de fazer?</p>
        <div className="flex gap-2">
            <button onClick={() => { toast.dismiss(toastId); onSingleDelete(); }} className="w-full text-sm font-semibold px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md">Excluir somente este</button>
            <button onClick={() => { toast.dismiss(toastId); onFutureDelete(); }} className="w-full text-sm font-semibold px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md">Excluir este e os futuros</button>
        </div>
    </div>
);


export default function PanelConciliacaoOFX({ contaId, isCartaoCredito, arquivosOfxIds = [], mesSelecionado, onClosePanel }) {
    const supabase = createClient();
    const { user, organizacao_id: organizacaoId } = useAuth();
    const queryClient = useQueryClient();

    const [isProcessing, setIsProcessing] = useState(false);

    // Estado Geral da Conciliação
    const [conciliationState, setConciliationState] = useState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
    const [extratoPeriodo, setExtratoPeriodo] = useState({ startDate: null, endDate: null });

    // Estados de Seleção (Interação)
    const [selectedExtratoId, setSelectedExtratoId] = useState(null);
    const [selectedSistemaIds, setSelectedSistemaIds] = useState(new Set());

    // Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lancamentoParaCriar, setLancamentoParaCriar] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [lancamentoParaEditar, setLancamentoParaEditar] = useState(null);

    // Visual (Linhas e Filtros)
    const [lines, setLines] = useState([]);
    const itemRefs = useRef(new Map());
    const containerRef = useRef(null);
    const [showConciliados, setShowConciliados] = useState(true);

    const getDisplayDate = (lancamento) => {
        if (!lancamento) return 'N/A';
        // Para cartão: prioridade é quando a compra ocorreu, depois quando vence a fatura
        if (isCartaoCredito) return lancamento.data_transacao || lancamento.data_vencimento || lancamento.data_pagamento;

        // Para contas normais (regra oficial de negócio):
        // 1º Data de Pagamento -> 2º Data de Vencimento -> 3º Data de Transação (criação)
        return lancamento.data_pagamento || lancamento.data_vencimento || lancamento.data_transacao;
    };

    // --- Queries ---

    const { data: transacoesOfxData, isLoading: isLoadingTransacoesOfx } = useQuery({
        queryKey: ['transacoesOfxConciliacao', arquivosOfxIds],
        queryFn: () => fetchTransacoesOfx(supabase, arquivosOfxIds),
        enabled: arquivosOfxIds.length > 0,
    });

    const { data: lancamentosSistema, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentosSistemaConciliacao', contaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate],
        queryFn: () => fetchLancamentosSistema(supabase, contaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate),
        enabled: !!(contaId && organizacaoId && extratoPeriodo.startDate && extratoPeriodo.endDate),
    });

    // Quando o usuário seleciona um novo arquivo OFX e os dados chegam, mapeamos para conciliationState
    useEffect(() => {
        if (transacoesOfxData && transacoesOfxData.length > 0) {
            const mappedExtrato = transacoesOfxData.map((t, index) => ({
                id: typeof t.id !== 'undefined' && t.id !== null ? t.id : (t.fitid || `fallback-id-${index}`),
                fitid: t.fitid,
                data: t.data_transacao,
                valor: t.valor,
                tipo: t.tipo,
                descricao: t.descricao_banco || t.memo_banco || 'Sem descrição',
                lancamento_id_vinculado: t.lancamento_id_vinculado
            }));

            // Adiciona margem na data (menor e maior) para garantir que puxa o mês todo
            const datasDoExtrato = mappedExtrato.map(t => new Date(t.data));
            if (datasDoExtrato.length > 0) {
                const minDate = new Date(Math.min.apply(null, datasDoExtrato));
                const maxDate = new Date(Math.max.apply(null, datasDoExtrato));

                minDate.setDate(minDate.getDate() - 5);
                maxDate.setDate(maxDate.getDate() + 5);

                const dataInicio = minDate.toISOString().split('T')[0];
                const dataFim = maxDate.toISOString().split('T')[0];

                let visualInicio = dataInicio;
                let visualFim = dataFim;
                if (mesSelecionado) {
                    const d = new Date(mesSelecionado); // ISO string UTC
                    visualInicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
                    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                    visualFim = `${ultimoDia.getFullYear()}-${String(ultimoDia.getMonth() + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;
                }

                setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
                setConciliationState({ extrato: mappedExtrato, sistema: [], matches: [], dateFilter: { startDate: visualInicio, endDate: visualFim } });
            }
        } else if (transacoesOfxData && transacoesOfxData.length === 0) {
            setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
        }
    }, [transacoesOfxData, mesSelecionado]);


    const undoConciliationMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            const { error: err1 } = await supabase.from('lancamentos').update({
                conciliado: false, status: 'Pendente', data_pagamento: null, fitid_banco: null
            }).eq('id', lancamentoId).eq('organizacao_id', organizacaoId);
            if (err1) throw new Error(err1.message);

            const { error: err2 } = await supabase.from('banco_transacoes_ofx').update({ lancamento_id_vinculado: null }).eq('lancamento_id_vinculado', lancamentoId);
            if (err2) throw new Error(err2.message);
        },
        onSuccess: () => {
            toast.success('Conciliação desfeita!');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
        },
        onError: (error) => toast.error(`Erro ao desfazer: ${error.message}`)
    });

    const onActionSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
        queryClient.invalidateQueries({ queryKey: ['extrato'] });
    };

    const deleteSingleMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamento excluído!');
            onActionSuccess();
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });
        },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const deleteFutureMutation = useMutation({
        mutationFn: async ({ parcela_grupo, data_vencimento }) => {
            const { error } = await supabase.rpc('delete_lancamentos_futuros_do_grupo', {
                p_grupo_id: parcela_grupo, p_data_referencia: data_vencimento, p_organizacao_id: organizacaoId,
            });
            if (error) throw error;
        },
        onSuccess: () => { toast.success('Lançamentos futuros excluídos!'); onActionSuccess(); },
        onError: (error) => toast.error(`Erro: ${error.message}`),
    });

    const handleDelete = (item) => {
        if (!item.parcela_grupo) {
            toast("Excluir Lançamento", {
                description: `Tem certeza que deseja excluir "${item.descricao}"?`,
                action: { label: "Excluir", onClick: () => toast.promise(deleteSingleMutation.mutateAsync(item.id), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}` }) },
                cancel: { label: "Cancelar" },
            });
            return;
        }

        toast.custom((t) => (
            <DeletionToast toastId={t}
                onSingleDelete={() => toast.promise(deleteSingleMutation.mutateAsync(item.id), { loading: 'Excluindo...', success: 'Lançamento excluído!', error: (err) => `Erro: ${err.message}` })}
                onFutureDelete={() => toast.promise(deleteFutureMutation.mutateAsync(item), { loading: 'Excluindo futuros...', success: 'Lançamentos futuros excluídos!', error: (err) => `Erro: ${err.message}` })}
            />
        ), { duration: 10000 });
    };

    // 1. Sugestão Automática de Pares
    useEffect(() => {
        if (isLoadingLancamentos || !lancamentosSistema || isLoadingTransacoesOfx) return;

        const availableSistema = lancamentosSistema.filter(l => !l.fitid_banco);
        const newMatches = [];
        let pairCounter = 0;
        const sistemaPool = [...availableSistema];

        conciliationState.extrato.forEach(extratoItem => {
            if (extratoItem.lancamento_id_vinculado) return;
            if (conciliationState.matches.some(m => m.extratoId === extratoItem.id)) return;

            // Procura o index da transação que bate com valor idêntico e até 2 dias de diferença
            const matchIndex = sistemaPool.findIndex(sistemaItem => {
                // Previne de tentar dar match em um sistemaItem que por algum motivo já tem FITID
                if (sistemaItem.fitid_banco) return false;

                const dataSistema = getDisplayDate(sistemaItem);
                const valorSistema = Math.abs(sistemaItem.valor);
                const valorExtrato = Math.abs(extratoItem.valor);
                const isValorSimilar = Math.abs(valorSistema - valorExtrato) < 0.01;
                const diffDias = daysBetween(dataSistema, extratoItem.data);

                return isValorSimilar && diffDias <= 2;
            });

            if (matchIndex > -1) {
                const [matchedSistema] = sistemaPool.splice(matchIndex, 1);
                newMatches.push({ extratoId: extratoItem.id, sistemaId: matchedSistema.id, pairId: pairCounter++ });
            }
        });

        if (newMatches.length > 0) {
            setConciliationState(prev => ({
                ...prev, sistema: lancamentosSistema, matches: [...prev.matches, ...newMatches]
            }));
        } else {
            setConciliationState(prev => ({ ...prev, sistema: lancamentosSistema }));
        }

    }, [lancamentosSistema, isCartaoCredito, isLoadingTransacoesOfx, conciliationState.extrato]);

    // 2. Desenhar Linhas
    const calculateLines = useDebouncedCallback(() => {
        if (!containerRef.current) return;
        if (selectedSistemaIds.size > 0) { setLines([]); return; }

        const newLines = [];
        const containerRect = containerRef.current.getBoundingClientRect();

        conciliationState.matches.forEach(match => {
            const sistemaNode = itemRefs.current.get(`sistema-${match.sistemaId}`);
            const extratoNode = itemRefs.current.get(`extrato-${match.extratoId}`);
            if (sistemaNode && extratoNode) {
                const sistemaRect = sistemaNode.getBoundingClientRect();
                const extratoRect = extratoNode.getBoundingClientRect();
                const startX = sistemaRect.right - containerRect.left;
                const startY = sistemaRect.top - containerRect.top + sistemaRect.height / 2;
                const endX = extratoRect.left - containerRect.left;
                const endY = extratoRect.top - containerRect.top + extratoRect.height / 2;
                newLines.push({ startX, startY, endX, endY, pairId: match.pairId });
            }
        });
        setLines(newLines);
    }, 100);

    useLayoutEffect(() => {
        calculateLines();
        window.addEventListener('resize', calculateLines);
        return () => window.removeEventListener('resize', calculateLines);
    }, [conciliationState, calculateLines, selectedSistemaIds]);

    const proceedWithMatch = () => {
        if (!selectedExtratoId || selectedSistemaIds.size === 0) return;
        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;
        const newMatches = Array.from(selectedSistemaIds).map(sisId => ({
            extratoId: selectedExtratoId, sistemaId: sisId, pairId: newPairId
        }));
        setConciliationState(prev => ({ ...prev, matches: [...prev.matches, ...newMatches] }));
        setSelectedExtratoId(null); setSelectedSistemaIds(new Set());
    };

    const calculadora = useMemo(() => {
        if (!selectedExtratoId) return null;
        const extratoItem = conciliationState.extrato.find(e => e.id === selectedExtratoId);
        if (!extratoItem) return null;

        const totalSistema = Array.from(selectedSistemaIds).reduce((acc, id) => {
            const item = conciliationState.sistema.find(s => s.id === id);
            return acc + (item ? Math.abs(item.valor) : 0);
        }, 0);

        const target = Math.abs(extratoItem.valor);
        const diff = target - totalSistema;
        const isMatch = Math.abs(diff) < 0.01;

        return { target, totalSistema, diff, isMatch, count: selectedSistemaIds.size };
    }, [selectedExtratoId, selectedSistemaIds, conciliationState]);

    const handleConfirmMatches = async () => {
        if (!user || !user.id || !organizacaoId) return;
        if (conciliationState.matches.length === 0) return;

        const toastId = toast.loading('Confirmando conciliações e blindando FITID...');
        setIsProcessing(true);

        try {
            for (const match of conciliationState.matches) {
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                const targetValue = extratoItem.valor;

                const { error: err1 } = await supabase.from('lancamentos').update({
                    conciliado: true, status: 'Pago', data_pagamento: extratoItem.data,
                    fitid_banco: extratoItem.fitid, valor: targetValue, origem_criacao: 'Manual-Conciliado'
                }).eq('id', match.sistemaId).eq('organizacao_id', organizacaoId);
                if (err1) throw err1;

                const { error: err2 } = await supabase.from('banco_transacoes_ofx').update({
                    lancamento_id_vinculado: match.sistemaId
                }).eq('fitid', extratoItem.fitid);
                if (err2) throw err2;
            }

            toast.success(`${conciliationState.matches.length} transações conciliadas!`, { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
            setConciliationState(prev => ({ ...prev, matches: [] }));
            setLines([]);
            setSelectedExtratoId(null);
            setSelectedSistemaIds(new Set());
        } catch (error) { toast.error(`Erro: ${error.message}`, { id: toastId }); } finally { setIsProcessing(false); }
    };

    const handleCreateLancamento = (extratoItem) => {
        setLancamentoParaCriar({
            descricao: extratoItem.descricao, valor: Math.abs(extratoItem.valor), tipo: extratoItem.valor > 0 ? 'Receita' : 'Despesa',
            conta_id: contaId, data_transacao: extratoItem.data, data_vencimento: extratoItem.data,
            data_pagamento: extratoItem.data, status: 'Pago', conciliado: true, fitid_banco: extratoItem.fitid, virtual_ofx_id: extratoItem.id
        });
        setIsModalOpen(true);
    };

    const updateOfxBindingMutation = useMutation({
        mutationFn: async ({ lancamentoId, fitid }) => {
            const { error } = await supabase.from('banco_transacoes_ofx').update({
                lancamento_id_vinculado: lancamentoId
            }).eq('fitid', fitid);
            if (error) throw error;
        }
    });

    const handleSuccessCreate = async (createdLancamento) => {
        const fitid = lancamentoParaCriar?.fitid_banco;
        if (createdLancamento && fitid) {
            await updateOfxBindingMutation.mutateAsync({ lancamentoId: createdLancamento.id, fitid: fitid });
            toast.success('Lançamento inserido e conciliado!');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['extrato'] });
        }
    };

    const handleOpenEditModal = (lancamento) => { setLancamentoParaEditar(lancamento); setIsEditModalOpen(true); };
    const handleSuccessEdit = () => { setIsEditModalOpen(false); setLancamentoParaEditar(null); onActionSuccess(); toast.success('Lançamento atualizado!'); };

    const handleDateFilterChange = (name, value) => { setConciliationState(prev => ({ ...prev, dateFilter: { ...prev.dateFilter, [name]: value } })); };

    const processedLists = useMemo(() => {
        const sessionMatchedSistemaIds = new Set(conciliationState.matches.map(m => m.sistemaId));
        const sessionMatchedExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));

        // Mapea os fitids que o sistema já tem blindados
        const dbConciliatedSistemaIds = new Set(conciliationState.sistema.filter(s => s.fitid_banco).map(s => s.id));
        const sistemaFitidsMap = new Map();
        conciliationState.sistema.forEach(s => {
            if (s.fitid_banco) sistemaFitidsMap.set(s.fitid_banco, s.id);
        });

        // Se o OFX tiver o lancamento_id do banco, ou o fitid_banco dele existir na tabela sistema = já está Oficial
        const dbConciliatedExtratoIds = new Set(conciliationState.extrato.filter(e => {
            return e.lancamento_id_vinculado || sistemaFitidsMap.has(e.fitid);
        }).map(e => e.id));

        const filterByDate = (items, type) => {
            const { startDate, endDate } = conciliationState.dateFilter;
            if (!startDate || !endDate) return items;
            return items.filter(item => {
                const itemDate = type === 'sistema' ? getDisplayDate(item) : item.data;
                return itemDate >= startDate && itemDate <= endDate;
            });
        };

        const classifyAndSort = (items, type) => {
            return items.map(item => {
                let status = 'pendente';
                if ((type === 'sistema' && sessionMatchedSistemaIds.has(item.id)) || (type === 'extrato' && sessionMatchedExtratoIds.has(item.id))) {
                    status = 'sessionMatch';
                } else if ((type === 'sistema' && dbConciliatedSistemaIds.has(item.id)) || (type === 'extrato' && dbConciliatedExtratoIds.has(item.id))) {
                    status = 'dbConciliated';
                }
                return { ...item, conciliationStatus: status };
            }).sort((a, b) => {
                const order = { sessionMatch: 1, pendente: 2, dbConciliated: 3 };
                if (order[a.conciliationStatus] !== order[b.conciliationStatus]) return order[a.conciliationStatus] - order[b.conciliationStatus];
                const dateA = new Date(type === 'sistema' ? getDisplayDate(a) : a.data);
                const dateB = new Date(type === 'sistema' ? getDisplayDate(b) : b.data);
                return dateA - dateB;
            });
        };

        let filteredSistema = filterByDate(conciliationState.sistema, 'sistema');
        // REMOVIDO: o filterByFocus foi removido porque estava sumindo com os lançamentos e confundindo o usuario.

        const fullSortedSistema = classifyAndSort(filteredSistema, 'sistema');
        const fullSortedExtrato = classifyAndSort(filterByDate(conciliationState.extrato, 'extrato'), 'extrato');

        if (!showConciliados) return { sortedSistema: fullSortedSistema.filter(item => item.conciliationStatus !== 'dbConciliated'), sortedExtrato: fullSortedExtrato.filter(item => item.conciliationStatus !== 'dbConciliated'), };
        return { sortedSistema: fullSortedSistema, sortedExtrato: fullSortedExtrato, };
    }, [conciliationState, showConciliados, selectedExtratoId, selectedSistemaIds, isCartaoCredito]);

    const handleItemClick = (item, listName) => {
        if (item.conciliationStatus === 'pendente') {
            if (listName === 'extrato') {
                const newSelection = (selectedExtratoId === item.id ? null : item.id);
                setSelectedExtratoId(newSelection);
                if (newSelection) setSelectedSistemaIds(new Set());
            } else {
                setSelectedSistemaIds(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(item.id)) newSet.delete(item.id);
                    else newSet.add(item.id);
                    return newSet;
                });
            }
        }
        else if (item.conciliationStatus === 'sessionMatch') {
            const matchToRemove = conciliationState.matches.find(m => m[`${listName}Id`] === item.id);
            if (!matchToRemove) return;
            setConciliationState(prev => ({ ...prev, matches: prev.matches.filter(m => m.pairId !== matchToRemove.pairId) }));
        }
    };

    const renderItem = (item, type, listName) => {
        const isSelected = type === 'extrato' ? selectedExtratoId === item.id : selectedSistemaIds.has(item.id);
        const match = item.conciliationStatus === 'sessionMatch' ? conciliationState.matches.find(m => m[`${listName}Id`] === item.id) : null;
        let rowClass = 'bg-white border-transparent hover:border-gray-200';
        let interactionClass = 'cursor-pointer hover:bg-gray-100';

        if (item.conciliationStatus === 'sessionMatch' && match) {
            rowClass = getColorForPair(match.pairId);
            interactionClass = 'cursor-pointer hover:opacity-80';
        }
        if (item.conciliationStatus === 'dbConciliated') {
            rowClass = 'bg-green-50/50 border-green-200 text-gray-500';
            interactionClass = 'opacity-80 cursor-default';
        }
        if (item.conciliationStatus === 'pendente' && isSelected) {
            rowClass = 'ring-2 ring-indigo-500 bg-indigo-50 border-transparent';
        }

        const isReceita = (type === 'sistema' ? item.tipo === 'Receita' : item.valor > 0);
        const valorClass = isReceita ? 'text-green-600' : 'text-red-600';
        const dataExibicao = type === 'sistema' ? getDisplayDate(item) : item.data;

        return (
            <div key={item.id} ref={node => itemRefs.current.set(`${listName}-${item.id}`, node)} onClick={() => handleItemClick(item, listName)}
                className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md mb-1 transition-all ${interactionClass} ${rowClass}`}>
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                    <span className="truncate">{formatDate(dataExibicao)}</span>
                    {type === 'sistema' && isCartaoCredito && <FontAwesomeIcon icon={faCalendarCheck} className="flex-shrink-0 text-[10px] text-orange-400" />}
                </div>
                <div className="col-span-5 truncate text-xs" title={item.descricao || item.fitid}>{item.descricao || 'Sem descrição'}</div>
                <div className={`col-span-2 text-right font-bold ${valorClass}`}>{formatCurrency(item.valor)}</div>

                <div className={`col-span-2 text-center h-8 flex items-center gap-1 ${type === 'sistema' ? 'justify-end' : 'justify-start'}`}>
                    {type === 'extrato' && item.conciliationStatus === 'pendente' && (
                        <button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2 py-1 rounded-md" title="Acrescentar este lançamento manualmente"><FontAwesomeIcon icon={faPlus} /></button>
                    )}
                    {type === 'extrato' && item.conciliationStatus === 'dbConciliated' && (
                        <span className="text-green-600 text-[9px] uppercase font-bold tracking-wider" title="Cruza com um Lançamento Oficial do Sistema"><FontAwesomeIcon icon={faCheckCircle} className="mr-0.5" /> Oficial</span>
                    )}
                    {type === 'sistema' && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(item); }} className="text-blue-600 hover:text-blue-800 text-xs px-1"><FontAwesomeIcon icon={faPenToSquare} /></button>
                            {(item.conciliationStatus === 'pendente' || item.conciliationStatus === 'sessionMatch') && (
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="text-red-500 hover:text-red-700 text-xs px-1"><FontAwesomeIcon icon={faTrash} /></button>
                            )}
                            {item.conciliationStatus === 'dbConciliated' && (
                                <button onClick={(e) => { e.stopPropagation(); undoConciliationMutation.mutate(item.id); }} disabled={undoConciliationMutation.isPending} className="text-gray-500 hover:bg-gray-200 rounded p-1" title="Desfazer o Match FITID"><FontAwesomeIcon icon={faUndo} spin={undoConciliationMutation.isPending} /></button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-indigo-200 overflow-hidden relative">

            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccessCreate} initialData={lancamentoParaCriar} />
            <LancamentoFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleSuccessEdit} initialData={lancamentoParaEditar} />

            <div className="p-4 bg-indigo-50 border-b flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} /> Painel de Conciliação
                    </h2>
                    <p className="text-xs text-indigo-600">Associe dados do OFX com os lançamentos do Studio 57 para blindagem perfeita.</p>
                </div>
                {onClosePanel && (
                    <button onClick={onClosePanel} className="bg-white hover:bg-indigo-100 text-indigo-500 p-2 rounded-full border shadow-sm transition-colors text-sm font-bold flex items-center gap-2">
                        <FontAwesomeIcon icon={faTimes} /> Fechar Conciliador
                    </button>
                )}
            </div>

            {/* Filtros de Data Rápida (Opcional - mas mantido igual ConciliacaoManager) */}
            <div className="px-4 py-2 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                <div className="flex gap-2">
                    <div>
                        <label className="text-[9px] font-bold text-gray-500 uppercase">De</label>
                        <input type="date" value={conciliationState.dateFilter.startDate} onChange={(e) => handleDateFilterChange('startDate', e.target.value)} className="w-32 p-1 border rounded text-xs focus:ring-1 focus:ring-indigo-400 bg-white" />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-gray-500 uppercase">Até</label>
                        <input type="date" value={conciliationState.dateFilter.endDate} onChange={(e) => handleDateFilterChange('endDate', e.target.value)} className="w-32 p-1 border rounded text-xs focus:ring-1 focus:ring-indigo-400 bg-white" />
                    </div>
                </div>
                <button onClick={() => setShowConciliados(!showConciliados)} className={`text-xs border px-3 py-1 rounded-md flex items-center gap-2 font-bold transition-all ${showConciliados ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-gray-100 text-gray-600'}`}>
                    <FontAwesomeIcon icon={showConciliados ? faEyeSlash : faEye} /> {showConciliados ? 'Ocultar Conciliados' : 'Mostrar Conciliados'}
                </button>
            </div>

            {/* Split Screen Lado-a-Lado */}
            <div ref={containerRef} className="relative bg-gray-100/50 p-4 min-h-[500px] mb-20">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    {lines.map((line, index) => (<path key={index} d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`} stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')} strokeWidth="2" fill="none" />))}
                </svg>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Lado Esquerdo - OFX Puros (extrato) */}
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col h-[65vh]">
                        <h3 className="font-bold text-sm bg-indigo-100 text-indigo-900 p-3 border-b border-indigo-200 flex items-center justify-between">
                            Transações do OFX Bruto
                            {isLoadingTransacoesOfx && <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-400" />}
                        </h3>
                        <div className="flex-1 overflow-y-auto p-1 bg-gray-50/50 custom-scrollbar relative">
                            {processedLists.sortedExtrato.map(item => renderItem(item, 'extrato', 'extrato'))}
                            {processedLists.sortedExtrato.length === 0 && !isLoadingTransacoesOfx && <p className="p-8 text-sm text-gray-400 text-center italic font-semibold">Sem transações no filtro atual.</p>}
                        </div>
                    </div>

                    {/* Lado Direito - Sistema (sistema) */}
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col h-[65vh]">
                        <h3 className="font-bold text-sm bg-gray-100 text-gray-800 p-3 border-b flex items-center justify-between">
                            Lançamentos (Studio 57)
                            {selectedSistemaIds.size > 0 && <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{selectedSistemaIds.size} selec.</span>}
                        </h3>
                        <div className="flex-1 overflow-y-auto p-1 bg-gray-50/50 custom-scrollbar relative">
                            {isLoadingLancamentos && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center flex-col text-blue-500 font-bold"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" /></div>}
                            {!isLoadingLancamentos && processedLists.sortedSistema.map(item => renderItem(item, 'sistema', 'sistema'))}
                            {!isLoadingLancamentos && processedLists.sortedSistema.length === 0 && <p className="p-8 text-sm text-gray-400 text-center italic font-semibold">Sem registros neste período do sistema.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Calculadora / Barra Inferior (Position absolute or fixed inside component container) */}
            {(conciliationState.matches.length > 0 || calculadora) && (
                <div className="absolute bottom-0 left-0 w-full bg-white p-3 border-t shadow-[0_-5px_15px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between gap-4">
                    {calculadora ? (
                        <div className={`flex flex-1 items-center gap-4 px-4 py-2 rounded-lg border-2 shadow-sm ${calculadora.isMatch ? 'border-green-400 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
                            <div className="flex flex-col items-end border-r pr-4 border-black/10">
                                <span className="text-[9px] text-gray-500 uppercase font-black">Alvo OFX</span>
                                <span className="font-mono font-bold text-lg text-gray-800">{formatCurrency(calculadora.target)}</span>
                            </div>
                            <div className="flex flex-col items-end border-r pr-4 border-black/10">
                                <span className="text-[9px] text-gray-500 uppercase font-black">Soma Seleção</span>
                                <span className="font-mono font-bold text-lg text-indigo-700">{formatCurrency(calculadora.totalSistema)}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] text-gray-500 uppercase font-black">Diferença</span>
                                <span className={`font-mono font-bold text-lg ${calculadora.diff === 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {formatCurrency(calculadora.diff)}
                                </span>
                            </div>
                            {calculadora.isMatch ? (
                                <button onClick={proceedWithMatch} className="ml-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 font-bold flex items-center gap-2 shadow-md">
                                    <FontAwesomeIcon icon={faLink} /> UNIR
                                </button>
                            ) : (
                                <div className="ml-4 text-orange-600 text-[10px] font-bold max-w-[100px] text-center bg-white p-1 border rounded">Diferença matemática identificada</div>
                            )}
                            <button onClick={() => { setSelectedExtratoId(null); setSelectedSistemaIds(new Set()); }} className="ml-auto text-gray-400 hover:text-gray-800 bg-white p-2 rounded-full shadow-sm hover:shadow w-8 h-8 flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                    ) : (
                        <div className="text-gray-500 text-xs font-semibold flex items-center gap-2 bg-gray-50 border px-4 py-2 rounded-lg flex-1">
                            <FontAwesomeIcon icon={faCalculator} className="text-indigo-400" /> Clique em um Lançamento OFX (Esq) e um(ou mais) do Studio 57 (Dir) para unir manualmente.
                        </div>
                    )}

                    {conciliationState.matches.length > 0 && (
                        <button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-bold px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-blue-800 disabled:opacity-50 flex items-center gap-2 shadow-lg">
                            <FontAwesomeIcon icon={isProcessing ? faSpinner : faCheckCircle} spin={isProcessing} />
                            {isProcessing ? 'Gravando...' : `CONFIRMAR ${conciliationState.matches.length} CONCILIAÇÕES`}
                        </button>
                    )}
                </div>
            )}

        </div>
    );
}

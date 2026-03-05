// components/financeiro/ConciliacaoManager.js
"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faSpinner, faCheckCircle, faMagic, faPlus,
    faEraser, faCalendarDay, faCalendarWeek, faCalendarAlt,
    faUndo, faEye, faEyeSlash, faTrash, faCalculator, faTimes,
    faCreditCard, faCalendarCheck, faLink, faPenToSquare, faFileInvoice, faCheck
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
        .select(`
            *,
            favorecido:favorecido_contato_id ( id, nome, razao_social ),
            anexos:lancamentos_anexos ( id, nome_arquivo, caminho_arquivo )
        `)
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId)
        .or(`data_pagamento.gte.${startDate},data_vencimento.gte.${startDate},data_transacao.gte.${startDate}`)
        .or(`data_pagamento.lte.${endDate},data_vencimento.lte.${endDate},data_transacao.lte.${endDate}`);

    if (error) throw new Error(error.message);
    return data;
};

const fetchArquivosOfx = async (supabase, contaId, organizacaoId) => {
    if (!contaId || !organizacaoId) return [];

    // Busca os arquivos OFX inseridos mais recentemente
    const { data, error } = await supabase
        .from('banco_arquivos_ofx')
        .select('*')
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId)
        .order('data_importacao', { ascending: false })
        .limit(20);

    if (error) throw new Error(error.message);
    return data;
};

const fetchTransacoesOfx = async (supabase, arquivoId) => {
    if (!arquivoId) return [];

    const { data, error } = await supabase
        .from('banco_transacoes_ofx')
        .select('*')
        .eq('arquivo_id', arquivoId)
        .order('data_transacao', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
};

// --- Componentes Auxiliares ---

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

// --- Componente Principal ---

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const organizacaoId = organizacao_id;

    const queryClient = useQueryClient();

    const contasAgrupadas = useMemo(() => {
        if (!contas) return [];
        const contasFiltradas = contas.filter(c => c.tipo !== 'Cartão de Crédito');

        // Agrupa por Empresa -> Tipo
        const empresas = {};
        contasFiltradas.forEach(c => {
            const empresaNome = c.empresa?.nome_fantasia || c.empresa?.razao_social || 'Contas Base (Sem Empresa Vínculada)';
            const tipoNome = c.tipo || 'Outros';

            if (!empresas[empresaNome]) empresas[empresaNome] = {};
            if (!empresas[empresaNome][tipoNome]) empresas[empresaNome][tipoNome] = [];

            empresas[empresaNome][tipoNome].push(c);
        });

        // Transforma o dicionário em array pronto para o render
        return Object.entries(empresas).map(([empresa, tipos]) => ({
            empresa,
            tipos: Object.entries(tipos).map(([tipo, listaContas]) => ({
                tipo,
                contas: listaContas.sort((a, b) => a.nome.localeCompare(b.nome))
            })).sort((a, b) => a.tipo.localeCompare(b.tipo))
        })).sort((a, b) => a.empresa.localeCompare(b.empresa));
    }, [contas]);

    // Estado da Conta Selecionada
    const [selectedContaId, setSelectedContaId] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('lastSelectedConciliationAccountId') || '' : ''));
    const [isDropdownContaOpen, setIsDropdownContaOpen] = useState(false);
    const dropdownContaRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownContaRef.current && !dropdownContaRef.current.contains(event.target)) {
                setIsDropdownContaOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedConta = useMemo(() => contas.find(c => c.id == selectedContaId), [contas, selectedContaId]);
    const isCartaoCredito = selectedConta?.tipo === 'Cartão de Crédito';

    // Novo Estado de OFX
    const [selectedArquivoOfxId, setSelectedArquivoOfxId] = useState('');
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
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    const [showConciliados, setShowConciliados] = useState(true);

    const getDisplayDate = (lancamento) => {
        if (!lancamento) return 'N/A';
        if (isCartaoCredito) return lancamento.data_transacao || lancamento.data_vencimento;
        return lancamento.data_pagamento || lancamento.data_vencimento;
    };

    // --- Queries e Mutations ---

    const { data: arquivosOfx, isLoading: isLoadingArquivos } = useQuery({
        queryKey: ['arquivosOfxConciliacao', selectedContaId, organizacaoId],
        queryFn: () => fetchArquivosOfx(supabase, selectedContaId, organizacaoId),
        enabled: !!(selectedContaId && organizacaoId),
    });

    const { data: transacoesOfxData, isLoading: isLoadingTransacoesOfx } = useQuery({
        queryKey: ['transacoesOfxConciliacao', selectedArquivoOfxId],
        queryFn: () => fetchTransacoesOfx(supabase, selectedArquivoOfxId),
        enabled: !!selectedArquivoOfxId,
    });

    const { data: lancamentosSistema, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentosSistemaConciliacao', selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate],
        queryFn: () => fetchLancamentosSistema(supabase, selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate),
        enabled: !!(selectedContaId && organizacaoId && extratoPeriodo.startDate && extratoPeriodo.endDate),
    });

    // Quando o usuário seleciona um novo arquivo OFX e os dados chegam, mapeamos para conciliationState
    useEffect(() => {
        if (transacoesOfxData && transacoesOfxData.length > 0) {
            const mappedExtrato = transacoesOfxData.map((t, index) => ({
                id: typeof t.id !== 'undefined' && t.id !== null ? t.id : (t.fitid || `fallback-id-${index}`), // O id real na tabela ou fallback seguro
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

                // Margem de 5 dias antes e depois
                minDate.setDate(minDate.getDate() - 5);
                maxDate.setDate(maxDate.getDate() + 5);

                const dataInicio = minDate.toISOString().split('T')[0];
                const dataFim = maxDate.toISOString().split('T')[0];

                setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
                setConciliationState({ extrato: mappedExtrato, sistema: [], matches: [], dateFilter: { startDate: dataInicio, endDate: dataFim } });
            }
        } else if (transacoesOfxData && transacoesOfxData.length === 0) {
            setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
            toast.info('Arquivo selecionado não possui transações.');
        }
    }, [transacoesOfxData]);


    const undoConciliationMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            // 1. Limpa o lançamento
            const { error: err1 } = await supabase
                .from('lancamentos')
                .update({
                    conciliado: false,
                    status: 'Pendente',
                    data_pagamento: null,
                    fitid_banco: null
                })
                .eq('id', lancamentoId)
                .eq('organizacao_id', organizacaoId);

            if (err1) throw new Error(err1.message);

            // 2. Limpa a transação OFX também
            const { error: err2 } = await supabase
                .from('banco_transacoes_ofx')
                .update({ lancamento_id_vinculado: null })
                .eq('lancamento_id_vinculado', lancamentoId);

            if (err2) throw new Error(err2.message);
        },
        onSuccess: () => {
            toast.success('Conciliação desfeita! O lançamento voltou a ser pendente.');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] }); // re-fetch ofx
        },
        onError: (error) => {
            toast.error(`Erro ao desfazer: ${error.message}`);
        }
    });

    const onActionSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
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
            if (!organizacaoId) throw new Error("Organização não identificada.");
            const { error } = await supabase.rpc('delete_lancamentos_futuros_do_grupo', {
                p_grupo_id: parcela_grupo,
                p_data_referencia: data_vencimento,
                p_organizacao_id: organizacaoId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamentos futuros excluídos!');
            onActionSuccess();
        },
        onError: (error) => toast.error(`Erro ao excluir futuros: ${error.message}`),
    });

    const handleDelete = (item) => {
        if (!item.parcela_grupo) {
            toast("Excluir Lançamento", {
                description: `Tem certeza que deseja excluir "${item.descricao}"?`,
                action: {
                    label: "Excluir",
                    onClick: () => toast.promise(deleteSingleMutation.mutateAsync(item.id), {
                        loading: 'Excluindo...',
                        success: 'Lançamento excluído!',
                        error: (err) => `Erro: ${err.message}`,
                    }),
                },
                cancel: { label: "Cancelar" },
            });
            return;
        }

        toast.custom((t) => (
            <DeletionToast
                toastId={t}
                onSingleDelete={() => toast.promise(deleteSingleMutation.mutateAsync(item.id), {
                    loading: 'Excluindo...',
                    success: 'Lançamento excluído!',
                    error: (err) => `Erro: ${err.message}`,
                })}
                onFutureDelete={() => toast.promise(deleteFutureMutation.mutateAsync(item), {
                    loading: 'Excluindo lançamentos futuros...',
                    success: 'Lançamentos futuros excluídos!',
                    error: (err) => `Erro: ${err.message}`,
                })}
            />
        ), { duration: 10000 });
    };


    // --- Efeitos e Lógica de Negócio ---

    // 1. Sugestão Automática de Pares
    useEffect(() => {
        if (isLoadingLancamentos || !lancamentosSistema || isLoadingTransacoesOfx) return;

        // Excluímos os que já possuem FITID vinculado ou que já mostraram que estão conciliados
        const availableSistema = lancamentosSistema.filter(l => !l.fitid_banco);
        const newMatches = [];
        let pairCounter = 0;

        const sistemaPool = [...availableSistema];

        conciliationState.extrato.forEach(extratoItem => {
            // Se já está vinculado no banco na raiz (dbConciliated) ou se tem match manual na sessão, pula
            if (extratoItem.lancamento_id_vinculado) return;
            const isAlreadyMatchedInSession = conciliationState.matches.some(m => m.extratoId === extratoItem.id);
            if (isAlreadyMatchedInSession) return;

            const matchIndex = sistemaPool.findIndex(sistemaItem => {
                const dataSistema = getDisplayDate(sistemaItem);
                const valorSistema = Math.abs(sistemaItem.valor);
                const valorExtrato = Math.abs(extratoItem.valor);

                // Regra 1: Valor idêntico (tolerância 1 centavo)
                const isValorSimilar = Math.abs(valorSistema - valorExtrato) < 0.01;

                // Regra 2: Data flexível (+/- 2 dias)
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
                ...prev,
                sistema: lancamentosSistema,
                matches: [...prev.matches, ...newMatches]
            }));
            toast.success(`${newMatches.length} pares foram sugeridos automaticamente! Confirme para vincular os FITIDs.`);
        } else {
            setConciliationState(prev => ({ ...prev, sistema: lancamentosSistema }));
        }

    }, [lancamentosSistema, isCartaoCredito, isLoadingTransacoesOfx]);

    // 2. Desenhar Linhas
    const calculateLines = useDebouncedCallback(() => {
        if (!containerRef.current) return;
        if (selectedSistemaIds.size > 0) {
            setLines([]);
            return;
        }

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

    // 3. Persistência de Estado
    useEffect(() => {
        if (selectedContaId) sessionStorage.setItem('lastSelectedConciliationAccountId', selectedContaId);
        else sessionStorage.removeItem('lastSelectedConciliationAccountId');
    }, [selectedContaId]);


    // --- Lógica N:1 e Calculadora ---

    const proceedWithMatch = () => {
        if (!selectedExtratoId || selectedSistemaIds.size === 0) return;

        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;

        const newMatches = Array.from(selectedSistemaIds).map(sisId => ({
            extratoId: selectedExtratoId,
            sistemaId: sisId,
            pairId: newPairId
        }));

        setConciliationState(prev => ({
            ...prev,
            matches: [...prev.matches, ...newMatches]
        }));

        setSelectedExtratoId(null);
        setSelectedSistemaIds(new Set());
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

    // --- Confirmação e Salvamento no DB ---

    const handleConfirmMatches = async () => {
        if (!user || !user.id || !organizacaoId) return;
        if (conciliationState.matches.length === 0) return;

        const toastId = toast.loading('Confirmando conciliações e blindando FITID...');
        setIsProcessing(true);

        try {
            // Arrays de atualização em massa manual (iteração)
            for (const match of conciliationState.matches) {
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                const targetValue = extratoItem.valor;

                // 1. Update no sistema oficial
                const { error: err1 } = await supabase.from('lancamentos').update({
                    conciliado: true,
                    status: 'Pago',
                    data_pagamento: extratoItem.data,
                    fitid_banco: extratoItem.fitid, // Crucial: vincula o FITID!
                    valor: targetValue,
                    origem_criacao: 'Manual-Conciliado'
                }).eq('id', match.sistemaId).eq('organizacao_id', organizacaoId);

                if (err1) throw err1;

                // 2. Update na tabela OFX para amarrar de volta
                const { error: err2 } = await supabase.from('banco_transacoes_ofx').update({
                    lancamento_id_vinculado: match.sistemaId
                }).eq('fitid', extratoItem.fitid);

                if (err2) throw err2;
            }

            toast.success(`${conciliationState.matches.length} transações foram conciliadas e blindadas!`, { id: toastId });

            // Invalida e limpa estados de sessão local para obrigar refetch
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });

            setConciliationState(prev => ({ ...prev, matches: [] }));
        } catch (error) {
            toast.error(`Erro: ${error.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateLancamento = (extratoItem) => {
        // Envia os dados para a janela de criação. 
        // Armazenamos extratoItem.fitid numa coluna custom/temporária (via componente) ou aproveitamos os campos.
        // O ideal é logo após salvar dar um update, então guardaremos o extratoItem ID em um ref interno só para o callback.

        setLancamentoParaCriar({
            descricao: extratoItem.descricao, valor: Math.abs(extratoItem.valor), tipo: extratoItem.valor > 0 ? 'Receita' : 'Despesa',
            conta_id: selectedContaId, data_transacao: extratoItem.data, data_vencimento: extratoItem.data,
            data_pagamento: extratoItem.data, status: 'Pago', conciliado: true,
            fitid_banco: extratoItem.fitid,
            // A flag below is virtual/fake to pass through the process
            virtual_ofx_id: extratoItem.id
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
            // Efetivação do vínculo duplo!
            await updateOfxBindingMutation.mutateAsync({
                lancamentoId: createdLancamento.id,
                fitid: fitid
            });
            toast.success('Lançamento criado no sistema com sucesso e vinculado à transação OFX!');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            queryClient.invalidateQueries({ queryKey: ['transacoesOfxConciliacao'] });
        }
    };

    const handleOpenEditModal = (lancamento) => {
        setLancamentoParaEditar(lancamento);
        setIsEditModalOpen(true);
    };

    const handleSuccessEdit = () => {
        setIsEditModalOpen(false);
        setLancamentoParaEditar(null);
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
        toast.success('Lançamento atualizado!');
    };

    const handleDateFilterChange = (name, value) => {
        setConciliationState(prev => ({ ...prev, dateFilter: { ...prev.dateFilter, [name]: value } }));
        setActivePeriodFilter('');
    };

    const setDateRange = (period) => {
        const today = new Date();
        let startDate, endDate;
        if (period === 'today') { startDate = endDate = today; }
        else if (period === 'week') { const first = today.getDate() - today.getDay(); startDate = new Date(today.setDate(first)); endDate = new Date(today.setDate(first + 6)); }
        else if (period === 'month') { startDate = new Date(today.getFullYear(), today.getMonth(), 1); endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); }
        setConciliationState(prev => ({ ...prev, dateFilter: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] } }));
        setActivePeriodFilter(period);
    };

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

        const fullSortedSistema = classifyAndSort(filteredSistema, 'sistema');
        const fullSortedExtrato = classifyAndSort(filterByDate(conciliationState.extrato, 'extrato'), 'extrato');

        if (!showConciliados) {
            return {
                sortedSistema: fullSortedSistema.filter(item => item.conciliationStatus !== 'dbConciliated'),
                sortedExtrato: fullSortedExtrato.filter(item => item.conciliationStatus !== 'dbConciliated'),
            };
        }

        return {
            sortedSistema: fullSortedSistema,
            sortedExtrato: fullSortedExtrato,
        };
    }, [conciliationState, showConciliados, selectedExtratoId, selectedSistemaIds, isCartaoCredito]);

    // --- Renderização de Itens ---

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

            setConciliationState(prev => ({
                ...prev,
                matches: prev.matches.filter(m => m.pairId !== matchToRemove.pairId)
            }));
            toast.info('Grupo de conciliação desfocado.');
        }
    };

    const renderItem = (item, type, listName) => {
        const isSelected = type === 'extrato' ? selectedExtratoId === item.id : selectedSistemaIds.has(item.id);
        const match = item.conciliationStatus === 'sessionMatch' ? conciliationState.matches.find(m => m[`${listName}Id`] === item.id) : null;
        let rowClass = 'bg-white';
        let interactionClass = 'cursor-pointer hover:bg-gray-100';

        if (item.conciliationStatus === 'sessionMatch' && match) {
            rowClass = getColorForPair(match.pairId);
            interactionClass = 'cursor-pointer hover:opacity-80';
        }

        if (item.conciliationStatus === 'dbConciliated') {
            rowClass = 'bg-green-50 border-green-300';
            interactionClass = 'opacity-60 cursor-default';
        }

        if (item.conciliationStatus === 'pendente' && isSelected) {
            rowClass = 'ring-2 ring-blue-500 bg-blue-50';
        }

        const isReceita = (type === 'sistema' ? item.tipo === 'Receita' : item.valor > 0);
        const valorClass = isReceita ? 'text-green-600' : 'text-red-600';
        const dataExibicao = type === 'sistema' ? getDisplayDate(item) : item.data;

        return (
            <div
                key={item.id}
                ref={node => itemRefs.current.set(`${listName}-${item.id}`, node)}
                onClick={() => handleItemClick(item, listName)}
                className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md mb-1 transition-all ${interactionClass} ${rowClass}`}
            >
                <div className="col-span-3 flex items-center gap-1 min-w-0">
                    <span className="truncate">{formatDate(dataExibicao)}</span>
                    {type === 'sistema' && isCartaoCredito && <FontAwesomeIcon icon={faCalendarCheck} className="flex-shrink-0 text-[10px] text-orange-400" title="Data da Transação (Cartão)" />}
                </div>
                <div className="col-span-5 truncate" title={item.descricao || item.fitid}>{item.descricao || 'Sem descrição'}</div>
                <div className={`col-span-2 text-right font-bold ${valorClass}`}>{formatCurrency(item.valor)}</div>

                <div className={`col-span-2 text-center h-8 flex items-center gap-2 ${type === 'sistema' ? 'justify-end' : 'justify-start'}`}>

                    {type === 'extrato' && item.conciliationStatus === 'pendente' && (
                        <button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2 py-1 rounded-md" title="Acrescentar este lançamento manualmente">
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                    )}

                    {type === 'extrato' && item.conciliationStatus === 'dbConciliated' && (
                        <span className="text-green-600 text-[10px] uppercase font-bold tracking-wider" title="Cruza com um Lançamento Oficial do Sistema Baseado no FITID"><FontAwesomeIcon icon={faCheckCircle} className="mr-1" /> Oficial</span>
                    )}

                    {type === 'sistema' && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(item); }} className="text-blue-600 hover:text-blue-800 text-xs px-1">
                                <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            {(item.conciliationStatus === 'pendente' || item.conciliationStatus === 'sessionMatch') && (
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="text-red-500 hover:text-red-700 text-xs px-1">
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                            {item.conciliationStatus === 'dbConciliated' && (
                                <button onClick={(e) => { e.stopPropagation(); undoConciliationMutation.mutate(item.id); }} disabled={undoConciliationMutation.isPending} className="text-gray-500 hover:bg-gray-200 rounded p-1 hover:text-gray-700 text-xs" title="Desfazer o Match FITID">
                                    <FontAwesomeIcon icon={faUndo} spin={undoConciliationMutation.isPending} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccessCreate} initialData={lancamentoParaCriar} />
            <LancamentoFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleSuccessEdit} initialData={lancamentoParaEditar} />

            <div className="p-5 border rounded-xl bg-white shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 bg-indigo-500 h-full"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coluna 1: Conta */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">1. Selecione a Conta Auditada</label>
                        <div className="relative w-full" ref={dropdownContaRef}>
                            <button
                                onClick={() => setIsDropdownContaOpen(!isDropdownContaOpen)}
                                className="w-full text-left bg-white border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {selectedConta ? (
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-gray-800">{selectedConta.nome}</span>
                                        <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
                                            {selectedConta.empresa?.nome_fantasia || selectedConta.empresa?.razao_social || 'Contas Base (Sem Empresa Vínculada)'} • {selectedConta.tipo || 'Outros'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-gray-500 text-sm font-semibold">-- Selecione uma conta --</span>
                                )}
                                <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDropdownContaOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar p-1 origin-top animate-fadeIn">
                                    {contasAgrupadas.map(gEmpresa => (
                                        <div key={gEmpresa.empresa} className="p-2">
                                            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2 pl-1">{gEmpresa.empresa}</h3>

                                            <div className="space-y-3">
                                                {gEmpresa.tipos.map(gTipo => (
                                                    <div key={gTipo.tipo} className="space-y-1">
                                                        <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5 pl-2 mb-1">
                                                            <span className="w-1 h-1 rounded-full bg-indigo-300"></span>
                                                            {gTipo.tipo}
                                                        </h4>

                                                        <div className="flex flex-col gap-1 w-full">
                                                            {gTipo.contas.map(c => {
                                                                const isSelected = selectedContaId === c.id;
                                                                return (
                                                                    <button
                                                                        key={c.id}
                                                                        onClick={() => { setSelectedContaId(c.id); setSelectedArquivoOfxId(''); setIsDropdownContaOpen(false); }}
                                                                        className={`text-left flex items-start justify-between p-2.5 rounded-lg border transition-all duration-200 ${isSelected ? 'bg-indigo-50/80 border-indigo-200 shadow-sm' : 'border-transparent bg-transparent hover:bg-gray-50'}`}
                                                                    >
                                                                        <div className="flex flex-col flex-1 pr-2">
                                                                            <span className={`font-bold text-[13px] leading-tight ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>{c.nome}</span>
                                                                            {c.descricao && <span className="text-[9px] text-gray-400 mt-0.5 line-clamp-1">{c.descricao}</span>}
                                                                        </div>
                                                                        {isSelected && <FontAwesomeIcon icon={faCheck} className="text-indigo-500 text-[10px] mt-0.5" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {isCartaoCredito && <p className="text-xs text-orange-600 mt-2 flex items-center gap-1 font-semibold"><FontAwesomeIcon icon={faCreditCard} /> Modo Cartão: Usando Data da Transação para cruzamento</p>}
                    </div>

                    {/* Coluna 2: Arquivo OFX */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">2. Selecione o Arquivo OFX DB</label>
                        <select
                            value={selectedArquivoOfxId}
                            onChange={(e) => setSelectedArquivoOfxId(e.target.value)}
                            disabled={!selectedContaId || isLoadingArquivos}
                            className={`w-full p-3 border-2 rounded-lg focus:border-indigo-500 focus:ring-0 transition-colors font-semibold shadow-inner
                                ${!selectedContaId ? 'bg-gray-100 border-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white border-indigo-100 text-indigo-900'}`}
                        >
                            <option value="">-- {isLoadingArquivos ? 'Buscando extratos do banco...' : !selectedContaId ? 'Escolha a conta primeiro' : 'Escolha o Extrato Processado'} --</option>
                            {arquivosOfx && arquivosOfx.map(arq => (
                                <option key={arq.id} value={arq.id}>
                                    {arq.nome_arquivo} ({formatDate(arq.periodo_inicio)} - {formatDate(arq.periodo_fim)})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-2 font-semibold">Os arquivos presentes aqui foram injetados através do AuditDropzone no Extrato.</p>
                    </div>
                </div>
            </div>

            {/* Filtros de Visualização */}
            {conciliationState.extrato.length > 0 &&
                <div className="p-4 border border-indigo-100 rounded-lg bg-indigo-50/30 space-y-3 animate-fade-in flex items-center justify-between">
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Período Analisado (De)</label>
                            <input type="date" value={conciliationState.dateFilter.startDate} onChange={(e) => handleDateFilterChange('startDate', e.target.value)} className="w-36 p-1.5 border border-indigo-200 rounded text-sm text-indigo-900 focus:ring-1 focus:ring-indigo-400 font-semibold bg-white" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">(Até)</label>
                            <input type="date" value={conciliationState.dateFilter.endDate} onChange={(e) => handleDateFilterChange('endDate', e.target.value)} className="w-36 p-1.5 border border-indigo-200 rounded text-sm text-indigo-900 focus:ring-1 focus:ring-indigo-400 font-semibold bg-white" />
                        </div>
                    </div>

                    <button onClick={() => setShowConciliados(!showConciliados)} className={`text-sm border-2 px-4 py-1.5 rounded-lg flex items-center gap-2 font-bold transition-all ${showConciliados ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-indigo-200 hover:border-indigo-300 text-indigo-600'}`}>
                        <FontAwesomeIcon icon={showConciliados ? faEyeSlash : faEye} /> {showConciliados ? 'Ocultar Conciliados' : 'Mostrar Conciliados'}
                    </button>
                </div>
            }

            {/* Listas e Linhas */}
            {(conciliationState.extrato.length > 0 || conciliationState.sistema.length > 0) && (
                <div ref={containerRef} className="relative mt-8 pt-6 border-t min-h-[400px]">
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                        {lines.map((line, index) => (<path key={index} d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`} stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')} strokeWidth="2" fill="none" />))}
                    </svg>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold mb-3 text-2xl text-gray-800 flex justify-between items-center bg-gray-50 px-4 py-2 rounded-t-xl border-b-2 border-blue-200">
                                <span>Lançamentos (Sistema)</span>
                                {selectedSistemaIds.size > 0 && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold shadow-inner">{selectedSistemaIds.size} selecionado(s)</span>}
                            </h3>
                            <div className="border border-t-0 rounded-b-xl max-h-[60vh] overflow-y-auto space-y-1 p-2 bg-white custom-scrollbar shadow-sm relative">
                                {isLoadingLancamentos && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center flex-col text-blue-500 font-bold"><FontAwesomeIcon icon={faSpinner} spin size="2x" className="mb-2" /> Varrulhando Banco...</div>}
                                {!isLoadingLancamentos && processedLists.sortedSistema.map(item => renderItem(item, 'sistema', 'sistema'))}
                                {!isLoadingLancamentos && processedLists.sortedSistema.length === 0 && <p className="p-8 text-sm text-gray-400 text-center italic font-semibold">Sem registros neste período oficial do Studio.</p>}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold mb-3 text-2xl text-indigo-900 bg-indigo-50 px-4 py-2 rounded-t-xl border-b-2 border-indigo-200 flex justify-between items-center">
                                <span>Extrato OFX Puro</span>
                                {isLoadingTransacoesOfx && <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-400 text-sm" />}
                            </h3>
                            <div className="border border-t-0 border-indigo-100 rounded-b-xl max-h-[60vh] overflow-y-auto space-y-1 p-2 bg-white custom-scrollbar shadow-sm">
                                {processedLists.sortedExtrato.map(item => renderItem(item, 'extrato', 'extrato'))}
                                {processedLists.sortedExtrato.length === 0 && !isLoadingTransacoesOfx && <p className="p-8 text-sm text-gray-400 text-center italic font-semibold">Mural do Extrato DB Vazio.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Calculadora Flutuante */}
            {(conciliationState.matches.length > 0 || calculadora) && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white p-4 items-center justify-center border-t border-t-indigo-200 shadow-[0_-15px_30px_rgba(0,0,0,0.05)] z-[100] animate-slide-up flex">
                    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        {calculadora ? (
                            <div className={`flex items-center gap-6 px-6 py-3 rounded-xl border-2 shadow-sm ${calculadora.isMatch ? 'border-green-400 bg-green-50/80' : 'border-orange-300 bg-orange-50'}`}>
                                <div className="flex flex-col items-end border-r-2 pr-6 border-black/10">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest drop-shadow-sm">Alvo OFX</span>
                                    <span className="font-mono font-black text-2xl text-gray-800 drop-shadow-sm">{formatCurrency(calculadora.target)}</span>
                                </div>
                                <div className="flex flex-col items-end border-r-2 pr-6 border-black/10">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest drop-shadow-sm">Soma Seleção</span>
                                    <span className="font-mono font-black text-2xl text-indigo-700 drop-shadow-sm">{formatCurrency(calculadora.totalSistema)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest drop-shadow-sm">Diferença</span>
                                    <span className={`font-mono font-black text-2xl drop-shadow-sm ${calculadora.diff === 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {formatCurrency(calculadora.diff)}
                                    </span>
                                </div>
                                {calculadora.isMatch ? (
                                    <button onClick={proceedWithMatch} className="ml-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 font-extrabold flex items-center gap-2 animate-bounce shadow-[0_4px_15px_rgba(16,185,129,0.3)] transition-all">
                                        <FontAwesomeIcon icon={faLink} /> UNIR
                                    </button>
                                ) : (
                                    <div className="ml-6 text-orange-600 text-xs font-bold max-w-[120px] text-center leading-tight bg-white p-2 border border-orange-200 rounded-lg shadow-sm">Diferença matemática identificada</div>
                                )}
                                <button onClick={() => { setSelectedExtratoId(null); setSelectedSistemaIds(new Set()); }} className="ml-4 text-gray-400 hover:text-gray-800 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all w-10 h-10 flex items-center justify-center">
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm font-semibold flex items-center gap-2 bg-gray-50 border px-6 py-3 rounded-full flex-1 justify-center shadow-inner">
                                <FontAwesomeIcon icon={faCalculator} className="text-indigo-400" /> Clique nos itens pendentes do OFX Direito e dos Lançamentos Esquerdos para unir o par.
                            </div>
                        )}

                        {conciliationState.matches.length > 0 && (
                            <button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-extrabold px-8 py-4 rounded-xl text-lg hover:from-indigo-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 flex items-center gap-3 shadow-[0_8px_25px_rgba(79,70,229,0.4)] transform transition hover:-translate-y-1 w-full md:w-auto justify-center">
                                <FontAwesomeIcon icon={isProcessing ? faSpinner : faCheckCircle} spin={isProcessing} className="text-xl" />
                                {isProcessing ? 'Gravando no BD...' : `CONFIRMAR ${conciliationState.matches.length} CONCILIAÇÕES`}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

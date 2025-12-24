"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faLink, faCheckCircle, faMagic, faPlus, 
    faEraser, faCalendarDay, faCalendarWeek, faCalendarAlt, 
    faUndo, faEye, faEyeSlash, faPenToSquare, faTrash, faCalculator, 
    faTimes, faPaste, faFileCode, faExclamationCircle, faRobot, faExternalLinkAlt
} from '@fortawesome/free-solid-svg-icons';
import LancamentoFormModal from './LancamentoFormModal';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';

// --- Funções Auxiliares de Formatação ---

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

// --- Funções de Busca (Data Fetching) ---

const fetchLancamentosSistema = async (supabase, contaId, organizacaoId, startDate, endDate) => {
    if (!contaId || !organizacaoId || !startDate || !endDate) return [];
    
    const filterQuery = `and(data_pagamento.gte.${startDate},data_pagamento.lte.${endDate}),and(data_pagamento.is.null,data_vencimento.gte.${startDate},data_vencimento.lte.${endDate})`;

    const { data, error } = await supabase
        .from('lancamentos')
        .select(`
            *,
            favorecido:favorecido_contato_id ( id, nome, razao_social ),
            anexos:lancamentos_anexos ( id, nome_arquivo, caminho_arquivo )
        `)
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId)
        .or(filterQuery);
        
    if (error) throw new Error(error.message);
    return data;
};

// --- Componentes Auxiliares ---

const DeletionToast = ({ toastId, onSingleDelete, onFutureDelete }) => (
    <div className="w-full">
        <p className="font-semibold">Este lançamento faz parte de uma série.</p>
        <p className="text-sm text-gray-600 mb-3">O que você gostaria de fazer?</p>
        <div className="flex gap-2">
            <button
                onClick={() => {
                    toast.dismiss(toastId);
                    onSingleDelete();
                }}
                className="w-full text-sm font-semibold px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
            >
                Excluir somente este
            </button>
            <button
                onClick={() => {
                    toast.dismiss(toastId);
                    onFutureDelete();
                }}
                className="w-full text-sm font-semibold px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
                Excluir este e os futuros
            </button>
        </div>
    </div>
);

// --- Componente Principal ---

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const organizacaoId = organizacao_id;
    
    const queryClient = useQueryClient();

    // Estado da Conta Selecionada
    const [selectedContaId, setSelectedContaId] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('lastSelectedConciliationAccountId') || '' : ''));
    
    // Estados de Input (Arquivo ou Texto)
    const [inputMode, setInputMode] = useState('csv'); 
    const [file, setFile] = useState(null);
    const [pastedText, setPastedText] = useState('');

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
    const [showConciliados, setShowConciliados] = useState(false);
    
    // --- Queries e Mutations ---

    const { data: lancamentosSistema, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentosSistemaConciliacao', selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate],
        queryFn: () => fetchLancamentosSistema(supabase, selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate),
        enabled: !!(selectedContaId && organizacaoId && extratoPeriodo.startDate && extratoPeriodo.endDate),
    });

    const undoConciliationMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            const { data, error } = await supabase
                .from('lancamentos')
                .update({
                    conciliado: false,
                    status: 'Pendente', 
                    data_pagamento: null,
                    id_transacao_externa: null
                })
                .eq('id', lancamentoId)
                .eq('organizacao_id', organizacaoId)
                .select()
                .single();

            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: () => {
            toast.success('Conciliação desfeita! O lançamento voltou a ser pendente.');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
        },
        onError: (error) => {
            toast.error(`Erro ao desfazer: ${error.message}`);
        }
    });
    
    const deleteSingleMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase.from('lancamentos').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Lançamento excluído!');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
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
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
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

    useEffect(() => {
        if (isLoadingLancamentos || !lancamentosSistema) return;
        const availableSistema = lancamentosSistema.filter(l => !l.conciliado);
        const newMatches = [];
        let pairCounter = 0;
        
        const sistemaPool = [...availableSistema];

        conciliationState.extrato.forEach(extratoItem => {
            const isAlreadyMatchedInSession = conciliationState.matches.some(m => m.extratoId === extratoItem.id);
            if (isAlreadyMatchedInSession) return;

            const matchIndex = sistemaPool.findIndex(sistemaItem => {
                const dataSistema = sistemaItem.data_pagamento || sistemaItem.data_vencimento;
                const valorSistema = Math.abs(sistemaItem.valor);
                const valorExtrato = Math.abs(extratoItem.valor);
                const isValorSimilar = Math.abs(valorSistema - valorExtrato) < 0.01;
                return dataSistema === extratoItem.data && isValorSimilar;
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
            toast.success(`${newMatches.length} pares foram sugeridos automaticamente!`);
        } else {
             setConciliationState(prev => ({ ...prev, sistema: lancamentosSistema }));
        }
        
        setIsProcessing(false);
    }, [lancamentosSistema]);

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
    
    useEffect(() => {
        if (selectedContaId) sessionStorage.setItem('lastSelectedConciliationAccountId', selectedContaId);
        else sessionStorage.removeItem('lastSelectedConciliationAccountId');
    }, [selectedContaId]);

    useEffect(() => {
        if (selectedContaId && (conciliationState.extrato.length > 0 || conciliationState.sistema.length > 0)) {
            sessionStorage.setItem(`conciliationProgress_${selectedContaId}`, JSON.stringify(conciliationState));
        }
    }, [conciliationState, selectedContaId]);

    useEffect(() => {
        if (selectedContaId) {
            const savedStateJSON = sessionStorage.getItem(`conciliationProgress_${selectedContaId}`);
            if (savedStateJSON) {
                try {
                    const savedState = JSON.parse(savedStateJSON);
                    if (!savedState.dateFilter) savedState.dateFilter = { startDate: '', endDate: '' };
                    setConciliationState(savedState);
                    
                    if(savedState.extrato.length > 0) {
                        const datasDoExtrato = savedState.extrato.map(t => new Date(t.data));
                        const dataInicio = new Date(Math.min.apply(null, datasDoExtrato)).toISOString().split('T')[0];
                        const dataFim = new Date(Math.max.apply(null, datasDoExtrato)).toISOString().split('T')[0];
                        setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
                        if (!savedState.dateFilter.startDate) {
                            setConciliationState(prev => ({ ...prev, dateFilter: { startDate: dataInicio, endDate: dataFim } }));
                        }
                    }
                    toast.info("Encontrei um progresso salvo e restaurei para você!");
                } catch (e) {
                    console.error("Erro ao restaurar estado", e);
                }
            } else {
                setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
                setExtratoPeriodo({ startDate: null, endDate: null });
            }
        } else {
            setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
            setExtratoPeriodo({ startDate: null, endDate: null });
        }
    }, [selectedContaId]);

    // --- Processamento de Arquivos e Texto ---

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            toast.info(`Arquivo "${selectedFile.name}" pronto para ser processado.`);
        }
    };
    
    const parseOfxFile = (fileContent) => {
        try {
            const transacoesManuais = [];
            const transacoesRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
            let match;
            const idMap = new Set(); 
            let index = 0;
            while ((match = transacoesRegex.exec(fileContent)) !== null) {
                const transacaoBlock = match[1];
                const getValue = (tag) => { 
                    const regex = new RegExp(`<${tag}>([^<]*)`); 
                    const result = regex.exec(transacaoBlock); 
                    return result ? result[1].trim() : null; 
                };
                const valorRaw = getValue('TRNAMT');
                const valor = parseFloat(valorRaw);
                const dataStr = getValue('DTPOSTED')?.substring(0, 8);
                if (!dataStr || isNaN(valor)) continue;
                const formattedDate = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
                let fitId = getValue('FITID');
                if (!fitId || fitId === '000000' || fitId === '0' || idMap.has(fitId)) {
                    fitId = `GEN_${dataStr}_${valorRaw.replace('.', '')}_${index}`;
                }
                idMap.add(fitId);
                transacoesManuais.push({ 
                    id: fitId, 
                    data: formattedDate, 
                    valor: valor, 
                    descricao: getValue('MEMO') || getValue('NAME') || 'Sem descrição' 
                });
                index++;
            }
            return transacoesManuais;
        } catch (error) { 
            console.error("Erro no parse OFX:", error); 
            return null; 
        }
    };
    
    // Parser Melhorado para Texto/CSV
    const parseCsvContent = (content) => {
        if (!content) return [];
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        const transacoes = [];
        let index = 0;

        lines.forEach(line => {
            const parts = line.split(/[\t;,]/).map(p => p.trim()).filter(p => p !== "");
            let data = null; let valor = null; let descricao = '';

            for (const part of parts) {
                if (!data && /^\d{2}\/\d{2}\/\d{4}$/.test(part)) { const [d, m, y] = part.split('/'); data = `${y}-${m}-${d}`; } 
                else if (!data && /^\d{4}-\d{2}-\d{2}$/.test(part)) { data = part; }
                else if (valor === null && /^-?[\d\.]+,\d{2}$/.test(part)) { valor = parseFloat(part.replace(/\./g, '').replace(',', '.')); } 
                else if (valor === null && /^-?R\$\s?[\d\.]+,\d{2}$/.test(part)) { valor = parseFloat(part.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')); } 
                else if (valor === null && /^-?[\d]+(\.\d{1,2})?$/.test(part)) { valor = parseFloat(part); } 
                else { descricao += (descricao ? ' ' : '') + part; }
            }

            if (data && valor !== null) {
                const fitId = `TXT_${data}_${valor}_${index}_${Date.now()}`;
                transacoes.push({ id: fitId, data: data, valor: valor, descricao: descricao || 'Importado via Texto' });
                index++;
            }
        });
        return transacoes;
    };

    const handleProcessFile = async () => {
        if (!selectedContaId) { toast.warning('Selecione uma conta!'); return; }
        const toastId = toast.loading('Processando dados...');
        setIsProcessing(true);
        setConciliationState(prev => ({ ...prev, matches: [] })); 

        let transacoesDoExtrato = [];

        if (inputMode === 'ofx') {
            if (!file) { toast.error("Selecione um arquivo!", {id: toastId}); setIsProcessing(false); return; }
            const fileContent = await file.text();
            transacoesDoExtrato = parseOfxFile(fileContent);
        } else {
            if (!pastedText.trim()) { toast.error("O texto está vazio!", {id: toastId}); setIsProcessing(false); return; }
            transacoesDoExtrato = parseCsvContent(pastedText);
        }
        
        if (!transacoesDoExtrato || transacoesDoExtrato.length === 0) { 
            toast.error('Não entendi as linhas. Verifique Data e Valor.', { id: toastId }); 
            setIsProcessing(false); 
            return; 
        }
        
        toast.dismiss(toastId);
        toast.info(`Lido com sucesso: ${transacoesDoExtrato.length} transações.`);
        const datasDoExtrato = transacoesDoExtrato.map(t => new Date(t.data));
        const dataInicio = new Date(Math.min.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        const dataFim = new Date(Math.max.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        setConciliationState({ extrato: transacoesDoExtrato, sistema: [], matches: [], dateFilter: { startDate: dataInicio, endDate: dataFim } });
        setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
    };
    
    const proceedWithMatch = () => {
        if (!selectedExtratoId || selectedSistemaIds.size === 0) return;
        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;
        const newMatches = Array.from(selectedSistemaIds).map(sisId => ({ extratoId: selectedExtratoId, sistemaId: sisId, pairId: newPairId }));
        setConciliationState(prev => ({ ...prev, matches: [...prev.matches, ...newMatches] }));
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

    const handleConfirmMatches = async () => {
        if (!user || !user.id || !organizacaoId) { toast.error("Erro de autenticação."); return; }
        if (conciliationState.matches.length === 0) return;

        const toastId = toast.loading('Confirmando conciliação...');
        setIsProcessing(true);

        try {
            let filePath = null;
            const timestamp = Date.now();
            const ano = new Date().getFullYear();
            const mes = String(new Date().getMonth() + 1).padStart(2, '0');

            if (inputMode === 'csv' && pastedText) {
                const blob = new Blob([pastedText], { type: 'text/plain' });
                filePath = `${organizacaoId}/${selectedContaId}/${ano}/${mes}/${timestamp}-importacao-txt.txt`;
                await supabase.storage.from('extratos-bancarios').upload(filePath, blob);
            } else if (inputMode === 'ofx' && file) {
                filePath = `${organizacaoId}/${selectedContaId}/${ano}/${mes}/${timestamp}-${file.name}`;
                await supabase.storage.from('extratos-bancarios').upload(filePath, file);
            }

            const updates = conciliationState.matches.map(match => {
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                return {
                    id: match.sistemaId,
                    updates: { 
                        conciliado: true, status: 'Pago', data_pagamento: extratoItem.data, id_transacao_externa: match.extratoId,
                        valor: conciliationState.sistema.find(s => s.id === match.sistemaId)?.valor
                    }
                };
            });
            
            for (const item of updates) {
                await supabase.from('lancamentos').update(item.updates).eq('id', item.id).eq('organizacao_id', organizacaoId);
            }
            
            const uniqueExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));
            const totalConciliado = Array.from(uniqueExtratoIds).reduce((sum, id) => sum + Math.abs(conciliationState.extrato.find(e => e.id === id)?.valor || 0), 0);
            
            await supabase.from('conciliacao_historico').insert([{
                usuario_id: user.id, conta_financeira_id: selectedContaId, organizacao_id: organizacaoId,
                caminho_arquivo_ofx: filePath || 'texto-colado',
                periodo_inicio_extrato: extratoPeriodo.startDate, periodo_fim_extrato: extratoPeriodo.endDate,
                lancamentos_conciliados: conciliationState.matches, total_conciliado: totalConciliado, tipo_importacao: inputMode
            }]);

            toast.success(`${updates.length} lançamentos conciliados!`, { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            resetState();
        } catch (error) {
            toast.error(`Erro: ${error.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateLancamento = (extratoItem) => {
        setLancamentoParaCriar({
            descricao: extratoItem.descricao, valor: Math.abs(extratoItem.valor), tipo: extratoItem.valor > 0 ? 'Receita' : 'Despesa',
            conta_id: selectedContaId, data_transacao: extratoItem.data, data_vencimento: extratoItem.data,
            data_pagamento: extratoItem.data, status: 'Pago', conciliado: true, id_transacao_externa: extratoItem.id,
        });
        setIsModalOpen(true);
    };

    const handleSuccessCreate = (createdLancamento) => {
        toast.success('Lançamento criado e conciliado!');
        const extratoId = lancamentoParaCriar.id_transacao_externa;
        if (!extratoId || !createdLancamento) return;
        setConciliationState(prev => ({ ...prev, sistema: [...prev.sistema, { ...createdLancamento, conciliado: true }] }));
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
    };

    const handleOpenEditModal = (lancamento) => { setLancamentoParaEditar(lancamento); setIsEditModalOpen(true); };
    const handleSuccessEdit = () => { setIsEditModalOpen(false); setLancamentoParaEditar(null); queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] }); toast.success('Lançamento atualizado!'); };

    const resetState = () => {
        if (selectedContaId) sessionStorage.removeItem(`conciliationProgress_${selectedContaId}`);
        setFile(null); setPastedText('');
        setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
        setSelectedExtratoId(null); setSelectedSistemaIds(new Set());
        setExtratoPeriodo({ startDate: null, endDate: null });
        const fileInput = document.getElementById('file-input'); if (fileInput) fileInput.value = '';
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
        setConciliationState(prev => ({...prev, dateFilter: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] }}));
        setActivePeriodFilter(period);
    };

    // --- Renderização de Itens ---
    const handleItemClick = (item, listName) => {
        if (item.conciliationStatus === 'pendente') {
            if (listName === 'extrato') { setSelectedExtratoId(prev => (prev === item.id ? null : item.id)); } 
            else { setSelectedSistemaIds(prev => { const newSet = new Set(prev); if (newSet.has(item.id)) newSet.delete(item.id); else newSet.add(item.id); return newSet; }); }
        } else if (item.conciliationStatus === 'sessionMatch') {
            const matchToRemove = conciliationState.matches.find(m => m[`${listName}Id`] === item.id);
            if (!matchToRemove) return;
            setConciliationState(prev => ({ ...prev, matches: prev.matches.filter(m => m.pairId !== matchToRemove.pairId) }));
            toast.info('Grupo de conciliação desfeito.');
        }
    };

    const renderItem = (item, type, listName) => {
        const isSelected = type === 'extrato' ? selectedExtratoId === item.id : selectedSistemaIds.has(item.id);
        const match = item.conciliationStatus === 'sessionMatch' ? conciliationState.matches.find(m => m[`${listName}Id`] === item.id) : null;
        let rowClass = 'bg-white'; let interactionClass = 'cursor-pointer hover:bg-gray-100';
        if (item.conciliationStatus === 'sessionMatch' && match) { rowClass = getColorForPair(match.pairId); interactionClass = 'cursor-pointer hover:opacity-80'; }
        if (item.conciliationStatus === 'dbConciliated') { rowClass = 'bg-green-50 border-green-300'; interactionClass = 'opacity-60 cursor-default'; }
        if (item.conciliationStatus === 'pendente' && isSelected) { rowClass = 'ring-2 ring-blue-500 bg-blue-50'; }
        const isReceita = (type === 'sistema' && item.tipo === 'Receita') || (type === 'extrato' && item.valor > 0);
        const valorClass = isReceita ? 'text-green-600' : 'text-red-600';
        const dataExibicao = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data;
        
        return (
            <div key={item.id} ref={node => itemRefs.current.set(`${listName}-${item.id}`, node)} onClick={() => handleItemClick(item, listName)} className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md transition-all ${interactionClass} ${rowClass}`}>
                <div className="col-span-3">{formatDate(dataExibicao)}</div>
                <div className="col-span-5 truncate" title={item.descricao}>{item.descricao}</div>
                <div className={`col-span-2 text-right font-bold ${valorClass}`}>{formatCurrency(item.valor)}</div>
                <div className={`col-span-2 text-center h-8 flex items-center gap-2 ${type === 'sistema' ? 'justify-end' : 'justify-start'}`}>
                    {type === 'extrato' && item.conciliationStatus === 'pendente' && (<button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2 py-1 rounded-md"><FontAwesomeIcon icon={faPlus} /></button>)}
                    {type === 'extrato' && item.conciliationStatus === 'dbConciliated' && (<FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />)}
                    {type === 'sistema' && ( <>
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(item); }} className="text-blue-600 hover:text-blue-800 text-xs px-1"><FontAwesomeIcon icon={faPenToSquare} /></button>
                            {(item.conciliationStatus === 'pendente' || item.conciliationStatus === 'sessionMatch') && (<button onClick={(e) => { e.stopPropagation(); handleDelete(item); }} className="text-red-500 hover:text-red-700 text-xs px-1"><FontAwesomeIcon icon={faTrash} /></button>)}
                            {item.conciliationStatus === 'dbConciliated' && (<button onClick={(e) => { e.stopPropagation(); undoConciliationMutation.mutate(item.id); }} disabled={undoConciliationMutation.isPending} className="text-gray-500 hover:text-gray-700 text-xs px-1"><FontAwesomeIcon icon={faUndo} spin={undoConciliationMutation.isPending} /></button>)}
                    </>)}
                </div>
            </div>
        );
    };

    const processedLists = useMemo(() => {
        const sessionMatchedSistemaIds = new Set(conciliationState.matches.map(m => m.sistemaId));
        const sessionMatchedExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));
        const dbConciliatedExtratoIds = new Set(conciliationState.sistema.filter(s => s.conciliado && s.id_transacao_externa).map(s => s.id_transacao_externa));
        const filterByDate = (items, type) => {
            const { startDate, endDate } = conciliationState.dateFilter;
            if (!startDate || !endDate) return items;
            return items.filter(item => { const itemDate = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data; return itemDate >= startDate && itemDate <= endDate; });
        };
        const classifyAndSort = (items, type) => items.map(item => {
            let status = 'pendente';
            if ((type === 'sistema' && sessionMatchedSistemaIds.has(item.id)) || (type === 'extrato' && sessionMatchedExtratoIds.has(item.id))) status = 'sessionMatch';
            else if ((type === 'sistema' && item.conciliado) || (type === 'extrato' && dbConciliatedExtratoIds.has(item.id))) status = 'dbConciliated';
            return { ...item, conciliationStatus: status };
        }).sort((a, b) => {
            const order = { sessionMatch: 1, pendente: 2, dbConciliated: 3 }; if (order[a.conciliationStatus] !== order[b.conciliationStatus]) return order[a.conciliationStatus] - order[b.conciliationStatus];
            const dateA = new Date(type === 'sistema' ? (a.data_pagamento || a.data_vencimento) : a.data); const dateB = new Date(type === 'sistema' ? (b.data_pagamento || b.data_vencimento) : b.data); return dateA - dateB;
        });
        const fullSortedSistema = classifyAndSort(filterByDate(conciliationState.sistema, 'sistema'), 'sistema');
        const fullSortedExtrato = classifyAndSort(filterByDate(conciliationState.extrato, 'extrato'), 'extrato');
        return { sortedSistema: showConciliados ? fullSortedSistema : fullSortedSistema.filter(item => item.conciliationStatus !== 'dbConciliated'), sortedExtrato: showConciliados ? fullSortedExtrato : fullSortedExtrato.filter(item => item.conciliationStatus !== 'dbConciliated') };
    }, [conciliationState, showConciliados]); 

    // --- Validação do Botão ---
    const isButtonDisabled = isProcessing || !selectedContaId || (inputMode === 'ofx' && !file) || (inputMode === 'csv' && pastedText.trim().length === 0);

    return (
        <div className="space-y-6 pb-24">
            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccessCreate} initialData={lancamentoParaCriar} />
            <LancamentoFormModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSuccess={handleSuccessEdit} initialData={lancamentoParaEditar} />

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">1. Selecione a Conta <span className="text-red-500">*</span></label>
                        <select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500">
                            <option value="">-- Escolha uma conta --</option>
                            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        {!selectedContaId && <p className="text-xs text-red-500 mt-1">Obrigatório selecionar conta.</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">2. Importar Dados</label>
                        <div className="flex gap-2 mb-2">
                            <button onClick={() => setInputMode('csv')} className={`flex-1 text-sm py-1 rounded-t-md font-semibold transition-colors ${inputMode === 'csv' ? 'bg-white border-t border-l border-r text-blue-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                                <FontAwesomeIcon icon={faPaste} className="mr-2"/> Colar Texto/CSV
                            </button>
                            <button onClick={() => setInputMode('ofx')} className={`flex-1 text-sm py-1 rounded-t-md font-semibold transition-colors ${inputMode === 'ofx' ? 'bg-white border-t border-l border-r text-blue-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}>
                                <FontAwesomeIcon icon={faFileCode} className="mr-2"/> Arquivo OFX
                            </button>
                        </div>
                        
                        <div className={`border rounded-b-md p-3 bg-white ${inputMode === 'csv' ? 'rounded-tr-md' : ''} shadow-sm relative`}>
                            {inputMode === 'ofx' ? (
                                <input id="file-input" type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="w-full text-sm" />
                            ) : (
                                <>
                                    <div className="mb-2 flex justify-end">
                                        <a 
                                            href="https://gemini.google.com/gem/1l3D8lZur9HX5lZlXubFFtqttaCoymbp_?usp=sharing" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200 flex items-center gap-2 transition-all"
                                            title="Clique para converter seu PDF do banco em texto"
                                        >
                                            <FontAwesomeIcon icon={faRobot} /> Converter PDF com IA
                                        </a>
                                    </div>
                                    <textarea 
                                        placeholder="Cole aqui as linhas do seu extrato... (Ex: 24/12/2025 Pagamento 150,00)" 
                                        value={pastedText}
                                        onChange={(e) => setPastedText(e.target.value)}
                                        className="w-full h-24 p-2 text-xs border rounded-md font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                    <button onClick={resetState} className="text-sm text-gray-600 hover:text-red-600 font-semibold flex items-center gap-2">
                        <FontAwesomeIcon icon={faEraser} /> Limpar
                    </button>
                    
                    <div className="flex items-center gap-4">
                        {isButtonDisabled && !isProcessing && (
                            <span className="text-xs text-orange-600 font-medium animate-pulse">
                                <FontAwesomeIcon icon={faExclamationCircle} /> {!selectedContaId ? "Selecione a conta" : "Cole o texto ou escolha arquivo"}
                            </span>
                        )}
                        <button 
                            onClick={handleProcessFile} 
                            disabled={isButtonDisabled} 
                            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                        >
                            <FontAwesomeIcon icon={isProcessing ? faSpinner : faMagic} spin={isProcessing} /> 
                            {isProcessing ? 'Lendo...' : 'Processar'}
                        </button>
                    </div>
                </div>
            </div>
            
            {conciliationState.extrato.length > 0 &&
                <div className="p-4 border rounded-lg bg-gray-50 space-y-3 animate-fade-in">
                    <div className="flex flex-wrap items-end gap-2">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase">De</label><input type="date" value={conciliationState.dateFilter.startDate} onChange={(e) => handleDateFilterChange('startDate', e.target.value)} className="w-36 p-2 border rounded-md text-sm"/></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase">Até</label><input type="date" value={conciliationState.dateFilter.endDate} onChange={(e) => handleDateFilterChange('endDate', e.target.value)} className="w-36 p-2 border rounded-md text-sm"/></div>
                        <div className="flex border rounded-md overflow-hidden ml-2">
                            {['today', 'week', 'month'].map(period => (<button key={period} onClick={() => setDateRange(period)} className={`px-3 py-2 text-sm hover:bg-gray-100 ${activePeriodFilter === period ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-white text-gray-600'}`}><FontAwesomeIcon icon={period === 'today' ? faCalendarDay : period === 'week' ? faCalendarWeek : faCalendarAlt} /></button>))}
                        </div>
                         <button onClick={() => setShowConciliados(!showConciliados)} className={`ml-auto text-sm border px-3 py-2 rounded-md flex items-center gap-2 ${showConciliados ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50'}`}><FontAwesomeIcon icon={showConciliados ? faEyeSlash : faEye} /> {showConciliados ? 'Ocultar Conciliados' : 'Ver Conciliados'}</button>
                    </div>
                </div>
            }

            <div ref={containerRef} className="relative pt-6 border-t min-h-[400px]">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    {lines.map((line, index) => ( <path key={index} d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`} stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')} strokeWidth="2" fill="none" /> ))}
                </svg>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2 text-gray-700 flex justify-between items-center"><span>Lançamentos (Sistema)</span>{selectedSistemaIds.size > 0 && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{selectedSistemaIds.size} selecionado(s)</span>}</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1 bg-gray-50 custom-scrollbar">
                            {isLoadingLancamentos && <div className="text-center p-8 text-gray-500"><FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> Buscando...</div>}
                            {!isLoadingLancamentos && processedLists.sortedSistema.map(item => renderItem(item, 'sistema', 'sistema'))}
                            {!isLoadingLancamentos && processedLists.sortedSistema.length === 0 && <p className="p-8 text-sm text-gray-400 text-center italic">Nenhum lançamento no período.</p>}
                        </div>
                    </div> 
                    <div>
                        <h3 className="font-semibold mb-2 text-gray-700">Extrato (Banco)</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1 bg-gray-50 custom-scrollbar">
                            {processedLists.sortedExtrato.map(item => renderItem(item, 'extrato', 'extrato'))}
                            {processedLists.sortedExtrato.length === 0 && <p className="p-8 text-sm text-gray-400 text-center italic">Nenhuma transação carregada.</p>}
                        </div>
                    </div>
                </div>
            </div>

            {(conciliationState.matches.length > 0 || (calculadora)) && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white p-4 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50 animate-slide-up">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        {calculadora ? (
                            <div className={`flex items-center gap-4 px-4 py-2 rounded-lg border-2 ${calculadora.isMatch ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                                <div className="flex flex-col items-end border-r pr-4 border-gray-300">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Alvo (Extrato)</span>
                                    <span className="font-mono font-bold text-lg text-gray-800">{formatCurrency(calculadora.target)}</span>
                                </div>
                                <div className="flex flex-col items-end border-r pr-4 border-gray-300">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Soma Seleção</span>
                                    <span className="font-mono font-bold text-lg text-blue-700">{formatCurrency(calculadora.totalSistema)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Diferença</span>
                                    <span className={`font-mono font-bold text-lg ${calculadora.diff === 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(calculadora.diff)}</span>
                                </div>
                                {calculadora.isMatch ? (
                                    <button onClick={proceedWithMatch} className="ml-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-bold flex items-center gap-2 animate-pulse shadow-md"><FontAwesomeIcon icon={faLink} /> Conciliar</button>
                                ) : (
                                    <div className="ml-4 text-red-500 text-xs font-bold max-w-[100px] text-center leading-tight">Diferença encontrada</div>
                                )}
                                <button onClick={() => { setSelectedExtratoId(null); setSelectedSistemaIds(new Set()); }} className="ml-2 text-gray-400 hover:text-gray-600 px-2"><FontAwesomeIcon icon={faTimes} /></button>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-sm italic flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full"><FontAwesomeIcon icon={faCalculator} /> Selecione itens para conciliar manualmente.</div>
                        )}
                        {conciliationState.matches.length > 0 && (
                            <button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-blue-800 text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-blue-900 disabled:bg-gray-400 flex items-center gap-3 shadow-lg transform transition hover:-translate-y-1"><FontAwesomeIcon icon={faCheckCircle} /> Confirmar {conciliationState.matches.length} Conciliações</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
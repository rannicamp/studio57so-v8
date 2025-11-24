"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faUpload, faLink, faFileImport, faCheckCircle, faMagic, faPlus, 
    faExclamationTriangle, faEraser, faCalendarDay, faCalendarWeek, faCalendarAlt, 
    faUndo, faEye, faEyeSlash, faPenToSquare,
    faTrash
} from '@fortawesome/free-solid-svg-icons';
import LancamentoFormModal from './LancamentoFormModal';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';

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


export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const organizacaoId = organizacao_id;
    
    const queryClient = useQueryClient();

    const [selectedContaId, setSelectedContaId] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('lastSelectedConciliationAccountId') || '' : ''));
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [conciliationState, setConciliationState] = useState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
    
    const [extratoPeriodo, setExtratoPeriodo] = useState({ startDate: null, endDate: null });
    const [selectedItems, setSelectedItems] = useState({ extrato: null, sistema: null });
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lancamentoParaCriar, setLancamentoParaCriar] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [lancamentoParaEditar, setLancamentoParaEditar] = useState(null);


    const [lines, setLines] = useState([]);
    const itemRefs = useRef(new Map());
    const containerRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    const [showConciliados, setShowConciliados] = useState(false);
    
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


    useEffect(() => {
        if (isLoadingLancamentos || !lancamentosSistema) return;
        const availableSistema = lancamentosSistema.filter(l => !l.conciliado);
        const newMatches = [];
        let pairCounter = 0;
        
        conciliationState.extrato.forEach(extratoItem => {
            const isAlreadyMatchedInSession = conciliationState.matches.some(m => m.extratoId === extratoItem.id);
            if (isAlreadyMatchedInSession) return;

            const matchIndex = availableSistema.findIndex(sistemaItem => {
                const dataSistema = sistemaItem.data_pagamento || sistemaItem.data_vencimento;
                const valorSistema = Math.abs(sistemaItem.valor);
                const valorExtrato = Math.abs(extratoItem.valor);
                const isValorSimilar = Math.abs(valorSistema - valorExtrato) < 0.01;
                return dataSistema === extratoItem.data && isValorSimilar;
            });
            if (matchIndex > -1) {
                const [matchedSistema] = availableSistema.splice(matchIndex, 1);
                newMatches.push({ extratoId: extratoItem.id, sistemaId: matchedSistema.id, pairId: pairCounter++ });
            }
        });

        setConciliationState(prev => ({ 
            ...prev, 
            sistema: lancamentosSistema, 
            matches: [...prev.matches, ...newMatches] 
        }));

        if (newMatches.length > 0) {
            toast.success(`${newMatches.length} pares foram sugeridos automaticamente!`);
        }
        setIsProcessing(false);
    }, [lancamentosSistema]);

    const calculateLines = useDebouncedCallback(() => {
        if (!containerRef.current) return;
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
    }, [conciliationState, calculateLines]);
    
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
            } else {
                setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
                setExtratoPeriodo({ startDate: null, endDate: null });
            }
        } else {
            setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
            setExtratoPeriodo({ startDate: null, endDate: null });
        }
    }, [selectedContaId]);

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            toast.info(`Arquivo "${selectedFile.name}" pronto para ser processado.`);
        }
    };
    
    // =================================================================================
    // PARSER OFX ATUALIZADO E ROBUSTO
    // O PORQUÊ: A Caixa envia muitos lançamentos com FITID "000000".
    // A lógica antiga sobrescrevia esses itens. A nova lógica detecta IDs duplicados
    // ou zerados e cria um ID sintético (DATA_VALOR_INDEX) para garantir unicidade.
    // =================================================================================
    const parseOfxFile = (fileContent) => {
        try {
            const transacoesManuais = [];
            const transacoesRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
            let match;
            const idMap = new Set(); // Rastreia IDs já usados para evitar duplicatas reais do arquivo

            let index = 0;
            while ((match = transacoesRegex.exec(fileContent)) !== null) {
                const transacaoBlock = match[1];
                
                // Função auxiliar para extrair valor de tags
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
                
                // CORREÇÃO CRÍTICA PARA CAIXA:
                // Se o ID for inválido, zerado ou JÁ EXISTIR no set, criamos um novo.
                if (!fitId || fitId === '000000' || fitId === '0' || idMap.has(fitId)) {
                    // Cria ID único: PREFIXO_DATA_VALOR_INDICE
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
            console.error("Erro no parse manual:", error); 
            return null; 
        }
    };
    
    const handleProcessFile = async () => {
        if (!file || !selectedContaId) { toast.warning('Por favor, selecione uma conta e um arquivo OFX.'); return; }
        const toastId = toast.loading('Lendo arquivo...');
        setIsProcessing(true);
        setConciliationState(prev => ({ ...prev, matches: [] })); 

        const fileContent = await file.text();
        const transacoesDoExtrato = parseOfxFile(fileContent);
        
        if (!transacoesDoExtrato || transacoesDoExtrato.length === 0) { 
            toast.error('Nenhuma transação válida encontrada no arquivo.', { id: toastId }); 
            setIsProcessing(false); 
            return; 
        }
        
        toast.dismiss(toastId);
        toast.info(`Arquivo lido com ${transacoesDoExtrato.length} transações. Buscando correspondências...`);
        
        const datasDoExtrato = transacoesDoExtrato.map(t => new Date(t.data));
        const dataInicio = new Date(Math.min.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        const dataFim = new Date(Math.max.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        
        setConciliationState({ extrato: transacoesDoExtrato, sistema: [], matches: [], dateFilter: { startDate: dataInicio, endDate: dataFim } });
        setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
    };
    
    const proceedWithMatch = () => {
        if (!selectedItems.extrato || !selectedItems.sistema) return;
        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;
        setConciliationState(prev => ({ ...prev, matches: [...prev.matches, { extratoId: selectedItems.extrato, sistemaId: selectedItems.sistema, pairId: newPairId }] }));
        setSelectedItems({ extrato: null, sistema: null });
    };

    const handleManualMatch = () => {
        const extratoItem = conciliationState.extrato.find(e => e.id === selectedItems.extrato);
        const sistemaItem = conciliationState.sistema.find(s => s.id === selectedItems.sistema);
        if (!extratoItem || !sistemaItem) return;
        if (Math.abs(extratoItem.valor).toFixed(2) !== Math.abs(sistemaItem.valor).toFixed(2)) {
            toast.warning(`Os valores são divergentes (${formatCurrency(sistemaItem.valor)} vs ${formatCurrency(extratoItem.valor)}). Ao confirmar, o valor do extrato prevalecerá.`, {
                action: { label: 'Continuar', onClick: () => proceedWithMatch() },
                cancel: { label: 'Cancelar' },
            });
        } else {
            proceedWithMatch();
        }
    };
    
    const handleConfirmMatches = async () => {
        if (!user || !user.id || !organizacaoId) {
            toast.error("Erro de autenticação. Não foi possível identificar seu usuário ou organização. Por favor, recarregue a página.");
            return;
        }

        if (conciliationState.matches.length === 0) return;
        if (!file) {
            toast.error("O arquivo OFX não foi encontrado. Por favor, reinicie o processo.");
            return;
        }

        const toastId = toast.loading('Iniciando conciliação...');
        setIsProcessing(true);

        try {
            toast.loading('Salvando arquivo do extrato...', { id: toastId });

            const dataAtual = new Date();
            const ano = dataAtual.getFullYear();
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const filePath = `${organizacaoId}/${selectedContaId}/${ano}/${mes}/${Date.now()}-${file.name}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('extratos-bancarios')
                .upload(filePath, file);

            if (uploadError) {
                throw new Error(`Falha ao salvar o arquivo: ${uploadError.message}`);
            }

            toast.loading('Confirmando conciliações no banco de dados...', { id: toastId });

            const updates = conciliationState.matches.map(match => {
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                return {
                    id: match.sistemaId,
                    updates: { 
                        conciliado: true, 
                        status: 'Pago', 
                        data_pagamento: extratoItem.data,
                        id_transacao_externa: match.extratoId,
                        valor: Math.abs(extratoItem.valor)
                    }
                };
            });

            const totalConciliado = updates.reduce((sum, item) => {
                const extratoItem = conciliationState.extrato.find(e => e.id === conciliationState.matches.find(m => m.sistemaId === item.id).extratoId);
                return sum + Math.abs(extratoItem.valor);
            }, 0);

            const lancamentosConciliadosJSON = conciliationState.matches.map(match => {
                const sistemaItem = conciliationState.sistema.find(s => s.id === match.sistemaId);
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                return {
                    lancamento_id: sistemaItem.id,
                    descricao_sistema: sistemaItem.descricao,
                    valor_sistema: sistemaItem.valor,
                    id_transacao_extrato: extratoItem.id,
                    descricao_extrato: extratoItem.descricao,
                    valor_extrato: extratoItem.valor
                };
            });
            
            for (const item of updates) {
                const { error } = await supabase.from('lancamentos').update(item.updates).eq('id', item.id).eq('organizacao_id', organizacaoId);
                if (error) throw error;
            }
            
            const historicoRecord = {
                usuario_id: user.id,
                conta_financeira_id: selectedContaId,
                organizacao_id: organizacaoId,
                caminho_arquivo_ofx: uploadData.path,
                periodo_inicio_extrato: extratoPeriodo.startDate,
                periodo_fim_extrato: extratoPeriodo.endDate,
                lancamentos_conciliados: lancamentosConciliadosJSON,
                total_conciliado: totalConciliado
            };

            const { error: historicoError } = await supabase
                .from('conciliacao_historico')
                .insert([historicoRecord]);
            
            if (historicoError) throw historicoError;

            toast.success(`${updates.length} lançamentos conciliados e histórico salvo!`, { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            resetState();
        } catch (error) {
            toast.error(`Erro ao conciliar: ${error.message}`, { id: toastId });
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
        toast.success('Lançamento criado e conciliado com sucesso a partir do extrato!');
        const extratoId = lancamentoParaCriar.id_transacao_externa;
        if (!extratoId || !createdLancamento) return;
        
        setConciliationState(prev => ({
            ...prev, 
            sistema: [...prev.sistema, { ...createdLancamento, conciliado: true }]
        }));
        
        const updatedExtrato = conciliationState.extrato.filter(item => item.id !== extratoId);
        setConciliationState(prev => ({...prev, extrato: updatedExtrato}));
        
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
    };

    const handleOpenEditModal = (lancamento) => {
        setLancamentoParaEditar(lancamento);
        setIsEditModalOpen(true);
    };

    const handleSuccessEdit = () => {
        setIsEditModalOpen(false);
        setLancamentoParaEditar(null);
        queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
        toast.success('Lançamento atualizado com sucesso!');
    };


    const resetState = () => {
        if (selectedContaId) sessionStorage.removeItem(`conciliationProgress_${selectedContaId}`);
        setFile(null);
        setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
        setSelectedItems({ extrato: null, sistema: null });
        setExtratoPeriodo({ startDate: null, endDate: null });
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
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

    const processedLists = useMemo(() => {
        const sessionMatchedSistemaIds = new Set(conciliationState.matches.map(m => m.sistemaId));
        const sessionMatchedExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));
        const dbConciliatedExtratoIds = new Set(conciliationState.sistema.filter(s => s.conciliado && s.id_transacao_externa).map(s => s.id_transacao_externa));

        const filterByDate = (items, type) => {
            const { startDate, endDate } = conciliationState.dateFilter;
            if (!startDate || !endDate) return items;
            return items.filter(item => {
                const itemDate = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data;
                return itemDate >= startDate && itemDate <= endDate;
            });
        };

        const classifyAndSort = (items, type) => {
            return items.map(item => {
                let status = 'pendente';
                if ((type === 'sistema' && sessionMatchedSistemaIds.has(item.id)) || (type === 'extrato' && sessionMatchedExtratoIds.has(item.id))) {
                    status = 'sessionMatch';
                } else if ((type === 'sistema' && item.conciliado) || (type === 'extrato' && dbConciliatedExtratoIds.has(item.id))) {
                    status = 'dbConciliated';
                }
                return { ...item, conciliationStatus: status };
            }).sort((a, b) => {
                const order = { sessionMatch: 1, pendente: 2, dbConciliated: 3 };
                if (order[a.conciliationStatus] !== order[b.conciliationStatus]) return order[a.conciliationStatus] - order[b.conciliationStatus];
                const dateA = new Date(type === 'sistema' ? (a.data_pagamento || a.data_vencimento) : a.data);
                const dateB = new Date(type === 'sistema' ? (b.data_pagamento || b.data_vencimento) : b.data);
                return dateA - dateB;
            });
        };
        
        const fullSortedSistema = classifyAndSort(filterByDate(conciliationState.sistema, 'sistema'), 'sistema');
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
    }, [conciliationState, showConciliados]); 

    const handleItemClick = (item, listName) => {
        if (item.conciliationStatus === 'pendente') {
            setSelectedItems(prev => {
                if (prev[listName] === item.id) {
                    return { ...prev, [listName]: null };
                }
                return { ...prev, [listName]: item.id };
            });
        } 
        else if (item.conciliationStatus === 'sessionMatch') {
            const matchToRemove = conciliationState.matches.find(m => m[`${listName}Id`] === item.id);
            if (!matchToRemove) return;

            setConciliationState(prev => ({
                ...prev,
                matches: prev.matches.filter(m => m.pairId !== matchToRemove.pairId)
            }));
            
            setSelectedItems({ extrato: null, sistema: null });
            toast.info('Conciliação desmarcada.');
        }
    };

    const renderItem = (item, type, listName) => {
        const isSelected = selectedItems[listName] === item.id;
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

        const isReceita = (type === 'sistema' && item.tipo === 'Receita') || (type === 'extrato' && item.valor > 0);
        const valorClass = isReceita ? 'text-green-600' : 'text-red-600';
        const dataExibicao = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data;
        
        const actionsCellClass = `col-span-2 text-center h-8 flex items-center gap-2 ${
            type === 'sistema' ? 'justify-end' : 'justify-start'
        }`;
        
        return (
            <div 
                key={item.id} 
                ref={node => itemRefs.current.set(`${listName}-${item.id}`, node)} 
                onClick={() => handleItemClick(item, listName)} 
                className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md transition-all ${interactionClass} ${rowClass}`}
            >
                <div className="col-span-3">{formatDate(dataExibicao)}</div>
                <div className="col-span-5 truncate">{item.descricao}</div>
                <div className={`col-span-2 text-right font-bold ${valorClass}`}>{formatCurrency(item.valor)}</div>
                
                <div className={actionsCellClass}>
                    
                    {/* --- LADO DIREITO (EXTRATO) --- */}
                    {type === 'extrato' && item.conciliationStatus === 'pendente' && (
                        <button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2 py-1 rounded-md">
                            <FontAwesomeIcon icon={faPlus} /> Criar
                        </button>
                    )}
                    
                    {type === 'extrato' && item.conciliationStatus === 'dbConciliated' && (
                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" title="Conciliado" />
                    )}

                    {/* --- LADO ESQUERDO (SISTEMA) --- */}
                    
                    {type === 'sistema' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); 
                                handleOpenEditModal(item);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold px-1 py-1 rounded-md"
                            title="Editar Lançamento"
                        >
                            <FontAwesomeIcon icon={faPenToSquare} />
                        </button>
                    )}

                    {type === 'sistema' && (item.conciliationStatus === 'pendente' || item.conciliationStatus === 'sessionMatch') && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item);
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-1 py-1 rounded-md"
                            title="Excluir Lançamento"
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    )}

                    {type === 'sistema' && item.conciliationStatus === 'dbConciliated' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toast.warning('Tem certeza que deseja desfazer esta conciliação?', {
                                    description: 'Isso reabrirá o lançamento no sistema.',
                                    action: { label: 'Desfazer', onClick: () => undoConciliationMutation.mutate(item.id) },
                                    cancel: { label: 'Cancelar' },
                                });
                            }}
                            disabled={undoConciliationMutation.isPending}
                            className="text-gray-500 hover:text-gray-700 text-xs font-bold px-1 py-1 rounded-md disabled:opacity-50"
                            title="Desfazer conciliação"
                        >
                            <FontAwesomeIcon icon={faUndo} spin={undoConciliationMutation.isPending} />
                        </button>
                    )}

                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <LancamentoFormModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSuccess={handleSuccessCreate} 
                initialData={lancamentoParaCriar}
            />

            <LancamentoFormModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                onSuccess={handleSuccessEdit} 
                initialData={lancamentoParaEditar}
            />

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">1. Selecione a Conta</label><select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md"><option value="">-- Escolha uma conta --</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                    <div><label className="block text-sm font-medium">2. Envie o arquivo OFX</label><input id="file-input" type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="mt-1 w-full text-sm" /></div>
                </div>
                <div className="flex flex-col md:flex-row justify-end items-center gap-3 pt-3 border-t">
                    <button onClick={resetState} className="text-sm text-gray-600 hover:text-red-600 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faEraser} /> Limpar Tela</button>

                    <button onClick={handleProcessFile} disabled={isProcessing || !file || !selectedContaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"><FontAwesomeIcon icon={isProcessing ? faSpinner : faMagic} spin={isProcessing} /> Processar Arquivo</button>
                </div>
            </div>
            
            {conciliationState.extrato.length > 0 &&
                <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                        <div><label className="block text-sm font-medium">Filtrar período de:</label><input type="date" name="startDate" value={conciliationState.dateFilter.startDate} onChange={(e) => handleDateFilterChange('startDate', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                        <div><label className="block text-sm font-medium">Até:</label><input type="date" name="endDate" value={conciliationState.dateFilter.endDate} onChange={(e) => handleDateFilterChange('endDate', e.target.value)} className="mt-1 w-full p-2 border rounded-md"/></div>
                        <button onClick={() => setDateRange('today')} className={`text-sm border px-3 py-2 rounded-md h-fit ${activePeriodFilter === 'today' ? 'bg-blue-600 text-white' : 'bg-white'}`}><FontAwesomeIcon icon={faCalendarDay}/></button>
                        <button onClick={() => setDateRange('week')} className={`text-sm border px-3 py-2 rounded-md h-fit ${activePeriodFilter === 'week' ? 'bg-blue-600 text-white' : 'bg-white'}`}><FontAwesomeIcon icon={faCalendarWeek}/></button>
                        <button onClick={() => setDateRange('month')} className={`text-sm border px-3 py-2 rounded-md h-fit ${activePeriodFilter === 'month' ? 'bg-blue-600 text-white' : 'bg-white'}`}><FontAwesomeIcon icon={faCalendarAlt}/></button>
                    </div>
                    <div className="border-t pt-3">
                         <button
                            onClick={() => setShowConciliados(!showConciliados)}
                            className={`text-sm border px-3 py-2 rounded-md h-fit flex items-center gap-2 transition-colors ${
                                showConciliados ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FontAwesomeIcon icon={showConciliados ? faEyeSlash : faEye} />
                            {showConciliados ? 'Ocultar Conciliados' : 'Mostrar Conciliados'}
                        </button>
                    </div>
                </div>
            }

            <div ref={containerRef} className="relative pt-6 border-t">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    {lines.map((line, index) => ( <path key={index} d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`} stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')} strokeWidth="2" fill="none" /> ))}
                </svg>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2">Lançamentos no Sistema</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1">
                            {isLoadingLancamentos && extratoPeriodo.startDate && <div className="text-center p-4"><FontAwesomeIcon icon={faSpinner} spin /> Buscando...</div>}
                            {!isLoadingLancamentos && processedLists.sortedSistema.map(item => renderItem(item, 'sistema', 'sistema'))}
                            {!isLoadingLancamentos && processedLists.sortedSistema.length === 0 && <p className="p-3 text-sm text-gray-500 text-center">Nenhum lançamento encontrado para os filtros aplicados.</p>}
                        </div>
                    </div> 
                    <div>
                        <h3 className="font-semibold mb-2">Transações do Extrato</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1">
                            {processedLists.sortedExtrato.map(item => renderItem(item, 'extrato', 'extrato'))}
                            {processedLists.sortedExtrato.length === 0 && <p className="p-3 text-sm text-gray-500 text-center">Nenhuma transação de extrato para os filtros aplicados.</p>}
                        </div>
                    </div>
                </div>
            </div>
            {(conciliationState.matches.length > 0 || (selectedItems.extrato && selectedItems.sistema)) && (
                <div className="sticky bottom-0 bg-white p-4 border-t-2 shadow-lg flex justify-center items-center gap-4 z-20">
                    {selectedItems.extrato && selectedItems.sistema && (<button onClick={handleManualMatch} className="bg-yellow-500 text-white font-bold px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2 animate-pulse"><FontAwesomeIcon icon={faLink}/> Conciliar Itens Selecionados</button>)}
                    {conciliationState.matches.length > 0 && (<button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-green-700 text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-green-800 disabled:bg-gray-400 flex items-center gap-3"><FontAwesomeIcon icon={faCheckCircle}/> Confirmar {conciliationState.matches.length} Conciliações</button>)}
                </div>
            )}
        </div>
    );
}
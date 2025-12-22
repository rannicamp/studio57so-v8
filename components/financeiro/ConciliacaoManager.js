"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faSpinner, faUpload, faLink, faFileImport, faCheckCircle, faMagic, faPlus, 
    faExclamationTriangle, faEraser, faCalendarDay, faCalendarWeek, faCalendarAlt, 
    faUndo, faEye, faEyeSlash, faPenToSquare, faTrash, faCalculator, faTimes,
    faBuildingColumns, faFileInvoice
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
    
    // Busca lançamentos por data de pagamento OU vencimento no período
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

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user, organizacao_id } = useAuth();
    const organizacaoId = organizacao_id;
    const queryClient = useQueryClient();

    // Estados
    const [selectedContaId, setSelectedContaId] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('lastSelectedConciliationAccountId') || '' : ''));
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conciliationState, setConciliationState] = useState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } });
    const [extratoPeriodo, setExtratoPeriodo] = useState({ startDate: null, endDate: null });
    
    // Estados Belvo
    const [importMethod, setImportMethod] = useState('ofx'); // 'ofx' ou 'belvo'
    const [belvoDateRange, setBelvoDateRange] = useState({ 
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        to: new Date().toISOString().split('T')[0] 
    });

    // Seleção Múltipla
    const [selectedExtratoId, setSelectedExtratoId] = useState(null);
    const [selectedSistemaIds, setSelectedSistemaIds] = useState(new Set());
    
    // Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lancamentoParaCriar, setLancamentoParaCriar] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [lancamentoParaEditar, setLancamentoParaEditar] = useState(null);

    // Visual
    const [lines, setLines] = useState([]);
    const itemRefs = useRef(new Map());
    const containerRef = useRef(null);
    const [activePeriodFilter, setActivePeriodFilter] = useState('');
    const [showConciliados, setShowConciliados] = useState(false);
    
    // Recupera dados da conta selecionada
    const selectedContaData = useMemo(() => contas.find(c => c.id == selectedContaId), [contas, selectedContaId]);

    // Busca lançamentos do sistema
    const { data: lancamentosSistema, isLoading: isLoadingLancamentos } = useQuery({
        queryKey: ['lancamentosSistemaConciliacao', selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate],
        queryFn: () => fetchLancamentosSistema(supabase, selectedContaId, organizacaoId, extratoPeriodo.startDate, extratoPeriodo.endDate),
        enabled: !!(selectedContaId && organizacaoId && extratoPeriodo.startDate && extratoPeriodo.endDate),
    });

    // --- EFEITOS E MATCHING AUTOMÁTICO ---
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

    // --- CALCULADORA DE LINHAS ---
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
    
    // --- PERSISTÊNCIA DE SESSÃO ---
    useEffect(() => {
        if (selectedContaId) sessionStorage.setItem('lastSelectedConciliationAccountId', selectedContaId);
    }, [selectedContaId]);

    // --- PROCESSAMENTO OFX ---
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
                const getValue = (tag) => { const regex = new RegExp(`<${tag}>([^<]*)`); const result = regex.exec(transacaoBlock); return result ? result[1].trim() : null; };
                const valorRaw = getValue('TRNAMT');
                const valor = parseFloat(valorRaw);
                const dataStr = getValue('DTPOSTED')?.substring(0, 8);
                if (!dataStr || isNaN(valor)) continue;
                const formattedDate = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
                let fitId = getValue('FITID');
                if (!fitId || fitId === '000000' || fitId === '0' || idMap.has(fitId)) { fitId = `GEN_${dataStr}_${valorRaw.replace('.', '')}_${index}`; }
                idMap.add(fitId);
                transacoesManuais.push({ id: fitId, data: formattedDate, valor: valor, descricao: getValue('MEMO') || getValue('NAME') || 'Sem descrição', origem: 'ofx' });
                index++;
            }
            return transacoesManuais;
        } catch (error) { return null; }
    };
    
    const handleProcessFile = async () => {
        if (!file || !selectedContaId) { toast.warning('Por favor, selecione uma conta e um arquivo OFX.'); return; }
        const toastId = toast.loading('Lendo arquivo...');
        setIsProcessing(true);
        setConciliationState(prev => ({ ...prev, matches: [] })); 

        const fileContent = await file.text();
        const transacoesDoExtrato = parseOfxFile(fileContent);
        
        if (!transacoesDoExtrato || transacoesDoExtrato.length === 0) { 
            toast.error('Nenhuma transação válida encontrada.', { id: toastId }); 
            setIsProcessing(false); 
            return; 
        }
        
        finalizeImport(transacoesDoExtrato, toastId);
    };

    // --- PROCESSAMENTO BELVO (NOVO) ---
    const handleImportFromBelvo = async () => {
        if (!selectedContaId) return toast.warning("Selecione uma conta.");
        if (!selectedContaData?.belvo_link_id || !selectedContaData?.belvo_account_id) return toast.error("Esta conta não está conectada ao Open Finance.");

        const toastId = toast.loading("Buscando transações no banco...");
        setIsProcessing(true);
        setConciliationState(prev => ({ ...prev, matches: [] }));

        try {
            const params = new URLSearchParams({
                link_id: selectedContaData.belvo_link_id,
                account_id: selectedContaData.belvo_account_id,
                date_from: belvoDateRange.from,
                date_to: belvoDateRange.to
            });

            const response = await fetch(`/api/belvo/transactions?${params}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Erro ao buscar transações');
            if (!data || data.length === 0) throw new Error('Nenhuma transação encontrada no período.');

            // Normaliza dados da Belvo
            const transacoesBelvo = data.map(t => ({
                id: t.id,
                data: t.data,
                valor: t.valor,
                descricao: t.descricao,
                origem: 'belvo'
            }));

            finalizeImport(transacoesBelvo, toastId);

        } catch (err) {
            toast.error(err.message, { id: toastId });
            setIsProcessing(false);
        }
    };

    const finalizeImport = (transacoes, toastId) => {
        const datasDoExtrato = transacoes.map(t => new Date(t.data));
        const dataInicio = new Date(Math.min.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        const dataFim = new Date(Math.max.apply(null, datasDoExtrato)).toISOString().split('T')[0];
        
        setConciliationState({ extrato: transacoes, sistema: [], matches: [], dateFilter: { startDate: dataInicio, endDate: dataFim } });
        setExtratoPeriodo({ startDate: dataInicio, endDate: dataFim });
        toast.success(`${transacoes.length} transações importadas com sucesso!`, { id: toastId });
    };

    // --- MUTAÇÕES DE AÇÃO ---
    const undoConciliationMutation = useMutation({
        mutationFn: async (lancamentoId) => {
            const { data, error } = await supabase
                .from('lancamentos')
                .update({ conciliado: false, status: 'Pendente', data_pagamento: null, id_transacao_externa: null })
                .eq('id', lancamentoId)
                .select().single();
            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: () => {
            toast.success('Conciliação desfeita!');
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
        }
    });

    const deleteSingleMutation = useMutation({
        mutationFn: async (id) => { const { error } = await supabase.from('lancamentos').delete().eq('id', id); if (error) throw error; },
        onSuccess: () => { toast.success('Lançamento excluído!'); queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] }); }
    });

    // --- RENDERIZAÇÃO ---
    const proceedWithMatch = () => {
        if (!selectedExtratoId || selectedSistemaIds.size === 0) return;
        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;
        const newMatches = Array.from(selectedSistemaIds).map(sisId => ({ extratoId: selectedExtratoId, sistemaId: sisId, pairId: newPairId }));
        setConciliationState(prev => ({ ...prev, matches: [...prev.matches, ...newMatches] }));
        setSelectedExtratoId(null); setSelectedSistemaIds(new Set());
    };

    const handleConfirmMatches = async () => {
        if (!user || !organizacaoId || conciliationState.matches.length === 0) return;
        const toastId = toast.loading('Processando conciliação...');
        setIsProcessing(true);

        try {
            // Se for OFX, tenta salvar arquivo (opcional para Belvo, mas bom manter padrão se tiver arquivo)
            let filePath = null;
            if (file) {
                const dataAtual = new Date();
                const path = `${organizacaoId}/${selectedContaId}/${dataAtual.getFullYear()}/${dataAtual.getMonth() + 1}/${Date.now()}-${file.name}`;
                const { data } = await supabase.storage.from('extratos-bancarios').upload(path, file);
                filePath = data?.path;
            }

            const updates = conciliationState.matches.map(match => {
                const extratoItem = conciliationState.extrato.find(e => e.id === match.extratoId);
                return {
                    id: match.sistemaId,
                    updates: { 
                        conciliado: true, status: 'Pago', data_pagamento: extratoItem.data, 
                        id_transacao_externa: match.extratoId 
                    }
                };
            });

            const uniqueExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));
            const totalConciliado = Array.from(uniqueExtratoIds).reduce((sum, id) => {
                const item = conciliationState.extrato.find(e => e.id === id);
                return sum + (item ? Math.abs(item.valor) : 0);
            }, 0);

            // Atualiza Lançamentos
            for (const item of updates) {
                await supabase.from('lancamentos').update(item.updates).eq('id', item.id);
            }
            
            // Salva Histórico
            await supabase.from('conciliacao_historico').insert([{
                usuario_id: user.id,
                conta_financeira_id: selectedContaId,
                organizacao_id: organizacaoId,
                caminho_arquivo_ofx: filePath || 'IMPORTACAO_BELVO',
                periodo_inicio_extrato: extratoPeriodo.startDate,
                periodo_fim_extrato: extratoPeriodo.endDate,
                lancamentos_conciliados: updates, // Simplificado para salvar JSON
                total_conciliado: totalConciliado
            }]);

            toast.success(`${updates.length} lançamentos conciliados!`, { id: toastId });
            queryClient.invalidateQueries({ queryKey: ['lancamentosSistemaConciliacao'] });
            
            // Limpa estado parcial
            setConciliationState(prev => ({ ...prev, matches: [] }));
            setFile(null);
            
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

    // Cálculos da Calculadora
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
        return { target, totalSistema, diff, isMatch: Math.abs(diff) < 0.01, count: selectedSistemaIds.size };
    }, [selectedExtratoId, selectedSistemaIds, conciliationState]);

    // Lógica de Renderização de Lista (Filtrada)
    const processedLists = useMemo(() => {
        const { startDate, endDate } = conciliationState.dateFilter;
        const sessionMatchedSis = new Set(conciliationState.matches.map(m => m.sistemaId));
        const sessionMatchedExt = new Set(conciliationState.matches.map(m => m.extratoId));
        
        const filterAndSort = (items, type) => {
            return items.filter(item => {
                const d = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data;
                return (!startDate || d >= startDate) && (!endDate || d <= endDate);
            }).map(item => {
                let status = 'pendente';
                if ((type === 'sistema' && sessionMatchedSis.has(item.id)) || (type === 'extrato' && sessionMatchedExt.has(item.id))) status = 'sessionMatch';
                else if (item.conciliado || (type === 'extrato' && item.origem === 'db')) status = 'dbConciliated'; // Simplificado
                return { ...item, conciliationStatus: status };
            }).filter(item => showConciliados || item.conciliationStatus !== 'dbConciliated')
            .sort((a,b) => new Date(type === 'sistema' ? (a.data_pagamento || a.data_vencimento) : a.data) - new Date(type === 'sistema' ? (b.data_pagamento || b.data_vencimento) : b.data));
        };

        return {
            sortedSistema: filterAndSort(conciliationState.sistema, 'sistema'),
            sortedExtrato: filterAndSort(conciliationState.extrato, 'extrato')
        };
    }, [conciliationState, showConciliados]);

    const renderItem = (item, type, listName) => {
        const isSelected = type === 'extrato' ? selectedExtratoId === item.id : selectedSistemaIds.has(item.id);
        const match = item.conciliationStatus === 'sessionMatch' ? conciliationState.matches.find(m => m[`${listName}Id`] === item.id) : null;
        let rowClass = 'bg-white';
        if (match) rowClass = getColorForPair(match.pairId);
        if (isSelected) rowClass = 'ring-2 ring-blue-500 bg-blue-50';
        
        const isReceita = (type === 'sistema' && item.tipo === 'Receita') || (type === 'extrato' && item.valor > 0);
        const dataExibicao = type === 'sistema' ? (item.data_pagamento || item.data_vencimento) : item.data;

        return (
            <div 
                key={item.id} 
                ref={node => itemRefs.current.set(`${listName}-${item.id}`, node)} 
                onClick={() => {
                     if (item.conciliationStatus === 'pendente') {
                        if (type === 'extrato') setSelectedExtratoId(prev => prev === item.id ? null : item.id);
                        else setSelectedSistemaIds(prev => { const s = new Set(prev); if (s.has(item.id)) s.delete(item.id); else s.add(item.id); return s; });
                     } else if (item.conciliationStatus === 'sessionMatch') {
                         setConciliationState(prev => ({ ...prev, matches: prev.matches.filter(m => m.pairId !== match.pairId) }));
                     }
                }}
                className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md cursor-pointer hover:bg-gray-100 transition-all ${rowClass}`}
            >
                <div className="col-span-3">{formatDate(dataExibicao)}</div>
                <div className="col-span-5 truncate" title={item.descricao}>{item.descricao}</div>
                <div className={`col-span-2 text-right font-bold ${isReceita ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor)}</div>
                <div className="col-span-2 flex justify-end gap-1">
                    {type === 'extrato' && item.conciliationStatus === 'pendente' && (
                         <button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="text-blue-600 bg-blue-100 p-1 rounded"><FontAwesomeIcon icon={faPlus}/></button>
                    )}
                    {type === 'sistema' && item.conciliationStatus === 'dbConciliated' && (
                         <button onClick={(e) => { e.stopPropagation(); undoConciliationMutation.mutate(item.id); }} className="text-gray-500"><FontAwesomeIcon icon={faUndo}/></button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={(newItem) => { toast.success('Criado!'); setConciliationState(p => ({ ...p, sistema: [...p.sistema, { ...newItem, conciliado: true }] })); setIsModalOpen(false); }} initialData={lancamentoParaCriar} />
            
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                {/* 1. SELEÇÃO DE CONTA */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária</label>
                    <select value={selectedContaId} onChange={(e) => { setSelectedContaId(e.target.value); setConciliationState({ extrato: [], sistema: [], matches: [], dateFilter: { startDate: '', endDate: '' } }); }} className="w-full p-2 border rounded-md">
                        <option value="">-- Selecione --</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.nome} {c.belvo_account_id ? '(Conectada)' : ''}</option>)}
                    </select>
                </div>

                {selectedContaId && (
                    <div className="bg-white p-4 rounded border">
                        {/* ABAS DE IMPORTAÇÃO */}
                        <div className="flex gap-4 mb-4 border-b pb-2">
                            <button onClick={() => setImportMethod('ofx')} className={`pb-2 px-2 font-medium flex items-center gap-2 ${importMethod === 'ofx' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                                <FontAwesomeIcon icon={faFileInvoice} /> Arquivo OFX
                            </button>
                            <button onClick={() => setImportMethod('belvo')} className={`pb-2 px-2 font-medium flex items-center gap-2 ${importMethod === 'belvo' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                                <FontAwesomeIcon icon={faBuildingColumns} /> Open Finance (Automático)
                            </button>
                        </div>

                        {importMethod === 'ofx' ? (
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-sm text-gray-600">Arquivo OFX</label>
                                    <input type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="w-full text-sm mt-1" />
                                </div>
                                <button onClick={handleProcessFile} disabled={isProcessing || !file} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                                    <FontAwesomeIcon icon={isProcessing ? faSpinner : faUpload} spin={isProcessing} /> Processar
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {selectedContaData?.belvo_account_id ? (
                                    <div className="flex gap-4 items-end">
                                        <div>
                                            <label className="text-sm text-gray-600">De</label>
                                            <input type="date" value={belvoDateRange.from} onChange={e => setBelvoDateRange(p => ({...p, from: e.target.value}))} className="w-full border rounded p-2" />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-600">Até</label>
                                            <input type="date" value={belvoDateRange.to} onChange={e => setBelvoDateRange(p => ({...p, to: e.target.value}))} className="w-full border rounded p-2" />
                                        </div>
                                        <button onClick={handleImportFromBelvo} disabled={isProcessing} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                                            <FontAwesomeIcon icon={isProcessing ? faSpinner : faMagic} spin={isProcessing} /> 
                                            Buscar Transações
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-orange-50 border border-orange-200 rounded text-orange-800">
                                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                                        Esta conta não está conectada ao Open Finance. <br/>
                                        <span className="text-sm">Vá em Configurações &gt; Contas para conectar.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* COLUNAS DE CONCILIAÇÃO */}
            <div ref={containerRef} className="relative pt-6 border-t min-h-[400px]">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    {lines.map((line, index) => ( <path key={index} d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`} stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')} strokeWidth="2" fill="none" /> ))}
                </svg>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2 flex justify-between">
                            Sistema ({processedLists.sortedSistema.length})
                            {selectedSistemaIds.size > 0 && <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded-full">{selectedSistemaIds.size} selecionado(s)</span>}
                        </h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1 bg-gray-50">
                            {isLoadingLancamentos ? <div className="p-4 text-center"><FontAwesomeIcon icon={faSpinner} spin/></div> : processedLists.sortedSistema.map(item => renderItem(item, 'sistema', 'sistema'))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Extrato / Belvo ({processedLists.sortedExtrato.length})</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1 bg-gray-50">
                            {processedLists.sortedExtrato.map(item => renderItem(item, 'extrato', 'extrato'))}
                        </div>
                    </div>
                </div>
            </div>

            {/* BARRA DE AÇÃO FLUTUANTE */}
            {(conciliationState.matches.length > 0 || calculadora) && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white p-4 border-t shadow-lg z-50 animate-slide-up">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        {calculadora ? (
                            <div className={`flex items-center gap-4 px-4 py-2 rounded border-2 ${calculadora.isMatch ? 'border-green-500 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                                <div className="text-right"><div className="text-xs font-bold text-gray-500">ALVO</div><div className="font-mono font-bold">{formatCurrency(calculadora.target)}</div></div>
                                <div className="text-right"><div className="text-xs font-bold text-gray-500">SOMA</div><div className="font-mono font-bold">{formatCurrency(calculadora.totalSistema)}</div></div>
                                <div className="text-right"><div className="text-xs font-bold text-gray-500">DIFERENÇA</div><div className={`font-mono font-bold ${calculadora.diff === 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(calculadora.diff)}</div></div>
                                {calculadora.isMatch && <button onClick={proceedWithMatch} className="bg-green-600 text-white px-3 py-1 rounded ml-4 hover:bg-green-700"><FontAwesomeIcon icon={faLink}/> Conciliar</button>}
                            </div>
                        ) : <div></div>}
                        
                        {conciliationState.matches.length > 0 && (
                            <button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-blue-800 text-white px-6 py-3 rounded font-bold hover:bg-blue-900 flex items-center gap-2 shadow-lg">
                                <FontAwesomeIcon icon={faCheckCircle} /> Confirmar {conciliationState.matches.length} Pares
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
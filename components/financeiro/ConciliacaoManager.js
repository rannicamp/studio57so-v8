//components\financeiro\ConciliacaoManager.js
"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext'; // 1. Importar o useAuth
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faLink, faFileImport, faCheckCircle, faMagic, faPlus, faExclamationTriangle, faEraser } from '@fortawesome/free-solid-svg-icons';
import LancamentoFormModal from './LancamentoFormModal';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';

// =================================================================================
// ATUALIZAÇÃO DA REGRA DE DATAS
// O PORQUÊ: Esta função agora segue nossa regra de ouro para datas simples,
// tratando a data como texto para evitar problemas de fuso horário.
// =================================================================================
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

// =================================================================================
// ATUALIZAÇÃO DE SEGURANÇA (organizacao_id)
// O PORQUÊ: A busca de lançamentos agora é filtrada pela organização.
// =================================================================================
const fetchLancamentosSistema = async (supabase, contaId, organizacaoId) => {
    if (!contaId || !organizacaoId) return [];
    const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('conta_id', contaId)
        .eq('organizacao_id', organizacaoId) // <-- FILTRO DE SEGURANÇA!
        .eq('conciliado', false)
        .in('status', ['Pago', 'Pendente']);
    if (error) throw new Error(error.message);
    return data;
};

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const { user } = useAuth(); // 2. Obter o usuário para o organizacaoId
    const organizacaoId = user?.organizacao_id;

    const [selectedContaId, setSelectedContaId] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lastSelectedConciliationAccountId') || '';
        }
        return '';
    });

    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const [conciliationState, setConciliationState] = useState({
        extrato: [],
        sistema: [],
        matches: [],
    });

    const [selectedItems, setSelectedItems] = useState({ extrato: null, sistema: null });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [lancamentoParaCriar, setLancamentoParaCriar] = useState(null);

    const [lines, setLines] = useState([]);
    const itemRefs = useRef(new Map());
    const containerRef = useRef(null);

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
    }, [conciliationState.matches, conciliationState.sistema, conciliationState.extrato, calculateLines]);

    // =================================================================================
    // ATUALIZAÇÃO DE SEGURANÇA (queryKey e queryFn)
    // O PORQUÊ: A query agora inclui o `organizacaoId` para um cache seguro e
    // chama a função de busca com o filtro de segurança.
    // =================================================================================
    const { refetch: refetchLancamentos } = useQuery({
        queryKey: ['lancamentosSistema', selectedContaId, organizacaoId],
        queryFn: () => fetchLancamentosSistema(supabase, selectedContaId, organizacaoId),
        enabled: false,
    });
    
    useEffect(() => {
        if (selectedContaId) {
            sessionStorage.setItem('lastSelectedConciliationAccountId', selectedContaId);
        } else {
            sessionStorage.removeItem('lastSelectedConciliationAccountId');
        }
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
                setConciliationState(JSON.parse(savedStateJSON));
                toast.success("Encontrei um progresso salvo e restaurei para você!");
            } else {
                setConciliationState({ extrato: [], sistema: [], matches: [] });
            }
        } else {
            setConciliationState({ extrato: [], sistema: [], matches: [] });
        }
    }, [selectedContaId]);

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
            while ((match = transacoesRegex.exec(fileContent)) !== null) {
                const transacaoBlock = match[1];
                const getValue = (tag) => { const regex = new RegExp(`<${tag}>([^<]*)`); const result = regex.exec(transacaoBlock); return result ? result[1].trim() : null; };
                const valor = parseFloat(getValue('TRNAMT'));
                const dataStr = getValue('DTPOSTED')?.substring(0, 8);
                if (!dataStr || isNaN(valor)) continue;
                const formattedDate = `${dataStr.substring(0, 4)}-${dataStr.substring(4, 6)}-${dataStr.substring(6, 8)}`;
                transacoesManuais.push({ id: getValue('FITID'), data: formattedDate, valor: valor, descricao: getValue('MEMO') || getValue('NAME') || 'Sem descrição' });
            }
            return transacoesManuais;
        } catch (error) { console.error("Erro no parse manual:", error); return null; }
    };
    
    const handleProcessFile = async () => {
        if (!file || !selectedContaId) {
            toast.warning('Por favor, selecione uma conta e um arquivo OFX.');
            return;
        }
        const toastId = toast.loading('Lendo arquivo e buscando lançamentos...');
        setIsProcessing(true);
        
        const fileContent = await file.text();
        const transacoesDoExtrato = parseOfxFile(fileContent);

        if (!transacoesDoExtrato || transacoesDoExtrato.length === 0) {
            toast.error('Nenhuma transação válida encontrada no arquivo.', { id: toastId });
            setIsProcessing(false);
            return;
        }
        
        const { data: lancamentosSistemaFetched, error: fetchError } = await refetchLancamentos();
        if (fetchError) {
            toast.error(`Erro ao buscar lançamentos: ${fetchError.message}`, { id: toastId });
            setIsProcessing(false);
            return;
        }
        
        const availableSistema = [...(lancamentosSistemaFetched || [])];
        const newMatches = [];
        let pairCounter = 0;
        
        const unmatchedExtrato = transacoesDoExtrato.filter(extratoItem => {
            const matchIndex = availableSistema.findIndex(sistemaItem => {
                const dataSistema = sistemaItem.data_pagamento || sistemaItem.data_vencimento || sistemaItem.data_transacao;
                const valorSistema = Math.abs(sistemaItem.valor);
                const valorExtrato = Math.abs(extratoItem.valor);
                return dataSistema === extratoItem.data && valorSistema.toFixed(2) === valorExtrato.toFixed(2);
            });

            if (matchIndex > -1) {
                const [matchedSistema] = availableSistema.splice(matchIndex, 1);
                newMatches.push({ extratoId: extratoItem.id, sistemaId: matchedSistema.id, pairId: pairCounter++ });
                return false;
            }
            return true;
        });

        setConciliationState({
            extrato: transacoesDoExtrato,
            sistema: (lancamentosSistemaFetched || []),
            matches: newMatches
        });
        toast.success(`${newMatches.length} pares foram sugeridos automaticamente!`, { id: toastId });
        setIsProcessing(false);
    };

    const handleManualMatch = () => {
        if (!selectedItems.extrato || !selectedItems.sistema) return;
        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;
        setConciliationState(prev => ({
            ...prev,
            matches: [...prev.matches, { extratoId: selectedItems.extrato, sistemaId: selectedItems.sistema, pairId: newPairId }]
        }));
        setSelectedItems({ extrato: null, sistema: null });
    };

    const handleConfirmMatches = async () => {
        if (conciliationState.matches.length === 0) return;

        const toastId = toast.loading(`Confirmando ${conciliationState.matches.length} pares...`);
        setIsProcessing(true);
        
        const updates = conciliationState.matches.map(match => ({
            id: match.sistemaId,
            updates: { conciliado: true, status: 'Pago', data_pagamento: new Date().toISOString(), id_transacao_externa: match.extratoId }
        }));

        try {
            for (const item of updates) {
                // =================================================================================
                // ATUALIZAÇÃO DE SEGURANÇA (organizacao_id)
                // O PORQUÊ: A atualização agora também verifica o `organizacao_id` para
                // garantir que estamos conciliando um lançamento da organização correta.
                // =================================================================================
                const { error } = await supabase
                    .from('lancamentos')
                    .update(item.updates)
                    .eq('id', item.id)
                    .eq('organizacao_id', organizacaoId); // <-- FILTRO DE SEGURANÇA!
                if (error) throw error;
            }
            toast.success(`${updates.length} lançamentos foram conciliados com sucesso!`, { id: toastId });
            resetState();
        } catch (error) {
            toast.error(`Erro ao confirmar conciliações: ${error.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCreateLancamento = (extratoItem) => {
        setLancamentoParaCriar({
            descricao: extratoItem.descricao,
            valor: Math.abs(extratoItem.valor),
            tipo: extratoItem.valor > 0 ? 'Receita' : 'Despesa',
            conta_id: selectedContaId,
            data_transacao: extratoItem.data,
            data_vencimento: extratoItem.data,
            data_pagamento: extratoItem.data,
            status: 'Pago',
            id_transacao_externa: extratoItem.id,
        });
        setIsModalOpen(true);
    };

    const handleSuccessCreate = (createdLancamento) => {
        toast.success('Lançamento criado e conciliado com sucesso a partir do extrato!');
        const extratoId = lancamentoParaCriar.id_transacao_externa;
        if (!extratoId || !createdLancamento) return;

        const newPairId = (conciliationState.matches[conciliationState.matches.length - 1]?.pairId || -1) + 1;

        const newMatch = {
            extratoId: extratoId,
            sistemaId: createdLancamento.id,
            pairId: newPairId
        };

        setConciliationState(prev => ({
            ...prev,
            sistema: [...prev.sistema, createdLancamento],
            matches: [...prev.matches, newMatch]
        }));
    };

    const resetState = () => {
        if (selectedContaId) {
            sessionStorage.removeItem(`conciliationProgress_${selectedContaId}`);
        }
        setFile(null);
        setConciliationState({ extrato: [], sistema: [], matches: [] });
        setSelectedItems({ extrato: null, sistema: null });
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
    };

    const { matchedExtratoIds, matchedSistemaIds } = useMemo(() => {
        const matchedExtratoIds = new Set(conciliationState.matches.map(m => m.extratoId));
        const matchedSistemaIds = new Set(conciliationState.matches.map(m => m.sistemaId));
        return { matchedExtratoIds, matchedSistemaIds };
    }, [conciliationState.matches]);
    
    const { sortedSistema, sortedExtrato } = useMemo(() => {
        const sistemaMatchOrder = new Map(conciliationState.matches.map(m => [m.sistemaId, m.pairId]));
        const extratoMatchOrder = new Map(conciliationState.matches.map(m => [m.extratoId, m.pairId]));

        const sortRule = (idSet, orderMap, dateFieldA, dateFieldB) => (a, b) => {
            const aIsMatched = idSet.has(a.id);
            const bIsMatched = idSet.has(b.id);

            if (aIsMatched && bIsMatched) {
                return orderMap.get(a.id) - orderMap.get(b.id);
            }
            if (aIsMatched) return -1;
            if (bIsMatched) return 1;
            
            const dateA = new Date(a[dateFieldA] || a[dateFieldB]);
            const dateB = new Date(b[dateFieldA] || b[dateFieldB]);
            return dateA - dateB;
        };

        const sortedSistema = [...conciliationState.sistema].sort(sortRule(matchedSistemaIds, sistemaMatchOrder, 'data_vencimento', 'data_transacao'));
        const sortedExtrato = [...conciliationState.extrato].sort(sortRule(matchedExtratoIds, extratoMatchOrder, 'data'));

        return { sortedSistema, sortedExtrato };
    }, [conciliationState.sistema, conciliationState.extrato, conciliationState.matches, matchedSistemaIds, matchedExtratoIds]);

    return (
        <div className="space-y-6">
            <LancamentoFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccessCreate} initialData={lancamentoParaCriar}/>
            
            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">1. Selecione a Conta</label><select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md"><option value="">-- Escolha uma conta --</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                    <div><label className="block text-sm font-medium">2. Envie o arquivo OFX</label><input id="file-input" type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="mt-1 w-full text-sm" /></div>
                </div>
                <div className="flex flex-col md:flex-row justify-end items-center gap-3 pt-3 border-t">
                    <button onClick={resetState} className="text-sm text-gray-600 hover:text-red-600 font-semibold flex items-center gap-2"><FontAwesomeIcon icon={faEraser} /> Limpar Tela</button>
                    <button onClick={handleProcessFile} disabled={isProcessing || !file || !selectedContaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"><FontAwesomeIcon icon={isProcessing ? faSpinner : faMagic} spin={isProcessing} /> Processar e Sugerir Pares</button>
                </div>
            </div>

            <div ref={containerRef} className="relative pt-6 border-t">
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                    {lines.map((line, index) => (
                        <path
                            key={index}
                            d={`M ${line.startX} ${line.startY} C ${line.startX + 50} ${line.startY}, ${line.endX - 50} ${line.endY}, ${line.endX} ${line.endY}`}
                            stroke={getColorForPair(line.pairId).split(' ')[0].replace('border', 'stroke').replace('-400', '-500')}
                            strokeWidth="2"
                            fill="none"
                        />
                    ))}
                </svg>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2">Lançamentos no Sistema</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1">
                            {sortedSistema.map(item => {
                                const isMatched = matchedSistemaIds.has(item.id);
                                const match = isMatched ? conciliationState.matches.find(m => m.sistemaId === item.id) : null;
                                const isSelected = selectedItems.sistema === item.id;
                                const colorClass = isMatched && match ? getColorForPair(match.pairId) : 'bg-white';
                                return (
                                    <div
                                        key={item.id}
                                        ref={node => { const map = itemRefs.current; if (node) map.set(`sistema-${item.id}`, node); else map.delete(`sistema-${item.id}`); }}
                                        onClick={() => !isMatched && setSelectedItems(prev => ({ ...prev, sistema: item.id }))}
                                        className={`p-2 border grid grid-cols-12 gap-2 text-sm rounded-md transition-all ${!isMatched ? 'cursor-pointer hover:bg-gray-100' : 'opacity-70'} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${colorClass}`}
                                    >
                                        <div className="col-span-3">{formatDate(item.data_vencimento || item.data_transacao)}</div>
                                        <div className="col-span-6 truncate">{item.descricao}</div>
                                        <div className={`col-span-3 text-right font-bold ${item.tipo === 'Receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor)}</div>
                                    </div>
                                );
                            })}
                            {sortedSistema.length === 0 && <p className="p-4 text-center text-gray-500 text-sm">Nenhum lançamento a conciliar.</p>}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-2">Transações do Extrato</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto space-y-1 p-1">
                            {sortedExtrato.map(item => {
                                const isMatched = matchedExtratoIds.has(item.id);
                                const isSelected = selectedItems.extrato === item.id;
                                const match = isMatched ? conciliationState.matches.find(m => m.extratoId === item.id) : null;
                                const colorClass = isMatched && match ? getColorForPair(match.pairId) : 'bg-white';
                                return (
                                    <div
                                        key={item.id}
                                        ref={node => { const map = itemRefs.current; if (node) map.set(`extrato-${item.id}`, node); else map.delete(`extrato-${item.id}`); }}
                                        onClick={() => !isMatched && setSelectedItems(prev => ({ ...prev, extrato: item.id }))}
                                        className={`p-2 border grid grid-cols-12 gap-2 text-sm items-center rounded-md transition-all ${!isMatched ? 'cursor-pointer hover:bg-gray-100' : 'opacity-70'} ${isSelected ? 'ring-2 ring-blue-500' : ''} ${colorClass}`}
                                    >
                                        <div className="col-span-3">{formatDate(item.data)}</div>
                                        <div className="col-span-5 truncate">{item.descricao}</div>
                                        <div className={`col-span-2 text-right font-bold ${item.valor > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(item.valor)}</div>
                                        <div className="col-span-2 text-center">
                                            {!isMatched && <button onClick={(e) => { e.stopPropagation(); handleCreateLancamento(item); }} className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-bold px-2 py-1 rounded-md"><FontAwesomeIcon icon={faPlus} /> Add</button>}
                                        </div>
                                    </div>
                                );
                            })}
                            {sortedExtrato.length === 0 && <p className="p-4 text-center text-gray-500 text-sm">Nenhuma transação do extrato carregada.</p>}
                        </div>
                    </div>
                </div>
            </div>
            
            {(conciliationState.matches.length > 0 || (selectedItems.extrato && selectedItems.sistema)) && (
                <div className="sticky bottom-0 bg-white p-4 border-t-2 shadow-lg flex justify-center items-center gap-4 z-20">
                     {selectedItems.extrato && selectedItems.sistema && (
                        <button onClick={handleManualMatch} className="bg-yellow-500 text-white font-bold px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2 animate-pulse">
                            <FontAwesomeIcon icon={faLink}/> Conciliar Itens Selecionados
                        </button>
                    )}
                    {conciliationState.matches.length > 0 && (
                        <button onClick={handleConfirmMatches} disabled={isProcessing} className="bg-green-700 text-white font-bold px-8 py-3 rounded-lg text-lg hover:bg-green-800 disabled:bg-gray-400 flex items-center gap-3">
                            <FontAwesomeIcon icon={faCheckCircle}/> Confirmar {conciliationState.matches.length} Conciliações
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
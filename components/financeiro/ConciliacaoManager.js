"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faLink, faFileImport, faCheckCircle, faMagic } from '@fortawesome/free-solid-svg-icons';
import { OfxData } from 'ofx-data-extractor'; // CORREÇÃO APLICADA AQUI

// Função para formatar a data
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Adiciona o fuso para evitar problemas de conversão de data
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('pt-BR');
};

// Função para formatar moeda
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const ItemCard = ({ item, type, isSelected, isSuggested, onSelect, onDragStart, onDragEnd, onDrop, onDragOver, onDragLeave, isDragOver }) => {
    const isDespesa = (type === 'extrato' && item.valor < 0) || (type === 'sistema' && item.tipo === 'Despesa');
    const valor = type === 'extrato' ? item.valor : (isDespesa ? -item.valor : item.valor);
    const data = type === 'extrato' ? item.data : (item.data_vencimento || item.data_transacao);

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={onSelect}
            className={`
                p-3 border-b grid grid-cols-12 gap-2 items-center text-sm cursor-pointer
                ${isSelected ? 'bg-blue-200 ring-2 ring-blue-400' : ''}
                ${isSuggested && !isSelected ? 'bg-yellow-100' : ''}
                ${isDragOver ? 'bg-green-200' : ''}
                ${type === 'extrato' ? 'hover:bg-blue-50' : 'hover:bg-green-50'}
            `}
        >
            <div className="col-span-3 text-gray-700">{formatDate(data)}</div>
            <div className="col-span-6 text-gray-900 font-medium truncate" title={item.descricao}>{item.descricao}</div>
            <div className={`col-span-3 text-right font-bold ${isDespesa ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(valor)}</div>
        </div>
    );
};


export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const [selectedContaId, setSelectedContaId] = useState('');
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');

    const [transacoesExtrato, setTransacoesExtrato] = useState([]);
    const [lancamentosSistema, setLancamentosSistema] = useState([]);
    
    const [selectedItem, setSelectedItem] = useState({ id: null, type: null });
    const [potentialMatches, setPotentialMatches] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverTarget, setDragOverTarget] = useState(null);

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setTransacoesExtrato([]);
            setLancamentosSistema([]);
            setMessage('');
            setSelectedItem({ id: null, type: null });
        }
    };
    
    const parseFileManually = (fileContent) => {
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
                transacoesManuais.push({ id: getValue('FITID'), data: formattedDate, valor: valor, descricao: getValue('MEMO') || getValue('NAME') || 'Sem descrição', tipo: valor < 0 ? 'Despesa' : 'Receita', conciliado: false });
            }
            return transacoesManuais;
        } catch (error) { console.error("Erro no parse manual:", error); return null; }
    };

    const parseOfxFile = (fileContent) => {
        try {
            // CORREÇÃO APLICADA AQUI
            const ofx = new OfxData(fileContent);
            const ofxData = ofx.getStatement();
            if (!ofxData?.transactions || ofxData.transactions.length === 0) { console.warn("Biblioteca OFX não encontrou transações. Tentando método manual."); return parseFileManually(fileContent); }
            return ofxData.transactions.map(t => ({ id: t.id, data: t.postedAt.toISOString().split('T')[0], valor: t.amount, descricao: t.description || 'Sem descrição', tipo: t.amount < 0 ? 'Despesa' : 'Receita', conciliado: false }));
        } catch (error) { console.error("Erro com a biblioteca OFX, tentando método manual:", error); return parseFileManually(fileContent); }
    };
    
    const conciliarPar = async (transacao, lancamento) => {
        const { error } = await supabase
            .from('lancamentos')
            .update({ 
                conciliado: true, 
                status: 'Pago',
                data_pagamento: new Date().toISOString(),
                id_transacao_externa: transacao.id 
            })
            .eq('id', lancamento.id);

        if (error) { console.error("Erro ao conciliar par:", error); return false; }
        return true;
    };
    
    const runAutoConciliation = async (transacoes, lancamentos) => {
        const matches = new Map();
        const lancamentosNaoConciliados = [];
        let autoConciliadosCount = 0;

        for (const lancamento of lancamentos) {
            const key = `${lancamento.data_transacao}_${Math.abs(lancamento.valor).toFixed(2)}`;
            const matchesForKey = matches.get(key) || [];
            matchesForKey.push(lancamento);
            matches.set(key, matchesForKey);
        }

        const transacoesNaoConciliadas = [];
        for (const transacao of transacoes) {
            const key = `${transacao.data}_${Math.abs(transacao.valor).toFixed(2)}`;
            const lancamentosCorrespondentes = matches.get(key);

            if (lancamentosCorrespondentes && lancamentosCorrespondentes.length > 0) {
                const lancamentoParaConciliar = lancamentosCorrespondentes.shift();
                const success = await conciliarPar(transacao, lancamentoParaConciliar);
                if (success) autoConciliadosCount++;
                else transacoesNaoConciliadas.push(transacao);
            } else {
                transacoesNaoConciliadas.push(transacao);
            }
        }
        
        matches.forEach(lancamentosRestantes => {
            lancamentosNaoConciliados.push(...lancamentosRestantes);
        });

        if (autoConciliadosCount > 0) {
            setMessage(`${autoConciliadosCount} lançamentos foram conciliados automaticamente!`);
        } else {
            setMessage('Nenhum lançamento foi conciliado automaticamente. Verifique os itens abaixo.');
        }

        return { transacoesRestantes: transacoesNaoConciliadas, lancamentosRestantes: lancamentosNaoConciliados, count: autoConciliadosCount };
    };

    const handleLoadForConciliation = async () => {
        if (!file || !selectedContaId) { setMessage('Selecione uma conta e um arquivo.'); return; }
        setIsProcessing(true);
        setMessage('Lendo arquivo e buscando lançamentos do sistema...');
        const fileContent = await file.text();
        const transacoes = parseOfxFile(fileContent);
        if (!transacoes || transacoes.length === 0) { setMessage('Nenhuma transação válida encontrada ou erro ao ler o arquivo.'); setIsProcessing(false); return; }

        const { data: lancamentosData, error } = await supabase.from('lancamentos').select('*').eq('conta_id', selectedContaId).eq('conciliado', false);
        if (error) { setMessage('Erro ao buscar lançamentos do sistema.'); setIsProcessing(false); return; }
        
        const { transacoesRestantes, lancamentosRestantes } = await runAutoConciliation(transacoes, lancamentosData || []);
        
        setTransacoesExtrato(transacoesRestantes);
        setLancamentosSistema(lancamentosRestantes);
        
        setIsProcessing(false);
    };
    
    const handleImportAsNew = () => { /* ...código sem alteração... */ };
    
    const findMatches = useCallback((item, list, type) => {
        if (!item) return [];

        const itemDate = new Date(type === 'extrato' ? item.data : (item.data_vencimento || item.data_transacao));
        const itemValue = Math.abs(item.valor);

        return list
            .map(candidate => {
                const candidateDate = new Date(type === 'sistema' ? candidate.data : (candidate.data_vencimento || candidate.data_transacao));
                const candidateValue = Math.abs(candidate.valor);
                const dateDiff = Math.abs(itemDate - candidateDate) / (1000 * 60 * 60 * 24);
                const valueDiff = Math.abs(itemValue - candidateValue);

                if (dateDiff <= 5 && valueDiff <= 1) { // Tolerância: 5 dias e R$1,00 de diferença
                    return candidate.id;
                }
                return null;
            })
            .filter(Boolean);
    }, []);

    useEffect(() => {
        if (!selectedItem.id) {
            setPotentialMatches([]);
            return;
        }

        if (selectedItem.type === 'extrato') {
            const item = transacoesExtrato.find(t => t.id === selectedItem.id);
            setPotentialMatches(findMatches(item, lancamentosSistema, 'sistema'));
        } else {
            const item = lancamentosSistema.find(l => l.id === selectedItem.id);
            setPotentialMatches(findMatches(item, transacoesExtrato, 'extrato'));
        }
    }, [selectedItem, transacoesExtrato, lancamentosSistema, findMatches]);

    const handleDropOnLancamento = async (lancamentoAlvo) => {
        if (!draggedItem) return;
        
        const transacaoArrastada = draggedItem;
        setDraggedItem(null); setDragOverTarget(null);

        const success = await conciliarPar(transacaoArrastada, lancamentoAlvo);
        if (success) {
            setTransacoesExtrato(prev => prev.filter(t => t.id !== transacaoArrastada.id));
            setLancamentosSistema(prev => prev.filter(l => l.id !== lancamentoAlvo.id));
            setMessage('Conciliado com sucesso!');
        } else {
            setMessage('Erro ao tentar conciliar.');
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Conciliação Bancária</h2>

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium">1. Selecione a Conta</label><select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md"><option value="">-- Escolha uma conta --</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                    <div><label className="block text-sm font-medium">2. Envie o arquivo OFX/OFC</label><input type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="mt-1 w-full text-sm"/></div>
                </div>
                <div className="flex flex-col md:flex-row justify-end gap-3 pt-3 border-t">
                    <button onClick={handleImportAsNew} disabled={isProcessing || !file || !selectedContaId} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"><FontAwesomeIcon icon={isProcessing ? faSpinner : faFileImport} spin={isProcessing} />Importar para o Financeiro</button>
                    <button onClick={handleLoadForConciliation} disabled={isProcessing || !file || !selectedContaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"><FontAwesomeIcon icon={isProcessing ? faSpinner : faMagic} spin={isProcessing} />Conciliar Automaticamente</button>
                </div>
            </div>

            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

            {(transacoesExtrato.length > 0 || lancamentosSistema.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                    <div>
                        <h3 className="font-semibold mb-2">Transações do Extrato ({transacoesExtrato.length})</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                            <div className="sticky top-0 bg-gray-50 grid grid-cols-12 gap-2 p-2 border-b text-xs font-bold uppercase text-gray-600">
                                <div className="col-span-3">Data</div><div className="col-span-6">Descrição</div><div className="col-span-3 text-right">Valor</div>
                            </div>
                            {transacoesExtrato.length === 0 && <p className="p-4 text-center text-gray-500">Nenhuma transação pendente.</p>}
                            {transacoesExtrato.map(t => (
                                <ItemCard key={t.id} item={t} type="extrato"
                                    isSelected={selectedItem.id === t.id}
                                    isSuggested={selectedItem.type === 'sistema' && potentialMatches.includes(t.id)}
                                    onSelect={() => setSelectedItem({id: t.id, type: 'extrato'})}
                                    onDragStart={() => setDraggedItem(t)}
                                    onDragEnd={() => setDraggedItem(null)}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Lançamentos do Sistema ({lancamentosSistema.length})</h3>
                        <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                           <div className="sticky top-0 bg-gray-50 grid grid-cols-12 gap-2 p-2 border-b text-xs font-bold uppercase text-gray-600">
                                <div className="col-span-3">Data</div><div className="col-span-6">Descrição</div><div className="col-span-3 text-right">Valor</div>
                            </div>
                            {lancamentosSistema.length === 0 && <p className="p-4 text-center text-gray-500">Nenhum lançamento pendente.</p>}
                            {lancamentosSistema.map(l => (
                                <ItemCard key={l.id} item={l} type="sistema"
                                    isSelected={selectedItem.id === l.id}
                                    isSuggested={selectedItem.type === 'extrato' && potentialMatches.includes(l.id)}
                                    isDragOver={dragOverTarget === l.id}
                                    onSelect={() => setSelectedItem({id: l.id, type: 'sistema'})}
                                    onDrop={() => handleDropOnLancamento(l)}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverTarget(l.id); }}
                                    onDragLeave={() => setDragOverTarget(null)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
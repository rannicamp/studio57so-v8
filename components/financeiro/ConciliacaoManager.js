"use client";

import { useState, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faLink, faFileImport, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { OFX } from 'ofx-data-extractor';

// Função para formatar a data
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    // Adiciona o fuso para evitar problemas de conversão de data
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR');
};

// Função para formatar moeda
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export default function ConciliacaoManager({ contas }) {
    const supabase = createClient();
    const [selectedContaId, setSelectedContaId] = useState('');
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');

    const [transacoesExtrato, setTransacoesExtrato] = useState([]);
    const [lancamentosSistema, setLancamentosSistema] = useState([]);
    const [selectedTransacao, setSelectedTransacao] = useState(null);
    const [selectedLancamento, setSelectedLancamento] = useState(null);

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setTransacoesExtrato([]);
            setMessage('');
        }
    };
    
    // Função para extrair transações do arquivo
    const parseFile = (fileContent) => {
        try {
            const transacoesManuais = [];
            const transacoesRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
            let match;
            
            while ((match = transacoesRegex.exec(fileContent)) !== null) {
                const transacaoBlock = match[1];
                
                const getValue = (tag) => {
                    const regex = new RegExp(`<${tag}>([^<]*)`);
                    const result = regex.exec(transacaoBlock);
                    return result ? result[1].trim() : null;
                };

                const valor = parseFloat(getValue('TRNAMT'));
                const dataStr = getValue('DTPOSTED')?.substring(0, 8);
                
                if (!dataStr || isNaN(valor)) continue;

                const formattedDate = `${dataStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                
                transacoesManuais.push({
                    id: getValue('FITID'),
                    data: formattedDate,
                    valor: valor,
                    descricao: getValue('MEMO') || getValue('NAME') || 'Sem descrição',
                    tipo: valor < 0 ? 'Despesa' : 'Receita',
                    conciliado: false
                });
            }
            return transacoesManuais;
        } catch (error) {
            console.error("Erro no parse manual:", error);
            return null;
        }
    };

    // Função para carregar o arquivo para conciliação
    const handleLoadForConciliation = () => {
        if (!file || !selectedContaId) {
            setMessage('Selecione uma conta e um arquivo.');
            return;
        }
        setIsProcessing(true);
        setMessage('Lendo arquivo do banco...');

        const reader = new FileReader();
        reader.onload = (e) => {
            const transacoes = parseFile(e.target.result);
            if (transacoes && transacoes.length > 0) {
                setTransacoesExtrato(transacoes);
                fetchLancamentosNaoConciliados(transacoes.map(t => t.id));
                setMessage(`${transacoes.length} transações encontradas para conciliar.`);
            } else {
                setMessage('Nenhuma transação válida encontrada ou erro ao ler o arquivo.');
            }
            setIsProcessing(false);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };
    
    // NOVA FUNÇÃO: Importar transações como novos lançamentos
    const handleImportAsNew = () => {
        if (!file || !selectedContaId) {
            setMessage('Selecione uma conta e um arquivo para importar.');
            return;
        }
        if (!window.confirm("Isso irá importar todas as transações do arquivo como novos lançamentos no sistema. Deseja continuar?")) return;

        setIsProcessing(true);
        setMessage('Importando transações...');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const transacoes = parseFile(e.target.result);
            if (!transacoes || transacoes.length === 0) {
                setMessage('Nenhuma transação válida encontrada para importar.');
                setIsProcessing(false);
                return;
            }

            const lancamentosParaInserir = transacoes.map(t => ({
                descricao: t.descricao,
                valor: Math.abs(t.valor),
                data_transacao: t.data,
                data_vencimento: t.data,
                tipo: t.tipo,
                status: 'Pago', // Lançamentos de extrato já estão pagos
                conta_id: selectedContaId,
                conciliado: true,
                id_transacao_externa: t.id
            }));
            
            const { error } = await supabase.from('lancamentos').insert(lancamentosParaInserir);

            if (error) {
                setMessage(`Erro ao importar: ${error.message}`);
            } else {
                setMessage(`${lancamentosParaInserir.length} transações importadas com sucesso!`);
                // Limpa o estado para evitar re-importação acidental
                setFile(null);
                setTransacoesExtrato([]);
                if(document.querySelector('input[type="file"]')) {
                   document.querySelector('input[type="file"]').value = "";
                }
            }
            setIsProcessing(false);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };


    const fetchLancamentosNaoConciliados = useCallback(async (transacaoIds) => {
        setIsProcessing(true);
        const { data: lancamentosData, error } = await supabase.from('lancamentos').select('*').eq('conta_id', selectedContaId).eq('conciliado', false);
        if (transacaoIds && transacaoIds.length > 0) {
            const { data: transacoesJaConciliadas } = await supabase.from('lancamentos').select('id_transacao_externa').in('id_transacao_externa', transacaoIds);
            const idsJaConciliados = new Set((transacoesJaConciliadas || []).map(t => t.id_transacao_externa));
            setTransacoesExtrato(prev => prev.map(t => ({...t, conciliado: idsJaConciliados.has(t.id) })));
        }
        if (error) setMessage('Erro ao buscar lançamentos do sistema.');
        else setLancamentosSistema(lancamentosData || []);
        setIsProcessing(false);
    }, [supabase, selectedContaId]);

    const handleConciliar = async () => {
        if (!selectedTransacao || !selectedLancamento) {
            setMessage('Selecione uma transação do extrato e um lançamento do sistema para conciliar.');
            return;
        }
        setIsProcessing(true);
        const { error } = await supabase.from('lancamentos').update({ conciliado: true, id_transacao_externa: selectedTransacao.id }).eq('id', selectedLancamento.id);
        if (error) setMessage(`Erro: ${error.message}`);
        else {
            setMessage('Conciliado com sucesso!');
            setTransacoesExtrato(prev => prev.map(t => t.id === selectedTransacao.id ? { ...t, conciliado: true } : t));
            setLancamentosSistema(prev => prev.filter(l => l.id !== selectedLancamento.id));
            setSelectedTransacao(null);
            setSelectedLancamento(null);
        }
        setIsProcessing(false);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Conciliação Bancária</h2>

            <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">1. Selecione a Conta</label>
                        <select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">-- Escolha uma conta --</option>
                            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">2. Envie o arquivo OFX/OFC</label>
                        <input type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="mt-1 w-full text-sm"/>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row justify-end gap-3 pt-3 border-t">
                    <button onClick={handleImportAsNew} disabled={isProcessing || !file || !selectedContaId} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={isProcessing ? faSpinner : faFileImport} spin={isProcessing} />
                        Importar para o Financeiro
                    </button>
                    <button onClick={handleLoadForConciliation} disabled={isProcessing || !file || !selectedContaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={isProcessing ? faSpinner : faUpload} spin={isProcessing} />
                        Analisar para Conciliação
                    </button>
                </div>
            </div>

            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

            {transacoesExtrato.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                    <div>
                        <h3 className="font-semibold mb-2">Transações do Extrato ({transacoesExtrato.filter(t => !t.conciliado).length})</h3>
                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                            {transacoesExtrato.map(t => (
                                <div key={t.id} onClick={() => !t.conciliado && setSelectedTransacao(t)} className={`p-3 border-b cursor-pointer ${selectedTransacao?.id === t.id ? 'bg-blue-200' : ''} ${t.conciliado ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'hover:bg-blue-50'}`}>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{t.descricao}</span>
                                        <span className={`font-bold ${t.tipo === 'Despesa' ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(t.valor)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">{formatDate(t.data)} {t.conciliado && <span className="font-bold text-green-600">(Já conciliado)</span>}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold mb-2">Lançamentos do Sistema ({lancamentosSistema.length})</h3>
                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                            {lancamentosSistema.map(l => (
                                <div key={l.id} onClick={() => setSelectedLancamento(l)} className={`p-3 border-b cursor-pointer ${selectedLancamento?.id === l.id ? 'bg-green-200' : 'hover:bg-green-50'}`}>
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{l.descricao}</span>
                                        <span className={`font-bold ${l.tipo === 'Despesa' ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(l.valor)}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">{formatDate(l.data_vencimento || l.data_transacao)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {selectedTransacao && selectedLancamento && (
                <div className="text-center p-4 border-t">
                    <button onClick={handleConciliar} disabled={isProcessing} className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-green-700 flex items-center justify-center gap-3 mx-auto">
                        <FontAwesomeIcon icon={faLink} />
                        Confirmar Conciliação
                    </button>
                </div>
            )}
        </div>
    );
}
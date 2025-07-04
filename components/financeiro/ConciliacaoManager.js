"use client";

import { useState, useCallback } from 'react';
import { createClient } from '../../utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faUpload, faLink, faPlus, faTimes, faCheckCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
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

    const handleParseFile = async () => {
        if (!file) {
            setMessage('Por favor, selecione um arquivo OFX ou OFC.');
            return;
        }
        if (!selectedContaId) {
            setMessage('Por favor, selecione a conta bancária correspondente.');
            return;
        }
        setIsProcessing(true);
        setMessage('Lendo arquivo do banco...');

        const tryParse = (fileContent) => {
            try {
                const ofx = new OFX(fileContent);
                const transacoes = ofx.getTransactions().map(t => {
                    // Lógica de data mais robusta
                    const dateStr = t.DTPOSTED.substring(0, 8);
                    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    
                    return {
                        id: t.FITID,
                        data: formattedDate,
                        valor: parseFloat(t.TRNAMT),
                        descricao: t.MEMO,
                        tipo: t.TRNTYPE === 'DEBIT' ? 'Despesa' : 'Receita',
                        conciliado: false,
                    };
                });
                setTransacoesExtrato(transacoes);
                fetchLancamentosNaoConciliados(transacoes.map(t => t.id));
                setMessage(`${transacoes.length} transações encontradas no extrato.`);
                return true; // Sucesso
            } catch (err) {
                console.warn('Falha ao analisar com uma codificação, tentando outra...', err);
                return false; // Falha
            }
        };

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            if (tryParse(content)) {
                setIsProcessing(false);
                return; // Funcionou, estamos prontos.
            }

            // Se a primeira tentativa falhar, tentamos novamente com ISO-8859-1 (Latin-1)
            const readerLatin1 = new FileReader();
            readerLatin1.onload = (e2) => {
                const contentLatin1 = e2.target.result;
                if (tryParse(contentLatin1)) {
                    setIsProcessing(false);
                    return; // Funcionou com a segunda codificação.
                }

                // Se ambos falharem, mostre o erro.
                setMessage('Erro ao ler o arquivo. Verifique se o formato é OFX/OFC válido e se o conteúdo não está corrompido.');
                setIsProcessing(false);
            };
            readerLatin1.readAsText(file, 'ISO-8859-1'); // Lê como Latin-1
        };

        reader.onerror = () => {
            setMessage('Não foi possível ler o arquivo.');
            setIsProcessing(false);
        };

        reader.readAsText(file); // Primeira tentativa com a codificação padrão
    };

    const fetchLancamentosNaoConciliados = useCallback(async (transacaoIds) => {
        setIsProcessing(true);
        const { data: lancamentosData, error } = await supabase
            .from('lancamentos')
            .select('*')
            .eq('conta_id', selectedContaId)
            .eq('conciliado', false);
            
        const { data: transacoesJaConciliadas } = await supabase.from('lancamentos').select('id_transacao_externa').in('id_transacao_externa', transacaoIds);
        const idsJaConciliados = new Set((transacoesJaConciliadas || []).map(t => t.id_transacao_externa));

        setTransacoesExtrato(prev => prev.map(t => ({...t, conciliado: idsJaConciliados.has(t.id) })));

        if (error) {
            setMessage('Erro ao buscar lançamentos do sistema.');
        } else {
            setLancamentosSistema(lancamentosData || []);
        }
        setIsProcessing(false);
    }, [supabase, selectedContaId]);

    const handleConciliar = async () => {
        if (!selectedTransacao || !selectedLancamento) {
            setMessage('Selecione uma transação do extrato e um lançamento do sistema para conciliar.');
            return;
        }
        setIsProcessing(true);
        const { error } = await supabase
            .from('lancamentos')
            .update({ conciliado: true, id_transacao_externa: selectedTransacao.id })
            .eq('id', selectedLancamento.id);

        if (error) {
            setMessage(`Erro: ${error.message}`);
        } else {
            setMessage('Conciliado com sucesso!');
            // Atualiza as listas na tela
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium">1. Selecione a Conta</label>
                        <select value={selectedContaId} onChange={(e) => setSelectedContaId(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                            <option value="">-- Escolha uma conta --</option>
                            {contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium">2. Envie o arquivo OFX/OFC</label>
                        <input type="file" onChange={handleFileChange} accept=".ofx,.ofc" className="mt-1 w-full text-sm"/>
                    </div>
                </div>
                <div className="text-right">
                    <button onClick={handleParseFile} disabled={isProcessing || !file || !selectedContaId} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin className="mr-2"/> : ''}
                        Carregar e Analisar
                    </button>
                </div>
            </div>

            {message && <p className="text-center p-2 bg-blue-50 text-blue-800 rounded-md text-sm">{message}</p>}

            {transacoesExtrato.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                    {/* Coluna do Extrato */}
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
                    {/* Coluna de Lançamentos do Sistema */}
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

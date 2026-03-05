"use client";

import { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faFileInvoice, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { parseOfxContent } from '../../utils/ofxParser';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

export default function OfxUploader({ organizacaoId, contas, onUploadSuccess }) {
    const supabase = createClient();
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', 'pending_account'
    const [queue, setQueue] = useState([]); // Array de arquivos esperando vinculação de conta
    const [selectedPendingContaId, setSelectedPendingContaId] = useState('');
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) await processFiles(files);
    };

    const handleFileInput = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) await processFiles(files);
        // Reset do input target para permitir selecionar os mesmos dnv
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const processFiles = async (filesArray) => {
        setIsProcessing(true);
        const newQueue = [];
        let autoProcessedCount = 0;

        for (const file of filesArray) {
            if (!file.name.toLowerCase().endsWith('.ofx')) {
                toast.error(`Formato inválido: ${file.name}`);
                continue;
            }

            try {
                // ArrayBuffer para o parser detectar o encoding corretamente (Latin1/Win1252/UTF8)
                const buffer = await file.arrayBuffer();
                const result = parseOfxContent(buffer);

                if (!result.sucesso) {
                    toast.error(`Falha no arquivo ${file.name}: ${result.erro}`);
                    continue;
                }

                if (result.transacoes.length === 0) {
                    toast.warning(`Nenhuma transação encontrada em ${file.name}.`);
                    continue;
                }

                const { bankId, acctId } = result.metadados;
                let matchedConta = null;

                if (bankId && acctId) {
                    matchedConta = contas.find(c => c.codigo_banco_ofx === bankId && c.numero_conta_ofx === acctId);
                }

                if (matchedConta) {
                    // Auto-Inject silencioso
                    await injectOfxIntoDatabase(result, matchedConta.id, file, false);
                    autoProcessedCount++;
                } else {
                    // Vai para a fila manual de pareamento
                    newQueue.push({ file, result });
                }

            } catch (error) {
                console.error(error);
                toast.error(`Erro ao processar ${file.name}`);
            }
        }

        setIsProcessing(false);

        if (autoProcessedCount > 0) {
            toast.success(`${autoProcessedCount} arquivo(s) OFX importado(s) com sucesso na sua Conta!`);
            if (onUploadSuccess) onUploadSuccess();
            setUploadStatus('success');
            setTimeout(() => setUploadStatus(null), 3000);
        }

        if (newQueue.length > 0) {
            setQueue(prev => [...prev, ...newQueue]);
            setUploadStatus('pending_account');
        }
    };

    const handleSubmitWithAccount = async (contaId) => {
        if (queue.length === 0) return;
        setIsProcessing(true);

        const currentItem = queue[0];
        try {
            // 1. Atualiza Auto-Pareamento da Conta na DB
            const { bankId, acctId } = currentItem.result.metadados;
            if (bankId && acctId) {
                await supabase.from('contas_financeiras')
                    .update({ codigo_banco_ofx: bankId, numero_conta_ofx: acctId })
                    .eq('id', contaId);
            }

            // 2. Transmitir ao banco
            await injectOfxIntoDatabase(currentItem.result, contaId, currentItem.file, true);

            // Sucesso: tira ele da fila
            const newQueue = queue.slice(1);
            setQueue(newQueue);
            setSelectedPendingContaId('');

            if (newQueue.length === 0) {
                setUploadStatus('success');
                if (onUploadSuccess) onUploadSuccess();
                setTimeout(() => setUploadStatus(null), 3000);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao importar: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const injectOfxIntoDatabase = async (parsedOutput, contaId, originalFile, verbose = true) => {
        const { transacoes } = parsedOutput;
        const dataInicio = new Date(Math.min(...transacoes.map(t => new Date(t.data)))).toISOString().split('T')[0];
        const dataFim = new Date(Math.max(...transacoes.map(t => new Date(t.data)))).toISOString().split('T')[0];

        // 1. Verificar se já existe arquivo com o mesmo nome na conta e deletar (sobrescrever)
        const { error: deleteError } = await supabase
            .from('banco_arquivos_ofx')
            .delete()
            .eq('conta_id', contaId)
            .eq('nome_arquivo', originalFile.name)
            .eq('organizacao_id', organizacaoId);

        if (deleteError) console.warn("Erro ao deletar arquivo OFX anterior:", deleteError);

        // 2. Criar o cabeçalho do Arquivo
        const { data: arquivoHeader, error: arquivoError } = await supabase
            .from('banco_arquivos_ofx')
            .insert({
                organizacao_id: organizacaoId,
                conta_id: contaId,
                nome_arquivo: originalFile.name,
                periodo_inicio: dataInicio,
                periodo_fim: dataFim,
                status: 'Processado'
            })
            .select('*')
            .single();

        if (arquivoError) throw arquivoError;

        // 3. Criar massivamente as Transações (Staging)
        const payloadTransacoes = transacoes.map(t => ({
            fitid: t.fitid,
            arquivo_id: arquivoHeader.id,
            organizacao_id: organizacaoId,
            conta_id: contaId,
            data_transacao: t.data,
            valor: t.valor,
            tipo: t.tipo,
            descricao_banco: t.descricao,
            memo_banco: t.tipo_ofx
        }));

        const { error: insertError } = await supabase
            .from('banco_transacoes_ofx')
            .upsert(payloadTransacoes, { onConflict: 'fitid' });

        if (insertError) throw insertError;

        if (verbose) {
            toast.success(`${originalFile.name} importado na Conta Selecionada!`);
        }
    };

    // UI Renders
    if (uploadStatus === 'pending_account' && queue.length > 0) {
        const currentItem = queue[0];
        const hasMore = queue.length > 1;

        return (
            <div className="w-full flex justify-end">
                {/* Modal Overlay */}
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                        {hasMore && (
                            <div className="mb-4 flex items-center justify-between text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                <span>Processamento em Fila</span>
                                <span>Faltam: {queue.length} arquivo(s)</span>
                            </div>
                        )}
                        <div className="text-center mb-6">
                            <FontAwesomeIcon icon={faFileInvoice} size="3x" className="text-indigo-500 mb-3" />
                            <h3 className="text-xl font-bold text-gray-800">Nova Conta Bancária</h3>
                            <p className="text-sm font-semibold mt-1 text-gray-600 truncate bg-gray-50 py-1 px-3 rounded inline-block" title={currentItem.file.name}>
                                {currentItem.file.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-3">
                                Lidos <strong>{currentItem.result.total_lido} transações</strong>, mas não conhecemos essa conta (Banco: <strong>{currentItem.result.metadados.bankId || 'X'}</strong> / Conta: <strong>{currentItem.result.metadados.acctId || 'X'}</strong>).
                            </p>
                            <p className="text-sm font-semibold text-gray-700 mt-4 bg-indigo-50 py-2 rounded-lg border border-indigo-100">
                                A qual conta do Studio 57 este extrato pertence?
                            </p>
                        </div>

                        <div className="space-y-4">
                            <select
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 font-medium"
                                value={selectedPendingContaId}
                                onChange={(e) => setSelectedPendingContaId(e.target.value)}
                            >
                                <option value="">Selecione a conta de destino...</option>
                                {contas.map(conta => (
                                    <option key={conta.id} value={conta.id}>{conta.nome}</option>
                                ))}
                            </select>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setUploadStatus(null); setQueue([]); setSelectedPendingContaId(''); }}
                                    disabled={isProcessing}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors border border-gray-200 hover:border-gray-300"
                                >
                                    Cancelar {hasMore ? 'Fila Inteira' : ''}
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedPendingContaId) {
                                            toast.warning("Selecione uma conta primeiro.");
                                            return;
                                        }
                                        handleSubmitWithAccount(selectedPendingContaId);
                                    }}
                                    disabled={isProcessing || !selectedPendingContaId}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex justify-center items-center gap-2"
                                >
                                    {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : (hasMore ? 'Vincular e Proximo' : 'Vincular e Fechar')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (uploadStatus === 'success') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center shadow-sm">
                <FontAwesomeIcon icon={faCheckCircle} size="3x" className="text-green-500 mb-4" />
                <h3 className="text-lg font-bold text-green-800">Espelho Bancário Atualizado!</h3>
                <p className="text-sm text-green-600 mt-1">O arquivo OFX foi amalgamado na sua conta com sucesso.</p>
            </div>
        );
    }

    return (
        <div className="w-full flex justify-end">
            <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                accept=".ofx"
                onChange={handleFileInput}
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm
                    ${isProcessing
                        ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-indigo-300 hover:text-indigo-600'}
                `}
                title="Importar Arquivo OFX do Banco"
            >
                {isProcessing ? (
                    <>
                        <FontAwesomeIcon icon={faSpinner} spin className="text-indigo-500" />
                        Processando OFX...
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon={faCloudUploadAlt} className="text-indigo-500" />
                        Importar OFX
                    </>
                )}
            </button>
        </div>
    );
}

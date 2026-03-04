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
    const [parsedData, setParsedData] = useState(null);
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

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const handleFileInput = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const processFile = async (file) => {
        if (!file.name.toLowerCase().endsWith('.ofx')) {
            toast.error("Formato inválido. Por favor envie um arquivo .ofx");
            return;
        }

        setIsProcessing(true);
        setUploadStatus(null);

        try {
            // Lê como ArrayBuffer para que o parser detecte o encoding (ISO-8859-1, Windows-1252, UTF-8)
            const buffer = await file.arrayBuffer();
            const result = parseOfxContent(buffer);

            if (!result.sucesso) {
                throw new Error(result.erro || "Falha ao ler os dados do OFX");
            }

            if (result.transacoes.length === 0) {
                toast.warning("O arquivo OFX foi lido, mas não encontrei transações dentro dele.");
                setIsProcessing(false);
                return;
            }

            // Descobrindo a conta (Auto-Pareamento)
            const { bankId, acctId } = result.metadados;
            let matchedConta = null;

            if (bankId && acctId) {
                matchedConta = contas.find(c => c.codigo_banco_ofx === bankId && c.numero_conta_ofx === acctId);
            }

            setParsedData({
                file: file,
                data: result,
                matchedConta: matchedConta,
                requiresAccountAssignment: !matchedConta
            });

            if (!matchedConta) {
                // Modo pendente: precisa perguntar a qual conta pertence
                setUploadStatus('pending_account');
            } else {
                // Conheço a conta, dispara direto pro banco
                await injectOfxIntoDatabase(result, matchedConta.id, file);
            }

        } catch (error) {
            console.error(error);
            setUploadStatus('error');
            toast.error(error.message);
        } finally {
            if (uploadStatus !== 'pending_account') setIsProcessing(false);
        }
    };

    const handleSubmitWithAccount = async (contaId) => {
        setIsProcessing(true);
        try {
            // 1. Atualizar a conta com o banco para no futuro não perguntar mais
            const { bankId, acctId } = parsedData.data.metadados;
            if (bankId && acctId) {
                await supabase.from('contas_financeiras')
                    .update({ codigo_banco_ofx: bankId, numero_conta_ofx: acctId })
                    .eq('id', contaId);
            }

            // 2. Transmitir ao banco
            await injectOfxIntoDatabase(parsedData.data, contaId, parsedData.file);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao importar: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const injectOfxIntoDatabase = async (parsedOutput, contaId, originalFile) => {
        const { transacoes, metadados } = parsedOutput;
        const dataInicio = new Date(Math.min(...transacoes.map(t => new Date(t.data)))).toISOString().split('T')[0];
        const dataFim = new Date(Math.max(...transacoes.map(t => new Date(t.data)))).toISOString().split('T')[0];

        // 1. Criar o cabeçalho do Arquivo
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

        // 2. Criar massivamente as Transações (Staging)
        // Precisamos tratar o FITID duplicado via Upsert ou ignorando erro de On Conflict
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
            .upsert(payloadTransacoes, { onConflict: 'fitid', ignoreDuplicates: true });

        if (insertError) throw insertError;

        setUploadStatus('success');
        toast.success(`Ofx importado! ${payloadTransacoes.length} transações salvas na Área de Preparação.`);
        if (onUploadSuccess) onUploadSuccess();

        // Reset 
        setTimeout(() => {
            setUploadStatus(null);
            setParsedData(null);
        }, 4000);
    };

    // UI Renders
    if (uploadStatus === 'pending_account') {
        return (
            <div className="w-full flex justify-end">
                {/* Modal Overlay */}
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
                        <div className="text-center mb-6">
                            <FontAwesomeIcon icon={faFileInvoice} size="3x" className="text-indigo-500 mb-3" />
                            <h3 className="text-xl font-bold text-gray-800">Nova Conta Bancária</h3>
                            <p className="text-sm text-gray-500 mt-2">
                                Foram lidos <strong>{parsedData?.data?.total_lido} lançamentos</strong> no OFX, mas ainda não conhecemos esta conta bancária (Banco: <strong>{parsedData?.data?.metadados?.bankId || 'X'}</strong> / Conta: <strong>{parsedData?.data?.metadados?.acctId || 'X'}</strong>).
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
                                    onClick={() => { setUploadStatus(null); setParsedData(null); setSelectedPendingContaId(''); }}
                                    disabled={isProcessing}
                                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors border border-gray-200 hover:border-gray-300"
                                >
                                    Cancelar
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
                                    {isProcessing ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Vincular e Importar'}
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

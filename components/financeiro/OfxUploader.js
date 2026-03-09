"use client";

import { useState, useRef, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faSpinner, faCheckCircle, faFileInvoice, faTimesCircle, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import UppyFileImporter from '@/components/ui/UppyFileImporter';
import { parseOfxContent } from '../../utils/ofxParser';

export default function OfxUploader({ organizacaoId, contas, onUploadSuccess }) {
    const supabase = createClient();
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', 'pending_account'
    const [queue, setQueue] = useState([]); // Array de arquivos esperando vinculação de conta
    const [selectedPendingContaId, setSelectedPendingContaId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const selectedConta = useMemo(() => contas?.find(c => c.id == selectedPendingContaId), [contas, selectedPendingContaId]);

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

    const handleFileInput = async (files) => {
        setIsModalOpen(false); // Fecha o modal após selecionar
        if (Array.isArray(files) && files.length > 0) {
            await processFiles(files);
        } else if (files) {
            await processFiles([files]);
        }
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
                    matchedConta = contas.find(c => {
                        // Limpa zeros à esquerda e espaços
                        const dbBank = c.codigo_banco_ofx ? String(c.codigo_banco_ofx).replace(/^0+/, '').trim() : '';
                        const ofxBank = String(bankId).replace(/^0+/, '').trim();

                        // Limpa qualquer pontuação ou espaço (ex: "105.706-5" vira "1057065")
                        const dbAcctOfx = c.numero_conta_ofx ? String(c.numero_conta_ofx).replace(/[^0-9a-zA-Z]/g, '') : '';
                        const dbAcctOficial = c.numero_conta ? String(c.numero_conta).replace(/[^0-9a-zA-Z]/g, '') : '';
                        const ofxAcct = String(acctId).replace(/[^0-9a-zA-Z]/g, '');

                        // Um banco precisa bater (ignorando zeros). A conta pode bater na coluna de OFX ou na Oficial!
                        return dbBank === ofxBank && (dbAcctOfx === ofxAcct || dbAcctOficial === ofxAcct);
                    });
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
                            <div className="relative w-full" ref={dropdownContaRef}>
                                <button
                                    onClick={() => setIsDropdownContaOpen(!isDropdownContaOpen)}
                                    className="w-full text-left bg-white border border-gray-300 hover:border-indigo-400 rounded-lg p-3 flex items-center justify-between transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {selectedConta ? (
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-gray-800">{selectedConta.nome}</span>
                                            <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
                                                {selectedConta.empresa?.nome_fantasia || selectedConta.empresa?.razao_social || 'Contas Base (Sem Empresa Vínculada)'} • {selectedConta.tipo || 'Outros'}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 text-sm font-semibold">Selecione a conta de destino...</span>
                                    )}
                                    <FontAwesomeIcon icon={faChevronDown} className={`text-gray-400 text-sm transition-transform duration-200 ${isDropdownContaOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDropdownContaOpen && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[300px] overflow-y-auto custom-scrollbar p-1 origin-top animate-fadeIn">
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
                                                                    const isSelected = selectedPendingContaId === c.id;
                                                                    return (
                                                                        <button
                                                                            key={c.id}
                                                                            onClick={() => { setSelectedPendingContaId(c.id); setIsDropdownContaOpen(false); }}
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
            <UppyFileImporter
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onFileSelected={handleFileInput}
                title="Importar Arquivo OFX"
                allowedFileTypes={['.ofx']}
                note="Selecione ou arraste os arquivos .ofx exportados do seu banco"
                multiple={true}
            />

            <button
                onClick={() => setIsModalOpen(true)}
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

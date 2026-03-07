'use client';

import React, { useState, useRef, useEffect } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import GoldenRetriever from '@uppy/golden-retriever';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUpload,
    faTrash,
    faSpinner,
    faCheckCircle,
    faFileAlt,
    faExclamationCircle,
    faPlus,
    faPaperPlane
} from '@fortawesome/free-solid-svg-icons';

export default function UppyListUploader({
    bucketName,
    folderPath = '',
    maxNumberOfFiles = null,
    onUploadSuccess = () => { },
    onUploadComplete = () => { },
    tiposDocumento = [],
    hideClassificacao = false,
}) {
    const supabase = createClient();
    const [fileList, setFileList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const uppyRef = useRef(null);
    const fileInputRef = useRef(null);

    const sanitizedPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;

    useEffect(() => {
        // Cleanup uppy na desmontagem
        return () => {
            if (uppyRef.current) {
                if (uppyRef.current.destroy) uppyRef.current.destroy();
                else if (uppyRef.current.close) uppyRef.current.close();
            }
        }
    }, []);

    const handleFilesAdded = (e) => {
        const selectedFiles = Array.from(e.target.files);

        if (maxNumberOfFiles && fileList.length + selectedFiles.length > maxNumberOfFiles) {
            toast.warning(`Você pode enviar no máximo ${maxNumberOfFiles} arquivos.`);
            return;
        }

        const newFiles = selectedFiles.map(file => ({
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            originalFile: file,
            name: file.name,
            size: file.size,
            tipoDocumento: '', // O usuário deve preencher
            descricao: '',     // Opicional
            status: 'idle',    // idle | uploading | success | error
            progress: 0,
            supabasePath: null
        }));

        setFileList(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveFile = (id) => {
        if (isUploading) return;
        setFileList(prev => prev.filter(f => f.id !== id));
        // Se já estivesse no uppy, também remover
        if (uppyRef.current) {
            const uppyFile = uppyRef.current.getFiles().find(f => f.meta.customId === id);
            if (uppyFile) uppyRef.current.removeFile(uppyFile.id);
        }
    };

    const updateFileMeta = (id, field, value) => {
        setFileList(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleStartUpload = async () => {
        const pendingFiles = fileList.filter(f => f.status === 'idle' || f.status === 'error');
        if (pendingFiles.length === 0) return;

        // Validar classificações se não estiverem ocultas
        if (!hideClassificacao) {
            const missingTypes = pendingFiles.some(f => !f.tipoDocumento);
            if (missingTypes) {
                toast.warning("Por favor, preencha a 'Classificação' para todos os arquivos antes de enviar.");
                return;
            }
        }

        setIsUploading(true);

        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            toast.error("Erro de autorização. Faça login novamente.");
            setIsUploading(false);
            return;
        }

        // Inicializar Uppy core se necessário
        if (!uppyRef.current) {
            uppyRef.current = new Uppy({
                id: `uppy-list-${bucketName}`,
                autoProceed: false,
            });

            uppyRef.current.use(GoldenRetriever, { serviceWorker: false });

            uppyRef.current.use(XHRUpload, {
                endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucketName}`,
                method: 'POST',
                formData: false,
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                }
            });

            // Endpoint override
            uppyRef.current.on('file-added', (file) => {
                const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const finalName = `${Date.now()}_${cleanName}`;
                const fullPath = sanitizedPath ? `${sanitizedPath}/${finalName}` : finalName;

                uppyRef.current.setFileMeta(file.id, { supabasePath: fullPath });
                uppyRef.current.setFileState(file.id, {
                    xhrUpload: {
                        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucketName}/${fullPath}`,
                    }
                });
            });

            uppyRef.current.on('upload-progress', (file, progress) => {
                setFileList(prev => prev.map(f =>
                    f.id === file.meta.customId
                        ? { ...f, progress: (progress.bytesUploaded / progress.bytesTotal) * 100, status: 'uploading' }
                        : f
                ));
            });

            uppyRef.current.on('upload-success', (file, response) => {
                const uploadedPath = file.meta.supabasePath;

                // Marca sucesso visual
                setFileList(prev => prev.map(f =>
                    f.id === file.meta.customId
                        ? { ...f, status: 'success', progress: 100, supabasePath: uploadedPath }
                        : f
                ));

                // Callback um a um
                onUploadSuccess({
                    fileId: file.id,
                    customId: file.meta.customId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    path: uploadedPath,
                    bucket: bucketName,
                    tipoDocumento: file.meta.tipoDocumento,
                    descricao: file.meta.descricao
                });
            });

            uppyRef.current.on('upload-error', (file, uploadError) => {
                setFileList(prev => prev.map(f =>
                    f.id === file.meta.customId
                        ? { ...f, status: 'error' }
                        : f
                ));
                toast.error(`Falha no envio de ${file.name}`);
            });

            uppyRef.current.on('complete', (result) => {
                setIsUploading(false);
                if (result.successful.length > 0) {
                    onUploadComplete(result);
                }
            });
        }

        // Adicionar arquivos ao core do Uppy
        pendingFiles.forEach(f => {
            try {
                uppyRef.current.addFile({
                    name: f.name,
                    type: f.originalFile.type,
                    data: f.originalFile,
                    meta: {
                        customId: f.id,
                        tipoDocumento: f.tipoDocumento,
                        descricao: f.descricao
                    }
                });
            } catch (err) {
                // Já existe
            }
        });

        // Trigger upload
        uppyRef.current.upload();
    };

    const pendingCount = fileList.filter(f => f.status === 'idle' || f.status === 'error').length;
    const progressCount = fileList.filter(f => f.status === 'success').length;

    return (
        <div className="flex flex-col h-full bg-white rounded-lg">

            {/* Header / Botão de Adicionar */}
            <div className="shrink-0 mb-4 flex justify-between items-center bg-gray-50 border border-gray-200 border-dashed rounded-lg p-4">
                <div className="flex items-center gap-3 text-gray-600">
                    <FontAwesomeIcon icon={faUpload} className="text-xl text-blue-500" />
                    <div>
                        <p className="font-semibold">Buscador de Arquivos</p>
                        <p className="text-xs text-gray-500">Adicione os PDFs ou Imagens para enviar.</p>
                    </div>
                </div>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        onChange={handleFilesAdded}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="bg-white border shadow-sm border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        Procurar Arquivos
                    </button>
                </div>
            </div>

            {/* Lista Scrollável */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg min-h-[300px]">
                {fileList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <FontAwesomeIcon icon={faFileAlt} className="w-12 h-12 mb-3 text-gray-200" />
                        <p className="font-medium text-gray-500">Nenhum arquivo selecionado.</p>
                        <p className="text-sm">Clique em Procurar Arquivos acima para listar documentos aqui.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-semibold w-1/3">Arquivo</th>
                                {!hideClassificacao && <th className="px-4 py-3 font-semibold">Classificação <span className="text-red-500">*</span></th>}
                                <th className="px-4 py-3 font-semibold">Descrição Rápida</th>
                                <th className="px-4 py-3 font-semibold text-center w-16">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {fileList.map((file) => (
                                <tr key={file.id} className="bg-white hover:bg-slate-50 relative">
                                    {/* Linha de progresso no fundo */}
                                    {file.status === 'uploading' && (
                                        <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300" style={{ width: `${file.progress}%` }}></div>
                                    )}
                                    {file.status === 'success' && (
                                        <div className="absolute inset-0 bg-green-50 z-0 pointer-events-none opacity-50"></div>
                                    )}

                                    {/* Células Overtop */}
                                    <td className="px-4 py-3 relative z-10">
                                        <div className="flex flex-col truncate max-w-[200px]" title={file.name}>
                                            <span className="font-medium text-gray-800 truncate">{file.name}</span>
                                            <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
                                        </div>
                                    </td>

                                    {!hideClassificacao && (
                                        <td className="px-4 py-3 relative z-10">
                                            <select
                                                value={file.tipoDocumento}
                                                onChange={(e) => updateFileMeta(file.id, 'tipoDocumento', e.target.value)}
                                                disabled={file.status === 'success' || file.status === 'uploading'}
                                                className={`w-full p-2 border rounded text-xs ${!file.tipoDocumento && file.status !== 'success' ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-blue-500'}`}
                                            >
                                                <option value="">Selecione...</option>
                                                {tiposDocumento.map(t => (
                                                    <option key={t.id} value={t.id}>{t.sigla} - {t.descricao}</option>
                                                ))}
                                            </select>
                                        </td>
                                    )}

                                    <td className="px-4 py-3 relative z-10">
                                        <input
                                            type="text"
                                            placeholder="Ex: Ref. Abril 2026"
                                            value={file.descricao}
                                            onChange={(e) => updateFileMeta(file.id, 'descricao', e.target.value)}
                                            disabled={file.status === 'success' || file.status === 'uploading'}
                                            className="w-full p-2 border border-gray-300 rounded text-xs focus:border-blue-500"
                                        />
                                    </td>

                                    <td className="px-4 py-3 relative z-10 text-center">
                                        {file.status === 'idle' && (
                                            <button
                                                onClick={() => handleRemoveFile(file.id)}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-2"
                                                title="Remover"
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        )}
                                        {file.status === 'uploading' && (
                                            <FontAwesomeIcon icon={faSpinner} spin className="text-blue-500 text-lg" />
                                        )}
                                        {file.status === 'success' && (
                                            <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-lg" />
                                        )}
                                        {file.status === 'error' && (
                                            <FontAwesomeIcon icon={faExclamationCircle} className="text-red-500 text-lg" title="Erro no envio" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer / Botão de Envio Fora da Rolagem */}
            <div className="shrink-0 mt-4 pt-4 border-t border-gray-200 flex justify-between items-center bg-white">
                <div className="text-sm font-medium text-gray-500">
                    {fileList.length > 0 ? (
                        <span>{progressCount} de {fileList.length} concluídos</span>
                    ) : (
                        <span>Pronto para listagem</span>
                    )}
                </div>

                <button
                    onClick={handleStartUpload}
                    disabled={isUploading || pendingCount === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[200px]"
                >
                    {isUploading ? (
                        <><FontAwesomeIcon icon={faSpinner} spin /> Processando...</>
                    ) : (
                        <><FontAwesomeIcon icon={faPaperPlane} /> Enviar {pendingCount > 0 ? pendingCount : ''} Arquivo(s)</>
                    )}
                </button>
            </div>

        </div>
    );
}

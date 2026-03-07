'use client';

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf, faFileImage, faFileExcel, faFileWord, faFileAlt, faDownload, faTrash, faEye } from '@fortawesome/free-solid-svg-icons';
import { createClient } from '@/utils/supabase/client';

export default function FileListView({
    files, // Array of file objects from DB, expected to have { id, nome_arquivo, caminho_arquivo, public_url, ... }
    onDelete, // Function(file) to handle deletion
    onView, // Function(file) dynamic view
    onDownload, // Function(file) dynamic download
    emptyMessage = "Nenhum documento encontrado."
}) {
    // Retorna o ícone correto baseado na extensão
    const getFileIcon = (fileName) => {
        if (!fileName) return faFileAlt;
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.pdf')) return faFilePdf;
        if (lowerName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return faFileImage;
        if (lowerName.match(/\.(xls|xlsx|csv)$/)) return faFileExcel;
        if (lowerName.match(/\.(doc|docx)$/)) return faFileWord;
        return faFileAlt;
    };

    // Retorna a cor do ícone baseado na extensão
    const getIconColor = (fileName) => {
        if (!fileName) return "text-gray-400";
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.pdf')) return "text-red-500";
        if (lowerName.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) return "text-blue-500";
        if (lowerName.match(/\.(xls|xlsx|csv)$/)) return "text-green-600";
        if (lowerName.match(/\.(doc|docx)$/)) return "text-blue-600";
        return "text-gray-500";
    };

    // Formata bytes para KB/MB
    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    if (!files || files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                <FontAwesomeIcon icon={faFileAlt} className="text-3xl mb-2 opacity-50" />
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <ul className="divide-y divide-gray-100">
                {files.map((file, index) => {
                    const icon = getFileIcon(file.nome_arquivo || file.name);
                    const iconColor = getIconColor(file.nome_arquivo || file.name);

                    return (
                        <li key={file.id || index} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-50 border border-gray-100 ${iconColor}`}>
                                    <FontAwesomeIcon icon={icon} className="text-lg" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-900 truncate pr-4" title={file.nome_arquivo || file.name}>
                                        {file.nome_arquivo || file.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                        {file.tamanho_bytes && <span>{formatBytes(file.tamanho_bytes)}</span>}
                                        {file.tipo?.descricao && (
                                            <>
                                                <span>•</span>
                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">{file.tipo.descricao}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {file.public_url && !onView && !onDownload && (
                                    <>
                                        <a
                                            href={file.public_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                            title="Visualizar Documento"
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </a>
                                        <a
                                            href={file.public_url}
                                            download={file.nome_arquivo || 'documento'}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                            title="Baixar Documento"
                                        >
                                            <FontAwesomeIcon icon={faDownload} />
                                        </a>
                                    </>
                                )}

                                {onView && (
                                    <button
                                        onClick={() => onView(file)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        title="Visualizar Documento"
                                    >
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                )}

                                {onDownload && (
                                    <button
                                        onClick={() => onDownload(file)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                                        title="Baixar Documento"
                                    >
                                        <FontAwesomeIcon icon={faDownload} />
                                    </button>
                                )}

                                {onDelete && (
                                    <button
                                        onClick={() => onDelete(file)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Excluir Arquivo"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

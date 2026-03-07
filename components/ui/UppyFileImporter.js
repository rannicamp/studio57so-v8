// components/ui/UppyFileImporter.js
"use client";

import React, { useState, useEffect } from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/react/dashboard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

export default function UppyFileImporter({
    isOpen,
    onClose,
    onFileSelected,
    title = "Importar Arquivo",
    allowedFileTypes = ['.csv'],
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    note = "Selecione ou arraste o arquivo aqui",
    children // For extra UI inside the modal (like column mapping)
}) {
    const [uppy] = useState(() => new Uppy({
        id: 'file-importer',
        allowMultipleUploadBatches: false,
        restrictions: {
            maxNumberOfFiles: 1,
            allowedFileTypes: allowedFileTypes,
            maxFileSize: maxFileSize,
        },
        locale: {
            strings: {
                dropHereOr: 'Arraste o arquivo aqui ou %{browse}',
                browse: 'busque no dispositivo',
                xFilesSelected: {
                    0: '%{smart_count} arquivo selecionado',
                    1: '%{smart_count} arquivos selecionados'
                },
                uploading: 'Enviando',
                complete: 'Completo',
                uploadFailed: 'Falha no envio',
                pleasePressRetry: 'Por favor, tente novamente.',
                cancel: 'Cancelar',
                cancelUpload: 'Cancelar envio',
                removeFile: 'Remover arquivo',
                editFile: 'Editar arquivo',
                editing: 'Editando %{file}',
                saveChanges: 'Salvar alterações',
                myDevice: 'Meu Dispositivo',
                dropPasteFiles: 'Solte o arquivo aqui ou %{browse}',
                dropPaste: 'Solte o arquivo aqui ou %{browse}',
                addMore: 'Adicionar mais',
                uploadComplete: 'Envio concluído',
                resumeUpload: 'Pausado',
                pauseUpload: 'Pausar',
                retryUpload: 'Tentar novamente',
                cancelUpload: 'Cancelar',
                xMoreFilesAdded: {
                    0: '%{smart_count} arquivo adicionado',
                    1: '%{smart_count} arquivos adicionados'
                },
                exceedsSize: 'Este arquivo excede o limite máximo permitido de %{size}',
                youCanOnlyUploadX: {
                    0: 'Você só pode enviar %{smart_count} arquivo por vez',
                    1: 'Você só pode enviar %{smart_count} arquivos por vez'
                },
                youHaveToAtLeastSelectX: {
                    0: 'Você precisa selecionar pelo menos %{smart_count} arquivo',
                    1: 'Você precisa selecionar pelo menos %{smart_count} arquivos'
                },
                selectFileNamed: 'Selecione o arquivo %{name}',
                unselectFileNamed: 'Remover o arquivo %{name}',
                openFolderNamed: 'Abrir a pasta %{name}'
            }
        },
    }));

    useEffect(() => {
        const handleFileAdded = (file) => {
            if (onFileSelected) {
                // We pass the actual JS File object
                onFileSelected(file.data);
            }
        };

        const handleRestrictionFailed = (file, error) => {
            toast.error(error.message);
        };

        uppy.on('file-added', handleFileAdded);
        uppy.on('restriction-failed', handleRestrictionFailed);

        return () => {
            uppy.off('file-added', handleFileAdded);
            uppy.off('restriction-failed', handleRestrictionFailed);
        };
    }, [uppy, onFileSelected]);

    // Cleanup when modal closes
    useEffect(() => {
        if (!isOpen) {
            uppy.cancelAll();
        }
    }, [isOpen, uppy]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* INJEÇÃO DO CSS VIA CDN */}
            <link href="https://releases.transloadit.com/uppy/v3.23.0/uppy.min.css" rel="stylesheet" />

            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white rounded-t-xl z-20">
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-red-500 hover:bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                        title="Fechar"
                    >
                        <FontAwesomeIcon icon={faXmark} size="lg" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-grow overflow-y-auto custom-scrollbar flex flex-col gap-6">
                    {/* Uppy Dashboard (Selection Mode) */}
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">1. {note}</p>
                        <Dashboard
                            uppy={uppy}
                            width="100%"
                            height={250}
                            hideUploadButton={true} // We don't upload directly, we pass the file to the parent
                            showRemoveButtonAfterComplete={true}
                            showProgressDetails={false}
                            theme="light"
                            note={`Apenas arquivos ${allowedFileTypes.join(', ')} até ${Math.round(maxFileSize / 1024 / 1024)}MB`}
                            proudlyDisplayPoweredByUppy={false}
                        />
                    </div>

                    {/* Slot for parent to render mapping UI, processing buttons, etc */}
                    {children}
                </div>
            </div>
        </div>
    );
}

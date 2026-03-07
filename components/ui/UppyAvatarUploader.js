"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faTrash, faSpinner, faImage, faPen, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'sonner';

// Uppy core and plugins (NPM imports)
import Uppy from '@uppy/core';
import Dashboard from '@uppy/react/dashboard';
import XHRUpload from '@uppy/xhr-upload';
import GoldenRetriever from '@uppy/golden-retriever';

export default function UppyAvatarUploader({
    url,
    onUpload,
    bucketName = 'empreendimentos',
    folderPath = 'capas',
    label = "Imagem de Capa (Thumbnail)",
    aspectRatio = "aspect-video", // 'aspect-video' (retangular) ou 'aspect-square' (quadrado/logo)
    objectFit = "object-cover",    // 'object-cover' (preenche) ou 'object-contain' (ajusta sem cortar)
    className = ""
}) {
    const supabase = createClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uppy, setUppy] = useState(null);

    // Initialize Uppy instance
    useEffect(() => {
        if (!isModalOpen) {
            if (uppy) {
                uppy.close();
                setUppy(null);
            }
            return;
        }

        const getSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                toast.error('Erro de autenticação ao inicializar o Uploader.');
                setIsModalOpen(false);
                return;
            }

            const uppyInstance = new Uppy({
                id: `uppy-avatar-${Math.random().toString(36).substring(7)}`,
                autoProceed: true, // Upload auto starts when file is selected
                restrictions: {
                    maxNumberOfFiles: 1,
                    allowedFileTypes: ['image/*'],
                    maxFileSize: 5 * 1024 * 1024, // 5MB
                },
                locale: {
                    strings: {
                        dropHereOr: 'Arraste a imagem aqui ou %{browse}',
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
                        dropPasteFiles: 'Solte a imagem aqui ou %{browse}',
                        dropPaste: 'Solte a imagem aqui ou %{browse}',
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
                }
            })
                .use(GoldenRetriever, { serviceWorker: false })
                .use(XHRUpload, {
                    endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucketName}/${folderPath}`,
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                    },
                    limit: 1, // Only 1 concurrent upload
                });

            // Adiciona listener para processar antes do upload (renomear, etc)
            uppyInstance.on('file-added', (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(7)}_${Date.now()}.${fileExt}`;

                uppyInstance.setFileMeta(file.id, {
                    name: fileName
                });
            });


            uppyInstance.on('upload-success', async (file, response) => {
                const filePath = `${folderPath}/${file.meta.name}`;

                // Get public URL
                const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

                if (onUpload) {
                    onUpload(data.publicUrl);
                }

                toast.success('Imagem alterada com sucesso!');
                setIsModalOpen(false); // Close modal on success
            });

            uppyInstance.on('upload-error', (file, error, response) => {
                console.error('Erro no upload via Uppy:', error);
                toast.error(`A imagem ${file.name} não pôde ser enviada. Tente novamente.`);
            });

            setUppy(uppyInstance);
        };

        getSession();

        return () => {
            if (uppy) {
                uppy.close();
            }
        };
        // Omit uppy from dependencies to prevent infinite loops
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen, bucketName, folderPath]);


    const removeImage = () => {
        if (onUpload) {
            onUpload(null);
        }
        toast.info('Imagem removida.');
    };

    const hasWidthClass = className && /\bw-(?:full|screen|px|\d+|auto|min|max|fit)\b/.test(className);
    const rootClasses = hasWidthClass ? className : `w-full ${className}`.trim();

    return (
        <div className={rootClasses}>
            {/* INJEÇÃO DO CSS VIA CDN */}
            <link href="https://releases.transloadit.com/uppy/v3.23.0/uppy.min.css" rel="stylesheet" />

            {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}

            {/* PREVIEW CONTAINER (Always visible, initiates modal) */}
            <div className="relative group cursor-pointer" onClick={() => !url && setIsModalOpen(true)}>
                <div className={`relative w-full ${aspectRatio} bg-gray-50 rounded-lg overflow-hidden border-2 flex items-center justify-center transition-all ${url ? 'border-gray-200 hover:border-blue-400' : 'border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50'}`}>
                    {url ? (
                        <>
                            <img
                                src={url}
                                alt={label}
                                className={`w-full h-full ${objectFit}`}
                            />
                            {/* Overlay Edit Icon (Hover) */}
                            <div
                                className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsModalOpen(true);
                                }}
                            >
                                <div className="bg-white text-blue-600 px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2 shadow-sm">
                                    <FontAwesomeIcon icon={faPen} /> Alterar
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-2">
                            <FontAwesomeIcon icon={faImage} className="mx-auto h-6 w-6 text-gray-400 mb-1 group-hover:text-blue-500 transition-colors" />
                            <p className="text-xs font-medium text-gray-600 group-hover:text-blue-600 transition-colors leading-tight">Add. Imagem</p>
                        </div>
                    )}
                </div>

                {/* Remove Button (Only if there is a URL) */}
                {url && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeImage();
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors z-10 w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100"
                        title="Remover imagem"
                    >
                        <FontAwesomeIcon icon={faTrash} className="text-sm" />
                    </button>
                )}
            </div>


            {/* MODAL DE UPLOAD (UPPY DASHBOARD) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative">
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-md font-bold text-gray-800 flex items-center gap-2">
                                <FontAwesomeIcon icon={faCloudUploadAlt} className="text-blue-600" />
                                {url ? 'Alterar' : 'Enviar'} {label}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimesCircle} className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Uppy Dashboard Body */}
                        <div className="p-0 bg-gray-50 flex justify-center w-full uppy-avatar-container">
                            {uppy ? (
                                <Dashboard
                                    uppy={uppy}
                                    proudlyDisplayPoweredByUppy={false}
                                    width="100%"
                                    height={350}
                                    showProgressDetails={true}
                                    hideUploadButton={true} // Auto proceed replaces this
                                    locale={{
                                        strings: {
                                            dropPasteFiles: 'Arraste a nova imagem aqui ou %{browse}',
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[350px] w-full text-gray-500">
                                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-3 text-blue-500" />
                                    <p>Inicializando uploader...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Scoped CSS overrides to make Uppy fit nicely */}
            <style jsx global>{`
                .uppy-avatar-container .uppy-Dashboard-inner {
                    border: none !important;
                    background-color: transparent !important;
                }
                .uppy-avatar-container .uppy-Dashboard-AddFiles {
                    border: none !important;
                }
            `}</style>
        </div>
    );
}

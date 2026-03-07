'use client';

import React, { useState, useEffect, useRef } from 'react';
import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import XHRUpload from '@uppy/xhr-upload';
import GoldenRetriever from '@uppy/golden-retriever';
import pt_BR from '@uppy/locales/lib/pt_BR';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function UppyGlobalUploader({
    bucketName,
    folderPath = '', // folder/path without trailing slash
    allowedFileTypes = null, // ex: ['.jpg', '.pdf', 'image/*']
    maxNumberOfFiles = null,
    onUploadSuccess = () => { },
    onUploadComplete = () => { },
    height = 400,
    note = "Arraste os arquivos ou clique para selecionar",
    metaFields = [] // Array of fields to capture in Dashboard (ex: [{ id: 'name', name: 'Nome', placeholder: 'Nome do arquivo' }])
}) {
    const dashboardContainerRef = useRef(null);
    const [uppy, setUppy] = useState(null);
    const supabaseRef = useRef(createClient());

    const onUploadSuccessRef = useRef(onUploadSuccess);
    const onUploadCompleteRef = useRef(onUploadComplete);

    useEffect(() => {
        onUploadSuccessRef.current = onUploadSuccess;
        onUploadCompleteRef.current = onUploadComplete;
    }, [onUploadSuccess, onUploadComplete]);

    // Certificar de que o folderPath não termine com barra /
    const sanitizedPath = folderPath.endsWith('/') ? folderPath.slice(0, -1) : folderPath;

    useEffect(() => {
        let isMounted = true;
        let uppyInstance = null;

        const initUppy = async () => {
            const { data: { session }, error } = await supabaseRef.current.auth.getSession();

            if (!isMounted) return; // Previne motor duplicado no React 18 Strict Mode

            if (error || !session) {
                console.error("UppyGlobalUploader: Falha ao obter sessão do usuário");
                toast.error("Erro na autorização do upload. Faça login novamente.");
                return;
            }

            uppyInstance = new Uppy({
                id: `uppy-${bucketName}`,
                locale: pt_BR,
                autoProceed: false,
                restrictions: {
                    maxNumberOfFiles,
                    allowedFileTypes,
                },
                meta: {
                    // Meta default se precisar
                }
            });

            uppyInstance.use(GoldenRetriever, { serviceWorker: false });

            // Dashboard Plugin
            if (dashboardContainerRef.current) {
                // Força a limpeza do DOM para evitar instâncias duplicadas (fantasmas do HMR/StrictMode)
                dashboardContainerRef.current.innerHTML = '';

                uppyInstance.use(Dashboard, {
                    target: dashboardContainerRef.current,
                    inline: true,
                    proudlyDisplayPoweredByUppy: false,
                    width: '100%',
                    height: height,
                    note: note,
                    metaFields: metaFields,
                    theme: 'light' // ou auto/dark conforme o design
                });
            }

            // XHR Upload (Padrão ouro de performance exigido pelo anti-crash)
            uppyInstance.use(XHRUpload, {
                endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucketName}`, // Endpoint base (será sobrescrito file-by-file)
                method: 'POST',
                formData: false, // OBRIGATÓRIO PARA O SUPABASE NÃO CORROMPER BITS DO ARQUIVO
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                }
            });

            // Ajustando a URL de upload dinamicamente por arquivo
            uppyInstance.on('file-added', (file) => {
                // Remove espaços e caracteres ruins
                const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const finalName = `${Date.now()}_${cleanName}`;

                // Constrói o caminho final: bucket / folder / nome-limpo.ext
                const fullPath = sanitizedPath ? `${sanitizedPath}/${finalName}` : finalName;

                // Salva o caminho gerado para usar no retorno
                uppyInstance.setFileMeta(file.id, { supabasePath: fullPath });

                // Sobrescreve o endpoint desse arquivo no XHRUpload
                uppyInstance.setFileState(file.id, {
                    xhrUpload: {
                        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucketName}/${fullPath}`,
                    }
                });
            });

            // Handlers de Sucesso
            uppyInstance.on('upload-success', (file, response) => {
                // response.body contém o retorno do REST do Supabase, ex: { Key: "bucketName/folder/file..." }
                const uploadedPath = file.meta.supabasePath;
                if (onUploadSuccessRef.current) {
                    onUploadSuccessRef.current({
                        fileId: file.id,
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        path: uploadedPath,
                        bucket: bucketName,
                        meta: file.meta
                    });
                }
            });

            uppyInstance.on('complete', (result) => {
                if (result.successful.length > 0) {
                    if (onUploadCompleteRef.current) onUploadCompleteRef.current(result);
                    // Opcional: limpar a interface após upload?
                    // uppyInstance.cancelAll();
                }
            });

            if (isMounted) {
                setUppy(uppyInstance);
            }
        };

        initUppy();

        return () => {
            isMounted = false;
            if (uppyInstance) {
                if (uppyInstance.destroy) uppyInstance.destroy();
                else if (uppyInstance.close) uppyInstance.close();
            }
        };
    }, [bucketName, sanitizedPath, allowedFileTypes, maxNumberOfFiles, height, note]);

    return (
        <div className="uppy-global-wrapper w-full">
            {/* INJEÇÃO DO CSS DO UPPY VIA CDN CONFORME PROTOCOLO ANTI-CRASH */}
            <link href="https://releases.transloadit.com/uppy/v3.23.0/uppy.min.css" rel="stylesheet" />
            <div className="rounded-xl overflow-hidden shadow-sm border border-gray-200 relative min-h-[250px] bg-gray-50">
                {!uppy && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400">
                        <span className="animate-pulse">Iniciando Uploader Seguro...</span>
                    </div>
                )}
                {/* Container estático sem filhos na ótica do React, apenas o Uppy toca aqui */}
                <div ref={dashboardContainerRef} className="absolute inset-0 z-0"></div>
            </div>
        </div>
    );
}

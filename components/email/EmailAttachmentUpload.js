"use client";

import { useEffect, useRef, useState } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';

// Uppy Core e Plugins
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";
const BUCKET_NAME = 'emailanexo';

const pt_BR_Translation = {
  strings: {
    dropPasteFiles: 'Arraste ou %{browse}',
    browse: 'busque aqui',
    uploading: 'Anexando...',
    complete: 'Sucesso',
    xFilesSelected: {
      0: '%{smart_count} arquivo',
      1: '%{smart_count} arquivos',
    },
  },
};

export default function EmailAttachmentUpload({ onUploadComplete }) {
  const supabase = createClient();
  const uppyContainerRef = useRef(null);
  const uppyInstanceRef = useRef(null);
  
  // Controles de Estado
  const [isMobile, setIsMobile] = useState(false);
  const [hasFiles, setHasFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const isSmallScreen = window.innerWidth < 768;

    if (uppyInstanceRef.current) return;

    // 1. Instância do Uppy
    const uppy = new Uppy({
      id: 'email-uploader-btn-text-fix-v14', 
      autoProceed: !isSmallScreen, // PC: Auto | Mobile: Manual
      debug: false,
      locale: pt_BR_Translation,
      restrictions: {
        maxFileSize: 20 * 1024 * 1024,
        maxNumberOfFiles: 10,
      },
    });

    // 2. Anti-Crash
    uppy.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });

    // 3. Dashboard
    uppy.use(DashboardPlugin, {
      inline: true,
      target: uppyContainerRef.current,
      width: '100%',
      height: 100, // Caixa compacta
      
      showSelectedFiles: true,
      disableThumbnailGenerator: true,
      showProgressDetails: true,
      
      hideUploadButton: true, // Esconde botão interno sempre (usamos o externo no mobile)
      
      hideRetryButton: false,
      hidePauseResumeButton: true,
      hideCancelButton: false,
      theme: 'light',
      note: null, 
    });

    // Monitora estado dos arquivos
    const updateFileStatus = () => {
        const count = uppy.getFiles().length;
        setHasFiles(count > 0);
    };

    uppy.on('file-added', updateFileStatus);
    uppy.on('file-removed', updateFileStatus);
    uppy.on('upload', () => setIsUploading(true));
    uppy.on('complete', () => setIsUploading(false));
    uppy.on('cancel-all', () => {
        setHasFiles(false);
        setIsUploading(false);
    });

    uppy.on('restored', () => {
        updateFileStatus();
        if (isSmallScreen) {
            toast.info('Arquivos recuperados. Toque em Anexar.');
        } else {
            uppy.upload();
        }
    });

    // 4. Lógica de Upload
    uppy.addUploader(async (fileIDs) => {
      if (fileIDs.length === 0) return;

      // Garante auth
      await new Promise(resolve => setTimeout(resolve, 500)); 
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
         toast.error("Conexão perdida. Tente novamente.");
         throw new Error("Sem sessão");
      }

      const files = fileIDs.map((id) => uppy.getFile(id));

      for (const file of files) {
        try {
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.size });

          const fileExt = file.name.split('.').pop();
          const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
          const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, file.data, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

          uppy.emit('upload-success', file, { uploadURL: publicUrl });

          if (onUploadComplete) {
             onUploadComplete([{
                name: file.name,
                size: file.size,
                type: file.type,
                url: publicUrl,
                path: filePath
             }]);
          }

          setTimeout(() => uppy.removeFile(file.id), 1000);

        } catch (error) {
          console.error('Erro:', error);
          uppy.emit('upload-error', file, error);
          toast.error(`Erro ao anexar. Tente novamente.`);
        }
      }
    });

    uppyInstanceRef.current = uppy;
  }, [onUploadComplete]);

  const handleManualUpload = () => {
    if (uppyInstanceRef.current) {
        uppyInstanceRef.current.upload();
    }
  };

  return (
    <div className="flex flex-col w-full my-1">
      <link href={UPPY_CSS_URL} rel="stylesheet" />
      
      <style jsx global>{`
        .uppy-Informer { display: none !important; }
        .uppy-Dashboard-inner {
            background-color: #f8fafc !important;
            border: 1px dashed #cbd5e1 !important;
            border-radius: 0.5rem !important;
        }
        .uppy-Dashboard-Item-preview { display: none !important; }
        
        /* CARD COMPACTO */
        .uppy-Dashboard-Item {
            width: 100% !important;
            height: 50px !important;
            margin: 2px 0 !important;
            border: 1px solid #e2e8f0 !important;
            background: white !important;
        }
        .uppy-Dashboard-Item-name { font-size: 0.8rem !important; }
        
        /* Esconde barra de botões interna */
        .uppy-StatusBar { display: none !important; }
      `}</style>
      
      {/* 1. Caixa do Uppy (Só seleção) */}
      <div className="relative group">
        <div ref={uppyContainerRef}></div>
      </div>

      {/* 2. BOTÃO EXTERNO (Só Mobile) - Agora diz "Anexar" */}
      {isMobile && hasFiles && !isUploading && (
          <button
            type="button"
            onClick={handleManualUpload}
            className="mt-3 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2 animate-in slide-in-from-top-2"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            Anexar
          </button>
      )}

      {/* Estado de Envio Mobile */}
      {isMobile && isUploading && (
          <div className="mt-3 w-full bg-gray-100 text-blue-600 font-medium py-3 px-4 rounded-lg text-center text-sm flex items-center justify-center gap-2">
             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
             Anexando...
          </div>
      )}
    </div>
  );
}
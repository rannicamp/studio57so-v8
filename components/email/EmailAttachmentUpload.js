"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons';

// Uppy Core e Plugins
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

// CSS do Uppy
const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// --- TRADUÇÃO MANUAL ---
const pt_BR_Translation = {
  strings: {
    addMore: 'Adicionar',
    addMoreFiles: 'Adicionar',
    browse: 'selecione',
    browseFiles: 'selecionar',
    cancel: 'Cancelar',
    complete: 'Ok',
    dashboardTitle: 'Anexos',
    dropPasteFiles: 'Arraste ou %{browse}', 
    fileProgress: 'Progresso',
    removeFile: 'Remover',
    upload: 'Enviar',
    uploadComplete: 'Pronto',
    uploading: 'Enviando...',
    xFilesSelected: {
      0: '%{smart_count} arquivo',
      1: '%{smart_count} arquivos'
    },
    exceedsSize: 'Arquivo maior que %{size}',
  }
};

export default function EmailAttachmentUpload({ onUploadComplete }) {
  const supabase = createClient();
  const dashboardRef = useRef(null);
  const uploaderRegistered = useRef(false); // TRAVA DE SEGURANÇA CONTRA DUPLICAÇÃO
  
  // Ref para garantir que o uploader sempre chame a função mais recente sem recriar o efeito
  const onUploadCompleteRef = useRef(onUploadComplete);
  useEffect(() => { onUploadCompleteRef.current = onUploadComplete; }, [onUploadComplete]);

  const BUCKET_NAME = 'anexos-email'; 
  const MAX_LIMIT_MB = 20;
  const MAX_LIMIT_BYTES = MAX_LIMIT_MB * 1024 * 1024;

  const [currentSize, setCurrentSize] = useState(0);

  // --- 1. CONFIGURAÇÃO DO UPPY ---
  const [uppy] = useState(() => {
    if (typeof window === 'undefined') return null;

    const uppyInstance = new Uppy({
      id: 'email-uploader-v4-fix-loop', // ID Novo
      autoProceed: true, // Upload automático ao selecionar
      locale: pt_BR_Translation,
      restrictions: {
        maxFileSize: MAX_LIMIT_BYTES, 
        maxTotalFileSize: MAX_LIMIT_BYTES, 
        maxNumberOfFiles: 10,
        allowedFileTypes: null, 
      },
    });

    uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
    
    return uppyInstance;
  });

  // --- 2. MONITOR DE TAMANHO ---
  useEffect(() => {
    if (!uppy) return;
    const updateSize = () => {
        const files = uppy.getFiles();
        const total = files.reduce((acc, file) => acc + file.size, 0);
        setCurrentSize(total);
    };
    uppy.on('file-added', updateSize);
    uppy.on('file-removed', updateSize);
    uppy.on('complete', updateSize);
    return () => {
        if (uppy) {
            uppy.off('file-added', updateSize);
            uppy.off('file-removed', updateSize);
            uppy.off('complete', updateSize);
        }
    };
  }, [uppy]);

  // --- 3. DASHBOARD VISUAL COMPACTO ---
  useEffect(() => {
    if (!uppy || !dashboardRef.current) return;

    if (!uppy.getPlugin('Dashboard')) {
      uppy.use(DashboardPlugin, {
        target: dashboardRef.current,
        inline: true,
        width: '100%',
        height: 50, // SUPER COMPACTO
        showProgressDetails: true,
        hideUploadButton: true,
        disableThumbnailGenerator: true, // Sem thumbnails
        showLinkToFileUploadResult: false,
        proudlyDisplayPoweredByUppy: false,
        disableStatusBar: false, 
        showSelectedFiles: false, // ESCONDE A LISTA INTERNA (Pois o Modal já mostra)
      });
    }
  }, [uppy]);

  // --- 4. LÓGICA DE UPLOAD BLINDADA ---
  useEffect(() => {
    if (!uppy) return;
    
    // SE JÁ REGISTROU, NÃO REGISTRA DE NOVO (Fim do Bug da Multiplicação)
    if (uploaderRegistered.current) return;

    const uploadToSupabase = async (fileIDs) => {
      const uploadedLinks = [];
      
      const promises = fileIDs.map(async (id) => {
        const file = uppy.getFile(id);
        try {
          // Upload
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.data.size });

          const fileExt = file.name.split('.').pop();
          const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
          
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file.data, { cacheControl: '3600', upsert: false });

          if (error) throw error;

          const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
          const finalUrl = publicData.publicUrl;

          uploadedLinks.push({
            name: file.name,
            url: finalUrl,
            size: file.size // Mantemos o número cru aqui
          });

          uppy.emit('upload-success', file, { uploadURL: finalUrl, status: 200 });
          
          // IMPORTANTE: Remove do Uppy para limpar a memória e o visual interno
          uppy.removeFile(id); 

        } catch (err) {
          console.error(err);
          uppy.emit('upload-error', file, err);
          toast.error(`Erro ao enviar ${file.name}`);
        }
      });

      await Promise.all(promises);
      
      if (uploadedLinks.length > 0) {
        // Usa a Ref para chamar a função do pai sem recriar o efeito
        if (onUploadCompleteRef.current) {
            onUploadCompleteRef.current(uploadedLinks);
        }
        toast.success("Anexado!");
      }
    };

    uppy.addUploader(uploadToSupabase);
    uploaderRegistered.current = true; // Marca como registrado
    
  }, [uppy]); // Dependência limpa: só roda quando o Uppy nasce

  // Visuais
  const percentUsed = Math.min((currentSize / MAX_LIMIT_BYTES) * 100, 100);
  const sizeInMB = (currentSize / 1024 / 1024).toFixed(2);
  let barColor = "bg-blue-500";
  if (percentUsed > 80) barColor = "bg-orange-500";
  if (percentUsed >= 100) barColor = "bg-red-500";

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <link href={UPPY_CSS_URL} rel="stylesheet" />

      {/* Cabeçalho Fininho */}
      <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
            <FontAwesomeIcon icon={faPaperclip} />
            <span>Anexar Arquivos</span>
         </div>
         <div className="flex items-center gap-2 w-1/3">
             <div className="w-full bg-gray-200 rounded-full h-1">
                <div className={`h-1 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentUsed}%` }}></div>
             </div>
             <span className="text-[9px] font-mono text-gray-400 whitespace-nowrap">
                {sizeInMB}/{MAX_LIMIT_MB}MB
             </span>
         </div>
      </div>

      {/* Área do Uppy (Mínima) */}
      <div className="relative">
         <style jsx global>{`
            .uppy-Dashboard-inner { height: 50px !important; border: none !important; background: #fff !important; }
            .uppy-Dashboard-AddFiles { border: none !important; margin: 0 !important; height: 50px !important; }
            .uppy-Dashboard-AddFiles-title { font-size: 11px !important; color: #6b7280 !important; padding-bottom: 0 !important; }
            .uppy-Dashboard-progressindicators { display: none !important; } 
            .uppy-Dashboard-Content-bar { display: none !important; }
         `}</style>
         <div ref={dashboardRef} />
      </div>

      {/* SEM LISTA AQUI - A LISTA FICA NO MODAL PAI */}
    </div>
  );
}
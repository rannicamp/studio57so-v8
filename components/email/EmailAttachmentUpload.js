"use client";

import { useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';

// Uppy Core e Plugins (Versão Vanilla JS para máxima compatibilidade)
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

// CSS do Uppy
const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// Nome do Bucket (Conforme seu padrão)
const BUCKET_NAME = 'emailanexo';

export default function EmailAttachmentUpload({ onUploadComplete }) {
  const supabase = createClient();
  const uppyContainerRef = useRef(null);
  const uppyInstanceRef = useRef(null);

  useEffect(() => {
    // Se já existe instância, não recria
    if (uppyInstanceRef.current) return;

    // 1. Instância do Uppy
    const uppy = new Uppy({
      id: 'email-uploader-mobile-v2', // ID único
      autoProceed: false, // Deixa o usuário clicar em "Upload" ou o código disparar
      debug: true,
      restrictions: {
        maxFileSize: 20 * 1024 * 1024, // 20MB
        maxNumberOfFiles: 10,
      },
    });

    // 2. Plugin Anti-Crash (Salva o arquivo se o Android matar a aba)
    uppy.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });

    // 3. Dashboard INLINE (Visual Padrão que funciona no toque)
    uppy.use(DashboardPlugin, {
      inline: true,
      target: uppyContainerRef.current,
      width: '100%',
      height: 250, // Altura boa para o dedo
      showProgressDetails: true,
      proudlyDisplayPoweredByUppy: false,
      hideUploadButton: false, // Mostra o botão verde de upload
      note: 'Se o navegador reiniciar, seu arquivo reaparecerá aqui.',
    });

    // 4. Uploader Customizado com "Paciência" (Delay de Auth)
    uppy.addUploader(async (fileIDs) => {
      if (fileIDs.length === 0) return;

      const uploaded = [];
      const files = fileIDs.map((id) => uppy.getFile(id));

      // [TRUQUE DE MESTRE] Delay para o Supabase "acordar" após o refresh do celular
      // Isso evita o erro de permissão/401 logo após o "Session Restored"
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      // Garante que a sessão está ativa
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Tente recarregar a página.");
        throw new Error("Usuário não autenticado");
      }

      for (const file of files) {
        try {
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.size });

          // Sanitização do nome (evita caracteres estranhos)
          const fileExt = file.name.split('.').pop();
          const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50);
          const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
          const filePath = `${fileName}`; // No bucket raiz ou pasta específica? Vou usar raiz para garantir.

          // Upload Supabase
          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME) // Usando o bucket correto 'emailanexo'
            .upload(filePath, file.data, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type // Importante para PDF
            });

          if (uploadError) throw uploadError;

          // URL Pública
          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

          uploaded.push({
            name: file.name,
            size: file.size,
            type: file.type,
            url: publicUrl,
            path: filePath
          });

          uppy.emit('upload-success', file, { uploadURL: publicUrl });

        } catch (error) {
          console.error('Erro no upload:', error);
          uppy.emit('upload-error', file, error);
          // Não lançamos erro global para permitir que outros arquivos continuem
        }
      }

      if (uploaded.length > 0) {
        toast.success("Arquivos anexados com sucesso!");
        if (onUploadComplete) {
          onUploadComplete(uploaded);
        }
      }
    });

    uppyInstanceRef.current = uppy;

    return () => {
      // Cleanup se necessário
    };
  }, [onUploadComplete]);

  return (
    <div className="w-full my-2">
      {/* Link CSS Obrigatório */}
      <link href={UPPY_CSS_URL} rel="stylesheet" />
      
      {/* Container do Uppy */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div ref={uppyContainerRef}></div>
      </div>
      
      <p className="text-xs text-gray-400 mt-1 text-center">
        * Se a tela piscar, o arquivo será restaurado automaticamente.
      </p>
    </div>
  );
}
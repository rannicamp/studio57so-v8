// components/UploadFotosRdo.js
"use client";

import { useState, useEffect } from 'react';
import { createClient } from '../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCamera, 
  faTrash, 
  faSpinner, 
  faFilePdf, 
  faFileAlt, 
  faDownload,
  faFileLines,
  faCloud
} from '@fortawesome/free-solid-svg-icons';

export default function UploadFotosRdo() {
  const supabase = createClient();
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const BUCKET_NAME = 'teste';
  const FOLDER_NAME = 'arquivos';

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(FOLDER_NAME, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      if (data) {
        const processed = await Promise.all(data.map(async (f) => {
            if (f.name === '.emptyFolderPlaceholder') return null;
            const fullPath = `${FOLDER_NAME}/${f.name}`;
            const { data: urlData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(fullPath, 3600);

            return {
                id: f.id, 
                name: f.name,
                caminho_arquivo: fullPath,
                tamanho_arquivo: f.metadata?.size || 0,
                created_at: f.created_at,
                signedUrl: urlData?.signedUrl
            };
        }));
        setFiles(processed.filter(Boolean));
      }
    } catch (e) { 
      console.error(e); 
    }
  };

  // FUNÇÃO DE UPLOAD ROBUSTA
  const handleUpload = async (e) => {
    // 1. Log imediato para ver se o evento disparou
    console.log("Evento de upload disparado!"); 
    
    const file = e.target.files?.[0];
    if (!file) {
        console.log("Nenhum arquivo selecionado ou seleção cancelada.");
        return;
    }

    setIsUploading(true);
    // 2. Alert visual para garantir que o código JS pegou o arquivo
    // alert("Arquivo capturado: " + file.name); // Descomente se precisar debugar muito fundo

    toast.info(`Processando: ${file.name}`);
    
    try {
        let finalFile = file;
        
        // Identificação de tipo segura
        const fileType = file.type || ''; 
        const isImage = fileType.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp)$/i);

        if (isImage) {
            try {
                const imageCompression = (await import('browser-image-compression')).default;
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
                finalFile = await imageCompression(file, options);
            } catch (err) {
                console.warn("Erro compressão imagem:", err);
            }
        }

        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `${FOLDER_NAME}/${Date.now()}_${cleanName}`;
        
        // Determina o Content-Type manualmente se falhar
        let contentType = file.type;
        if (!contentType || contentType === "") {
             if (file.name.endsWith('.pdf')) contentType = 'application/pdf';
             else if (file.name.endsWith('.txt')) contentType = 'text/plain';
             else contentType = 'application/octet-stream';
        }

        const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, finalFile, {
                contentType: contentType,
                upsert: false
            });
            
        if (upErr) throw upErr;

        toast.success("Sucesso!");
        loadFiles(); 
        
    } catch (err) {
        console.error("Erro no upload:", err);
        toast.error(`Erro: ${err.message}`);
    } finally {
        setIsUploading(false);
        // Limpa o input com segurança
        e.target.value = ""; 
    }
  };

  const handleRemove = async (path) => {
      if(!confirm("Excluir?")) return;
      try {
        await supabase.storage.from(BUCKET_NAME).remove([path]);
        setFiles(prev => prev.filter(f => f.caminho_arquivo !== path));
        toast.success("Excluído.");
      } catch (error) {
        toast.error("Erro ao excluir.");
      }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      
      {/* --- ÁREA DE DIAGNÓSTICO (BOTÃO NATIVO) --- */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs font-bold text-yellow-800 mb-2">TESTE DO ANDROID (Botão Nativo):</p>
          <p className="text-xs text-yellow-700 mb-3">Tente enviar o PDF por este botão cinza abaixo. Se funcionar, o problema era o design.</p>
          
          {/* ESTE É O SEGREDO: Um input visível, sem CSS 'hidden' */}
          <input 
            type="file" 
            onChange={handleUpload}
            disabled={isUploading}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
          />
      </div>
      {/* ------------------------------------------ */}

      <div className="flex items-center gap-2 mb-4 text-gray-500 text-sm">
        <FontAwesomeIcon icon={faCloud} />
        <span>Bucket: <strong>{BUCKET_NAME}</strong></span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* BOTÃO FOTOS (Design Original - Mantido) */}
        <label className={`
            flex flex-col items-center justify-center p-4 border-2 border-dashed border-blue-200 bg-blue-50 rounded-xl cursor-pointer active:bg-blue-100 transition-all
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}>
            <FontAwesomeIcon icon={faCamera} className="text-2xl text-blue-600 mb-1" />
            <span className="text-xs font-bold text-blue-700">FOTOS</span>
            <input 
                type="file" 
                accept="image/*" 
                onChange={handleUpload} 
                disabled={isUploading}
                className="hidden" 
            />
        </label>

        {/* BOTÃO ARQUIVOS (Design Original - Mantido para comparação) */}
        <label className={`
            flex flex-col items-center justify-center p-4 border-2 border-dashed border-red-200 bg-red-50 rounded-xl cursor-pointer active:bg-red-100 transition-all
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}>
            {isUploading ? (
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-red-600 mb-1" />
            ) : (
                <FontAwesomeIcon icon={faFileLines} className="text-2xl text-red-600 mb-1" />
            )}
            <span className="text-xs font-bold text-red-700">DESIGN</span>
            <input 
                type="file" 
                onChange={handleUpload} 
                disabled={isUploading}
                className="hidden" 
            />
        </label>

      </div>

      <div className="space-y-3">
        {files.map((f) => {
            const isPdf = f.name.toLowerCase().includes('.pdf');
            const isTxt = f.name.toLowerCase().includes('.txt');
            const isDoc = !isPdf && !isTxt && !f.name.match(/\.(jpg|jpeg|png|webp)$/i);

            return (
                <div key={f.id || f.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                    <div className="w-12 h-12 flex-shrink-0 bg-white rounded overflow-hidden flex items-center justify-center border">
                        {isPdf ? <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-xl" /> :
                         isTxt ? <FontAwesomeIcon icon={faFileAlt} className="text-gray-500 text-xl" /> :
                         isDoc ? <FontAwesomeIcon icon={faFileLines} className="text-blue-500 text-xl" /> :
                         <img src={f.signedUrl} className="w-full h-full object-cover" />
                        }
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{f.name}</p>
                        
                        {(isPdf || isTxt || isDoc) && (
                            <a href={f.signedUrl} target="_blank" className="text-[10px] text-blue-600 font-bold mt-1 inline-block">
                                <FontAwesomeIcon icon={faDownload} className="mr-1"/> Abrir
                            </a>
                        )}
                    </div>

                    <button 
                        onClick={() => handleRemove(f.caminho_arquivo)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            );
        })}
      </div>
    </div>
  );
}
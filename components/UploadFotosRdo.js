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
  faSync
} from '@fortawesome/free-solid-svg-icons';
import imageCompression from 'browser-image-compression';

export default function UploadFotosRdo({ organizacaoId }) {
  const supabase = createClient();
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // CONFIGURAÇÃO DE TESTE
  const BUCKET_NAME = 'teste';
  const FOLDER_NAME = 'teste'; // Pasta dentro do bucket

  useEffect(() => {
    loadFiles();
  }, []);

  // Carrega arquivos direto do STORAGE (Sem banco de dados)
  const loadFiles = async () => {
    try {
      // Lista arquivos na pasta 'teste'
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(FOLDER_NAME, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      if (data) {
        // Gera URLs assinadas para cada arquivo encontrado
        const processed = await Promise.all(data.map(async (file) => {
            if (file.name === '.emptyFolderPlaceholder') return null; // Ignora arquivo de sistema

            const fullPath = `${FOLDER_NAME}/${file.name}`;
            const { data: urlData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(fullPath, 3600);

            return {
                id: file.id,
                name: file.name,
                caminho_arquivo: fullPath,
                tamanho_arquivo: file.metadata?.size || 0,
                signedUrl: urlData?.signedUrl
            };
        }));
        setFiles(processed.filter(Boolean)); // Remove nulos
      }
    } catch (e) { 
      console.error(e); 
      toast.error("Erro ao listar arquivos do bucket 'teste'.");
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
        let finalFile = file;
        const isImage = file.type.startsWith('image/');

        // Compressão apenas para imagens
        if (isImage) {
            try {
                const options = { 
                    maxSizeMB: 1, 
                    maxWidthOrHeight: 1920, 
                    useWebWorker: true 
                };
                finalFile = await imageCompression(file, options);
            } catch (err) {
                console.warn("Sem compressão:", err);
            }
        }

        // Nome limpo
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `${FOLDER_NAME}/${Date.now()}_${cleanName}`;
        
        // Upload direto para o bucket 'teste'
        const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, finalFile);
            
        if (upErr) throw upErr;

        toast.success("Upload realizado com sucesso!");
        loadFiles(); // Recarrega a lista visual
        
    } catch (err) {
        console.error(err);
        toast.error(`Erro: ${err.message}`);
    } finally {
        setIsUploading(false);
        e.target.value = ""; 
    }
  };

  const handleRemove = async (path) => {
      if(!confirm("Excluir este arquivo do bucket?")) return;
      
      try {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
        if (error) throw error;
        
        setFiles(prev => prev.filter(f => f.caminho_arquivo !== path));
        toast.success("Arquivo excluído.");
      } catch (error) {
        console.error(error);
        toast.error("Erro ao excluir.");
      }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
        📂 Bucket: <span className="text-blue-600 font-mono">{BUCKET_NAME}/{FOLDER_NAME}</span>
        <button onClick={loadFiles} className="ml-auto text-sm text-gray-400 hover:text-blue-500">
            <FontAwesomeIcon icon={faSync} />
        </button>
      </h2>
      
      {/* ÁREA DE UPLOAD */}
      <div className="mb-6">
        <label className={`
            flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors
            ${isUploading ? 'bg-gray-100 border-gray-300' : 'bg-blue-50 border-blue-300 hover:bg-blue-100'}
        `}>
            {isUploading ? (
                <div className="text-center text-blue-600">
                    <FontAwesomeIcon icon={faSpinner} spin className="text-3xl mb-2" />
                    <p className="font-bold">Enviando para bucket teste...</p>
                </div>
            ) : (
                <div className="text-center text-blue-600">
                    <FontAwesomeIcon icon={faCamera} className="text-3xl mb-2" />
                    <p className="font-bold">Upload de Teste</p>
                    <p className="text-xs text-gray-500 mt-1">Fotos ou PDF</p>
                </div>
            )}
            <input 
                type="file" 
                accept="image/*,application/pdf" 
                onChange={handleUpload} 
                disabled={isUploading}
                className="hidden" 
            />
        </label>
      </div>

      {/* LISTA DE ANEXOS */}
      <div className="space-y-3">
        {files.map(f => {
            const isPdf = f.name.toLowerCase().endsWith('.pdf');

            return (
                <div key={f.id || f.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                    {/* Miniatura */}
                    <div className="w-16 h-16 flex-shrink-0 bg-white rounded overflow-hidden flex items-center justify-center border">
                        {isPdf ? (
                            <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-2xl" />
                        ) : (
                            <img src={f.signedUrl} className="w-full h-full object-cover" alt="anexo" />
                        )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{f.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isPdf && (
                                <a href={f.signedUrl} target="_blank" className="text-[10px] text-blue-600 font-bold flex items-center gap-1">
                                    <FontAwesomeIcon icon={faDownload} /> Abrir PDF
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Excluir */}
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
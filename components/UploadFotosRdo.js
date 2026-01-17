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

  // CONFIGURAÇÃO SIMPLES
  const BUCKET_NAME = 'teste';
  const FOLDER_NAME = 'arquivos'; // Pasta para organizar

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      // Lista arquivos da pasta
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(FOLDER_NAME, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;

      if (data) {
        // Gera URLs para visualização
        const processed = await Promise.all(data.map(async (f) => {
            if (f.name === '.emptyFolderPlaceholder') return null;
            
            const fullPath = `${FOLDER_NAME}/${f.name}`;
            const { data: urlData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(fullPath, 3600);

            return {
                id: f.id, // ID interno do storage
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
      // toast.error("Erro ao listar arquivos."); // Opcional
    }
  };

  const handleUpload = async (e) => {
    // Evita comportamentos estranhos do navegador
    if (e.preventDefault) e.preventDefault();

    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.info("Processando arquivo...");
    
    try {
        let finalFile = file;

        // VERIFICAÇÃO SEGURA: Se não tiver tipo, assume que NÃO é imagem
        // Isso evita o crash no Android quando o PDF vem sem metadata
        const fileType = file.type || ''; 
        const isImage = fileType.startsWith('image/');

        // OTIMIZAÇÃO (Apenas para Imagens)
        if (isImage) {
            try {
                const imageCompression = (await import('browser-image-compression')).default;
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
                finalFile = await imageCompression(file, options);
            } catch (err) {
                console.warn("Sem compressão:", err);
            }
        }

        // Nome limpo e seguro
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `${FOLDER_NAME}/${Date.now()}_${cleanName}`;
        
        // UPLOAD DIRETO
        const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, finalFile);
            
        if (upErr) throw upErr;

        toast.success("Arquivo salvo com sucesso!");
        loadFiles(); // Atualiza a lista visualmente
        
    } catch (err) {
        console.error(err);
        toast.error(`Erro: ${err.message}`);
    } finally {
        setIsUploading(false);
        // Limpa o input para permitir selecionar o mesmo arquivo novamente se falhar
        e.target.value = ""; 
    }
  };

  const handleRemove = async (path) => {
      if(!confirm("Excluir arquivo?")) return;
      
      try {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
        if (error) throw error;
        
        setFiles(prev => prev.filter(f => f.caminho_arquivo !== path));
        toast.success("Excluído.");
      } catch (error) {
        console.error(error);
        toast.error("Erro ao excluir.");
      }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      <div className="flex items-center gap-2 mb-4 text-gray-500 text-sm">
        <FontAwesomeIcon icon={faCloud} />
        <span>Armazenamento: <strong>{BUCKET_NAME}/{FOLDER_NAME}</strong></span>
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* BOTÃO 1: FOTOS (Galeria) */}
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

        {/* BOTÃO 2: DOCUMENTOS (Lista Simples) */}
        <label className={`
            flex flex-col items-center justify-center p-4 border-2 border-dashed border-red-200 bg-red-50 rounded-xl cursor-pointer active:bg-red-100 transition-all
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}>
            {isUploading ? (
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-red-600 mb-1" />
            ) : (
                <FontAwesomeIcon icon={faFileLines} className="text-2xl text-red-600 mb-1" />
            )}
            <span className="text-xs font-bold text-red-700">ARQUIVOS</span>
            
            {/* CORREÇÃO AQUI: 
                Adicionei as extensões (.pdf, .doc) explicitamente. 
                Isso ajuda o Android a não se perder e evita o reload da página.
            */}
            <input 
                type="file" 
                accept=".pdf, .txt, .doc, .docx, application/pdf, application/msword"
                onChange={handleUpload} 
                disabled={isUploading}
                className="hidden" 
            />
        </label>

      </div>

      {/* LISTA DE ARQUIVOS */}
      <div className="space-y-3">
        {files.map((f) => {
            const isPdf = f.name.toLowerCase().includes('.pdf');
            const isTxt = f.name.toLowerCase().includes('.txt');
            const isDoc = !isPdf && !isTxt && !f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);

            return (
                <div key={f.id || f.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                    {/* Miniatura */}
                    <div className="w-12 h-12 flex-shrink-0 bg-white rounded overflow-hidden flex items-center justify-center border">
                        {isPdf ? <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-xl" /> :
                         isTxt ? <FontAwesomeIcon icon={faFileAlt} className="text-gray-500 text-xl" /> :
                         isDoc ? <FontAwesomeIcon icon={faFileLines} className="text-blue-500 text-xl" /> :
                         <img src={f.signedUrl} className="w-full h-full object-cover" />
                        }
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-700 truncate">{f.name}</p>
                        <p className="text-[10px] text-gray-400">
                            {new Date(f.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        
                        {(isPdf || isTxt || isDoc) && (
                            <a href={f.signedUrl} target="_blank" className="text-[10px] text-blue-600 font-bold mt-1 inline-block">
                                <FontAwesomeIcon icon={faDownload} className="mr-1"/> Abrir
                            </a>
                        )}
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

        {files.length === 0 && !isUploading && (
            <div className="text-center py-8 text-gray-400">
                <p>Pasta vazia.</p>
            </div>
        )}
      </div>
    </div>
  );
}
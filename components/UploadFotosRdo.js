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
  faFileLines
} from '@fortawesome/free-solid-svg-icons';

// NOTA: Removemos o import global do 'browser-image-compression' para economizar memória inicial.
// Ele será carregado sob demanda apenas quando necessário.

export default function UploadFotosRdo({ rdoId, organizacaoId }) {
  const supabase = createClient();
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (rdoId) loadFiles();
  }, [rdoId]);

  const loadFiles = async () => {
    try {
      const { data } = await supabase
        .from('rdo_fotos_uploads')
        .select('*')
        .eq('diario_obra_id', rdoId);
        
      if (data) {
        const processed = await Promise.all(data.map(async f => ({
            ...f,
            signedUrl: (await supabase.storage.from('rdo-fotos').createSignedUrl(f.caminho_arquivo, 3600)).data?.signedUrl
        })));
        setFiles(processed);
      }
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.info("Lendo arquivo...");
    
    try {
        let finalFile = file;
        const isImage = file.type.startsWith('image/');
        
        // 1. OTIMIZAÇÃO DE MEMÓRIA (Importação Dinâmica)
        // Só carrega a biblioteca pesada se for realmente uma imagem
        if (isImage) {
            try {
                toast.loading("Otimizando imagem...", { id: "compression" });
                // Importa a biblioteca apenas agora
                const imageCompression = (await import('browser-image-compression')).default;
                
                const options = { 
                    maxSizeMB: 1, 
                    maxWidthOrHeight: 1920, 
                    useWebWorker: true 
                };
                finalFile = await imageCompression(file, options);
                toast.dismiss("compression");
            } catch (err) {
                console.warn("Compressão falhou, enviando original", err);
                toast.dismiss("compression");
            }
        }

        // 2. Upload
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `${rdoId}/${Date.now()}_${cleanName}`;
        
        const { error: upErr } = await supabase.storage
            .from('rdo-fotos')
            .upload(path, finalFile);
            
        if (upErr) throw upErr;

        // 3. Salva no Banco
        const { error: dbErr } = await supabase.from('rdo_fotos_uploads').insert({
            diario_obra_id: rdoId, 
            organizacao_id: organizacaoId,
            caminho_arquivo: path,
            tamanho_arquivo: finalFile.size,
            descricao: isImage ? "Foto Mobile" : file.name
        });
        
        if (dbErr) throw dbErr;

        toast.success("Sucesso!");
        loadFiles();
        
    } catch (err) {
        console.error(err);
        toast.error(`Erro: ${err.message}`);
    } finally {
        setIsUploading(false);
        e.target.value = ""; 
    }
  };

  const handleRemove = async (id, path) => {
      if(!confirm("Excluir?")) return;
      try {
        await supabase.storage.from('rdo-fotos').remove([path]);
        await supabase.from('rdo_fotos_uploads').delete().eq('id', id);
        setFiles(prev => prev.filter(f => f.id !== id));
        toast.success("Excluído.");
      } catch (error) {
        toast.error("Erro ao excluir.");
      }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      
      {/* SEÇÃO DE BOTÕES DIVIDIDOS (ESTRATÉGIA PARA NÃO TRAVAR O ANDROID) */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        
        {/* BOTÃO 1: FOTOS (Usa galeria visual) */}
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

        {/* BOTÃO 2: DOCUMENTOS (Usa lista leve) */}
        {/* AQUI ESTÁ O TRUQUE: Listamos tipos específicos para evitar que o Android tente carregar vídeos e trave */}
        <label className={`
            flex flex-col items-center justify-center p-4 border-2 border-dashed border-red-200 bg-red-50 rounded-xl cursor-pointer active:bg-red-100 transition-all
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}>
            {isUploading ? (
                <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-red-600 mb-1" />
            ) : (
                <FontAwesomeIcon icon={faFileLines} className="text-2xl text-red-600 mb-1" />
            )}
            <span className="text-xs font-bold text-red-700">DOCUMENTOS</span>
            <span className="text-[9px] text-red-500">(PDF, DOC, TXT)</span>
            
            <input 
                type="file" 
                // EVITA O */* PARA NÃO CARREGAR VÍDEOS NA MEMÓRIA
                accept="application/pdf, text/plain, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleUpload} 
                disabled={isUploading}
                className="hidden" 
            />
        </label>

      </div>

      {/* LISTA DE ARQUIVOS */}
      <div className="space-y-3">
        {files.map(f => {
            const isPdf = f.caminho_arquivo?.toLowerCase().includes('.pdf');
            const isTxt = f.caminho_arquivo?.toLowerCase().includes('.txt');
            const isDoc = !isPdf && !isTxt && !f.caminho_arquivo?.match(/\.(jpg|jpeg|png|webp|gif)$/i);

            return (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                    {/* Ícones conforme o tipo */}
                    <div className="w-12 h-12 flex-shrink-0 bg-white rounded overflow-hidden flex items-center justify-center border">
                        {isPdf ? <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-xl" /> :
                         isTxt ? <FontAwesomeIcon icon={faFileAlt} className="text-gray-500 text-xl" /> :
                         isDoc ? <FontAwesomeIcon icon={faFileLines} className="text-blue-500 text-xl" /> :
                         <img src={f.signedUrl} className="w-full h-full object-cover" />
                        }
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{f.descricao || f.caminho_arquivo.split('/').pop()}</p>
                        { (isPdf || isTxt || isDoc) && (
                            <a href={f.signedUrl} target="_blank" className="text-[10px] text-blue-600 font-bold mt-1 inline-block">
                                <FontAwesomeIcon icon={faDownload} className="mr-1"/> Baixar
                            </a>
                        )}
                    </div>

                    <button onClick={() => handleRemove(f.id, f.caminho_arquivo)} className="p-2 text-red-500">
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            );
        })}
      </div>
    </div>
  );
}
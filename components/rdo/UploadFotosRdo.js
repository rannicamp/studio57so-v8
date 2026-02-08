// components/UploadFotosRdo.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrash, 
  faFilePdf, 
  faFileAlt, 
  faDownload, 
  faFileLines,
  faCloud 
} from '@fortawesome/free-solid-svg-icons';

// --- UPPY CORE & PLUGINS (SEM O PACOTE REACT) ---
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard'; // Importamos o Plugin direto, não o componente
import GoldenRetriever from '@uppy/golden-retriever';
import Webcam from '@uppy/webcam';

export default function UploadFotosRdo() {
  const supabase = createClient();
  const BUCKET_NAME = 'teste';
  const FOLDER_NAME = 'arquivos';

  // Referência para onde o Uppy vai desenhar a tela
  const dashboardContainerRef = useRef(null);

  // Lista de arquivos já salvos
  const [existingFiles, setExistingFiles] = useState([]);
  
  // Instância do Uppy
  const [uppy] = useState(() => {
    if (typeof window === 'undefined') return null;

    const uppyInstance = new Uppy({
      id: 'rdo-uploader-v1', // ID fixo para recuperação
      autoProceed: false,
      debug: true,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024,
        maxNumberOfFiles: 5,
        allowedFileTypes: ['.pdf', 'image/*', '.txt', '.doc', '.docx'],
      },
    });

    // 1. O SALVA-VIDAS (Recuperação de Crash)
    uppyInstance.use(GoldenRetriever, {
      serviceWorker: false,
      indexedDB: true,
    });

    // 2. Webcam
    uppyInstance.use(Webcam);

    return uppyInstance;
  });

  // --- MONTAGEM MANUAL DA INTERFACE (Bypass do erro do React) ---
  useEffect(() => {
    if (!uppy || !dashboardContainerRef.current) return;

    // Se o plugin já existe, não adiciona de novo
    if (!uppy.getPlugin('Dashboard')) {
        uppy.use(DashboardPlugin, {
            id: 'Dashboard',
            target: dashboardContainerRef.current, // Desenha DENTRO da nossa div
            inline: true,
            width: '100%',
            height: 300,
            showProgressDetails: true,
            note: "Se o navegador reiniciar, seu arquivo reaparecerá aqui.",
            doneButtonHandler: () => loadFiles(),
            locale: {
                strings: {
                    dropPasteFiles: 'Arraste arquivos ou %{browse}',
                    browse: 'busque aqui',
                    myDevice: 'Meu Dispositivo',
                    addMore: 'Adicionar mais',
                    cancel: 'Cancelar',
                }
            }
        });
    }

    // Cleanup (opcional, mas boa prática)
    return () => {
        // Não removemos o plugin aqui para não perder o estado se o componente remontar rápido
    };
  }, [uppy]);


  // --- CONECTOR UPPY -> SUPABASE ---
  useEffect(() => {
    if (!uppy) return;

    const uploadToSupabase = async (fileIDs) => {
      if (fileIDs.length === 0) return Promise.resolve();

      const promises = fileIDs.map(async (id) => {
        const file = uppy.getFile(id);
        
        try {
          uppy.emit('upload-progress', file, { 
            uploader: uppy, 
            bytesUploaded: 0, 
            bytesTotal: file.data.size 
          });

          const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const path = `${FOLDER_NAME}/${Date.now()}_${cleanName}`;
          
          let contentType = file.type;
          if (!contentType && file.name.endsWith('.pdf')) contentType = 'application/pdf';

          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(path, file.data, {
              contentType: contentType,
              upsert: false
            });

          if (error) throw error;

          uppy.emit('upload-success', file, { uploadURL: path, status: 200, body: data });
          uppy.removeFile(id);

        } catch (err) {
          console.error("Erro Supabase:", err);
          uppy.emit('upload-error', file, err);
          toast.error(`Falha ao enviar ${file.name}`);
          throw err;
        }
      });

      return Promise.all(promises);
    };

    uppy.addUploader(uploadToSupabase);
    loadFiles();

  }, [uppy]); 


  // --- FUNÇÕES DE LISTAGEM ---
  const loadFiles = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(FOLDER_NAME, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;

      if (data) {
        const processed = await Promise.all(data.map(async (f) => {
            if (f.name === '.emptyFolderPlaceholder') return null;
            const fullPath = `${FOLDER_NAME}/${f.name}`;
            const { data: urlData } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(fullPath, 3600);

            return {
                id: f.id, name: f.name, caminho_arquivo: fullPath,
                created_at: f.created_at, signedUrl: urlData?.signedUrl
            };
        }));
        setExistingFiles(processed.filter(Boolean));
      }
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (path) => {
      if(!confirm("Excluir arquivo permanentemente?")) return;
      try {
        await supabase.storage.from(BUCKET_NAME).remove([path]);
        setExistingFiles(prev => prev.filter(f => f.caminho_arquivo !== path));
        toast.success("Excluído com sucesso.");
      } catch (error) { toast.error("Erro ao excluir."); }
  };

  if (!uppy) return null; 

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      
      {/* CSS DO UPPY VIA CDN (Evita erros de build) */}
      <link href="https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css" rel="stylesheet" />

      {/* 1. ÁREA DE UPLOAD (Aqui a mágica acontece) */}
      <div className="mb-8">
        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCloud} className="text-blue-500"/>
          Novo Upload (Anti-Crash)
        </h3>
        
        {/* Usamos uma DIV simples com REF. O Uppy desenha aqui dentro. */}
        <div ref={dashboardContainerRef} className="uppy-dashboard-container" />
        
      </div>

      {/* 2. LISTA DE ARQUIVOS */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Arquivos na Nuvem</h3>
        <div className="space-y-3">
          {existingFiles.map((f) => {
              const isPdf = f.name.toLowerCase().includes('.pdf');
              const isTxt = f.name.toLowerCase().includes('.txt');
              const isDoc = !isPdf && !isTxt && !f.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);

              return (
                  <div key={f.id || f.name} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 shadow-sm">
                      <div className="w-12 h-12 flex-shrink-0 bg-white rounded overflow-hidden flex items-center justify-center border">
                          {isPdf ? <FontAwesomeIcon icon={faFilePdf} className="text-red-500 text-xl" /> :
                           isTxt ? <FontAwesomeIcon icon={faFileAlt} className="text-gray-500 text-xl" /> :
                           isDoc ? <FontAwesomeIcon icon={faFileLines} className="text-blue-500 text-xl" /> :
                           <img src={f.signedUrl} className="w-full h-full object-cover" alt="preview" />
                          }
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">{f.name}</p>
                          <p className="text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                          {(isPdf || isTxt || isDoc) && (
                              <a href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 font-bold mt-1 inline-block">
                                  <FontAwesomeIcon icon={faDownload} className="mr-1"/> Abrir
                              </a>
                          )}
                      </div>
                      <button onClick={() => handleRemove(f.caminho_arquivo)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                          <FontAwesomeIcon icon={faTrash} />
                      </button>
                  </div>
              );
          })}
          {existingFiles.length === 0 && <div className="text-center py-4 text-gray-400 text-sm">Nenhum arquivo salvo ainda.</div>}
        </div>
      </div>
    </div>
  );
}
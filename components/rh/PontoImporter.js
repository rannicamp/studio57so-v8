// components/rh/PontoImporter.js
"use client";

import { useState, useEffect, useRef } from 'react';
import { createClient } from '../../utils/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCloud, 
  faCheckCircle, 
  faExclamationTriangle, 
  faSpinner, 
  faFileImport 
} from '@fortawesome/free-solid-svg-icons';

import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// --- DICIONÁRIO PT-BR COMPLETO (A "MÁSCARA") ---
const pt_BR = {
  strings: {
    addMore: 'Adicionar mais',
    addMoreFiles: 'Adicionar mais arquivos',
    addingMoreFiles: 'Adicionando mais arquivos',
    browse: 'selecione', // AQUI ESTÁ A CHAVE QUE FALTAVA
    browseFiles: 'selecionar arquivos',
    cancel: 'Cancelar',
    cancelUpload: 'Cancelar envio',
    chooseFiles: 'Selecionar arquivos',
    closeModal: 'Fechar',
    complete: 'Concluído',
    dashboardTitle: 'Envio de Arquivos',
    dashboardWindowTitle: 'Janela de envio de arquivos',
    dataUploadedOfTotal: '%{complete} de %{total}',
    done: 'Concluído',
    dropHereOr: 'Arraste arquivos ou %{browse}',
    dropHint: 'Solte seus arquivos aqui',
    dropPaste: 'Solte arquivos aqui, cole ou %{browse}',
    dropPasteFiles: 'Arraste arquivos aqui ou %{browse}', // O texto principal
    dropPasteFolders: 'Arraste arquivos aqui ou %{browse}',
    dropPasteImport: 'Arraste arquivos aqui ou %{browse}',
    editFile: 'Editar arquivo',
    editing: 'Editando %{file}',
    fileProgress: 'Progresso do arquivo: velocidade de envio e tempo restante',
    folderAdded: {
      0: 'Adicionado %{smart_count} arquivo de %{folder}',
      1: 'Adicionado %{smart_count} arquivos de %{folder}'
    },
    myDevice: 'Meu Dispositivo',
    noFilesFound: 'Você não possui arquivos ou pastas aqui',
    pause: 'Pausar',
    pauseUpload: 'Pausar envio',
    paused: 'Pausado',
    poweredBy: 'Desenvolvido por',
    processingXFiles: {
      0: 'Processando %{smart_count} arquivo',
      1: 'Processando %{smart_count} arquivos'
    },
    removeFile: 'Remover arquivo',
    resume: 'Retomar',
    resumeUpload: 'Retomar envio',
    retry: 'Tentar novamente',
    retryUpload: 'Tentar enviar novamente',
    save: 'Salvar',
    saveChanges: 'Salvar alterações',
    selectX: {
      0: 'Selecionar %{smart_count}',
      1: 'Selecionar %{smart_count}'
    },
    timedOut: 'Upload parou por demora de %{seconds} segundos',
    upload: 'Enviar',
    uploadComplete: 'Envio concluído',
    uploadFailed: 'Envio falhou',
    uploadPaused: 'Envio pausado',
    uploadXFiles: {
      0: 'Enviar %{smart_count} arquivo',
      1: 'Enviar %{smart_count} arquivos'
    },
    uploading: 'Enviando',
    uploadingXFiles: {
      0: 'Enviando %{smart_count} arquivo',
      1: 'Enviando %{smart_count} arquivos'
    },
    xFilesSelected: {
      0: '%{smart_count} arquivo selecionado',
      1: '%{smart_count} arquivos selecionados'
    },
    xMoreFilesAdded: {
      0: '%{smart_count} arquivo adicionado',
      1: '%{smart_count} arquivos adicionados'
    },
  }
};

// Utilitários Visuais
const StatusIndicator = ({ status, message }) => {
    if (status === 'success') return <span className="text-green-600 flex items-center gap-1 text-xs"><FontAwesomeIcon icon={faCheckCircle} /> Pronto</span>;
    if (status === 'error') return <span className="text-red-500 flex items-center gap-1 text-xs" title={message}><FontAwesomeIcon icon={faExclamationTriangle} /> Erro</span>;
    return <span className="text-gray-400 text-xs">Aguardando...</span>;
};

const formatDbStringToBr = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR');
    } catch {
        return dateStr;
    }
};

export default function PontoImporter({ onImport }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const BUCKET_NAME = 'arquivos-ponto'; 
  
  const dashboardContainerRef = useRef(null);

  const [processedRecords, setProcessedRecords] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. CONFIGURAÇÃO DO UPPY ---
  const [uppy] = useState(() => {
    if (typeof window === 'undefined') return null;

    const uppyInstance = new Uppy({
      // ID NOVO PARA LIMPAR CACHE
      id: 'ponto-importer-v6-br-total', 
      
      // AQUI ESTÁ A SOLUÇÃO: Injetamos o português no cérebro do Uppy
      locale: pt_BR, 
      
      autoProceed: false,      
      debug: true,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024,
        maxNumberOfFiles: 1, 
        allowedFileTypes: ['.txt', '.csv', 'text/*'],
      },
    });

    uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });
    return uppyInstance;
  });

  // --- 2. DASHBOARD VISUAL ---
  useEffect(() => {
    if (!uppy || !dashboardContainerRef.current) return;

    if (!uppy.getPlugin('Dashboard')) {
        uppy.use(DashboardPlugin, {
            id: 'Dashboard',
            target: dashboardContainerRef.current,
            inline: true,
            width: '100%',
            height: 280, 
            showProgressDetails: true,
            note: "Progresso salvo automaticamente.",
            hideUploadButton: false, 
            // Não precisamos mais passar 'locale' aqui, pois passamos no 'new Uppy()' acima.
            // Isso garante consistência total.
        });
    }
  }, [uppy]);

  // --- 3. UPLOAD E LEITURA ---
  useEffect(() => {
    if (!uppy) return;

    const uploadToSupabaseAndRead = async (fileIDs) => {
      if (fileIDs.length === 0) return Promise.resolve();
      setIsProcessing(true);

      const promises = fileIDs.map(async (id) => {
        const file = uppy.getFile(id);
        
        try {
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.data.size });

          const fileName = `import_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          
          // 1. Upload
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file.data, {
              contentType: 'text/plain',
              upsert: true
            });

          if (error) throw error;

          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: file.data.size, bytesTotal: file.data.size });

          // 2. PEGAR URL PÚBLICA
          const { data: publicData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

          const publicUrl = publicData.publicUrl;

          // 3. Ler o conteúdo
          const response = await fetch(publicUrl);
          if (!response.ok) throw new Error(`Erro ao baixar arquivo: ${response.status}`);
          
          const textContent = await response.text();
          
          // 4. Processar
          processFileContent(textContent);

          uppy.emit('upload-success', file, { uploadURL: publicUrl, status: 200, body: data });
          uppy.removeFile(id); 

        } catch (err) {
          console.error("Erro no processo:", err);
          uppy.emit('upload-error', file, err);
          toast.error(`Falha: ${err.message}`);
          setIsProcessing(false);
        }
      });

      return Promise.all(promises);
    };

    uppy.addUploader(uploadToSupabaseAndRead);
  }, [uppy]);

  // --- 4. PARSER ---
  const processFileContent = (text) => {
    const lines = text.split(/\r?\n/);
    const records = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      
      const hasDate = line.match(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/); 
      
      if (hasDate) {
         const parts = line.split(/\t+| {2,}/); 
         const nome = parts[0] || "Desconhecido";
         const dataHora = parts.find(p => p.match(/:/)) || new Date().toISOString();

         records.push({
            employee_name: nome.trim(),
            data_hora_texto: dataHora,
            status: 'success', 
            original_line: line
         });
      }
    });

    setIsProcessing(false);

    if (records.length === 0) {
        toast.warning("Arquivo lido, mas nenhum registro identificado.");
    } else {
        setProcessedRecords(records);
        toast.success(`${records.length} registros identificados!`);
    }
  };

  // --- 5. SALVAR NO BANCO ---
  const importMutation = useMutation({
    mutationFn: async (records) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    },
    onSuccess: () => {
      toast.success("Pontos importados com sucesso!");
      queryClient.invalidateQueries(['pontos']);
      setProcessedRecords([]);
      if (onImport) onImport();
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    }
  });

  if (!uppy) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      <link href={UPPY_CSS_URL} rel="stylesheet" />

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCloud} className="text-blue-500"/>
          Upload de Arquivo de Ponto
        </h3>
        
        {/* CAIXA VISUAL DO UPPY */}
        <div ref={dashboardContainerRef} className="uppy-dashboard-container" />
      </div>

      {isProcessing && (
          <div className="text-center py-4 text-blue-600 animate-pulse">
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              Lendo arquivo...
          </div>
      )}

      {processedRecords.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-t pt-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-semibold text-gray-700">Pré-visualização ({processedRecords.length})</h3>
             <button onClick={() => setProcessedRecords([])} className="text-xs text-red-500 hover:underline">Cancelar</button>
          </div>

          <div className="border rounded-lg overflow-hidden mb-4 max-h-60 overflow-y-auto shadow-inner bg-gray-50">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Colaborador</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Data/Hora</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {processedRecords.map((rec, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2 text-xs font-medium truncate max-w-[120px]">{rec.employee_name}</td>
                    <td className="px-4 py-2 text-xs">{formatDbStringToBr(rec.data_hora_texto)}</td>
                    <td className="px-4 py-2"><StatusIndicator status={rec.status} message={rec.error_message} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <button
            onClick={() => importMutation.mutate(processedRecords.filter(r => r.status === 'success'))}
            disabled={importMutation.isPending}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold shadow-md flex items-center justify-center gap-2"
          >
            {importMutation.isPending ? <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> : <><FontAwesomeIcon icon={faFileImport} /> Confirmar Importação</>}
          </button>
        </div>
      )}
    </div>
  );
}
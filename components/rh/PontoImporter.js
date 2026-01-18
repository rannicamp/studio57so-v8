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

// --- UPPY CORE & PLUGINS (Igual ao UploadFotosRdo) ---
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';
import GoldenRetriever from '@uppy/golden-retriever';

// CSS OBRIGATÓRIO (Linkado no JSX)
const UPPY_CSS_URL = "https://releases.transloadit.com/uppy/v5.2.1/uppy.min.css";

// Utilitários
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
  const BUCKET_NAME = 'arquivos-ponto'; // Seu bucket de ponto
  
  // Referência para o Dashboard (A caixa visual)
  const dashboardContainerRef = useRef(null);

  // Estados de Dados
  const [processedRecords, setProcessedRecords] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. CONFIGURAÇÃO DO UPPY (Igual ao seu sucesso) ---
  const [uppy] = useState(() => {
    if (typeof window === 'undefined') return null;

    const uppyInstance = new Uppy({
      id: 'ponto-importer-v2', // ID único
      autoProceed: false,      // Deixa o usuário confirmar visualmente
      debug: true,
      restrictions: {
        maxFileSize: 10 * 1024 * 1024,
        maxNumberOfFiles: 1, // Apenas 1 arquivo de ponto por vez
        allowedFileTypes: ['.txt', '.csv', 'text/*'],
      },
    });

    // O SALVA-VIDAS (Recuperação de Crash)
    uppyInstance.use(GoldenRetriever, { serviceWorker: false, indexedDB: true });

    return uppyInstance;
  });

  // --- 2. MONTAGEM DO DASHBOARD (A Mágica Visual) ---
  useEffect(() => {
    if (!uppy || !dashboardContainerRef.current) return;

    if (!uppy.getPlugin('Dashboard')) {
        uppy.use(DashboardPlugin, {
            id: 'Dashboard',
            target: dashboardContainerRef.current,
            inline: true,
            width: '100%',
            height: 250, // Um pouco menor que o do RDO
            showProgressDetails: true,
            note: "Se o celular fechar, o arquivo volta aqui.",
            hideUploadButton: false, 
            locale: {
                strings: {
                    dropPasteFiles: 'Arraste o arquivo de ponto ou %{browse}',
                    browse: 'busque aqui',
                    addMore: 'Trocar arquivo',
                    cancel: 'Cancelar',
                    xFilesSelected: {
                        0: '%{smart_count} arquivo selecionado',
                        1: '%{smart_count} arquivo selecionado'
                    },
                }
            }
        });
    }
  }, [uppy]);

  // --- 3. CONECTOR UPPY -> SUPABASE + LEITURA ---
  useEffect(() => {
    if (!uppy) return;

    // Remove uploaders antigos para não duplicar
    const existingUploaders = uppy.getPlugin('uploader'); 
    // Nota: Uppy core não expõe fácil remoção de addUploader, mas como recriamos o Uppy no state, tá seguro.

    const uploadToSupabaseAndRead = async (fileIDs) => {
      if (fileIDs.length === 0) return Promise.resolve();
      setIsProcessing(true);

      const promises = fileIDs.map(async (id) => {
        const file = uppy.getFile(id);
        
        try {
          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: 0, bytesTotal: file.data.size });

          // 1. Upload para o Bucket
          const fileName = `import_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
          
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file.data, {
              contentType: 'text/plain',
              upsert: true
            });

          if (error) throw error;

          uppy.emit('upload-progress', file, { uploader: uppy, bytesUploaded: file.data.size, bytesTotal: file.data.size });

          // 2. Pegar URL Pública para ler o conteúdo
          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

          // 3. Ler o conteúdo (Fetch direto da URL do Supabase)
          // Isso evita carregar o arquivo na memória do celular antes do upload
          const response = await fetch(publicUrl);
          const textContent = await response.text();
          
          // 4. Processar o texto
          processFileContent(textContent);

          uppy.emit('upload-success', file, { uploadURL: publicUrl, status: 200, body: data });
          
          // Remove do visual para mostrar que acabou
          uppy.removeFile(id); 

        } catch (err) {
          console.error("Erro no processo:", err);
          uppy.emit('upload-error', file, err);
          toast.error(`Falha: ${err.message}`);
          setIsProcessing(false);
          throw err;
        }
      });

      return Promise.all(promises);
    };

    uppy.addUploader(uploadToSupabaseAndRead);

  }, [uppy]);

  // --- 4. LÓGICA DE PARSING (Texto -> Tabela) ---
  const processFileContent = (text) => {
    const lines = text.split(/\r?\n/);
    const records = [];

    lines.forEach((line) => {
      if (!line.trim()) return;
      
      const hasDate = line.match(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/); 
      
      if (hasDate) {
         // Ajuste aqui conforme seu layout real
         const parts = line.split(/\t+| {2,}/); 
         const nome = parts[0] || "Desconhecido";
         
         const dataHoraMatch = line.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})|(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
         const dataHora = dataHoraMatch ? dataHoraMatch[0] : new Date().toISOString();

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
        toast.warning("Arquivo enviado, mas nenhum ponto identificado.");
    } else {
        setProcessedRecords(records);
        toast.success(`${records.length} registros identificados!`);
    }
  };

  // --- 5. SALVAR NO BANCO (Final) ---
  const importMutation = useMutation({
    mutationFn: async (records) => {
      // Simulação
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


  // --- RENDERIZAÇÃO ---
  if (!uppy) return null;

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
      <link href={UPPY_CSS_URL} rel="stylesheet" />

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCloud} className="text-blue-500"/>
          Upload de Arquivo de Ponto
        </h3>
        
        {/* CAIXA VISUAL DO UPPY (Igual ao RDO) */}
        <div ref={dashboardContainerRef} className="uppy-dashboard-container" />
      </div>

      {/* ÁREA DE CARREGAMENTO */}
      {isProcessing && (
          <div className="text-center py-4 text-blue-600 animate-pulse">
              <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
              Lendo arquivo do servidor...
          </div>
      )}

      {/* TABELA DE PRÉ-VISUALIZAÇÃO */}
      {processedRecords.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-t pt-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-semibold text-gray-700">Pré-visualização ({processedRecords.length})</h3>
             <button 
                onClick={() => setProcessedRecords([])}
                className="text-xs text-red-500 hover:underline"
             >
                Cancelar
             </button>
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
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            {importMutation.isPending ? (
                <><FontAwesomeIcon icon={faSpinner} spin /> Salvando...</> 
            ) : (
                <><FontAwesomeIcon icon={faFileImport} /> Confirmar Importação</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}